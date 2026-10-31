/**
 * /knowledge — 知识库索引
 *
 * 十四主星 / 十三主题 / 推荐阅读 / 古籍入口。
 * 只做索引与导航，卡片进入 /knowledge/[slug]/overview。
 */

import Link from "next/link";
import {
  ALL_STARS,
  ALL_TOPICS,
  STAR_BRIEF_SEO,
  STAR_TO_SLUG,
  getKnowledge,
} from "@/lib/seo/knowledge";
import type { TopicKey } from "@/lib/ziwei/db-analysis";
import { TOPIC_LABEL, TOPIC_PALACE_NAME } from "@/lib/ziwei/db-analysis";
import { ALL_BOOKS } from "@/lib/classics";
import { PageHeader, SectionHeading } from "@/components/ui/PageHeader";
import { buttonClasses } from "@/components/ui/Button";
import { IconArrowRight, IconBook } from "@/components/icons";
import { pageMetadata } from "@/lib/brand";

export const metadata = {
  ...pageMetadata(
    "紫微斗数知识库 · 14 主星 × 13 专题",
    "传统星宫知识库，说明触发条件、联动关系与阅读限制。",
    "/knowledge",
  ),
  keywords: [
    "紫微斗数",
    "天机盘",
    "三合四化",
    "紫微斗数全集",
    "紫微斗数全书",
    "14 主星",
    "12 宫位",
  ],
};

const ARTICLE_COUNT = ALL_STARS.length * ALL_TOPICS.length;

/** 从「主星简介」里取出星曜属性与一句星性，仅用于索引卡展示。 */
function starGlance(star: string): { attr: string; nature: string } {
  const brief = STAR_BRIEF_SEO[star] ?? "";
  const match = brief.match(/^.+?为(.+?)，(.+?)。/);
  if (!match) return { attr: "主星", nature: brief };
  return { attr: match[1], nature: match[2] };
}

function palaceShort(topic: TopicKey) {
  return TOPIC_PALACE_NAME[topic].replace(/宫$/, "");
}

const FEATURED: { star: string; topic: TopicKey }[] = [
  { star: "紫微", topic: "overview" },
  { star: "七杀", topic: "overview" },
  { star: "太阴", topic: "love" },
  { star: "武曲", topic: "wealth" },
  { star: "天机", topic: "career" },
  { star: "廉贞", topic: "personality" },
];

