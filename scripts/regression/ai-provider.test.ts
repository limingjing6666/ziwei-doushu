import assert from 'node:assert/strict';
import { resolveAiProvider, streamAi } from '../../lib/ai/deepseek';

async function main() {
  const originalFetch = globalThis.fetch;
  const originalDeepSeekKey = process.env.DEEPSEEK_API_KEY;
  const originalGoKey = process.env.OPENCODE_GO_API_KEY;
  try {
    delete process.env.OPENCODE_GO_API_KEY;
    const session = 'a06fde66-9912-4c93-9996-943fda002658';
    const request = new Request('http://localhost', { headers: { 'X-OpenCode-Session': session } });
    const goSelection = { provider: 'opencode-go', model: 'glm-5.3', effort: 'high' } as const;
    assert.throws(() => resolveAiProvider(goSelection, request), /尚未配置/);

    process.env.OPENCODE_GO_API_KEY = 'go-fixture';
    const go = resolveAiProvider(goSelection, request);
    const newSession = resolveAiProvider(goSelection, new Request('http://localhost', {
      headers: { 'X-OpenCode-Session': 'rejected-custom-value' },
    }));
    assert.match(newSession.headers['X-OpenCode-Session'], /^[\da-f-]{36}$/);
    assert.notEqual(newSession.headers['X-OpenCode-Session'], session);

    globalThis.fetch = async (url, options) => {
      assert.equal(url, 'https://opencode.ai/inference/go/openai/v1/chat/completions');
      const headers = new Headers(options?.headers);
      assert.equal(headers.get('authorization'), 'Bearer go-fixture');
      assert.equal(headers.get('x-opencode-session'), session);
      assert.equal(headers.get('user-agent'), 'Tianjipan/1.0');
      const sent = JSON.parse(String(options?.body));
      assert.equal(sent.model, 'glm-5.3');
      assert.equal(sent.reasoning_effort, 'high');
      assert.equal(sent.thinking, undefined);
      assert.equal(sent.stream, true);
      assert.equal(sent.max_tokens, 4448);
      return new Response([
        'data: {"choices":[{"delta":{"reasoning_content":"hidden"}}]}',
        'data: {"choices":[{"delta":{"content":"visible"},"finish_reason":"stop"}]}',
        'data: [DONE]',
      ].join('\n\n') + '\n\n');
    };
    const response = await streamAi(go, request, 'test', [], 1000, 2400);
    const result = await response.text();
    assert.match(result, /visible/);
    assert.doesNotMatch(result, /hidden|reasoning/);
    assert.ok(result.endsWith('data: [DONE]\n\n'));

    process.env.DEEPSEEK_API_KEY = 'deepseek-fixture';
    const deepSeekSelection = { provider: 'deepseek', model: 'deepseek-flash' } as const;
    const deepSeek = resolveAiProvider({ ...deepSeekSelection, effort: 'max' }, request);
    assert.equal(deepSeek.headers.Authorization, 'Bearer deepseek-fixture');
    assert.equal(deepSeek.headers['X-OpenCode-Session'], undefined);
    assert.deepEqual(deepSeek.thinkingOptions, { thinking: { type: 'enabled' }, reasoning_effort: 'max' });
    assert.deepEqual(resolveAiProvider({ ...deepSeekSelection, effort: 'none' }, request).thinkingOptions, {
      thinking: { type: 'disabled' },
    });
    assert.deepEqual(resolveAiProvider({ ...goSelection, effort: 'default' }, request).thinkingOptions, {});
    console.log('✓ AI providers: OpenCode Go configuration, session and SSE; DeepSeek thinking controls');
  } finally {
    globalThis.fetch = originalFetch;
    if (originalDeepSeekKey === undefined) delete process.env.DEEPSEEK_API_KEY;
    else process.env.DEEPSEEK_API_KEY = originalDeepSeekKey;
    if (originalGoKey === undefined) delete process.env.OPENCODE_GO_API_KEY;
    else process.env.OPENCODE_GO_API_KEY = originalGoKey;
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
