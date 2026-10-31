/**
 * /library/[book]/[chapter] — 单章阅读页
 *
 * 左：粘性章节目录（当前章高亮，token 底色）
 * 中：reading 宽度正文（原文宋体 17px / 1.95，注释与译文用 surface-2 块 + 小字）
 * 顶部细进度条（纯 CSS 章节进度）、段落 id 锚点、上下章导航、打印隐藏导航。
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import type { Book } from "@/lib/classics/types";
import { ALL_BOOKS, getChapter } from "@/lib/classics";
import { CLASSICS_NOTICE } from "@/lib/classics/types";
import { pageMetadata } from "@/lib/brand";
import { cn } from "@/lib/ui/cn";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import {
  IconArrowLeft,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
} from "@/components/icons";

export async function generateStaticParams() {
  return ALL_BOOKS.flatMap((b) =>
    b.chapters.map((_, i) => ({ book: b.slug, chapter: String(i) })),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ book: string; chapter: string }>;
}) {
  const { book: bookSlug, chapter: chIdx } = await params;
  const result = getChapter(bookSlug, parseInt(chIdx));
  if (!result) return {};
  return pageMetadata(
    `${result.chapter.title} · 《${result.book.title}》主题整理`,
    CLASSICS_NOTICE,
    `/library/${bookSlug}/${chIdx}`,
  );
}

/** 章节目录 + 当前章高亮，桌面粘性栏与移动端折叠面板共用。 */
function ChapterNav({
  book,
  chapterIdx,
}: {
  book: Book;
  chapterIdx: number;
}) {
  return (
    <nav aria-label="章节目录">
      <div className="flex items-baseline justify-between gap-3">
        <p className="label-section">章节目录</p>
        <span className="font-mono text-[12px] tabular-nums text-ink-3">
          {chapterIdx + 1} / {book.chapters.length}
        </span>
      </div>
      <ol className="mt-3 space-y-0.5 text-[13px]">
        {book.chapters.map((item, index) => {
          const active = index === chapterIdx;
          return (
            <li key={`${item.title}-${index}`}>
              <Link
                href={`/library/${book.slug}/${index}`}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "block border-l-2 py-1.5 pl-3 pr-2 leading-snug transition-colors",
                  active
                    ? "border-cinnabar bg-surface-2 font-medium text-ink"
                    : "border-line/15 text-ink-2 hover:border-line/40 hover:bg-surface-2 hover:text-ink",
                )}
              >
                <span className="mr-1.5 font-mono text-[11px] tabular-nums text-ink-3">
                  {String(index + 1).padStart(2, "0")}
                </span>
                {item.title}
              </Link>
            </li>
          );
        })}
      </ol>
      <Link
        href={`/library/${book.slug}`}
        className="mt-4 inline-flex items-center gap-1.5 text-[12px] text-ink-3 transition-colors hover:text-cinnabar"
      >
        <IconArrowLeft size={13} />
        返回《{book.title}》目录
      </Link>
    </nav>
  );
}

