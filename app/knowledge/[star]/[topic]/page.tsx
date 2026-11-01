/**
 * /knowledge/[star]/[topic] — SEO 落地页
 *
 * 14 主星 × 13 topic = 182 个独立 URL
 * 桌面三栏：左目录（十四主星 / 本星十三主题 / 本文锚点）+ 中 reading 正文 + 右 CTA 与相关主题
 * 移动端目录折叠为顶部 details，右栏移到文末。
 *
 * SEO 要点（保持不变）：
 *  - title 含主关键词（如"紫微入命宫·传统星性参考"）
 *  - description 用 dingdiao（一句话定调）
 *  - JSON-LD Article 结构化数据
 *  - 内链：同主星其他 12 宫 + 同宫其他 13 主星
 *  - generateStaticParams 静态生成，零运行时开销
 */

import Link from "next/link";
import TermText from '@/components/TermText';
import { notFound } from "next/navigation";
import type { TopicKey } from "@/lib/ziwei/db-analysis";
import {
  ALL_STARS,
  ALL_TOPICS,
  getKnowledge,
  getAllKnowledgeRoutes,
  STAR_BRIEF_SEO,
  STAR_TO_SLUG,
  SLUG_TO_STAR,
} from "@/lib/seo/knowledge";
import { SITE_URL } from "@/lib/site";
import { pageMetadata, SITE_TITLE, SITE_SLOGAN } from "@/lib/brand";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { buttonClasses } from "@/components/ui/Button";
import { KnowledgeToc } from "@/components/content/KnowledgeToc";
import type { TocSection } from "@/components/content/KnowledgeToc";
import { IconArrowRight, IconChevronDown } from "@/components/icons";

export const dynamicParams = false;

export async function generateStaticParams() {
  const routes = getAllKnowledgeRoutes();
  // URL 用拼音 slug 替代中文，避开 Vercel/CDN 中文路由边界问题
  return routes.map((r) => ({ star: r.slug, topic: r.topic }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ star: string; topic: string }>;
}) {
  const { star: slug, topic } = await params;
  const star = SLUG_TO_STAR[slug];
  if (!star) return {};
  const data = getKnowledge(star, topic as TopicKey);
  if (!data.exists) return {};

  const title = `${star}入${data.palaceName.replace(/宫$/, "")}宫 · ${data.topicLabel} · 传统星性参考`;
  const description =
    data.parsed.dingdiao ||
    `${star}入${data.palaceName.replace(/宫$/, "")}宫的紫微斗数解读 — 基于开源解读数据集与传统星性，仅供学习参考。`;

  return {
    ...pageMetadata(title, description, `/knowledge/${slug}/${topic}`, true),
    keywords: [
      "紫微斗数",
      "传统星性",
      star,
      data.palaceName,
      data.topicLabel,
      `${star}${data.palaceName}`,
      `${star}入${data.palaceName}`,
      `紫微斗数 ${star}`,
      "斗数骨髓赋",
    ],
  };
}

