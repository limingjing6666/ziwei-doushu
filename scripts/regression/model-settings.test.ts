import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { listProviderModels, modelCatalogAccessToken, providerCredentialStatuses, readActiveModelSelection, readRuntimeModelConfiguration, saveModelSelection, saveProviderCredential } from '../../admin/shared/model-config';

const deepseekKey = 'test-deepseek-environment-credential';
const goKey = 'test-opencode-go-initial-credential';
const nextGoKey = 'test-opencode-go-rotated-credential';
const invalidKey = 'test-invalid-credential';
const deepseekModel = 'deepseek-test-future-v1';
const goModel = 'go-test-future-v1';

function goItem(id: string, name: string) {
  return { id, name, type: 'chat', modalities: { input: ['text'], output: ['text'] },
    api: { 'chat-completions': {} }, capabilities: { reasoning: { effort: ['max', 'low', 'unknown'] } } };
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
      assert.ok(authorization === `Bearer ${goKey}` || authorization === `Bearer ${nextGoKey}`);
      return Response.json({ data: [
        goItem(goModel, 'Future OpenCode Model'),
        { id: 'responses-only', type: 'chat', modalities: { input: ['text'], output: ['text'] }, api: { responses: {} } },
        ...(authorization === `Bearer ${nextGoKey}` ? [goItem('go-rotated-catalog-model', 'New model after rotation')] : []),
      ] });
    }
    assert.equal(url, 'https://catalog.test.local/model-catalog?provider=deepseek');
    const relayToken = modelCatalogAccessToken();
    assert.ok(relayToken);
    assert.equal(authorization, `Bearer ${relayToken}`);
    return Response.json({ models: [{ id: 'relay-test-model', name: 'Relay model', efforts: ['default'] }] });
  };
  try {
    const defaultModel = { provider: 'deepseek', model: 'deepseek-flash', effort: 'default' } as const;
    assert.deepEqual(await readActiveModelSelection(), defaultModel);
    assert.deepEqual(await listProviderModels('deepseek'), [{ id: deepseekModel, name: 'Future DeepSeek', efforts: ['default', 'none', 'low', 'max'] }]);
    const deepseek = { provider: 'deepseek', model: deepseekModel, effort: 'low' } as const;
    assert.deepEqual(await saveModelSelection(deepseek), deepseek);
    assert.deepEqual(await readRuntimeModelConfiguration(), { selection: deepseek, key: deepseekKey });
    process.env.VERCEL_ENV = 'preview';
    assert.deepEqual(await readActiveModelSelection(), defaultModel);

    const go = { provider: 'opencode-go', model: goModel, effort: 'max' } as const;
    await assert.rejects(saveModelSelection(go), /凭据/);
    await saveProviderCredential('opencode-go', goKey);
    assert.deepEqual(await listProviderModels('opencode-go'), [{ id: goModel, name: 'Future OpenCode Model', efforts: ['default', 'max', 'low'] }]);
    await assert.rejects(saveModelSelection({ ...go, effort: 'medium' }), /不支持/);
    assert.deepEqual(await saveModelSelection(go), go);
    assert.deepEqual(await readActiveModelSelection(), go);
    assert.deepEqual(await readRuntimeModelConfiguration(), { selection: go, key: goKey });
    const encryptedRows = () => db.query<{ environment: string; provider: string; encrypted_key: string }>(
      'SELECT environment, provider, encrypted_key FROM tianjipan_provider_credentials');
    const first = (await encryptedRows()).rows[0];
    assert.equal(first.environment, 'preview');
    assert.equal(first.provider, 'opencode-go');
    assert.ok(!first.encrypted_key.includes(goKey));
    await assert.rejects(saveProviderCredential('opencode-go', invalidKey), (error: Error) => /验证/.test(error.message) && !error.message.includes(invalidKey));
    assert.deepEqual(await readRuntimeModelConfiguration(), { selection: go, key: goKey });
    await saveProviderCredential('opencode-go', nextGoKey);
    assert.deepEqual(await readRuntimeModelConfiguration(), { selection: go, key: nextGoKey });
    const rotated = (await encryptedRows()).rows;
    assert.equal(rotated.length, 1);
    assert.notEqual(rotated[0].encrypted_key, first.encrypted_key);
    assert.ok(!rotated[0].encrypted_key.includes(nextGoKey));
    assert.ok((await listProviderModels('opencode-go')).some(model => model.id === 'go-rotated-catalog-model'));

    process.env.VERCEL_ENV = 'production';
    assert.deepEqual(await providerCredentialStatuses(), { deepseek: true, 'opencode-go': false });
    assert.deepEqual(await readRuntimeModelConfiguration(), { selection: deepseek, key: deepseekKey });
    delete process.env.DEEPSEEK_API_KEY;
    process.env.MODEL_CATALOG_URL = 'https://catalog.test.local/model-catalog';
    assert.deepEqual(await listProviderModels('deepseek'), [{ id: 'relay-test-model', name: 'Relay model', efforts: ['default'] }]);
    console.log('Provider model lists, authenticated relay, encrypted key rotation and deployment isolation passed.');
  } finally {
    globalThis.fetch = originalFetch;
    await server.stop();
    await db.close();
  }
}

void main().catch(error => { console.error(error); process.exitCode = 1; });
