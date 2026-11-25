import assert from 'node:assert/strict';
import { createCipheriv, createHmac, randomBytes } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { addProviderCredential, listProviderModels, modelCatalogAccessToken, providerCredentialEntries, providerCredentialStatuses, readActiveModelSelection, readRuntimeModelConfiguration, saveModelSelection, updateProviderCredential } from '../../admin/shared/model-config';
import { fetchProviderCatalog } from '../../admin/shared/provider-catalog';
import { GET as readModelCatalog } from '../../app/api/admin/model-catalog/route';

const deepseekKey = 'test-deepseek-environment-credential';
const goKey = 'test-opencode-go-initial-credential';
const nextGoKey = 'test-opencode-go-rotated-credential';
const invalidKey = 'test-invalid-credential';
const legacyKey = 'test-previous-encrypted-legacy-credential';
const goEnvironmentKey = 'test-opencode-go-environment-credential';
const deepseekModel = 'deepseek-test-future-v1';
const goModel = 'go-test-future-v1';
const goFlash = 'deepseek-v4.1-flash';
const remoteCredential = { id: 'environment', label: '环境变量密钥', suffix: 'V3R1', enabled: true, source: 'environment' } as const;

function goItem(id: string, name: string, toggle?: boolean) {
  return { id, name, type: 'chat', modalities: { input: ['text'], output: ['text'] },
    api: { 'chat-completions': {} }, capabilities: { reasoning: { effort: ['max', 'low', 'unknown'], toggle } } };
}