export default function KnowledgeHomePage() {
  const featured = FEATURED.filter(
    ({ star, topic }) => getKnowledge(star, topic).exists,
  ).slice(0, 6);

  return (
    <div className="knowledge-page container-page py-10 lg:py-14">
      <PageHeader
        eyebrow="星曜知识"
        title="紫微斗数知识库"
        description={`十四主星 × 十三主题 = ${ARTICLE_COUNT} 项专题整理。每篇说明星曜落在该宫位时的传统解释、判断依据与阅读限制，传统星宫关系与独立白话整理，含公版古籍参考。`}
        actions={
          <Link href="/library" className={buttonClasses("secondary", "sm")}>
            <IconBook size={15} />
            古籍对读
          </Link>
        }
      />

      <section className="mt-12" aria-labelledby="knowledge-stars">
        <SectionHeading
          title="十四主星"
          description="点开一颗星，先读它在命宫的总览，再按宫位继续。"
        />
        <div
          id="knowledge-stars"
          className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7"
        >
          {ALL_STARS.map((star) => {
            const { attr, nature } = starGlance(star);
            return (
              <Link
                key={star}
                href={`/knowledge/${STAR_TO_SLUG[star]}/overview`}
                className="group flex flex-col items-center justify-between gap-2 rounded-xs border border-line/20 bg-surface px-3 py-4 text-center outline outline-1 outline-offset-[-6px] outline-line/10 transition-colors hover:border-cinnabar/40 hover:bg-surface-2 sm:aspect-square sm:px-4 sm:py-5 xl:px-2.5"
              >
                <span className="text-[11px] tracking-[0.12em] text-ink-3 transition-colors group-hover:text-cinnabar">
                  {attr}
                </span>
                <span className="font-serif text-[22px] font-semibold leading-none tracking-[0.14em] text-ink">
                  {star}
                </span>
                <span className="line-clamp-2 text-balance text-[12px] leading-relaxed text-ink-2">
                  {nature}
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="mt-14" aria-labelledby="knowledge-palaces">
        <SectionHeading
          title="十三宫位"
          description="按宫位索引，同一颗星在不同人生主题下的侧重并不相同（以紫微主星专题为例）。"
        />
        <div id="knowledge-palaces" className="mt-6 flex flex-wrap gap-2">
          {ALL_TOPICS.map((topic) => (
            <Link
              key={topic}
              href={`/knowledge/${STAR_TO_SLUG["紫微"]}/${topic}`}
              className="group inline-flex items-baseline gap-2 rounded-full border border-line/20 px-3.5 py-1.5 text-[13px] text-ink-2 transition-colors hover:border-cinnabar/40 hover:bg-surface-2 hover:text-ink"
            >
              <span className="font-serif">{palaceShort(topic)}宫</span>
              <span className="text-[12px] text-ink-3 transition-colors group-hover:text-cinnabar">
                {TOPIC_LABEL[topic]}
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-14" aria-labelledby="knowledge-featured">
        <SectionHeading
          eyebrow="推荐阅读"
          title="从哪里开始读"
          description="几篇常被检索的专题，用来熟悉这套星宫写法。"
        />
        <div
          id="knowledge-featured"
          className="mt-4 grid gap-x-10 border-t border-line/10 md:grid-cols-2"
        >
          {featured.map(({ star, topic }, index) => (
            <Link
              key={`${star}-${topic}`}
              href={`/knowledge/${STAR_TO_SLUG[star]}/${topic}`}
              className="group flex items-baseline gap-4 border-b border-line/10 py-3.5"
            >
              <span className="w-6 shrink-0 font-mono text-[12px] tabular-nums text-ink-3">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-serif text-[16px] font-medium tracking-[0.04em] text-ink transition-colors group-hover:text-cinnabar">
                  {star}入{palaceShort(topic)}宫
                </span>
                <span className="mt-0.5 block text-[12px] text-ink-3">
                  {TOPIC_LABEL[topic]} · 传统星性参考
                </span>
              </span>
              <IconArrowRight
                size={15}
                className="shrink-0 text-ink-3 transition-colors group-hover:text-cinnabar"
              />
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-14" aria-labelledby="knowledge-library">
        <SectionHeading
          eyebrow="原典"
          title="古籍对读"
          description="知识库里的星性说法，可以回到古籍整理稿里对照阅读。"
          action={
            <Link href="/library" className={buttonClasses("ghost", "sm")}>
              打开古籍库
              <IconArrowRight size={14} />
            </Link>
          }
        />
        <ul
          id="knowledge-library"
          className="mt-6 grid gap-3 sm:grid-cols-3"
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
                  className="group surface-card flex h-full flex-col p-4 transition-colors hover:border-cinnabar/40 hover:bg-surface-2"
                >
                  <span className="text-[12px] text-ink-3">
                    {book.dynasty} · {book.author}
                  </span>
                  <span className="mt-1.5 font-serif text-[18px] font-semibold leading-snug tracking-[0.04em] text-ink transition-colors group-hover:text-cinnabar">
                    《{book.title}》
                  </span>
                  <span className="mt-2 line-clamp-2 flex-1 text-[12px] leading-relaxed text-ink-2">
                    {book.intro}
                  </span>
                  <span className="mt-3 flex items-center gap-3 text-[12px] text-ink-3">
                    <span>{book.chapters.length} 章</span>
                    <span aria-hidden="true">·</span>
                    <span>{paragraphs} 段</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
