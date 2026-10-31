import Link from "next/link";
import { Seal } from "@/components/brand";
import { SITE_SLOGAN } from "@/lib/brand";

const PRODUCT_LINKS = [
  { href: "/chart", label: "排盘" },
  { href: "/heming", label: "合盘" },
  { href: "/knowledge", label: "星曜知识" },
  { href: "/library", label: "古籍对读" },
];

const LEGAL_LINKS = [
  { href: "/terms", label: "服务条款" },
  { href: "/privacy", label: "隐私政策" },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-line/12 bg-surface/40 print:hidden">
      <div className="container-wide grid gap-10 py-12 md:grid-cols-[1.5fr_1fr_1fr] md:py-14">
        <div>
          <div className="flex items-center gap-2.5">
            <Seal size={26} />
            <span className="font-serif text-[16px] font-semibold tracking-[0.12em] text-ink">
              天机盘
            </span>
          </div>
          <p className="mt-3 text-[13px] leading-relaxed text-ink-2">
            {SITE_SLOGAN}
          </p>
          <p className="mt-4 max-w-md text-[12px] leading-[1.8] text-ink-3">
            基于传统三合派紫微斗数，结合四化飞星。本站独立整理方法，不代表任何个人或机构授权、传承或背书。传统术数仅供文化学习与自我观察，不是科学预测，也不构成医疗、投资、法律或人生重大决策建议。
          </p>
        </div>

        <nav aria-label="产品导航">
          <h2 className="mb-3 text-[12px] font-medium tracking-[0.16em] text-ink-3">
            产品
          </h2>
          <ul className="space-y-2 text-[13px] text-ink-2">
            {PRODUCT_LINKS.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="transition-colors hover:text-cinnabar"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="条款与数据">
          <h2 className="mb-3 text-[12px] font-medium tracking-[0.16em] text-ink-3">
            条款与数据
          </h2>
          <ul className="space-y-2 text-[13px] text-ink-2">
            {LEGAL_LINKS.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="transition-colors hover:text-cinnabar"
                >
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <a
                href="https://github.com/Renhuai123/ziwei-doushu"
                target="_blank"
                rel="noreferrer noopener"
                className="transition-colors hover:text-cinnabar"
              >
                开源解读数据集（CC BY 4.0）
              </a>
            </li>
          </ul>
        </nav>
      </div>

      <div className="border-t border-line/12">
        <div className="container-wide space-y-2 py-6 text-[12px] leading-relaxed text-ink-3">
          <p>
            本站部分断语来自紫微斗数开源解读数据集 v4.0（CC BY 4.0），作者：王多鱼AI；已提取、去重并过滤受限引文，修改不代表上游作者认可。代码按 MIT 许可使用。
          </p>
          <p>
            © {new Date().getFullYear()} 天机盘 · 传统术数内容仅供文化学习参考。AI 生成内容可能出错，请自行核对。
          </p>
        </div>
      </div>
    </footer>
  );
}
