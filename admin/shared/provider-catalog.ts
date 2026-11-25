export type ModelProvider = 'deepseek' | 'opencode-go';
export const MODEL_ID = /^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,127}$/;
export const EFFORTS = ['default', 'none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'] as const;
export type ReasoningEffort = typeof EFFORTS[number];
export type ProviderModel = { id: string; name: string; efforts: ReasoningEffort[] };

const CATALOG_URLS: Record<ModelProvider, string> = {
  deepseek: 'https://api.deepseek.com/models',
  'opencode-go': 'https://opencode.ai/inference/go/v1/models',
};

const CATALOG_ERROR = '暂时无法读取供应商模型列表，请稍后重试。';

type CatalogItem = {
  id?: unknown;
  name?: unknown;
  type?: unknown;
  input_modalities?: unknown;
  output_modalities?: unknown;
  effort?: { supported_levels?: unknown };
  modalities?: { input?: unknown; output?: unknown };
  api?: Record<string, unknown>;
  capabilities?: { reasoning?: { effort?: unknown; toggle?: unknown } };
  efforts?: unknown;
};

function options(levels: unknown): ReasoningEffort[] {
  const efforts = new Set<ReasoningEffort>(['default']);
  if (Array.isArray(levels)) {
    for (const level of levels) {
      if (typeof level === 'string' && EFFORTS.includes(level as ReasoningEffort)) {
        efforts.add(level as ReasoningEffort);
      }
    }
  }
  return [...efforts];
}

function isText(modalities: unknown) {
  return Array.isArray(modalities) && modalities.includes('text');
}

function modelList(value: unknown, effortsFor: (item: CatalogItem) => ReasoningEffort[] | undefined): ProviderModel[] {
  if (!Array.isArray(value)) throw new Error(CATALOG_ERROR);
  const models = new Map<string, ProviderModel>();
  for (const item of value as CatalogItem[]) {
    if (typeof item?.id !== 'string' || !MODEL_ID.test(item.id) || models.has(item.id)) continue;
    const efforts = effortsFor(item);
    if (!efforts) continue;
    const name = typeof item.name === 'string' ? item.name.trim() : '';
    models.set(item.id, { id: item.id, name: name || item.id, efforts });
  }
  return [...models.values()];
}

export function decodeProviderCatalog(value: unknown): ProviderModel[] {
  return modelList(value, item => Array.isArray(item.efforts) ? options(item.efforts) : undefined);
}

function deepseekEfforts(item: CatalogItem): ReasoningEffort[] | undefined {
  // DeepSeek's modality and effort fields can be absent on older model entries.
  if ((item.input_modalities !== undefined && !isText(item.input_modalities)) ||
      (item.output_modalities !== undefined && !isText(item.output_modalities))) return undefined;
  const efforts = options(item.effort?.supported_levels);
  if (efforts.length > 1 && !efforts.includes('none')) efforts.splice(1, 0, 'none');
  return efforts;
}

function openCodeEfforts(item: CatalogItem): ReasoningEffort[] | undefined {
  if (item.type !== 'chat' || !item.api?.['chat-completions'] ||
      !isText(item.modalities?.input) || !isText(item.modalities?.output)) return undefined;
  const reasoning = item.capabilities?.reasoning;
  const efforts = options(reasoning?.effort);
  // The Go catalog can omit the toggle advertised for this model in OpenCode's model catalog.
  const canDisable = reasoning?.toggle === true || (reasoning?.toggle === undefined && item.id === 'deepseek-v4.1-flash');
  if (canDisable && !efforts.includes('none')) efforts.splice(1, 0, 'none');
  return efforts;
}

export async function fetchProviderCatalog(provider: ModelProvider, key?: string): Promise<ProviderModel[]> {
  if (provider === 'deepseek' && !key) throw new Error('请先配置 DeepSeek 密钥。');
  let response: Response;
  try {
    response = await fetch(CATALOG_URLS[provider], {
      headers: key ? { Authorization: `Bearer ${key}` } : undefined,
      cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(5000),
    });
  } catch {
    throw new Error(CATALOG_ERROR);
  }
  if (response.status === 401 || response.status === 403) throw new Error('密钥未通过供应商的模型列表验证。');
  if (!response.ok) throw new Error(CATALOG_ERROR);
  const payload = await response.json().catch(() => null) as { data?: unknown } | null;
  return modelList(payload?.data, provider === 'deepseek' ? deepseekEfforts : openCodeEfforts);
}
