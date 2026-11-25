'use client';

import { startTransition, useActionState, useEffect, useRef, useState, type FormEvent } from 'react';
import type { ModelSelection, ProviderCredentialEntry, ReasoningEffort } from '../shared/model-config';
import { addCredential, changeCredential, login, saveSettings } from './actions';

type Provider = ModelSelection['provider'];
type ProviderModel = { id: string; name: string; efforts: ReasoningEffort[] };
type ModelLists = Record<Provider, ProviderModel[]>;
type GoStatus = 'ready' | 'unreachable' | 'unconfigured';

const providerNames: Record<Provider, string> = { deepseek: 'DeepSeek 官方', 'opencode-go': 'OpenCode Go' };
const effortNames: Record<ReasoningEffort, string> = {
  default: '沿用默认',
  none: '关闭',
  minimal: '最低',
  low: '低',
  medium: '中',
  high: '高',
  xhigh: '很高',
  max: '最高',
};

function submitWithoutReset(event: FormEvent<HTMLFormElement>, action: (fields: FormData) => void) {
  // Dispatch directly so React does not reset the selects to their initial form values.
  event.preventDefault();
  const fields = new FormData(event.currentTarget);
  const submitter = (event.nativeEvent as SubmitEvent).submitter;
  if (submitter instanceof HTMLButtonElement && submitter.name) fields.append(submitter.name, submitter.value);
  startTransition(() => action(fields));
}

export function LoginForm() {
  const [result, action, busy] = useActionState(login, {});
  return (
    <form action={action} className="login-form">
      <label htmlFor="password">管理员密码</label>
      <input id="password" name="password" type="password" autoComplete="current-password" required />
      {result.error && <p className="error" role="alert">{result.error}</p>}
      <button className="primary" type="submit" disabled={busy}>{busy ? '正在登录…' : '登录'}</button>
    </form>
  );
}

