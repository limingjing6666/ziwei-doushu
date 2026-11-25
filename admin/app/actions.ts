'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { addProviderCredential, saveModelSelection, updateProviderCredential, type ModelSelection, type ReasoningEffort } from '../shared/model-config';
import { adminSignedIn, endAdminSession, startAdminSession } from '../lib/session';

export type AdminActionState = { error?: string; notice?: string; selection?: ModelSelection };
export type CredentialActionState = { error?: string; notice?: string };

export async function login(_state: AdminActionState, form: FormData): Promise<AdminActionState> {
  if (!await startAdminSession(form.get('password'))) return { error: '密码不正确，请再试一次。' };
  redirect('/');
}

export async function logout() {
  await endAdminSession();
  redirect('/');
}

export async function saveSettings(state: AdminActionState, form: FormData): Promise<AdminActionState> {
  const previous = state?.selection;
  if (!await adminSignedIn()) return { selection: previous, error: '登录已过期，请刷新页面重新登录。' };

  const provider = form.get('provider');
  const model = form.get('model');
  const effort = form.get('effort');
  if ((provider !== 'deepseek' && provider !== 'opencode-go') || typeof model !== 'string' || typeof effort !== 'string') {
    return { selection: previous, error: '请选择供应商、模型和思考程度。' };
  }

  try {
    const selection = await saveModelSelection({ provider, model, effort: effort as ReasoningEffort });
    return { selection, notice: '已保存，下一次新的解读将使用此设置。' };
  } catch (error) {
    return { selection: previous, error: error instanceof Error ? error.message : '保存失败，请稍后重试。' };
  }
}

export async function addCredential(_state: CredentialActionState, form: FormData): Promise<CredentialActionState> {
  if (!await adminSignedIn()) return { error: '登录已过期，请刷新页面重新登录。' };

  const provider = form.get('provider');
  const key = form.get('key');
  const label = form.get('label');
  if ((provider !== 'deepseek' && provider !== 'opencode-go') || typeof key !== 'string' || !key.trim() || key.length > 512) {
    return { error: '请选择供应商并输入有效的 API 密钥。' };
  }
  if (label !== null && (typeof label !== 'string' || label.trim().length > 48)) return { error: '备注最多可输入 48 个字符。' };

  try {
    await addProviderCredential(provider, key.trim(), label?.trim() ?? '');
  } catch (error) {
    return { error: error instanceof Error ? error.message : '密钥保存失败，请稍后重试。' };
  }
  revalidatePath('/');
  return { notice: '密钥已添加。' };
}

export async function changeCredential(_state: CredentialActionState, form: FormData): Promise<CredentialActionState> {
  if (!await adminSignedIn()) return { error: '登录已过期，请刷新页面重新登录。' };
  const provider = form.get('provider');
  const id = form.get('id');
  const operation = form.get('operation');
  if ((provider !== 'deepseek' && provider !== 'opencode-go') || typeof id !== 'string' || !id ||
      (operation !== 'primary' && operation !== 'enable' && operation !== 'disable')) {
    return { error: '请重新选择要管理的密钥。' };
  }

  try {
    await updateProviderCredential(provider, id, operation);
  } catch (error) {
    return { error: error instanceof Error ? error.message : '密钥更新失败，请稍后重试。' };
  }
  revalidatePath('/');
  return {};
}
