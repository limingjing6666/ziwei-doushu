/**
 * 出生信息表单的纯函数与选项集合。
 *
 * 这些规则与 /chart、/heming 共用，拆分出来只是为了让字段组件无状态，
 * 校验口径保持与旧版 BirthForm 完全一致（年份范围 1900–2026、日数固定 31 项、
 * 由 isValidDate 判定「X 月没有 Y 日」）。
 */

export const MONTH_OPTIONS: number[] = Array.from({ length: 12 }, (_, index) => index + 1);

export const DAY_OPTIONS: number[] = Array.from({ length: 31 }, (_, index) => index + 1);

export function lunarMonthLabel(n: number): string {
  return (
    {
      1: "正月",
      2: "二月",
      3: "三月",
      4: "四月",
      5: "五月",
      6: "六月",
      7: "七月",
      8: "八月",
      9: "九月",
      10: "十月",
      11: "十一月",
      12: "腊月",
    } as Record<number, string>
  )[n];
}

export function lunarDayLabel(n: number): string {
  const digits = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
  if (n <= 10) return n === 10 ? "初十" : `初${digits[n]}`;
  if (n < 20) return `十${digits[n - 10]}`;
  if (n === 20) return "二十";
  if (n < 30) return `廿${digits[n - 20]}`;
  return "三十";
}

export function isValidDate(year: number, month: number, day: number): boolean {
  if (!year || !month || !day) return false;
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

/** 出生地经度相对东八区标准经线（120°E）的时差，单位：分钟。 */
export function longitudeOffsetMinutes(longitude: number): number {
  return Math.round((longitude - 120) * 4);
}
