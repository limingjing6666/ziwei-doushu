/** Defer until after StrictMode's setup/cleanup replay; cancelled mounts never claim a chart. */
export function scheduleAutoOverview(sent: WeakSet<object>, chart: object, send: () => void): () => void {
  const timer = setTimeout(() => {
    if (sent.has(chart)) return;
    sent.add(chart);
    send();
  }, 0);
  return () => clearTimeout(timer);
}
