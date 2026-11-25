import { Pool } from 'pg';

export type ModelProvider = 'deepseek' | 'opencode-go';
const EFFORTS = ['default', 'none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'] as const;
export type ReasoningEffort = typeof EFFORTS[number];
export type ModelSelection = { provider: ModelProvider; model: string; effort: ReasoningEffort };
type ProviderModel = { id: string; name: string; efforts: ReasoningEffort[] };

const MODEL_ID = /^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,127}$/;
const GO_MODELS_URL = 'https://opencode.ai/inference/go/v1/models';
const DEEPSEEK_EFFORTS: ReasoningEffort[] = ['default', 'none', 'low', 'high', 'max'];
const DEEPSEEK_MODELS: ProviderModel[] = [
  { id: 'deepseek-flash', name: 'DeepSeek V4.1 Flash', efforts: DEEPSEEK_EFFORTS },
  { id: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro', efforts: DEEPSEEK_EFFORTS },
];

function isEffort(value: unknown): value is ReasoningEffort {
  return typeof value === 'string' && EFFORTS.includes(value as ReasoningEffort);
}

function isSelection(value: unknown): value is ModelSelection {
  if (!value || typeof value !== 'object') return false;
  const { provider, model, effort } = value as Partial<ModelSelection>;
  return (provider === 'deepseek' || provider === 'opencode-go') &&
    typeof model === 'string' && MODEL_ID.test(model) && isEffort(effort);
}

function defaultSelection(): ModelSelection {
  return { provider: 'deepseek', model: process.env.DEEPSEEK_MODEL || 'deepseek-flash', effort: 'default' };
}

function databaseUrl() {
  return process.env.MODEL_SETTINGS_DATABASE_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL;
}

function deploymentScope() {
  if (process.env.VERCEL_ENV === 'production') return 'production';
  if (process.env.VERCEL_ENV === 'preview') return 'preview';
  return 'development';
}

let pool: Pool | undefined;
let poolUrl: string | undefined;
let lastRead: { url: string; scope: string; selection: ModelSelection } | undefined;

function database() {
  const connectionString = databaseUrl();
  if (!connectionString) return undefined;
  if (pool && poolUrl === connectionString) return pool;
  if (pool) void pool.end().catch(() => {});
  pool = new Pool({ connectionString, max: 2, idleTimeoutMillis: 10000, connectionTimeoutMillis: 1800,
    statement_timeout: 2000, query_timeout: 2300, allowExitOnIdle: true });
  pool.on('error', () => {}); // An idle connection may be closed by the database; pg reconnects on demand.
  poolUrl = connectionString;
  return pool;
}

export function modelSettingsAvailable() {
  return Boolean(databaseUrl());
}

export function providerAvailable(provider: ModelProvider) {
  return provider === 'deepseek' || Boolean(process.env.OPENCODE_GO_API_KEY || process.env.OPENCODE_GO_CONFIGURED === '1');
}

function postgresCode(error: unknown) {
  return error && typeof error === 'object' && 'code' in error ? error.code : undefined;
}

export async function readActiveModelSelection(): Promise<ModelSelection> {
  const db = database();
  if (!db) return defaultSelection();
  try {
    const result = await db.query<ModelSelection>(
      'SELECT provider, model, effort FROM tianjipan_model_settings WHERE environment = $1', [deploymentScope()]);
    if (result.rows.length === 0) return defaultSelection();
    if (isSelection(result.rows[0])) return result.rows[0];
  } catch (error) {
    if (postgresCode(error) === '42P01') return defaultSelection(); // The first admin save creates the table.
  }
  throw new Error('暂时无法读取模型设置，请稍后重试。');
}

export async function readRuntimeModelSelection(): Promise<ModelSelection> {
  const url = databaseUrl();
  if (!url) return defaultSelection();
  const scope = deploymentScope();
  let selection: ModelSelection;
  try {
    selection = await readActiveModelSelection();
    lastRead = { url, scope, selection };
  } catch {
    selection = lastRead?.url === url && lastRead.scope === scope ? lastRead.selection : defaultSelection();
  }
  return selection.provider === 'opencode-go' && !process.env.OPENCODE_GO_API_KEY ? defaultSelection() : selection;
}

type GoModel = {
  id?: unknown; name?: unknown; type?: unknown;
  modalities?: { input?: string[]; output?: string[] };
  api?: Record<string, unknown>;
  capabilities?: { reasoning?: { effort?: unknown } };
};

let goCatalog: { models: ProviderModel[]; expires: number } | undefined;

export async function listProviderModels(provider: ModelProvider): Promise<ProviderModel[]> {
  if (provider === 'deepseek') {
    const { model } = defaultSelection();
    return DEEPSEEK_MODELS.some(item => item.id === model) ? DEEPSEEK_MODELS :
      [...DEEPSEEK_MODELS, { id: model, name: model, efforts: ['default'] }];
  }
  if (goCatalog && goCatalog.expires > Date.now()) return goCatalog.models;
  try {
    const response = await fetch(GO_MODELS_URL, { cache: 'no-store', signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error();
    const { data } = await response.json() as { data?: GoModel[] };
    if (!Array.isArray(data)) throw new Error();
    const models = data.flatMap((item): ProviderModel[] => {
      if (item?.type !== 'chat' || typeof item.id !== 'string' || !MODEL_ID.test(item.id) ||
          !item.api?.['chat-completions'] || !item.modalities?.input?.includes('text') ||
          !item.modalities?.output?.includes('text')) return [];
      const choices = item.capabilities?.reasoning?.effort;
      const efforts: ReasoningEffort[] = ['default'];
      if (Array.isArray(choices)) efforts.push(...EFFORTS.filter(choice => choice !== 'default' && choices.includes(choice)));
      return [{ id: item.id, name: typeof item.name === 'string' ? item.name : item.id, efforts }];
    });
    if (!models.length) throw new Error();
    goCatalog = { models, expires: Date.now() + 5 * 60 * 1000 };
    return models;
  } catch {
    if (goCatalog) return goCatalog.models;
    throw new Error('暂时无法读取 OpenCode Go 模型列表，请稍后重试。');
  }
}

export async function saveModelSelection(selection: ModelSelection): Promise<ModelSelection> {
  if (!isSelection(selection)) throw new Error('请选择有效的供应商、模型和思考程度。');
  if (!providerAvailable(selection.provider)) throw new Error('请先配置 OpenCode Go 凭据。');
  const db = database();
  if (!db) throw new Error('模型设置数据库尚未连接。');
  const models = await listProviderModels(selection.provider);
  if (!models.find(item => item.id === selection.model)?.efforts.includes(selection.effort)) {
    throw new Error('该供应商或模型不支持这个组合，请重新选择。');
  }
  try {
    await db.query(`CREATE TABLE IF NOT EXISTS tianjipan_model_settings (
      environment text PRIMARY KEY, provider text NOT NULL, model text NOT NULL, effort text NOT NULL
    )`).catch(error => {
      if (postgresCode(error) !== '23505') throw error; // Another first save may create the table concurrently.
    });
    const { rows } = await db.query<ModelSelection>(`INSERT INTO tianjipan_model_settings (environment, provider, model, effort)
      VALUES ($1, $2, $3, $4) ON CONFLICT (environment) DO UPDATE SET
      provider = EXCLUDED.provider, model = EXCLUDED.model, effort = EXCLUDED.effort
      RETURNING provider, model, effort`, [deploymentScope(), selection.provider, selection.model, selection.effort]);
    return rows[0];
  } catch {
    throw new Error('模型设置保存失败，请稍后重试。');
  }
}
