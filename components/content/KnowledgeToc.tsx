import Link from "next/link";
import {
  ALL_STARS,
  ALL_TOPICS,
  getKnowledge,
  STAR_TO_SLUG,
} from "@/lib/seo/knowledge";
import { TOPIC_LABEL } from "@/lib/ziwei/db-analysis";
import { cn } from "@/lib/ui/cn";

export interface TocSection {
  id: string;
  label: string;
}

/**
 * 知识库详情页目录：十四主星 / 所选星的十三主题 / 本文小节锚点。
 * 桌面放左侧粘性栏，移动端放进 details 折叠面板，复用同一份内容。
 */
export function KnowledgeToc({
  star,
  slug,
  topic,
  sections,
}: {
  star: string;
  slug: string;
  topic: string;
  sections: TocSection[];
}) {
  const topics = ALL_TOPICS.filter((t) => getKnowledge(star, t).exists);

  return (
    <div className="space-y-7 text-[13px]">
      <nav aria-label="十四主星">
        <p className="label-section mb-2.5">十四主星</p>
        <ul className="grid grid-cols-4 gap-1 sm:grid-cols-7 lg:grid-cols-2">
          {ALL_STARS.map((item) => {
            const active = item === star;
            return (
              <li key={item}>
                <Link
                  href={`/knowledge/${STAR_TO_SLUG[item]}/overview`}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "block rounded-xs px-1.5 py-1 text-center font-serif tracking-[0.08em] transition-colors lg:text-left",
                    active
                      ? "bg-cinnabar/10 font-medium text-cinnabar"
                      : "text-ink-2 hover:bg-surface-2 hover:text-ink",
                  )}
                >
                  {item}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <nav aria-label={`${star}星的十三主题`}>
        <p className="label-section mb-2.5">{star}星 · 十三主题</p>
        <ul className="space-y-0.5">
          {topics.map((item) => {
            const active = item === topic;
            return (
              <li key={item}>
                <Link
                  href={`/knowledge/${slug}/${item}`}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "block rounded-xs px-1.5 py-1 transition-colors",
                    active
                      ? "bg-cinnabar/10 font-medium text-cinnabar"
                      : "text-ink-2 hover:bg-surface-2 hover:text-ink",
                  )}
                >
                  {TOPIC_LABEL[item]}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <nav aria-label="本文目录">
        <p className="label-section mb-2.5">本文目录</p>
        <ol className="space-y-1 border-l border-line/15 pl-3">
          {sections.map((section) => (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                className="block py-0.5 text-ink-3 transition-colors hover:text-cinnabar"
              >
                {section.label}
              </a>
            </li>
          ))}
        </ol>
      </nav>
    </div>
  );
}
