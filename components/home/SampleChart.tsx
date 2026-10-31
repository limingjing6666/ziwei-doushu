import type { SiHua } from "@/lib/ziwei/types";
import { cn } from "@/lib/ui/cn";
import { SiHuaBadge } from "@/components/ui/Badge";

interface SampleStar {
  name: string;
  /** 庙 / 旺 / 得 / 利 / 平 / 不 / 闲 / 陷 */
  brightness: string;
  siHua?: SiHua;
}

interface SamplePalace {
  name: string;
  stem: string;
  branch: string;
  /** 4×4 盘面里的格子位置（印刷表格式排布，中央区另占 2×2） */
  area: string;
  stars: SampleStar[];
  /** 只列少量辅星，避免示例盘过密 */
  aux?: string[];
  isMing?: boolean;
  isShen?: boolean;
}

/**
 * 示例命盘数据：公历 1990-05-09 08:00（北京时间）、男。
 * 先由本站排盘规则生成，再静态写入本文件——首页不运行排盘逻辑，
 * 这份数据仅用于说明盘面结构，不针对任何个人。
 */
export const SAMPLE_PALACES: SamplePalace[] = [
  // 上排：巳 午 未 申
  {
    name: "官禄",
    stem: "辛",
    branch: "巳",
    area: "col-start-1 row-start-1",
    stars: [
      { name: "廉贞", brightness: "陷" },
      { name: "贪狼", brightness: "陷" },
    ],
    aux: ["火星"],
  },
  {
    name: "仆役",
    stem: "壬",
    branch: "午",
    area: "col-start-2 row-start-1",
    stars: [{ name: "巨门", brightness: "旺" }],
    aux: ["文昌"],
  },
  {
    name: "迁移",
    stem: "癸",
    branch: "未",
    area: "col-start-3 row-start-1",
    stars: [{ name: "天相", brightness: "得" }],
    aux: ["左辅", "右弼"],
  },
  {
    name: "疾厄",
    stem: "甲",
    branch: "申",
    area: "col-start-4 row-start-1",
    stars: [
      { name: "天同", brightness: "旺", siHua: "忌" },
      { name: "天梁", brightness: "陷" },
    ],
    aux: ["文曲", "禄存"],
  },
  // 右列：酉 戌 亥
  {
    name: "财帛",
    stem: "乙",
    branch: "酉",
    area: "col-start-4 row-start-2",
    stars: [
      { name: "武曲", brightness: "利", siHua: "权" },
      { name: "七杀", brightness: "旺" },
    ],
    aux: ["擎羊"],
    isShen: true,
  },
  {
    name: "子女",
    stem: "丙",
    branch: "戌",
    area: "col-start-4 row-start-3",
    stars: [{ name: "太阳", brightness: "不", siHua: "禄" }],
  },
  {
    name: "夫妻",
    stem: "丁",
    branch: "亥",
    area: "col-start-4 row-start-4",
    stars: [],
  },
  // 下排：子 丑 寅（自右向左）
  {
    name: "兄弟",
    stem: "戊",
    branch: "子",
    area: "col-start-3 row-start-4",
    stars: [{ name: "天机", brightness: "庙" }],
  },
  {
    name: "命宫",
    stem: "己",
    branch: "丑",
    area: "col-start-2 row-start-4",
    stars: [
      { name: "紫微", brightness: "庙" },
      { name: "破军", brightness: "旺" },
    ],
    aux: ["天魁"],
    isMing: true,
  },
  {
    name: "父母",
    stem: "戊",
    branch: "寅",
    area: "col-start-1 row-start-4",
    stars: [],
  },
  // 左列：卯 辰
  {
    name: "福德",
    stem: "己",
    branch: "卯",
    area: "col-start-1 row-start-3",
    stars: [{ name: "天府", brightness: "得" }],
    aux: ["地劫"],
  },
  {
    name: "田宅",
    stem: "庚",
    branch: "辰",
    area: "col-start-1 row-start-2",
    stars: [{ name: "太阴", brightness: "陷", siHua: "科" }],
  },
];

export const SAMPLE_CHART_META = {
  solar: "1990-05-09 08:00",
  lunar: "农历四月十五",
  gender: "男",
  ju: "火六局",
  mingZhu: "巨门",
  shenZhu: "火星",
} as const;

const SAMPLE_PILLARS: { label: string; pillar: string }[] = [
  { label: "年", pillar: "庚午" },
  { label: "月", pillar: "辛巳" },
  { label: "日", pillar: "甲戌" },
  { label: "时", pillar: "戊辰" },
];

/** 首页「本命结构」小样本：直接取示例盘中的三宫，避免与盘面不一致 */
export const SAMPLE_STRUCTURE: { palace: string; stars: string }[] = [
  "命宫",
  "迁移",
  "财帛",
].map((name) => {
  const palace = SAMPLE_PALACES.find((item) => item.name === name)!;
  return {
    palace: name.endsWith("宫") ? name : `${name}宫`,
    stars: palace.stars.map((star) => star.name).join(" · "),
  };
});

