import { listProviderModels, modelSettingsAvailable, providerAvailable, providerCredentialStatuses, providerKeySettingsAvailable, readActiveModelSelection } from '../shared/model-config';
import { adminLoginConfigured, adminSignedIn } from '../lib/session';
import { logout } from './actions';
import { CredentialForm, LoginForm, ModelForm } from './model-form';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  if (!await adminSignedIn()) {
    return (
      <main className="login">
        <div className="brand">天机盘</div>
        <section className="panel">
          <h1>模型管理</h1>
          {adminLoginConfigured() ? <LoginForm /> : <p className="note">管理后台尚未配置登录密码。</p>}
        </section>
      </main>
    );
  }

  const canSave = modelSettingsAvailable();
  const localGoAvailable = providerAvailable('opencode-go');
  const credentialStatuses = providerCredentialStatuses().catch(() => null);
  const goAvailable = localGoAvailable ? Promise.resolve(true) : credentialStatuses.then(credentials => Boolean(credentials?.['opencode-go']));
  const [active, deepseek, credentials, go, hasGoCredential] = await Promise.all([
    readActiveModelSelection().catch(() => null),
    listProviderModels('deepseek').catch(() => null),
    credentialStatuses,
    goAvailable.then(available => available ? listProviderModels('opencode-go').catch(() => null) : null),
    goAvailable,
  ]);

  return (
    <>
      <header className="top-bar">
        <div className="frame top-bar-inner">
          <div className="brand">天机盘 <span>管理后台</span></div>
          <form action={logout}><button className="secondary" type="submit">退出登录</button></form>
        </div>
      </header>
      <main className="frame dashboard">
        <header className="heading">
          <h1>模型配置</h1>
          <p>管理单盘解读和合盘共用的 AI 设置。</p>
        </header>
        {active
          ? <ModelForm active={active} models={{ deepseek: deepseek ?? [], 'opencode-go': go ?? [] }} goStatus={hasGoCredential ? (go?.length ? 'ready' : 'unreachable') : 'unconfigured'} canSave={canSave} />
          : <p className="panel error" role="alert">暂时无法读取模型配置，请刷新重试。</p>}
        <CredentialForm activeProvider={active?.provider ?? 'deepseek'} configured={{
          deepseek: deepseek?.length ? true : credentials?.deepseek ?? null,
          'opencode-go': go?.length ? true : credentials?.['opencode-go'] ?? null,
        }} canSave={providerKeySettingsAvailable()} />
      </main>
    </>
  );
}
