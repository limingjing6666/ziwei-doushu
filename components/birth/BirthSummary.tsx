import { IconCheck } from "@/components/icons";

/**
 * 表单状态：纯文字，不使用分段进度条。
 * 空表单时不会出现任何「已完成」色块，避免被误读成从右往左的完成度。
 */
export function BirthStatus({ ready }: { ready: boolean }) {
  if (ready) {
    return (
      <span
        aria-live="polite"
        className="inline-flex items-center gap-1 text-jade"
      >
        <IconCheck size={14} />
        信息已齐全
      </span>
    );
  }

  return (
    <span aria-live="polite" className="text-ink-3">
      必填项：出生日期
    </span>
  );
}

/** 复核摘要：起盘前列出「即将采用」的参数。 */
export function BirthSummary({ text }: { text: string }) {
  return (
    <div
      aria-live="polite"
      className="flex items-start gap-2 rounded-sm border border-line/20 bg-surface-2 px-3 py-2.5"
    >
      <IconCheck size={16} className="mt-0.5 shrink-0 text-jade" />
      <div className="min-w-0 space-y-0.5">
        <p className="text-[11px] tracking-[0.12em] text-ink-3">复核摘要</p>
        <p className="break-words text-[13px] leading-relaxed text-ink-2">{text}</p>
      </div>
    </div>
  );
}