function legacyCiphertext(secret: string, key: string) {
  const iv = randomBytes(12);
  const encryptionKey = createHmac('sha256', secret).update('tianjipan/provider-credentials/v1').digest();
  const cipher = createCipheriv('aes-256-gcm', encryptionKey, iv);
  cipher.setAAD(Buffer.from('preview:opencode-go'));
  const encrypted = Buffer.concat([cipher.update(key), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map(part => part.toString('base64url')).join('.');
}

async function main() {
  const originalFetch = globalThis.fetch;
  const db = await PGlite.create();
  const server = new PGLiteSocketServer({ db, port: 0, host: '127.0.0.1', maxConnections: 10 });
  await server.start();
  process.env.MODEL_SETTINGS_DATABASE_URL = `postgres://postgres:postgres@${server.getServerConn()}/postgres`;
  process.env.DEEPSEEK_MODEL = 'deepseek-flash';
  process.env.DEEPSEEK_API_KEY = deepseekKey;
  process.env.MODEL_SETTINGS_SECRET = 'test-only-key-settings-secret';
  process.env.VERCEL_ENV = 'production';
  delete process.env.OPENCODE_GO_API_KEY;
  delete process.env.OPENCODE_GO_CONFIGURED;
  delete process.env.MODEL_CATALOG_URL;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    const authorization = new Headers(init?.headers).get('authorization');
    if (authorization === `Bearer ${invalidKey}`) return new Response(invalidKey, { status: 401 });
    if (url === 'https://api.deepseek.com/models') {
      assert.equal(authorization, `Bearer ${deepseekKey}`);
      return Response.json({ data: [
        { id: deepseekModel, name: 'Future DeepSeek', input_modalities: ['text', 'image'], output_modalities: ['text'], effort: { supported_levels: ['low', 'max'] } },
        { id: 'speech-only', input_modalities: ['audio'], output_modalities: ['audio'] },
      ] });
    }
    if (url === 'https://opencode.ai/inference/go/v1/models') {
      assert.ok([goKey, nextGoKey, legacyKey, goEnvironmentKey].some(key => authorization === `Bearer ${key}`));
      return Response.json({ data: [
        goItem(goModel, 'Future OpenCode Model'),
        goItem(goFlash, 'DeepSeek V4.1 Flash', authorization === `Bearer ${nextGoKey}` ? false : undefined),
        goItem('go-explicit-toggle', 'OpenCode Model with Toggle', true),
        { id: 'responses-only', type: 'chat', modalities: { input: ['text'], output: ['text'] }, api: { responses: {} } },
        ...(authorization === `Bearer ${nextGoKey}` ? [goItem('go-rotated-catalog-model', 'New model after rotation')] : []),
      ] });
    }
    const relayToken = modelCatalogAccessToken();
    assert.ok(relayToken);
    assert.equal(authorization, `Bearer ${relayToken}`);
    if (url === 'https://catalog.test.local/model-catalog?view=credentials') {
      return Response.json({ credentials: { deepseek: [{ ...remoteCredential, key: 'ignored-raw-field' }], 'opencode-go': [] } });
    }
    assert.equal(url, 'https://catalog.test.local/model-catalog?provider=deepseek');
    return Response.json({ models: [{ id: 'relay-test-model', name: 'Relay model', efforts: ['default'] }] });
  };
  try {
    const defaultModel = { provider: 'deepseek', model: 'deepseek-flash', effort: 'default' } as const;
    assert.deepEqual(await readActiveModelSelection(), defaultModel);
    assert.deepEqual(await listProviderModels('deepseek'), [{ id: deepseekModel, name: 'Future DeepSeek', efforts: ['default', 'none', 'low', 'max'] }]);
    const deepseek = { provider: 'deepseek', model: deepseekModel, effort: 'low' } as const;
    assert.deepEqual(await saveModelSelection(deepseek), deepseek);
    assert.deepEqual(await readRuntimeModelConfiguration(), { selection: deepseek, keys: [deepseekKey] });
    process.env.VERCEL_ENV = 'preview';
    assert.deepEqual(await readActiveModelSelection(), defaultModel);

    const go = { provider: 'opencode-go', model: goModel, effort: 'max' } as const;
    await assert.rejects(saveModelSelection(go), /凭据/);
    await addProviderCredential('opencode-go', goKey, '主账户');
    assert.deepEqual(await listProviderModels('opencode-go'), [
      { id: goModel, name: 'Future OpenCode Model', efforts: ['default', 'max', 'low'] },
      { id: goFlash, name: 'DeepSeek V4.1 Flash', efforts: ['default', 'none', 'max', 'low'] },
      { id: 'go-explicit-toggle', name: 'OpenCode Model with Toggle', efforts: ['default', 'none', 'max', 'low'] },
    ]);
    const noToggleFlash = (await fetchProviderCatalog('opencode-go', nextGoKey)).find(model => model.id === goFlash);
    assert.deepEqual(noToggleFlash?.efforts, ['default', 'max', 'low']);
    const flashWithoutThinking = { ...go, model: goFlash, effort: 'none' } as const;
    assert.deepEqual(await saveModelSelection(flashWithoutThinking), flashWithoutThinking);
    await assert.rejects(saveModelSelection({ ...go, effort: 'medium' }), /不支持/);
    assert.deepEqual(await saveModelSelection(go), go);
    assert.deepEqual(await readActiveModelSelection(), go);
    assert.deepEqual(await readRuntimeModelConfiguration(), { selection: go, keys: [goKey] });
    await assert.rejects(addProviderCredential('opencode-go', invalidKey, '无效'), (error: Error) => /验证/.test(error.message) && !error.message.includes(invalidKey));
    await addProviderCredential('opencode-go', nextGoKey, '备用账户');
    const managed = (await providerCredentialEntries())['opencode-go'];
    assert.deepEqual(managed.map(entry => [entry.label, entry.enabled]), [['主账户', true], ['备用账户', true]]);
    assert.ok(!JSON.stringify(managed).includes(goKey) && !JSON.stringify(managed).includes(nextGoKey));
    assert.deepEqual(await readRuntimeModelConfiguration(), { selection: go, keys: [goKey, nextGoKey] });
    await assert.rejects(addProviderCredential('opencode-go', nextGoKey, '重复账户'));
    const encryptedRows = await db.query<{ environment: string; provider: string; encrypted_key: string }>(
      'SELECT environment, provider, encrypted_key FROM tianjipan_provider_keys');
    assert.equal(encryptedRows.rows.length, 2);
    assert.ok(encryptedRows.rows.every(row => row.environment === 'preview' && row.provider === 'opencode-go' &&
      !row.encrypted_key.includes(goKey) && !row.encrypted_key.includes(nextGoKey)));

    await updateProviderCredential('opencode-go', managed[1].id, 'primary');
    assert.deepEqual(await readRuntimeModelConfiguration(), { selection: go, keys: [nextGoKey, goKey] });
    assert.ok((await listProviderModels('opencode-go')).some(model => model.id === 'go-rotated-catalog-model'));
    await updateProviderCredential('opencode-go', managed[1].id, 'disable');
    assert.deepEqual(await readRuntimeModelConfiguration(), { selection: go, keys: [goKey] });
    await updateProviderCredential('opencode-go', managed[0].id, 'disable');
    process.env.OPENCODE_GO_API_KEY = goKey;
    assert.deepEqual(await readRuntimeModelConfiguration(), { selection: go, keys: [] });
    delete process.env.OPENCODE_GO_API_KEY;
    await updateProviderCredential('opencode-go', managed[0].id, 'enable');
    await updateProviderCredential('opencode-go', managed[1].id, 'enable');
    assert.deepEqual(await readRuntimeModelConfiguration(), { selection: go, keys: [nextGoKey, goKey] });

    await db.exec(`CREATE TABLE tianjipan_provider_credentials (
      environment text NOT NULL, provider text NOT NULL, encrypted_key text NOT NULL, PRIMARY KEY(environment, provider)
    )`);
    await db.query('INSERT INTO tianjipan_provider_credentials VALUES ($1, $2, $3)',
      ['preview', 'opencode-go', legacyCiphertext(process.env.MODEL_SETTINGS_SECRET!, legacyKey)]);
    process.env.OPENCODE_GO_API_KEY = goEnvironmentKey;
    assert.deepEqual(await readRuntimeModelConfiguration(), { selection: go, keys: [nextGoKey, goKey, legacyKey, goEnvironmentKey] });
    const listed = await providerCredentialEntries(false);
    assert.deepEqual(listed['opencode-go'].map(entry => [entry.label, entry.source]), [
      ['备用账户', undefined], ['主账户', undefined], ['旧版后台密钥', 'legacy'], ['环境变量密钥', 'environment'],
    ]);
    assert.deepEqual(listed['opencode-go'].slice(2).map(entry => entry.suffix), [legacyKey.slice(-4), goEnvironmentKey.slice(-4)]);
    assert.ok([nextGoKey, goKey, legacyKey, goEnvironmentKey].every(key => !JSON.stringify(listed).includes(key)));
    const credentialUrl = 'https://site.test/api/admin/model-catalog?view=credentials';
    assert.equal((await readModelCatalog(new Request(credentialUrl))).status, 401);
    const authorizedList = await readModelCatalog(new Request(credentialUrl, { headers: { Authorization: `Bearer ${modelCatalogAccessToken()}` } }));
    assert.equal(authorizedList.status, 200);
    assert.equal(authorizedList.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await authorizedList.json(), { credentials: listed });
    process.env.OPENCODE_GO_API_KEY = legacyKey;
    assert.deepEqual(await readRuntimeModelConfiguration(), { selection: go, keys: [nextGoKey, goKey, legacyKey] });
    assert.ok(!(await providerCredentialEntries(false))['opencode-go'].some(entry => entry.source === 'environment'));
    delete process.env.OPENCODE_GO_API_KEY;

    process.env.VERCEL_ENV = 'production';
    assert.deepEqual(await providerCredentialStatuses(), { deepseek: true, 'opencode-go': false });
    assert.deepEqual(await readRuntimeModelConfiguration(), { selection: deepseek, keys: [deepseekKey] });
    assert.equal((await providerCredentialEntries())['opencode-go'].length, 0);
    delete process.env.DEEPSEEK_API_KEY;
    process.env.MODEL_CATALOG_URL = 'https://catalog.test.local/model-catalog';
    assert.deepEqual(await providerCredentialEntries(), { deepseek: [remoteCredential], 'opencode-go': [] });
    assert.deepEqual(await listProviderModels('deepseek'), [{ id: 'relay-test-model', name: 'Relay model', efforts: ['default'] }]);
    console.log('Provider catalogs, encrypted key pools, priority, disable/enable, legacy fallback and environment isolation passed.');
  } finally {
    globalThis.fetch = originalFetch;
    await server.stop();
    await db.close();
  }
}

void main().catch(error => { console.error(error); process.exitCode = 1; });
