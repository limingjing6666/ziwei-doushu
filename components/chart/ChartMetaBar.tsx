"use client";

import type { ZiweiChart } from "@/lib/ziwei/types";
import { describeBirthTime } from "@/lib/birth-time";
import { BRANCHES, STEMS } from "@/lib/ziwei/constants";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { IconRefresh } from "@/components/icons";
import { cn } from "@/lib/ui/cn";

const pad = (value: number) => String(value).padStart(2, "0");

interface MetaItem {
  label: string;
  value: string;
  detail?: string;
}

/** 校时方式仅用于展示，不写入命盘或参与计算。 */
function buildMetaItems(chart: ZiweiChart, useTrueSolar?: boolean): MetaItem[] {
  const { birthInfo, lunarInfo } = chart;

  const birthTime = describeBirthTime({ ...birthInfo.origInput, unknownTime: birthInfo.birthTimeKnown === false, city: birthInfo.city, longitude: birthInfo.longitude, useTrueSolar, branch: birthInfo.hour });

  const longitude =
    typeof birthInfo.longitude === "number" && Number.isFinite(birthInfo.longitude)
      ? `${birthInfo.longitude.toFixed(1)}°E`
      : "";

  const placeParts: string[] = [];
  if (birthInfo.province) placeParts.push(birthInfo.province);
  if (birthInfo.city && birthInfo.city !== birthInfo.province) placeParts.push(birthInfo.city);
  if (longitude && birthInfo.city) placeParts.push(longitude);
  const place = placeParts.length > 0 ? placeParts.join(" · ") : "未填写";
  const lunarYear = `${STEMS[lunarInfo.yearStem] ?? ""}${BRANCHES[lunarInfo.yearBranch] ?? ""}年`;
  const lunarMonth = `${lunarInfo.isLeapMonth ? "闰" : ""}${Math.abs(lunarInfo.lunarMonth)}月`;

  const dx = chart.currentDaXianIndex >= 0 ? chart.daXians[chart.currentDaXianIndex] : undefined;

  return [
    {
      label: "公历",
      value: `${birthInfo.year}-${pad(birthInfo.month)}-${pad(birthInfo.day)}`,
    },
    { label: "时辰", value: birthTime.summary, detail: birthTime.detail },
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
  useTrueSolar?: boolean;
  className?: string;
}

/** 命盘信息条：顶部一行身份信息 + 现成字段摘要 + 重新起盘。 */
export default function ChartMetaBar({ chart, onReset, useTrueSolar, className }: ChartMetaBarProps) {
  const items = buildMetaItems(chart, useTrueSolar);
  const name = chart.birthInfo.name?.trim();
  const gender = chart.birthInfo.gender === "male" ? "男" : "女";

  return (
    <Card className={cn("px-4 py-3.5 sm:px-5 sm:py-4", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="hidden text-[12px] tracking-[0.18em] text-ink-3 sm:block">命盘结果</p>
          <h1 className="break-all font-serif text-[20px] font-semibold leading-tight tracking-[0.02em] text-ink sm:mt-1 sm:text-[26px]">
            {name ? `${name.slice(0, 20)}${name.length > 20 ? '…' : ''} · 紫微斗数命盘` : "紫微斗数命盘"}
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

      {useTrueSolar === undefined && !chart.birthInfo.city && <p role="note" className="ux-notice mt-3">这张旧盘没有保存城市信息。如果要按出生地校时，请重新起盘并选择城市。</p>}
      <dl className="mt-2.5 flex flex-wrap items-baseline gap-x-4 gap-y-1 border-t border-line/12 pt-2.5 text-[13px] leading-snug sm:mt-3 sm:gap-y-1.5 sm:pt-3">
        {items.map((item) => (
          <div key={item.label} className="inline-flex max-w-full items-baseline gap-1.5">
            <dt className="shrink-0 text-[12px] text-ink-3">{item.label}</dt>
            <dd className="min-w-0 break-words text-ink-2">{item.value}{item.detail && <small className="mt-1 block text-[11px] leading-relaxed text-ink-3">{item.detail}</small>}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
