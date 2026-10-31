import Link from 'next/link';
export default function NotFound() {
  return <main className="min-h-[75vh] flex flex-col items-center justify-center px-5 text-center" style={{ background: '#020810', color: '#e8eef6', fontFamily: "'Noto Serif CJK SC',serif" }}>
    <p className="text-6xl mb-6" style={{ color: '#d9aa45' }}>404</p><h1 className="text-2xl mb-4">这一页暂时找不到</h1><p className="mb-8 text-sm">地址可能已变更，可以回到首页或重新排盘。</p><div className="flex gap-3"><Link href="/" className="ux-button" style={{ borderColor: '#d9aa45' }}>回首页</Link><Link href="/chart" className="ux-primary">去排盘</Link></div>
  </main>;
}
