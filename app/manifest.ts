import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '天机盘 · AI 紫微命盘',
    short_name: '天机盘',
    description: '三合四化 · 古法排盘 · AI 解读',
    lang: 'zh-CN', start_url: '/', display: 'browser',
  };
}
