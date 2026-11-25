import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { decodeProviderCatalog, EFFORTS, fetchProviderCatalog, MODEL_ID, type ModelProvider, type ProviderModel, type ReasoningEffort } from './provider-catalog';

export type { ModelProvider, ReasoningEffort } from './provider-catalog';
export type ModelSelection = { provider: ModelProvider; model: string; effort: ReasoningEffort };
export type ProviderCredentialEntry = { id: string; label: string; suffix: string; enabled: boolean };
type ProviderCredentialRow = ProviderCredentialEntry & { encrypted_key: string; provider: ModelProvider };
type CredentialOperation = 'primary' | 'enable' | 'disable';

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

function credentialContext(provider: ModelProvider, id?: string) {
  return Buffer.from(`${deploymentScope()}:${provider}${id ? `:${id}` : ''}`);
}

function decryptCredential(encrypted: string, key: Buffer, context: Buffer) {
  try {
    const [iv, tag, data] = encrypted.split('.').map(part => Buffer.from(part, 'base64url'));
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAAD(context);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  } catch { return undefined; }
}

async function readManagedCredentials(db: Pool, provider?: ModelProvider) {
  try {
    const { rows } = await db.query<ProviderCredentialRow>(`SELECT provider, id, label, suffix, enabled, encrypted_key
      FROM tianjipan_provider_keys WHERE environment = $1 AND ($2::text IS NULL OR provider = $2)
      ORDER BY enabled DESC, primary_at DESC NULLS LAST, created_at, id`, [deploymentScope(), provider ?? null]);
    return rows;
  } catch (error) {
    if (postgresCode(error) === '42P01') return [];
    throw new Error('暂时无法读取供应商密钥，请稍后重试。');
  }
}

async function readLegacyCredential(db: Pool, provider: ModelProvider, encryptionKey: Buffer) {
  try {
    const { rows } = await db.query<{ encrypted_key: string }>(
      'SELECT encrypted_key FROM tianjipan_provider_credentials WHERE environment = $1 AND provider = $2',
      [deploymentScope(), provider]);
    const encrypted = rows[0]?.encrypted_key;
    return encrypted ? decryptCredential(encrypted, encryptionKey, credentialContext(provider)) : undefined;
  } catch { return undefined; }
}

async function readProviderCredentials(provider: ModelProvider): Promise<string[]> {
  const encryptionKey = deriveSettingsKey('tianjipan/provider-credentials/v1');
  const db = encryptionKey && database();
  const environmentKey = providerEnvKey(provider);
  if (!db || !encryptionKey) return environmentKey ? [environmentKey] : [];
  const [managed, legacy] = await Promise.all([
    readManagedCredentials(db, provider).catch(() => []), readLegacyCredential(db, provider, encryptionKey),
  ]);
  const decrypted = managed.map(row => ({ enabled: row.enabled, key: decryptCredential(row.encrypted_key, encryptionKey, credentialContext(provider, row.id)) }));
  const enabled = decrypted.filter(row => row.enabled).map(row => row.key);
  const disabled = new Set(decrypted.filter(row => !row.enabled).map(row => row.key));
  const fallback = [legacy, environmentKey].filter(key => !disabled.has(key));
  return [...new Set([...enabled, ...fallback].filter((key): key is string => Boolean(key)))];
}

export async function providerCredentialEntries(): Promise<Record<ModelProvider, ProviderCredentialEntry[]>> {
  const result: Record<ModelProvider, ProviderCredentialEntry[]> = { deepseek: [], 'opencode-go': [] };
  const db = database();
  if (!db) return result;
  for (const { provider, id, label, suffix, enabled } of await readManagedCredentials(db)) {
    result[provider].push({ id, label, suffix, enabled });
  }
  return result;
}

export async function providerCredentialStatuses(): Promise<Record<ModelProvider, boolean>> {
  const [deepseek, go] = await Promise.all([readProviderCredentials('deepseek'), readProviderCredentials('opencode-go')]);
  return { deepseek: deepseek.length > 0, 'opencode-go': go.length > 0 };
}

export async function readRuntimeModelConfiguration(): Promise<{ selection: ModelSelection; keys: string[] }> {
  const selection = await readRuntimeSelection();
  return { selection, keys: await readProviderCredentials(selection.provider) };
}

export async function readRuntimeModelSelection(): Promise<ModelSelection> {
  return (await readRuntimeModelConfiguration()).selection;
}

const catalogs = new Map<ModelProvider, { identity: string; models: ProviderModel[]; fetchedAt: number }>();

async function fetchCatalogs(provider: ModelProvider, keys: string[]) {
  if (!keys.length) return fetchProviderCatalog(provider);
  const catalogs = await Promise.allSettled(keys.map(key => fetchProviderCatalog(provider, key)));
  const models = new Map<string, ProviderModel>();
  for (const catalog of catalogs) {
    if (catalog.status === 'rejected') continue;
    for (const model of catalog.value) {
      const previous = models.get(model.id);
      const efforts = previous ? [...new Set([...previous.efforts, ...model.efforts])] : model.efforts;
      models.set(model.id, { ...model, name: previous?.name ?? model.name, efforts });
    }
  }
  return [...models.values()];
}

