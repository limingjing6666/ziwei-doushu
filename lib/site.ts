/**
 * 站点根地址。优先读 NEXT_PUBLIC_SITE_URL（见 .env.example）；
 * 未配置时默认 https://tianjipan.tech，供 canonical、og:url、sitemap、robots 使用。
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://tianjipan.tech').replace(/\/+$/, '');

/** 只取域名部分，用于界面上展示（如分享卡底部） */
export const SITE_HOST = SITE_URL.replace(/^https?:\/\//, '');
