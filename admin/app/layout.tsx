import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './styles.css';

export const metadata: Metadata = {
  title: '模型管理 · 天机盘',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
