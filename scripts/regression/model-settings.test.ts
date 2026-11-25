import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { listProviderModels, readActiveModelSelection, readRuntimeModelSelection, saveModelSelection } from '../../admin/shared/model-config';

async function main() {
  const originalFetch = globalThis.fetch;
  const db = await PGlite.create();
  const server = new PGLiteSocketServer({ db, port: 0, host: '127.0.0.1', maxConnections: 10 });
  await server.start();
  process.env.MODEL_SETTINGS_DATABASE_URL = `postgres://postgres:postgres@${server.getServerConn()}/postgres`;
  process.env.DEEPSEEK_MODEL = 'deepseek-flash';
  process.env.VERCEL_ENV = 'production';
  delete process.env.OPENCODE_GO_API_KEY;
  delete process.env.OPENCODE_GO_CONFIGURED;
  try {
    const defaultModel = { provider: 'deepseek', model: 'deepseek-flash', effort: 'default' } as const;
    assert.deepEqual(await readActiveModelSelection(), defaultModel);
    const deepseek = { provider: 'deepseek', model: 'deepseek-v4-pro', effort: 'low' } as const;
    assert.deepEqual(await saveModelSelection(deepseek), deepseek);
    assert.deepEqual(await readRuntimeModelSelection(), deepseek);
    process.env.VERCEL_ENV = 'preview';
    assert.deepEqual(await readActiveModelSelection(), defaultModel);

    const go = { provider: 'opencode-go', model: 'glm-5.3', effort: 'max' } as const;
    await assert.rejects(saveModelSelection(go), /凭据/);
    process.env.OPENCODE_GO_CONFIGURED = '1';
    globalThis.fetch = async url => {
      assert.equal(url, 'https://opencode.ai/inference/go/v1/models');
      return Response.json({ data: [
        { id: 'glm-5.3', name: 'GLM-5.3', type: 'chat', modalities: { input: ['text'], output: ['text'] },
          api: { 'chat-completions': {} }, capabilities: { reasoning: { effort: ['low', 'high', 'max', 'unknown'] } } },
        { id: 'other', type: 'chat', modalities: { input: ['text'], output: ['text'] }, api: { responses: {} } },
      ] });
    };
    assert.deepEqual(await listProviderModels('opencode-go'), [{ id: 'glm-5.3', name: 'GLM-5.3', efforts: ['default', 'low', 'high', 'max'] }]);
    await assert.rejects(saveModelSelection({ ...go, effort: 'medium' }), /不支持/);
    assert.deepEqual(await saveModelSelection(go), go);
    assert.deepEqual(await readActiveModelSelection(), go);
    assert.deepEqual(await readRuntimeModelSelection(), defaultModel);
    process.env.OPENCODE_GO_API_KEY = 'test-go-key';
    assert.deepEqual(await readRuntimeModelSelection(), go);
    process.env.VERCEL_ENV = 'production';
    assert.deepEqual(await readRuntimeModelSelection(), deepseek);
    console.log('Model settings catalog, persistence and deployment isolation passed.');
  } finally {
    globalThis.fetch = originalFetch;
    await server.stop();
    await db.close();
  }
}

void main().catch(error => { console.error(error); process.exitCode = 1; });
