import type { Metadata } from 'next';

export const SITE_TITLE = '天机盘 · AI 紫微命盘';
export const SITE_SLOGAN = '三合四化 · 古法排盘 · AI 解读';

/** Keep page-specific SEO and social cards on the same brand contract. */
export function pageMetadata(page: string, detail: string, path: string, article = false): Metadata {
  const title = `${page} · ${SITE_TITLE}`;
  const description = `${SITE_SLOGAN}。${detail}`;
  return {
    title, description, alternates: { canonical: path },
    openGraph: { title, description, siteName: SITE_TITLE, url: path, type: article ? 'article' : 'website' },
    twitter: { card: 'summary', title, description },
  };
}
