import type { MetadataRoute } from 'next';
import { SITE_TITLE, SITE_SLOGAN } from '@/lib/brand';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_TITLE,
    short_name: '天机盘',
    description: SITE_SLOGAN,
    lang: 'zh-CN', start_url: '/', display: 'browser',
  };
}
