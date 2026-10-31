/**
 * 出生信息表单的纯函数与选项集合。
 *
 * 这些规则与 /chart、/heming 共用，拆分出来只是为了让字段组件无状态，
 * 校验口径保持与旧版 BirthForm 完全一致（年份范围 1900–2026、日数固定 31 项、
 * 由 isValidDate 判定「X 月没有 Y 日」）。
 */

export const YEAR_MIN = 1900;
export const YEAR_MAX = 2026;

/** 年份下拉：由近到远（2026 → 1900），与旧实现的顺序一致。 */
export const YEAR_OPTIONS: number[] = Array.from(
  { length: YEAR_MAX - YEAR_MIN + 1 },
  (_, index) => YEAR_MAX - index,
);

export const MONTH_OPTIONS: number[] = Array.from({ length: 12 }, (_, index) => index + 1);

export const DAY_OPTIONS: number[] = Array.from({ length: 31 }, (_, index) => index + 1);

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
