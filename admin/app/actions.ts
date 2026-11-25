'use server';

import { redirect } from 'next/navigation';
import { saveModelSelection, type ModelSelection, type ReasoningEffort } from '../shared/model-config';
import { adminSignedIn, endAdminSession, startAdminSession } from '../lib/session';

export type AdminActionState = { error?: string; notice?: string; selection?: ModelSelection };

export async function login(_state: AdminActionState, form: FormData): Promise<AdminActionState> {
  if (!await startAdminSession(form.get('password'))) return { error: '密码不正确，请再试一次。' };
  redirect('/');
}

export async function logout() {
  await endAdminSession();
  redirect('/');
}

export async function saveSettings(_state: AdminActionState, form: FormData): Promise<AdminActionState> {
  if (!await adminSignedIn()) return { error: '登录已过期，请刷新页面重新登录。' };

  const provider = form.get('provider');
  const model = form.get('model');
  const effort = form.get('effort');
  if ((provider !== 'deepseek' && provider !== 'opencode-go') || typeof model !== 'string' || typeof effort !== 'string') {
    return { error: '请选择供应商、模型和思考程度。' };
  }

  try {
    const selection = await saveModelSelection({ provider, model, effort: effort as ReasoningEffort });
    return { selection, notice: '已保存，下一次新的解读将使用此设置。' };
  } catch (error) {
    return { error: error instanceof Error ? error.message : '保存失败，请稍后重试。' };
  }
}
