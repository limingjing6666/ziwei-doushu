import Link from 'next/link';
import { GLOSSARY } from '@/lib/glossary';
import { pageMetadata } from '@/lib/brand';
export const metadata = pageMetadata('术语表', '用大白话了解命宫、四化、大限与星曜。', '/glossary');
export default function GlossaryPage() {
  return <main className="max-w-3xl mx-auto p-5 py-10"><Link href="/chart" className="underline">← 去排盘</Link><h1 className="text-2xl my-5" style={{ color: 'var(--ac)' }}>命盘术语，用大白话说</h1><p className="mb-6">先了解词义，再结合关系与现实经历阅读。</p><dl className="space-y-4">{Object.entries(GLOSSARY).map(([name, description]) => <div key={name} id={name} className="card rounded-xl p-4"><dt className="font-semibold mb-2" style={{ color: 'var(--ac)' }}>{name}</dt><dd>{description} <Link href="/knowledge" className="underline text-sm">了解更多 →</Link></dd></div>)}</dl></main>;
}
