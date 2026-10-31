import type { Instrumentation } from 'next';
import { syslog } from './lib/syslog';
export function register() {}
export const onRequestError: Instrumentation.onRequestError = (_error, _request, context) => {
  // Framework route template, never request URL, headers, or arbitrary exception text.
  syslog('error', 'server.error', { route: context.routePath.split('?')[0], errorClass: 'ServerError', errorMessage: 'Unhandled server error' });
};