export function ModelForm({ active, models, goStatus, canSave }: {
  active: ModelSelection;
  models: ModelLists;
  goStatus: GoStatus;
  canSave: boolean;
}) {
  const [result, action, busy] = useActionState(saveSettings, {});
  const current = result.selection ?? active;
  const [draft, setDraft] = useState(() => {
    const model = models[active.provider].find(item => item.id === active.model);
    return model && !model.efforts.includes(active.effort) ? { ...active, effort: 'default' as const } : active;
  });
  const selected = models[draft.provider].find(model => model.id === draft.model);
  const canUseGo = goStatus === 'ready' && models['opencode-go'].length > 0;
  const valid = selected?.efforts.includes(draft.effort);
  const changed = draft.provider !== current.provider || draft.model !== current.model || draft.effort !== current.effort;

  function changeProvider(provider: Provider) {
    const source = models[provider];
    const liveModel = provider === current.provider ? source.find(model => model.id === current.model) : undefined;
    const model = liveModel ?? source[0];
    const effort = liveModel?.efforts.includes(current.effort) ? current.effort : 'default';
    setDraft({ provider, model: model?.id ?? '', effort });
  }

  function changeModel(id: string) {
    const model = models[draft.provider].find(item => item.id === id);
    setDraft({ ...draft, model: id, effort: model?.efforts.includes(draft.effort) ? draft.effort : 'default' });
  }

  return (
    <>
      <section className="panel active-panel" aria-labelledby="active-title">
        <h2 id="active-title">当前生效</h2>
        <dl>
          <div><dt>供应商</dt><dd>{providerNames[current.provider]}</dd></div>
          <div><dt>模型</dt><dd className="model-id">{current.model}</dd></div>
          <div><dt>思考程度</dt><dd>{effortNames[current.effort]}</dd></div>
        </dl>
      </section>
      <section className="panel settings" aria-labelledby="settings-title">
        <h2 id="settings-title">切换配置</h2>
        <form action={action} onSubmit={event => submitWithoutReset(event, action)}>
          <div className="fields">
            <div className="field">
              <label htmlFor="provider">供应商</label>
              <select id="provider" name="provider" value={draft.provider} onChange={event => changeProvider(event.target.value as Provider)} disabled={busy}>
                <option value="deepseek" disabled={!models.deepseek.length}>{providerNames.deepseek}{!models.deepseek.length && '（暂不可选）'}</option>
                <option value="opencode-go" disabled={!canUseGo}>{providerNames['opencode-go']}{!canUseGo && '（暂不可选）'}</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="model">模型</label>
              <select id="model" name="model" value={draft.model} onChange={event => changeModel(event.target.value)} disabled={busy}>
                {!selected && <option value={draft.model}>{draft.model || '暂无可选模型'}</option>}
                {models[draft.provider].map(model => <option key={model.id} value={model.id}>{model.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="effort">思考程度</label>
              <select id="effort" name="effort" value={draft.effort} onChange={event => setDraft({ ...draft, effort: event.target.value as ReasoningEffort })} disabled={busy}>
                {(selected?.efforts ?? [draft.effort]).map(effort => <option key={effort} value={effort}>{effortNames[effort]}</option>)}
              </select>
            </div>
          </div>
          {!models.deepseek.length && <p className="note">暂时无法读取 DeepSeek 模型列表。可刷新重试。</p>}
          {goStatus === 'unconfigured' && <p className="note">配置 OpenCode Go 密钥后即可读取模型列表。</p>}
          {goStatus === 'unreachable' && <p className="note">暂时无法读取 OpenCode Go 模型列表。可刷新重试。</p>}
          {!canSave && <p className="note">共享数据库尚未配置，当前仅可查看设置。</p>}
          <div className="form-footer">
            <div aria-live="polite">
              {result.error && <p className="error">{result.error}</p>}
              {result.notice && !changed && <p className="success">{result.notice}</p>}
            </div>
            <button className="primary" type="submit" disabled={busy || !canSave || !valid || !changed}>
              {busy ? '正在保存…' : '保存设置'}
            </button>
          </div>
        </form>
      </section>
    </>
  );
}

function CredentialRow({ provider, entry, primary, canSave }: {
  provider: Provider; entry: ProviderCredentialEntry; primary: boolean; canSave: boolean;
}) {
  const [result, action, busy] = useActionState(changeCredential, {});
  const role = !entry.enabled ? '已停用' : primary ? '主用' : '备用';
  return (
    <li className="credential-row">
      <div className="credential-item">
        <div>
          <span className="credential-label">{entry.label || '密钥'}</span>
          {entry.suffix && <code className="credential-mask">••••{entry.suffix}</code>}
        </div>
        <span className={primary ? 'credential-role credential-primary' : 'credential-role'}>{role}</span>
      </div>
      <form className="credential-actions" action={action} onSubmit={event => submitWithoutReset(event, action)}>
        <input type="hidden" name="provider" value={provider} />
        <input type="hidden" name="id" value={entry.id} />
        {entry.enabled && !primary && (
          <button className="secondary" name="operation" value="primary" disabled={busy || !canSave}>设为主用</button>
        )}
        <button className="secondary" name="operation" value={entry.enabled ? 'disable' : 'enable'} disabled={busy || !canSave}>
          {entry.enabled ? '停用' : '启用'}
        </button>
      </form>
      {result.error && <p className="error" role="alert">{result.error}</p>}
    </li>
  );
}

function ProviderCredentialCard({ provider, entries, configured, canSave }: {
  provider: Provider; entries: ProviderCredentialEntry[] | null; configured: boolean | null; canSave: boolean;
}) {
  const [result, action, busy] = useActionState(addCredential, {});
  const fieldsRef = useRef<HTMLFormElement>(null);
  const primary = entries?.find(entry => entry.enabled)?.id;

  useEffect(() => {
    if (result.notice) fieldsRef.current?.reset();
  }, [result]);

  return (
    <article className="credential-card" aria-labelledby={`credentials-${provider}`}>
      <h3 id={`credentials-${provider}`}>{providerNames[provider]}</h3>
      {entries?.length ? (
        <ul className="credential-list">
          {entries.map(entry => <CredentialRow key={entry.id} provider={provider} entry={entry} primary={entry.id === primary} canSave={canSave} />)}
        </ul>
      ) : null}
      {!primary && (
        <p className="note credential-current">
          {entries === null || configured === null ? '暂时无法读取密钥状态' : configured ? '已有密钥 · 主用' : '暂无可用密钥'}
        </p>
      )}
      <form ref={fieldsRef} action={action} onSubmit={event => submitWithoutReset(event, action)} autoComplete="off">
        <input type="hidden" name="provider" value={provider} />
        <div className="field credential-field">
          <label htmlFor={`credential-label-${provider}`}>备注（选填）</label>
          <input id={`credential-label-${provider}`} name="label" placeholder="例如备用账号" maxLength={48} disabled={busy || !canSave} />
        </div>
        <div className="field credential-field">
          <label htmlFor={`credential-key-${provider}`}>API 密钥</label>
          <input id={`credential-key-${provider}`} name="key" type="password" autoComplete="off" placeholder="输入新密钥" maxLength={512} disabled={busy || !canSave} required />
        </div>
        <div className="credential-footer">
          <div aria-live="polite">
            {result.error && <p className="error">{result.error}</p>}
            {result.notice && <p className="success">{result.notice}</p>}
          </div>
          <button className="primary" type="submit" disabled={busy || !canSave}>
            {busy ? '正在验证…' : '添加密钥'}
          </button>
        </div>
      </form>
    </article>
  );
}

export function CredentialForm({ entries, configured, canSave }: {
  entries: Record<Provider, ProviderCredentialEntry[]> | null;
  configured: Record<Provider, boolean | null>;
  canSave: boolean;
}) {
  return (
    <section className="panel credential-panel" aria-labelledby="credentials-title">
      <h2 id="credentials-title">供应商密钥</h2>
      <p className="note">优先使用主用密钥，暂时不可用时尝试同一家供应商的备用密钥。</p>
      {!canSave && <p className="note">密钥存储尚未配置。</p>}
      <div className="credential-grid">
        <ProviderCredentialCard provider="deepseek" entries={entries?.deepseek ?? null} configured={configured.deepseek} canSave={canSave} />
        <ProviderCredentialCard provider="opencode-go" entries={entries?.['opencode-go'] ?? null} configured={configured['opencode-go']} canSave={canSave} />
      </div>
    </section>
  );
}
