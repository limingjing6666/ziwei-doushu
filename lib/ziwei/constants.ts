// 天干 Heavenly Stems
export const STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];

// 地支 Earthly Branches
export const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

// 时辰对应地支
export const SHICHEN = [
  { branch: 0, name: '子时', range: '23:00-01:00' },
  { branch: 1, name: '丑时', range: '01:00-03:00' },
  { branch: 2, name: '寅时', range: '03:00-05:00' },
  { branch: 3, name: '卯时', range: '05:00-07:00' },
  { branch: 4, name: '辰时', range: '07:00-09:00' },
  { branch: 5, name: '巳时', range: '09:00-11:00' },
  { branch: 6, name: '午时', range: '11:00-13:00' },
  { branch: 7, name: '未时', range: '13:00-15:00' },
  { branch: 8, name: '申时', range: '15:00-17:00' },
  { branch: 9, name: '酉时', range: '17:00-19:00' },
  { branch: 10, name: '戌时', range: '19:00-21:00' },
  { branch: 11, name: '亥时', range: '21:00-23:00' },
];

// 四化表（年干 → [化禄, 化权, 化科, 化忌]）
export const SI_HUA_TABLE: Record<number, [string, string, string, string]> = {
  0: ['廉贞', '破军', '武曲', '太阳'],   // 甲
  1: ['天机', '天梁', '紫微', '太阴'],   // 乙
  2: ['天同', '天机', '文昌', '廉贞'],   // 丙
  3: ['太阴', '天同', '天机', '巨门'],   // 丁
  4: ['贪狼', '太阴', '右弼', '天机'],   // 戊
  5: ['武曲', '贪狼', '天梁', '文曲'],   // 己
  6: ['太阳', '武曲', '太阴', '天同'],   // 庚
  7: ['巨门', '太阳', '文曲', '文昌'],   // 辛
  8: ['天梁', '紫微', '左辅', '武曲'],   // 壬
  9: ['破军', '巨门', '太阴', '贪狼'],   // 癸
};

// 禄存表（年干 → 禄存branch）
export const LUCUN_TABLE: Record<number, number> = {
  0: 2,   // 甲: 寅
  1: 3,   // 乙: 卯
  2: 5,   // 丙: 巳
  3: 6,   // 丁: 午
  4: 5,   // 戊: 巳
  5: 6,   // 己: 午
  6: 8,   // 庚: 申
  7: 9,   // 辛: 酉
  8: 11,  // 壬: 亥
  9: 0,   // 癸: 子
};

// ★ 所有星曜亮度（主星 + 辅星）已迁移到 algorithm.ts → astro.config({ brightness })
// 覆写范围：9 颗主星 + 3 颗辅星（文曲/铃星/擎羊），共 24 处差异修正。
// 其余星曜（武曲/廉贞/贪狼/巨门/破军/文昌/火星/陀罗）iztro 默认值与全书一致，无需覆写。
// 旧 STAR_BRIGHTNESS 是死代码（从未被引用），已在 2026-05-08 清理。

// 主星描述（传统象义）
export const STAR_DESCRIPTIONS: Record<string, { keywords: string; nature: string; element: string }> = {
  '紫微': { keywords: '帝王·尊贵·独立', nature: '中性偏吉', element: '土' },
  '天机': { keywords: '智慧·机变·谋略', nature: '吉星', element: '木' },
  '太阳': { keywords: '阳刚·官贵·慷慨', nature: '吉星', element: '火' },
  '武曲': { keywords: '财富·刚毅·果断', nature: '中性', element: '金' },
  '天同': { keywords: '温和·享福·随缘', nature: '吉星', element: '水' },
  '廉贞': { keywords: '才艺·刑囚·桃花', nature: '凶中带吉', element: '火' },
  '天府': { keywords: '财库·稳重·保守', nature: '吉星', element: '土' },
  '太阴': { keywords: '柔美·财富·阴柔', nature: '吉星', element: '水' },
  '贪狼': { keywords: '欲望·桃花·多才', nature: '中性', element: '木' },
  '巨门': { keywords: '口舌·是非·善辩', nature: '凶中带吉', element: '水' },
  '天相': { keywords: '辅佐·行政·印绶', nature: '吉星', element: '水' },
  '天梁': { keywords: '荫护·医药·长辈', nature: '吉星', element: '土' },
  '七杀': { keywords: '将星·果决·孤克', nature: '凶星', element: '金' },
  '破军': { keywords: '开创·变动·破坏', nature: '凶星', element: '水' },
};
