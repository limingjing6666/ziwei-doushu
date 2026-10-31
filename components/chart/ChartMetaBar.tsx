"use client";

import type { ZiweiChart } from "@/lib/ziwei/types";
import { BRANCHES, SHICHEN, STEMS } from "@/lib/ziwei/constants";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { IconRefresh } from "@/components/icons";
import { cn } from "@/lib/ui/cn";

const pad = (value: number) => String(value).padStart(2, "0");

interface MetaItem {
  label: string;
  value: string;
}

/** 命盘信息条只使用 chart 里已有的字段，不新增数据来源。 */
function buildMetaItems(chart: ZiweiChart): MetaItem[] {
  const { birthInfo, lunarInfo } = chart;

  const shichen = SHICHEN[birthInfo.hour]?.name ?? "";
  const orig = birthInfo.origInput;
  const birthTime = orig
    ? `${pad(orig.clockHour)}:${pad(orig.clockMinute)} 北京时间 → ${shichen}`
    : shichen;

  const longitude =
    typeof birthInfo.longitude === "number" && Number.isFinite(birthInfo.longitude)
      ? `${birthInfo.longitude.toFixed(1)}°E`
      : "";

  const placeParts: string[] = [];
  if (birthInfo.province) placeParts.push(birthInfo.province);
  if (birthInfo.city && birthInfo.city !== birthInfo.province) placeParts.push(birthInfo.city);
  if (longitude) placeParts.push(longitude);
  const place = placeParts.length > 0 ? placeParts.join(" · ") : "未填写";
  const lunarYear = `${STEMS[lunarInfo.yearStem] ?? ""}${BRANCHES[lunarInfo.yearBranch] ?? ""}年`;
  const lunarMonth = `${lunarInfo.isLeapMonth ? "闰" : ""}${Math.abs(lunarInfo.lunarMonth)}月`;

  const dx = chart.currentDaXianIndex >= 0 ? chart.daXians[chart.currentDaXianIndex] : undefined;

  return [
    {
      label: "公历",
      value: `${birthInfo.year}-${pad(birthInfo.month)}-${pad(birthInfo.day)}`,
    },
    { label: "时辰", value: birthTime || "未填写" },
    { label: "出生地", value: place },
    { label: "农历", value: `${lunarYear} · ${lunarMonth}${lunarInfo.lunarDay}日` },
    { label: "五行局", value: chart.wuxingJuName },
    { label: "命主 / 身主", value: `${chart.mingZhu || "—"} / ${chart.shenZhu || "—"}` },
    {
      label: "当前大限",
      value: dx
        ? `虚岁 ${chart.currentAge} · ${dx.startAge}–${dx.endAge} 岁 · ${dx.palaceName}`
        : `虚岁 ${chart.currentAge} · 未入大限`,
    },
  ];
}

export interface ChartMetaBarProps {
  chart: ZiweiChart;
  onReset: () => void;
  className?: string;
}

/** 命盘信息条：顶部一行身份信息 + 现成字段摘要 + 重新起盘。 */
export default function ChartMetaBar({ chart, onReset, className }: ChartMetaBarProps) {
  const items = buildMetaItems(chart);
  const name = chart.birthInfo.name?.trim();
  const gender = chart.birthInfo.gender === "male" ? "男" : "女";

  return (
    <Card className={cn("px-4 py-3.5 sm:px-5 sm:py-4", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="hidden text-[12px] tracking-[0.18em] text-ink-3 sm:block">命盘结果</p>
          <h1 className="break-words font-serif text-[20px] font-semibold leading-tight tracking-[0.02em] text-ink sm:mt-1 sm:text-[26px]">
            {name ? `${name} · 紫微斗数命盘` : "紫微斗数命盘"}
          </h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 sm:mt-2">
            <Badge tone="muted">{gender}</Badge>
            {chart.yinYangGender ? <Badge tone="muted">{chart.yinYangGender}</Badge> : null}
          </div>
        </div>
        <Button
          variant="secondary"
          size="md"
          onClick={onReset}
          className="shrink-0 max-sm:!h-8 max-sm:!px-3 max-sm:!text-[13px]"
        >
          <IconRefresh size={16} />
          重新起盘
        </Button>
      </div>

      <dl className="mt-2.5 flex flex-wrap items-baseline gap-x-4 gap-y-1 border-t border-line/12 pt-2.5 text-[13px] leading-snug sm:mt-3 sm:gap-y-1.5 sm:pt-3">
        {items.map((item) => (
          <div key={item.label} className="inline-flex max-w-full items-baseline gap-1.5">
            <dt className="shrink-0 text-[12px] text-ink-3">{item.label}</dt>
            <dd className="min-w-0 break-words text-ink-2">{item.value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