export default async function KnowledgePage({
  params,
}: {
  params: Promise<{ star: string; topic: string }>;
}) {
  const { star: slug, topic } = await params;
  const star = SLUG_TO_STAR[slug];
  if (!star) notFound();
  const data = getKnowledge(star, topic as TopicKey);
  if (!data.exists) notFound();

  const palaceShortName = data.palaceName.replace(/宫$/, "");
  const palaceLabel = `${palaceShortName}宫`;

  // 同主星其他 topic
  const otherTopicsForStar = ALL_TOPICS.filter(
    (t) => t !== topic && getKnowledge(star, t).exists,
  );
  // 同 topic 其他主星
  const otherStarsForTopic = ALL_STARS.filter(
    (s) => s !== star && getKnowledge(s, topic as TopicKey).exists,
  );

  const sections: TocSection[] = [];
  if (data.parsed.dingdiao) sections.push({ id: "dingdiao", label: "一句话定调" });
  if (data.parsed.lundian) sections.push({ id: "lundian", label: "核心论断" });
  if (data.parsed.yiju) sections.push({ id: "yiju", label: "命盘依据" });
  if (data.parsed.chuchu) sections.push({ id: "chuchu", label: "经典出处" });
  sections.push({ id: "related", label: `${star}星的其他宫位` });
  sections.push({ id: "library", label: "古籍对读" });

  // JSON-LD（保持不变）
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: `${star}入${palaceShortName}宫 · ${data.topicLabel}`,
    description: `${SITE_SLOGAN}。${data.parsed.dingdiao || "传统星性参考"}`,
    author: { "@type": "Organization", name: SITE_TITLE },
    publisher: {
      "@type": "Organization",
      name: SITE_TITLE,
      url: SITE_URL,
    },
    datePublished: "2026-04-28",
    dateModified: "2026-10-31",
    mainEntityOfPage: `${SITE_URL}/knowledge/${slug}/${topic}`,
    articleSection: "紫微斗数 · 传统星性参考",
    keywords: [`紫微斗数`, star, data.palaceName, data.topicLabel].join(", "),
  };

  return (
    <div className="container-wide py-8 lg:py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <Breadcrumb
        items={[
          { label: "首页", href: "/" },
          { label: "星曜知识", href: "/knowledge" },
          { label: star, href: `/knowledge/${slug}/overview` },
          { label: palaceLabel },
        ]}
        className="no-print mb-6"
      />

      <div className="grid gap-8 lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-10 xl:grid-cols-[240px_minmax(0,1fr)_280px] print:block">
        <aside className="hidden lg:block print:hidden">
          <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto no-scrollbar pb-6 pr-2">
            <KnowledgeToc
              star={star}
              slug={slug}
              topic={topic}
              sections={sections}
            />
          </div>
        </aside>

        <div className="min-w-0">
          {/* 移动端折叠目录 */}
          <details className="group mb-8 rounded-sm border border-line/15 bg-surface lg:hidden print:hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-[14px] font-medium text-ink [&::-webkit-details-marker]:hidden">
              <span>
                目录 · {star}入{palaceLabel}
              </span>
              <IconChevronDown
                size={16}
                className="shrink-0 text-ink-3 transition-transform duration-200 group-open:rotate-180"
              />
            </summary>
            <div className="border-t border-line/10 px-4 py-4">
              <KnowledgeToc
                star={star}
                slug={slug}
                topic={topic}
                sections={sections}
              />
            </div>
          </details>

          <article className="reading mx-auto min-w-0">
            <header className="border-b border-line/15 pb-6">
              <p className="eyebrow">
                {data.topicLabel} · 传统星性参考
              </p>
              <h1 className="mt-2 font-serif text-[clamp(28px,4vw,40px)] font-semibold leading-tight tracking-[0.04em] text-ink">
                {star}入{palaceLabel}
              </h1>
              {STAR_BRIEF_SEO[star] ? (
                <p className="mt-4 text-[14px] leading-relaxed text-ink-2">
                  {STAR_BRIEF_SEO[star]}
                </p>
              ) : null}
            </header>

            <div className="prose-cn mt-8">
              {data.parsed.dingdiao ? (
                <section id="dingdiao" className="scroll-mt-24">
                  <h2>一句话定调</h2>
                  <blockquote className="text-[19px] leading-[1.9] text-ink lg:text-[21px]">
                    {data.parsed.dingdiao}
                  </blockquote>
                </section>
              ) : null}

              {data.parsed.lundian ? (
                <section id="lundian" className="scroll-mt-24">
                  <h2>核心论断</h2>
                  <div className="whitespace-pre-wrap"><TermText text={data.parsed.lundian} /></div>
                </section>
              ) : null}

              {data.parsed.yiju ? (
                <section id="yiju" className="scroll-mt-24">
                  <h2>命盘依据</h2>
                  <div className="whitespace-pre-wrap"><TermText text={data.parsed.yiju} /></div>
                </section>
              ) : null}

              {data.parsed.chuchu ? (
                <section id="chuchu" className="scroll-mt-24">
                  <h2>经典出处</h2>
                  <blockquote className="whitespace-pre-wrap text-[15px] leading-[1.95]">
                    {data.parsed.chuchu}
                  </blockquote>
                  <p className="text-[12px] leading-relaxed text-ink-3">
                    出处依开源解读数据集与现代整理标注；本页引文未逐字校勘原典，请以可靠影印本对读。
                  </p>
                </section>
              ) : null}
            </div>

            {/* 内链：同主星其他宫位（原「其他宫位解读」） */}
            <section
              id="related"
              className="mt-12 scroll-mt-24 border-t border-line/15 pt-8"
            >
              <h2 className="font-serif text-[20px] font-semibold text-ink">
                {star}星的其他宫位
              </h2>
              <p className="mt-2 text-[13px] text-ink-3">
                同一颗主星落在不同宫位时的侧重。
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {otherTopicsForStar.map((t) => {
                  const item = getKnowledge(star, t);
                  return (
                    <Link
                      key={t}
                      href={`/knowledge/${slug}/${t}`}
                      className="inline-flex items-center rounded-full border border-line/20 px-3 py-1.5 text-[13px] text-ink-2 transition-colors hover:border-cinnabar/40 hover:bg-surface-2 hover:text-ink"
                    >
                      {star}入{item.palaceName.replace(/宫$/, "")}宫
                    </Link>
                  );
                })}
              </div>
            </section>

            {/* 古籍库入口（原「想读原典？」） */}
            <section
              id="library"
              className="mt-10 scroll-mt-24 rounded-sm border border-line/15 bg-surface p-5 sm:p-6"
            >
              <p className="eyebrow">古籍对读</p>
              <h2 className="mt-2 font-serif text-[20px] font-semibold text-ink">
                想读原典？
              </h2>
              <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-ink-2">
                古籍库收录维基文库《紫微斗数全书》通行三卷本原文（繁转简，未逐字校勘），含斗数骨髓赋与女命骨髓赋，可与本页的星性说法对照阅读。
              </p>
              <Link
                href="/library"
                className={buttonClasses("secondary", "sm", "mt-4")}
              >
                查阅古籍原典库
                <IconArrowRight size={14} />
              </Link>
            </section>
          </article>
        </div>

        {/* 右栏：CTA + 相关主题 + 数据说明（移动端移至文末） */}
        <aside className="lg:col-span-2 xl:col-span-1 print:hidden">
          <div className="grid gap-4 md:grid-cols-2 xl:block xl:space-y-4">
            <section className="surface-card p-5">
              <p className="eyebrow">对照命盘</p>
              <h2 className="mt-2 font-serif text-[18px] font-semibold leading-snug text-ink">
                在你的命盘中看这颗星
              </h2>
              <p className="mt-2 text-[13px] leading-relaxed text-ink-2">
                输入生辰排一张盘，看{star}落在哪一宫、与哪些星曜同宫，再回来对照本页。
              </p>
              <Link
                href="/chart"
                className={buttonClasses("primary", "md", "mt-4 w-full")}
              >
                排一张盘
              </Link>
            </section>

            <section className="surface-card p-5">
              <h2 className="text-[13px] font-medium tracking-[0.08em] text-ink">
                同宫其他主星
              </h2>
              <p className="mt-1 text-[12px] text-ink-3">
                其他主星入{palaceLabel}的解读
              </p>
              <ul className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 xl:grid-cols-1">
                {otherStarsForTopic.map((s) => (
                  <li key={s}>
                    <Link
                      href={`/knowledge/${STAR_TO_SLUG[s]}/${topic}`}
                      className="block font-serif text-[13px] text-ink-2 transition-colors hover:text-cinnabar"
                    >
                      {s}入{palaceLabel}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-sm border border-dashed border-line/20 p-5 text-[12px] leading-relaxed text-ink-3">
              <h2 className="text-[13px] font-medium tracking-[0.08em] text-ink">
                数据与免责
              </h2>
              <p className="mt-2">
                本页为传统星性主题整理，含现代说明，未逐字校勘原典。
              </p>
              <p className="mt-3">
                部分断语来自{" "}
                <a
                  href="https://github.com/Renhuai123/ziwei-doushu"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-cinnabar underline-offset-4 hover:underline"
                >
                  紫微斗数开源解读数据集 v4.0
                </a>
                （
                <a
                  href="https://creativecommons.org/licenses/by/4.0/"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-cinnabar underline-offset-4 hover:underline"
                >
                  CC BY 4.0
                </a>
                ），作者：王多鱼AI；已提取、去重并过滤引文，修改不代表上游作者认可。
              </p>
            </section>
          </div>
        </aside>
      </div>
    </div>
  );
}
