/**
 * /library/[book] — 单部古籍书目
 *
 * 左：粘性书信息（书名 / 朝代 / 作者 / 章节数 / 段数 / 简介 / 开始阅读）
 * 右：章节目录（编号 + 标题 + 副题 + 段数）
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { ALL_BOOKS, getBookBySlug } from "@/lib/classics";
import { CLASSICS_NOTICE } from "@/lib/classics/types";
import { pageMetadata } from "@/lib/brand";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { buttonClasses } from "@/components/ui/Button";
import { IconArrowRight } from "@/components/icons";

export async function generateStaticParams() {
  return ALL_BOOKS.map((b) => ({ book: b.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ book: string }>;
}) {
  const { book: slug } = await params;
  const book = getBookBySlug(slug);
  if (!book) return {};
  return pageMetadata(`《${book.title}》主题整理`, book.intro, `/library/${slug}`);
}

export default async function BookPage({
  params,
}: {
  params: Promise<{ book: string }>;
}) {
  const { book: slug } = await params;
  const book = getBookBySlug(slug);
  if (!book) notFound();

  const paragraphCount = book.chapters.reduce(
    (sum, chapter) => sum + chapter.paragraphs.length,
    0,
  );

  return (
    <div className="container-page py-8 lg:py-12">
      <Breadcrumb
        items={[
          { label: "首页", href: "/" },
          { label: "古籍对读", href: "/library" },
          { label: `《${book.title}》` },
        ]}
        className="mb-6"
      />

      <div className="grid gap-8 lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-12">
        <aside className="self-start lg:sticky lg:top-24">
          <div className="surface-card p-6">
            <p className="eyebrow">古籍主题整理</p>
            <h1 className="mt-2 font-serif text-[26px] font-semibold leading-snug tracking-[0.04em] text-ink">
              《{book.title}》
            </h1>
            <dl className="mt-5 space-y-2.5 border-t border-line/15 pt-4 text-[13px]">
              <div className="flex items-baseline justify-between gap-4">
                <dt className="shrink-0 text-ink-3">朝代</dt>
                <dd className="text-right text-ink-2">{book.dynasty}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="shrink-0 text-ink-3">作者</dt>
                <dd className="text-right text-ink-2">{book.author}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="shrink-0 text-ink-3">章节</dt>
                <dd className="text-right font-mono tabular-nums text-ink-2">
                  {book.chapters.length}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="shrink-0 text-ink-3">整理段数</dt>
                <dd className="text-right font-mono tabular-nums text-ink-2">
                  {paragraphCount}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="shrink-0 text-ink-3">约字数</dt>
                <dd className="text-right font-mono tabular-nums text-ink-2">
                  {book.wordCount}
                </dd>
              </div>
            </dl>
            <p className="mt-4 text-[13px] leading-relaxed text-ink-2">
              {book.intro}
            </p>
            <Link
              href={`/library/${book.slug}/0`}
              className={buttonClasses("primary", "md", "mt-5 w-full")}
            >
              从第一章开始
              <IconArrowRight size={16} />
            </Link>
          </div>
        </aside>

        <div className="min-w-0">
          <p
            role="note"
            className="mb-6 rounded-sm border border-line/15 bg-surface-2/40 p-4 text-[12px] leading-relaxed text-ink-2"
          >
            {CLASSICS_NOTICE}
          </p>

          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="font-serif text-[20px] font-semibold text-ink">
              章节目录
            </h2>
            <span className="text-[12px] text-ink-3">
              共 {book.chapters.length} 章 · {paragraphCount} 段
            </span>
          </div>

          <ol className="mt-3 border-t border-line/10">
            {book.chapters.map((chapter, index) => (
              <li key={`${book.slug}-${index}`}>
                <Link
                  href={`/library/${book.slug}/${index}`}
                  className="group flex items-baseline gap-4 border-b border-line/10 px-2 py-4 transition-colors hover:bg-surface-2"
                >
                  <span className="w-7 shrink-0 font-mono text-[12px] tabular-nums text-ink-3 transition-colors group-hover:text-cinnabar">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-serif text-[16px] font-medium tracking-[0.04em] text-ink">
                      {chapter.title}
                    </span>
                    {chapter.subtitle ? (
                      <span className="mt-0.5 block text-[12px] leading-snug text-ink-3">
                        {chapter.subtitle}
                      </span>
                    ) : null}
                  </span>
                  <span className="shrink-0 text-[12px] text-ink-3">
                    {chapter.paragraphs.length} 段
                  </span>
                  <IconArrowRight
                    size={15}
                    className="shrink-0 text-ink-3 transition-colors group-hover:text-cinnabar"
                  />
                </Link>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
