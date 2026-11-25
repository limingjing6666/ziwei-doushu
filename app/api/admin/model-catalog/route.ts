import { listProviderModels, modelCatalogAccessToken, providerCredentialEntries } from '@/lib/ai/model-config';
import { authorized } from '@/lib/stats-auth';

const headers = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' };

export async function GET(request: Request) {
  if (!authorized(request, modelCatalogAccessToken())) return Response.json({ error: 'Unauthorized' }, { status: 401, headers });
  const params = new URL(request.url).searchParams;
  if (params.get('view') === 'credentials') {
    try {
      return Response.json({ credentials: await providerCredentialEntries(false) }, { headers });
    } catch {
      return Response.json({ error: 'Credential list unavailable' }, { status: 503, headers });
    }
  }
  const provider = params.get('provider');
  if (provider !== 'deepseek' && provider !== 'opencode-go') return Response.json({ error: 'Invalid provider' }, { status: 400, headers });
  try {
    return Response.json({ models: await listProviderModels(provider, false) }, { headers });
  } catch {
    return Response.json({ error: 'Model catalog unavailable' }, { status: 503, headers });
  }
}
