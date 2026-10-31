export default function Footer() {
  return <footer className="relative border-t px-5 py-8 text-center text-xs leading-7" style={{ borderColor: 'var(--bdr-med)', color: 'var(--tx-2)' }}>
    <p>天机盘 · 传统命理仅供参考，现实选择更重要。不构成医疗、投资或法律建议。</p>
    <p>部分断语来自 <a className="underline" href="https://github.com/Renhuai123/ziwei-doushu">紫微斗数开源解读数据集 v4.0</a>（CC BY 4.0），作者：王多鱼AI。已提取、去重并过滤引文。</p>
    <p><a className="underline" href="/terms">服务条款</a> · <a className="underline" href="/privacy">隐私政策</a> · <a className="underline" href="/glossary">术语表</a></p>
  </footer>;
}
