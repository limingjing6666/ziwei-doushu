'use client';

import { startTransition, useActionState, useState, type FormEvent } from 'react';
import type { ModelSelection, ReasoningEffort } from '../shared/model-config';
import { login, saveSettings } from './actions';

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

  function submitSettings(event: FormEvent<HTMLFormElement>) {
    // Dispatch directly so React does not reset the selects to their initial form values.
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    startTransition(() => action(fields));
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
        <form action={action} onSubmit={submitSettings}>
          <div className="fields">
            <div className="field">
              <label htmlFor="provider">供应商</label>
              <select id="provider" name="provider" value={draft.provider} onChange={event => changeProvider(event.target.value as Provider)} disabled={busy}>
                <option value="deepseek">{providerNames.deepseek}</option>
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
          {goStatus === 'unconfigured' && <p className="note">OpenCode Go 等待服务端配置。</p>}
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
