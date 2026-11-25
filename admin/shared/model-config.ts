import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from 'node:crypto';
import { Pool } from 'pg';
import { decodeProviderCatalog, EFFORTS, fetchProviderCatalog, MODEL_ID, type ModelProvider, type ProviderModel, type ReasoningEffort } from './provider-catalog';

export type { ModelProvider, ReasoningEffort } from './provider-catalog';
export type ModelSelection = { provider: ModelProvider; model: string; effort: ReasoningEffort };

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

export function providerKeySettingsAvailable() {
  return modelSettingsAvailable() && Boolean(process.env.MODEL_SETTINGS_SECRET);
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

async function readRuntimeSelection(): Promise<ModelSelection> {
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
  return selection;
}

function deriveSettingsKey(purpose: string) {
  const secret = process.env.MODEL_SETTINGS_SECRET;
  return secret ? createHmac('sha256', secret).update(purpose).digest() : undefined;
}

export function modelCatalogAccessToken() {
  return deriveSettingsKey('tianjipan/model-catalog/v1')?.toString('base64url');
}

function providerEnvKey(provider: ModelProvider) {
  return provider === 'deepseek' ? process.env.DEEPSEEK_API_KEY : process.env.OPENCODE_GO_API_KEY;
}

function credentialContext(provider: ModelProvider) {
  return Buffer.from(`${deploymentScope()}:${provider}`);
}

async function readProviderCredential(provider: ModelProvider) {
  const encryptionKey = deriveSettingsKey('tianjipan/provider-credentials/v1');
  const db = encryptionKey && database();
  if (db && encryptionKey) {
    try {
      const { rows } = await db.query<{ encrypted_key: string }>(
        'SELECT encrypted_key FROM tianjipan_provider_credentials WHERE environment = $1 AND provider = $2',
        [deploymentScope(), provider]);
      const encrypted = rows[0]?.encrypted_key;
      if (encrypted) {
        const [iv, tag, data] = encrypted.split('.').map(part => Buffer.from(part, 'base64url'));
        const decipher = createDecipheriv('aes-256-gcm', encryptionKey, iv);
        decipher.setAAD(credentialContext(provider));
        decipher.setAuthTag(tag);
        return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
      }
    } catch { /* Fall back to the deployment credential if the settings store is unavailable. */ }
  }
  return providerEnvKey(provider);
}

export async function providerCredentialStatuses(): Promise<Record<ModelProvider, boolean>> {
  const [deepseek, go] = await Promise.all([readProviderCredential('deepseek'), readProviderCredential('opencode-go')]);
  return { deepseek: Boolean(deepseek), 'opencode-go': Boolean(go) };
}

export async function readRuntimeModelConfiguration() {
  const selection = await readRuntimeSelection();
  const key = await readProviderCredential(selection.provider);
  if (selection.provider === 'opencode-go' && !key) {
    return { selection: defaultSelection(), key: await readProviderCredential('deepseek') };
  }
  return { selection, key };
}

export async function readRuntimeModelSelection(): Promise<ModelSelection> {
  return (await readRuntimeModelConfiguration()).selection;
}

const catalogs = new Map<ModelProvider, { identity: string; models: ProviderModel[]; fetchedAt: number }>();

export async function listProviderModels(provider: ModelProvider, allowRelay = true): Promise<ProviderModel[]> {
  const key = await readProviderCredential(provider);
  const relay = !key && allowRelay ? process.env.MODEL_CATALOG_URL : undefined;
  const token = relay && modelCatalogAccessToken();
  if ((!allowRelay && !key) || (relay && !token)) throw new Error('尚未配置供应商密钥。');
  const identity = createHash('sha256').update(key ?? `${relay ?? ''}\n${token ?? ''}`).digest('hex');
  const cached = catalogs.get(provider);
  const matching = cached?.identity === identity ? cached : undefined;
  if (matching && Date.now() - matching.fetchedAt < 5 * 60 * 1000) return matching.models;
  try {
    let models: ProviderModel[];
    if (relay && token) {
      const url = new URL(relay);
      url.searchParams.set('provider', provider);
      const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(8000) });
      if (!response.ok) throw new Error();
      models = decodeProviderCatalog((await response.json()).models);
    } else {
      models = await fetchProviderCatalog(provider, key);
    }
    if (!models.length) throw new Error();
    catalogs.set(provider, { identity, models, fetchedAt: Date.now() });
    return models;
  } catch {
    if (matching && Date.now() - matching.fetchedAt < 30 * 60 * 1000) return matching.models;
    throw new Error('暂时无法读取官方模型列表，请稍后重试。');
  }
}

export async function saveProviderCredential(provider: ModelProvider, value: string): Promise<void> {
  const key = value.trim();
  if (!key || key.length > 512 || /[\u0000-\u0020\u007f]/.test(key)) throw new Error('请输入有效的 API 密钥。');
  const encryptionKey = deriveSettingsKey('tianjipan/provider-credentials/v1');
  const db = database();
  if (!encryptionKey || !db) throw new Error('密钥存储尚未配置。');
  const models = await fetchProviderCatalog(provider, key);
  if (!models.length) throw new Error('这把密钥没有可用的文本解读模型。');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey, iv);
  cipher.setAAD(credentialContext(provider));
  const ciphertext = Buffer.concat([cipher.update(key, 'utf8'), cipher.final()]);
  const encrypted = [iv, cipher.getAuthTag(), ciphertext].map(part => part.toString('base64url')).join('.');
  try {
    await db.query(`CREATE TABLE IF NOT EXISTS tianjipan_provider_credentials (
      environment text NOT NULL, provider text NOT NULL, encrypted_key text NOT NULL,
      PRIMARY KEY(environment, provider)
    )`).catch(error => {
      if (postgresCode(error) !== '23505') throw error;
    });
    await db.query(`INSERT INTO tianjipan_provider_credentials (environment, provider, encrypted_key)
      VALUES ($1, $2, $3) ON CONFLICT (environment, provider) DO UPDATE SET encrypted_key = EXCLUDED.encrypted_key`,
      [deploymentScope(), provider, encrypted]);
  } catch {
    throw new Error('密钥保存失败，请稍后重试。');
  }
  const identity = createHash('sha256').update(key).digest('hex');
  catalogs.set(provider, { identity, models, fetchedAt: Date.now() });
}

export async function saveModelSelection(selection: ModelSelection): Promise<ModelSelection> {
  if (!isSelection(selection)) throw new Error('请选择有效的供应商、模型和思考程度。');
  if (!providerAvailable(selection.provider) && !(await readProviderCredential(selection.provider))) throw new Error('请先配置 OpenCode Go 凭据。');
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
