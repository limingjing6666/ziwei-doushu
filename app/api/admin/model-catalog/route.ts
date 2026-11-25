import { listProviderModels, modelCatalogAccessToken } from '@/lib/ai/model-config';
import { authorized } from '@/lib/stats-auth';

const headers = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' };

export async function GET(request: Request) {
  if (!authorized(request, modelCatalogAccessToken())) return Response.json({ error: 'Unauthorized' }, { status: 401, headers });
  const provider = new URL(request.url).searchParams.get('provider');
  if (provider !== 'deepseek' && provider !== 'opencode-go') return Response.json({ error: 'Invalid provider' }, { status: 400, headers });
  try {
    return Response.json({ models: await listProviderModels(provider, false) }, { headers });
  } catch {
    return Response.json({ error: 'Model catalog unavailable' }, { status: 503, headers });
  }
}
