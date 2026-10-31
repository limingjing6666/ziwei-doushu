/**
 * /library — 古籍对读库索引
 *
 * 全文搜索 + 书目卡 + 关于本库（含 CLASSICS_NOTICE 与校勘/署名说明）。
 */

import Link from "next/link";
import { ALL_BOOKS, TOTAL_PARAGRAPHS } from "@/lib/classics";
import { CLASSICS_NOTICE, CLASSICS_SOURCE } from "@/lib/classics/types";
import LibrarySearch from "./LibrarySearch";
import { PageHeader, SectionHeading } from "@/components/ui/PageHeader";
import { buttonClasses } from "@/components/ui/Button";
import { IconArrowRight } from "@/components/icons";
import { pageMetadata } from "@/lib/brand";

export const metadata = pageMetadata(
  "古籍对读库",
  "维基文库《紫微斗数全书》古籍原文（繁转简）与检索，未逐字校勘。",
  "/library",
);

export default function LibraryHomePage() {
  return (
    <div className="container-page py-10 lg:py-14">
      <PageHeader
        eyebrow="古籍对读"
        title="古籍对读库"
        description={`收录 ${ALL_BOOKS.length} 部古籍原文（繁转简），共 ${TOTAL_PARAGRAPHS} 段。可全文检索，也可按书目逐章对读；所涉均为历史文献，尚未完成版本逐字校勘。`}
        actions={
          <Link href="/library/search" className={buttonClasses("secondary", "sm")}>
            全文检索
            <IconArrowRight size={14} />
          </Link>
        }
      />

      <section className="mt-8 max-w-2xl" aria-label="古籍全文检索">
        <LibrarySearch />
        <p className="mt-2 text-[12px] text-ink-3">
          直接检索已收录的古籍原文（繁转简），命中词会在结果中高亮。
        </p>
      </section>

      <section className="mt-12" aria-labelledby="library-books">
        <SectionHeading
          title="收录书目"
          description="书名、朝代、作者与规模；进入书目可逐章阅读古籍原文（繁转简）。"
        />
        <ul
          id="library-books"
          className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3"
        >
          {ALL_BOOKS.map((book) => {
            const paragraphs = book.chapters.reduce(
              (sum, chapter) => sum + chapter.paragraphs.length,
              0,
            );
            return (
              <li key={book.slug}>
                <Link
                  href={`/library/${book.slug}`}
                  className="group surface-card flex h-full flex-col p-5 transition-colors hover:border-cinnabar/40 hover:bg-surface-2"
                >
                  <p className="text-[12px] tracking-[0.08em] text-ink-3">
                    {book.dynasty} · {book.author}
                  </p>
                  <p className="mt-2 font-serif text-[22px] font-semibold leading-snug tracking-[0.06em] text-ink transition-colors group-hover:text-cinnabar">
                    《{book.title}》
                  </p>
                  <p className="mt-3 flex-1 text-[13px] leading-relaxed text-ink-2">
                    {book.intro}
                  </p>
                  <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-ink-3">
                    <span>{book.chapters.length} 章</span>
                    <span aria-hidden="true">·</span>
                    <span>{paragraphs} 段</span>
                    <span aria-hidden="true">·</span>
                    <span>约 {book.wordCount} 字</span>
                  </p>
                  <span className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-cinnabar">
                    进入查阅
                    <IconArrowRight size={14} />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-12" aria-labelledby="library-about">
        <div className="rounded-sm border border-line/15 bg-surface-2/40 p-6">
          <h2
            id="library-about"
            className="font-serif text-[20px] font-semibold text-ink"
          >
            关于本库
          </h2>
          <p className="mt-3 max-w-3xl text-[13px] leading-relaxed text-ink-2">
            所涉古籍为历史文献；本库收录古籍原文（繁转简），尚未完成版本逐字校勘。
            <br />
            底本未标明，版本和文字仍需持续核校。
            <br />
            如发现任何错误请联系我们。
          </p>
          <p
            role="note"
            className="mt-3 max-w-3xl text-[13px] leading-relaxed text-ink-2"
          >
            {CLASSICS_NOTICE}
          </p>
          <p className="mt-3 max-w-3xl text-[13px] leading-relaxed text-ink-2">
            原文来源：<a href={CLASSICS_SOURCE} className="text-cinnabar">维基文库《紫微斗数全书》（{CLASSICS_SOURCE}）</a>，CC BY-SA 4.0，繁转简，未逐字校勘。
          </p>
        </div>
      </section>
    </div>
  );
}