export async function listProviderModels(provider: ModelProvider, allowRelay = true): Promise<ProviderModel[]> {
  const keys = await readProviderCredentials(provider);
  const relay = allowRelay ? process.env.MODEL_CATALOG_URL : undefined;
  const token = relay && modelCatalogAccessToken();
  if ((!allowRelay && !keys.length) || (relay && !token)) throw new Error('尚未配置供应商密钥。');
  const identity = createHash('sha256').update(JSON.stringify([keys, relay, token])).digest('hex');
  const cached = catalogs.get(provider);
  const matching = cached?.identity === identity ? cached : undefined;
  if (matching && Date.now() - matching.fetchedAt < 5 * 60 * 1000) return matching.models;
  try {
    let models: ProviderModel[] = [];
    if (relay && token) {
      try {
        const url = new URL(relay);
        url.searchParams.set('provider', provider);
        const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(8000) });
        if (response.ok) models = decodeProviderCatalog((await response.json()).models);
      } catch { /* Direct credentials can keep the catalogue available during a relay outage. */ }
    }
    if (!models.length && (!relay || keys.length)) models = await fetchCatalogs(provider, keys);
    if (!models.length) throw new Error();
    catalogs.set(provider, { identity, models, fetchedAt: Date.now() });
    return models;
  } catch {
    if (matching && Date.now() - matching.fetchedAt < 30 * 60 * 1000) return matching.models;
    throw new Error('暂时无法读取官方模型列表，请稍后重试。');
  }
}

export async function addProviderCredential(provider: ModelProvider, value: string, label: string): Promise<void> {
  const key = value.trim();
  if (!key || key.length > 512 || /[\u0000-\u0020\u007f]/.test(key)) throw new Error('请输入有效的 API 密钥。');
  const name = label.trim() || 'API 密钥';
  if (name.length > 48) throw new Error('密钥名称最多 48 个字符。');
  const encryptionKey = deriveSettingsKey('tianjipan/provider-credentials/v1');
  const fingerprintKey = deriveSettingsKey('tianjipan/provider-credential-fingerprints/v1');
  const db = database();
  if (!encryptionKey || !fingerprintKey || !db) throw new Error('密钥存储尚未配置。');
  if ((await readProviderCredentials(provider)).includes(key)) throw new Error('这把密钥已配置。');
  const models = await fetchProviderCatalog(provider, key);
  if (!models.length) throw new Error('这把密钥没有可用的文本解读模型。');
  const id = randomUUID();
  const context = credentialContext(provider, id);
  const fingerprint = createHmac('sha256', fingerprintKey).update(credentialContext(provider)).update('\0').update(key).digest('hex');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey, iv);
  cipher.setAAD(context);
  const ciphertext = Buffer.concat([cipher.update(key, 'utf8'), cipher.final()]);
  const encrypted = [iv, cipher.getAuthTag(), ciphertext].map(part => part.toString('base64url')).join('.');
  try {
    await db.query(`CREATE TABLE IF NOT EXISTS tianjipan_provider_keys (
      id uuid PRIMARY KEY, environment text NOT NULL, provider text NOT NULL,
      label text NOT NULL, suffix text NOT NULL, encrypted_key text NOT NULL, fingerprint text NOT NULL,
      enabled boolean NOT NULL DEFAULT true, primary_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT clock_timestamp(), UNIQUE(environment, provider, fingerprint)
    )`).catch(error => {
      if (postgresCode(error) !== '23505') throw error;
    });
    await db.query(`INSERT INTO tianjipan_provider_keys (id, environment, provider, label, suffix, encrypted_key, fingerprint)
      VALUES ($1, $2, $3, $4, $5, $6, $7)`, [id, deploymentScope(), provider, name, key.length >= 12 ? key.slice(-4) : '', encrypted, fingerprint]);
  } catch (error) {
    if (postgresCode(error) === '23505') throw new Error('这把密钥已配置。');
    throw new Error('密钥保存失败，请稍后重试。');
  }
  catalogs.delete(provider);
}

const credentialUpdates = {
  primary: 'SET primary_at = clock_timestamp() WHERE enabled AND',
  enable: 'SET enabled = true WHERE',
  disable: 'SET enabled = false WHERE',
} satisfies Record<CredentialOperation, string>;

export async function updateProviderCredential(provider: ModelProvider, id: string, operation: CredentialOperation): Promise<void> {
  if (!/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i.test(id)) throw new Error('找不到这把密钥。');
  const db = database();
  if (!db || !providerKeySettingsAvailable()) throw new Error('密钥存储尚未配置。');
  const update = credentialUpdates[operation];
  let updated: number | null;
  try {
    const result = await db.query(`UPDATE tianjipan_provider_keys ${update} environment = $1 AND provider = $2 AND id = $3`,
      [deploymentScope(), provider, id]);
    updated = result.rowCount;
  } catch { throw new Error('密钥设置保存失败，请稍后重试。'); }
  if (!updated) throw new Error('找不到可更新的密钥。');
  catalogs.delete(provider);
}

export async function saveModelSelection(selection: ModelSelection): Promise<ModelSelection> {
  if (!isSelection(selection)) throw new Error('请选择有效的供应商、模型和思考程度。');
  if (!providerAvailable(selection.provider) && !(await readProviderCredentials(selection.provider)).length) throw new Error('请先配置 OpenCode Go 凭据。');
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
