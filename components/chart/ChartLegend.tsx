import { SiHuaBadge } from "@/components/ui/Badge";
import { cn } from "@/lib/ui/cn";

const SIHUA_LIST = ["禄", "权", "科", "忌"] as const;

/** 命盘图例：四化章（生年实心 / 运限虚线）、命宫与三方四正标记。 */
export default function ChartLegend({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "mt-3 flex flex-col gap-2 border-t border-line/12 pt-3 text-[12px] leading-relaxed text-ink-3",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="inline-flex items-center gap-1.5">
          <span>生年四化</span>
          {SIHUA_LIST.map((siHua) => (
            <SiHuaBadge key={siHua} siHua={siHua} />
          ))}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span>运限叠加</span>
          <SiHuaBadge siHua="禄" overlay label="限" />
          <SiHuaBadge siHua="忌" overlay label="年" />
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="inline-flex items-center gap-1.5">
          <span className="font-serif text-[12px] font-semibold text-cinnabar">命宫</span>
          朱砂宫名
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="border border-line/30 px-0.5 text-[12px] leading-none text-ink-3">
            身
          </span>
          身宫所在
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="h-2.5 w-2.5 border border-dashed border-cinnabar/45"
          />
          三方四正
        </span>
        <span>点击宫位查看三方四正</span>
      </div>
    </div>
  );
}
