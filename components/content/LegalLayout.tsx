import Link from "next/link";
import type { ReactNode } from "react";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { IconChevronDown } from "@/components/icons";

export interface LegalSection {
  /** 与正文 h2 的 id 对应，用于页内锚点 */
  id: string;
  /** 目录里显示的条款标题（与 h2 文字一致） */
  title: string;
}

function TocList({ sections }: { sections: LegalSection[] }) {
  return (
    <ol className="space-y-1.5 border-l border-line/15 pl-3">
      {sections.map((section) => (
        <li key={section.id}>
          <a
            href={`#${section.id}`}
            className="block py-0.5 text-[13px] leading-snug text-ink-3 transition-colors hover:text-cinnabar"
          >
            {section.title}
          </a>
        </li>
      ))}
    </ol>
  );
}

/**
 * 法务页共享布局：面包屑 + 粘性目录 + prose-cn 正文 + 最后更新日期。
 * terms / privacy 共用同一套版式，只替换正文与目录数据。
 */
export function LegalLayout({
  title,
  updated,
  summary,
  sections,
  other,
  children,
}: {
  title: string;
  updated: string;
  summary?: string;
  sections: LegalSection[];
  other: { href: string; label: string };
  children: ReactNode;
}) {
  return (
    <div className="container-page py-8 lg:py-12">
      <Breadcrumb
        items={[{ label: "首页", href: "/" }, { label: title }]}
        className="no-print mb-6"
      />

      <div className="grid gap-10 lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-14 print:block">
        <aside className="hidden lg:block print:hidden">
          <nav
            aria-label="本页目录"
            className="sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto no-scrollbar pb-4"
          >
            <p className="label-section mb-3">本页目录</p>
            <TocList sections={sections} />
          </nav>
        </aside>

        <div className="min-w-0">
          <header className="border-b border-line/15 pb-6">
            <p className="eyebrow">法务与说明</p>
            <h1 className="mt-2 font-serif text-[clamp(26px,3.6vw,36px)] font-semibold tracking-[0.02em] text-ink">
              {title}
            </h1>
            <p className="mt-3 text-[13px] text-ink-3">最后更新：{updated}</p>
            {summary ? (
              <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-ink-2">
                {summary}
              </p>
            ) : null}
          </header>

          <details className="group mt-6 rounded-sm border border-line/15 bg-surface lg:hidden print:hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-[14px] font-medium text-ink [&::-webkit-details-marker]:hidden">
              <span>本页目录</span>
              <IconChevronDown
                size={16}
                className="text-ink-3 transition-transform duration-200 group-open:rotate-180"
              />
            </summary>
            <div className="border-t border-line/10 px-4 py-3">
              <TocList sections={sections} />
            </div>
          </details>

          <div className="prose-cn mt-8 max-w-[720px]">{children}</div>

          <footer className="mt-12 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line/15 pt-5 text-[13px]">
            <Link
              href={other.href}
              className="text-cinnabar underline-offset-4 hover:underline"
            >
              {other.label}
            </Link>
            <Link
              href="/"
              className="text-ink-3 transition-colors hover:text-ink-2"
            >
              返回首页
            </Link>
          </footer>
        </div>
      </div>
    </div>
  );
}