export default async function ChapterPage({
  params,
}: {
  params: Promise<{ book: string; chapter: string }>;
}) {
  const { book: bookSlug, chapter: chIdx } = await params;
  const result = getChapter(bookSlug, parseInt(chIdx));
  if (!result) notFound();

  const { book, chapter, chapterIdx } = result;
  const prevIdx = chapterIdx - 1;
  const nextIdx = chapterIdx + 1;

  return (
    <div className="container-wide py-6 lg:py-10">
      <Breadcrumb
        items={[
          { label: "首页", href: "/" },
          { label: "古籍对读", href: "/library" },
          { label: `《${book.title}》`, href: `/library/${book.slug}` },
          { label: chapter.title },
        ]}
        className="no-print mb-5"
      />

      {/* 顶部细进度条：纯 CSS，按章节位置显示进度 */}
      <div className="no-print mb-6">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-[12px] text-ink-3">
          <span>
            《{book.title}》· {book.dynasty}
          </span>
          <span className="font-mono tabular-nums">
            第 {chapterIdx + 1} / {book.chapters.length} 章
          </span>
        </div>
        <div aria-hidden="true" className="mt-2 flex gap-1">
          {book.chapters.map((_, index) => (
            <span
              key={index}
              className={cn(
                "h-0.5 flex-1 rounded-xs",
                index < chapterIdx
                  ? "bg-cinnabar/40"
                  : index === chapterIdx
                    ? "bg-cinnabar"
                    : "bg-line/20",
              )}
            />
          ))}
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-10 print:block">
        <aside className="no-print hidden lg:block">
          <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto no-scrollbar pb-6 pr-2">
            <ChapterNav book={book} chapterIdx={chapterIdx} />
          </div>
        </aside>

        <div className="min-w-0">
          {/* 移动端折叠章节目录 */}
          <details className="no-print group mb-6 rounded-sm border border-line/15 bg-surface lg:hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-[14px] font-medium text-ink [&::-webkit-details-marker]:hidden">
              <span>
                章节目录 · 第 {chapterIdx + 1} / {book.chapters.length} 章
              </span>
              <IconChevronDown
                size={16}
                className="shrink-0 text-ink-3 transition-transform duration-200 group-open:rotate-180"
              />
            </summary>
            <div className="border-t border-line/10 px-4 py-4">
              <ChapterNav book={book} chapterIdx={chapterIdx} />
            </div>
          </details>

          <article className="reading mx-auto">
            <header className="border-b border-line/15 pb-6">
              <p className="eyebrow">
                《{book.title}》· {book.dynasty}
              </p>
              <h1 className="mt-2 font-serif text-[clamp(26px,3.6vw,36px)] font-semibold leading-tight tracking-[0.04em] text-ink">
                {chapter.title}
              </h1>
              {chapter.subtitle ? (
                <p className="mt-2 text-[14px] leading-relaxed text-ink-2">
                  {chapter.subtitle}
                </p>
              ) : null}
            </header>

            <p
              role="note"
              className="mt-6 rounded-sm border border-line/15 bg-surface-2/40 p-4 text-[12px] leading-relaxed text-ink-2"
            >
              {CLASSICS_NOTICE}
            </p>

            <div className="mt-8 divide-y divide-line/10">
              {chapter.paragraphs.map((paragraph) => (
                <section
                  key={paragraph.id}
                  id={paragraph.id}
                  className="scroll-mt-24 py-6 first:pt-0 last:pb-0"
                >
                  <div className="flex items-baseline gap-3 sm:gap-4">
                    <span className="w-5 shrink-0 font-mono text-[11px] tabular-nums text-ink-3">
                      {String(paragraph.idx).padStart(2, "0")}
                    </span>
                    <p className="font-serif text-[17px] leading-[1.95] tracking-[0.02em] text-ink">
                      {paragraph.text}
                    </p>
                  </div>

                  {paragraph.translation ? (
                    <div className="mt-3 rounded-sm bg-surface-2 px-3.5 py-2.5 text-[13px] leading-relaxed text-ink-2 sm:ml-9">
                      <span className="mr-2 font-medium text-ink-3">白话</span>
                      {paragraph.translation}
                    </div>
                  ) : null}

                  {paragraph.readingNote ? (
                    <div className="mt-2 rounded-sm border-l-2 border-ochre/50 bg-surface-2 px-3.5 py-2.5 text-[13px] leading-relaxed text-ink-2 sm:ml-9">
                      <span className="mr-2 font-medium text-ochre">
                        阅读提示
                      </span>
                      {paragraph.readingNote}
                    </div>
                  ) : null}
                </section>
              ))}
            </div>

            <nav
              aria-label="章节导航"
              className="no-print mt-12 grid gap-3 border-t border-line/15 pt-6 sm:grid-cols-2"
            >
              {prevIdx >= 0 ? (
                <Link
                  href={`/library/${book.slug}/${prevIdx}`}
                  className="group rounded-sm border border-line/15 bg-surface p-4 transition-colors hover:border-cinnabar/40 hover:bg-surface-2"
                >
                  <span className="flex items-center gap-1.5 text-[12px] text-ink-3">
                    <IconChevronLeft size={14} />
                    上一章
                  </span>
                  <span className="mt-1 block font-serif text-[14px] font-medium text-ink">
                    {book.chapters[prevIdx].title}
                  </span>
                </Link>
              ) : (
                <span className="hidden sm:block" aria-hidden="true" />
              )}
              {nextIdx < book.chapters.length ? (
                <Link
                  href={`/library/${book.slug}/${nextIdx}`}
                  className="group rounded-sm border border-line/15 bg-surface p-4 text-right transition-colors hover:border-cinnabar/40 hover:bg-surface-2"
                >
                  <span className="flex items-center justify-end gap-1.5 text-[12px] text-ink-3">
                    下一章
                    <IconChevronRight size={14} />
                  </span>
                  <span className="mt-1 block font-serif text-[14px] font-medium text-ink">
                    {book.chapters[nextIdx].title}
                  </span>
                </Link>
              ) : null}
            </nav>

            <Link
              href={`/library/${book.slug}`}
              className="no-print mt-6 inline-flex items-center gap-1.5 text-[12px] text-ink-3 transition-colors hover:text-cinnabar"
            >
              <IconArrowLeft size={13} />
              返回《{book.title}》目录
            </Link>
          </article>
        </div>
      </div>
    </div>
  );
}
