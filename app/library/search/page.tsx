/**
 * /library/search?q=xxx — 古籍库全文检索结果
 *
 * 顶部搜索框预填 q；结果计数；命中列表用 prose-cn 的 mark token 高亮；
 * 空状态用 EmptyState 给建议词，不再注入页面级 <style>。
 */

import Link from "next/link";
import { redirect } from 'next/navigation';
import { searchClassics, getParagraphById } from "@/lib/classics";
import { CLASSICS_NOTICE } from "@/lib/classics/types";
import { pageMetadata } from "@/lib/brand";
import LibrarySearch from "../LibrarySearch";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconSearch } from "@/components/icons";

export const metadata = pageMetadata(
  "搜索 · 古籍对读库",
  CLASSICS_NOTICE,
  "/library/search",
);

const SUGGESTIONS = [
  "七杀朝斗",
  "双禄朝垣",
  "化忌",
  "紫微",
  "命宫",
  "机月同梁",
];

function SuggestionLinks() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {SUGGESTIONS.map((word) => (
        <Link
          key={word}
          href={`/library/search?q=${encodeURIComponent(word)}`}
          className="inline-flex items-center rounded-full border border-line/20 px-3 py-1.5 text-[13px] text-ink-2 transition-colors hover:border-cinnabar/40 hover:bg-surface-2 hover:text-cinnabar"
        >
          {word}
        </Link>
      ))}
    </div>
  );
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() || "";
  if (!q) redirect('/library');
  const hits = searchClassics(q, 50);

  return (
    <div className="container-page py-8 lg:py-12">
      <Breadcrumb
        items={[
          { label: "首页", href: "/" },
          { label: "古籍对读", href: "/library" },
          { label: "全文检索" },
        ]}
        className="mb-6"
      />

      <div className="max-w-3xl">
        <p className="eyebrow">古籍对读 · 全文检索</p>
        <h1 className="mt-2 font-serif text-[clamp(26px,3.6vw,36px)] font-semibold leading-tight tracking-[0.02em] text-ink">
          {q ? `「${q}」的检索结果` : "全文检索"}
        </h1>

        <div className="mt-5">
          <LibrarySearch defaultValue={q} />
        </div>

        <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[13px] text-ink-3">
          {q ? (
            <>
              <span>
                共找到{" "}
                <strong className="font-mono text-[15px] tabular-nums text-ink">
                  {hits.length}
                </strong>{" "}
                条匹配
              </span>
              <span className="text-[12px]">
                仅检索已收录的整理稿，最多显示 50 条
              </span>
            </>
          ) : (
            <span>输入关键词，检索已收录的古籍整理段落。</span>
          )}
        </div>
      </div>

      <p
        role="note"
        className="mt-6 max-w-3xl rounded-sm border border-line/15 bg-surface-2/40 p-4 text-[12px] leading-relaxed text-ink-2"
      >
        {CLASSICS_NOTICE}
      </p>

      <div className="mt-8 max-w-3xl">
        {hits.length === 0 ? (
          <EmptyState
            icon={<IconSearch size={28} />}
            title={q ? "暂未在已收录古籍中找到这个关键词" : "输入关键词开始检索"}
            description={
              q
                ? "我们持续补充内容中。可以换一个更短的关键词，或直接点选下面的建议词。"
                : "可检索整理稿正文中的星曜、格局与宫位名，例如七杀朝斗、双禄朝垣、化忌。"
            }
            action={<SuggestionLinks />}
          />
        ) : (
          <ol className="space-y-3">
            {hits.map((hit, index) => {
              const context = getParagraphById(hit.paragraphId);
              const chapterIdx = context?.chapterIdx ?? 0;
              return (
                <li key={`${hit.paragraphId}-${index}`}>
                  <Link
                    href={`/library/${hit.bookSlug}/${chapterIdx}#${hit.paragraphId}`}
                    className="group block rounded-sm border border-line/15 bg-surface p-4 transition-colors hover:border-cinnabar/40 hover:bg-surface-2/40 sm:p-5"
                  >
                    <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[12px] text-ink-3">
                      <span className="font-medium text-cinnabar">
                        《{hit.bookTitle}》
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{hit.chapterTitle}</span>
                      <span className="ml-auto font-mono tabular-nums">
                        {hit.paragraphId}
                      </span>
                    </span>
                    <p
                      className="prose-cn mt-2 leading-[1.95]"
                      dangerouslySetInnerHTML={{ __html: hit.snippet }}
                    />
                  </Link>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}