const SIHUA_ORDER: SiHua[] = ["禄", "权", "科", "忌"];

/** 首页「四化飞星」小样本：同样取自示例盘的生年四化 */
export const SAMPLE_SI_HUA: { hua: SiHua; star: string; palace: string }[] =
  SIHUA_ORDER.flatMap((hua) => {
    for (const palace of SAMPLE_PALACES) {
      const star = palace.stars.find((item) => item.siHua === hua);
      if (star) return [{ hua, star: star.name, palace: `${palace.name}宫` }];
    }
    return [];
  });

function PalaceTile({ palace }: { palace: SamplePalace }) {
  return (
    <div
      className={cn(
        "flex min-h-[78px] flex-col overflow-hidden bg-surface px-1.5 py-1.5 sm:min-h-[96px] sm:px-2.5 sm:py-2",
        palace.area,
      )}
    >
      <div className="flex items-baseline justify-between gap-1">
        <span
          className={cn(
            "font-serif text-[12px] font-semibold tracking-[0.04em] sm:text-[13px]",
            palace.isMing ? "text-cinnabar" : "text-ink",
          )}
        >
          {palace.name}
          {palace.isShen ? (
            <span className="ml-1 align-middle text-[11px] font-normal text-ink-3">身</span>
          ) : null}
        </span>
        <span className="font-mono text-[12px] leading-none text-ink-3">
          {palace.stem}
          {palace.branch}
        </span>
      </div>

      <div className="mt-1 flex flex-1 flex-col justify-center gap-0.5">
        {palace.stars.length === 0 ? (
          <span className="text-[12px] text-ink-3">空宫</span>
        ) : (
          palace.stars.map((star) => (
            <div key={star.name} className="flex flex-wrap items-center gap-x-1 gap-y-0.5">
              <span className="font-serif text-[13px] font-semibold text-ink sm:text-[14px]">
                {star.name}
              </span>
              <span className="text-[12px] text-ink-3">{star.brightness}</span>
              {star.siHua ? <SiHuaBadge siHua={star.siHua} /> : null}
            </div>
          ))
        )}
      </div>

      {palace.aux?.length ? (
        <p className="mt-0.5 hidden truncate text-[12px] leading-tight text-ink-3 sm:block">
          {palace.aux.join(" · ")}
        </p>
      ) : null}
    </div>
  );
}

export function SampleChart() {
  return (
    <figure id="sample-chart" aria-labelledby="sample-chart-title" className="w-full scroll-mt-24">
      <div className="mb-2.5 flex items-baseline justify-between gap-3">
        <p
          id="sample-chart-title"
          className="font-serif text-[15px] font-semibold tracking-[0.06em] text-ink"
        >
          示例命盘
        </p>
        <p className="text-[12px] tracking-[0.08em] text-ink-3">示例盘 · 仅示意</p>
      </div>

      <div
        aria-hidden="true"
        className="grid grid-cols-4 gap-px border border-line/25 bg-line/25 text-left"
      >
        {SAMPLE_PALACES.map((palace) => (
          <PalaceTile key={palace.name} palace={palace} />
        ))}

        <div className="col-span-2 col-start-2 row-span-2 row-start-2 flex flex-col items-center justify-center gap-1 bg-surface-2/70 px-2 py-3 text-center">
          <p className="font-serif text-[13px] font-semibold text-ink sm:text-[15px]">
            公历 {SAMPLE_CHART_META.solar.slice(0, 10)}
          </p>
          <p className="font-mono text-[12px] text-ink-2">
            {SAMPLE_CHART_META.solar.slice(11)} · {SAMPLE_CHART_META.gender}
          </p>
          <p className="text-[12px] text-ink-2">
            {SAMPLE_CHART_META.ju} · 命主{SAMPLE_CHART_META.mingZhu}
          </p>
          <dl className="mt-0.5 grid grid-cols-2 gap-x-2 gap-y-0.5 text-[12px] leading-tight">
            {SAMPLE_PILLARS.map((item) => (
              <div key={item.label} className="flex items-baseline justify-center gap-1">
                <dt className="text-ink-3">{item.label}</dt>
                <dd className="font-mono text-ink">{item.pillar}</dd>
              </div>
            ))}
          </dl>
          <p className="hidden text-[12px] text-ink-3 sm:block">
            身主{SAMPLE_CHART_META.shenZhu} · {SAMPLE_CHART_META.lunar}
          </p>
        </div>
      </div>

      <figcaption className="mt-3 text-[12px] leading-[1.8] text-ink-3">
        公历 {SAMPLE_CHART_META.solar}（北京时间）、{SAMPLE_CHART_META.gender}；
        {SAMPLE_CHART_META.lunar}
        。盘面按本站三合四化规则排出，仅用于说明结构，不针对任何个人。
      </figcaption>
    </figure>
  );
}
