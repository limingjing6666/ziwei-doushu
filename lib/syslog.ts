const keys = new Set('requestId route status durationMs upstreamStatus upstreamMs ttfbMs promptTokens completionTokens totalTokens cacheHitTokens cacheMissTokens outputChars mode timeKnown repaired truncated finishReason errorClass errorMessage limited rows deployment'.split(' '));
export function syslog(level: 'info' | 'warn' | 'error', event: string, fields: Record<string, number | boolean | string | null | undefined> = {}) {
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (!keys.has(key) || value === undefined) continue;
    // Never pass arbitrary error messages through: redact network identifiers and credentials.
    safe[key] = typeof value === 'string' ? value.replace(/https?:\/\/\S+|Bearer\s+\S+|sk-[\w-]+/gi, '[redacted]').replace(/[\w.+-]+@[\w.-]+/g, '[redacted]').replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b|(?:[\da-f]{0,4}:){2,}[\da-f:.]*/gi, '[redacted]').slice(0, key === 'errorMessage' ? 200 : 100) : value;
  }
  console[level === 'info' ? 'log' : level](JSON.stringify({ ts: new Date().toISOString(), level, event, ...safe }));
}
