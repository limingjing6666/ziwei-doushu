import { BRANCHES, STEMS } from '@/lib/ziwei/constants';
import { getLiuNianSiHua, getSiHuaByStem } from '@/lib/ziwei/sihua';
import type { ZiweiChart } from '@/lib/ziwei/types';
import { normalizeChart, normalizeView } from './input';

/** Display context only; transformations use the existing tables, not a new chart algorithm. */
export function viewToText(raw: unknown, chart: ZiweiChart, currentYear = new Date().getFullYear()): string {
  const v = normalizeView(raw, chart, currentYear);
  const flow = getLiuNianSiHua(v.year);
  const dx = v.decadal;
  return `【当前所选运势层】\n视图：${{ natal: '本命', decadal: '大限', yearly: '流年' }[v.type]}；所选流年：${v.year}年（“今年”“最近”均按此年；未选择年份时默认当前年 ${currentYear}）\n流年干${flow.stemName}四化：${Object.entries(flow.transforms).map(([h, s]) => `${s}化${h}`).join('、')}（叠加本命，不是重排流年十二宫）\n${dx ? `所选大限：${dx.startAge}–${dx.endAge}岁；${dx.palaceName}；宫干${STEMS[dx.stem] ?? '未知'}；大限四化：${Object.entries(getSiHuaByStem(dx.stem)).map(([h, s]) => `${s}化${h}`).join('、')}` : '尚未起限或无可用大限，不擅套第一限'}\n生年四化：${chart.palaces.flatMap(p => p.stars.filter(s => s.siHua).map(s => `${s.name}化${s.siHua}在${p.name}`)).join('、')}\nbirthTimeKnown: ${chart.birthInfo.birthTimeKnown !== false}。${chart.birthInfo.birthTimeKnown === false ? '因出生时辰未知，命宫/身宫/宫位排布不可靠，下面只作参考。不得对依赖宫位的内容作肯定判断。' : '出生时辰已提供。'}`;
}

export const palaceKey = (name: string) => name === '命宫' ? '命宫' : name.replace(/宫$/, '').replace('交友', '仆役');
const shown = (n: number) => n >= 0 ? String(n) : '未提供';

export function chartToText(raw: unknown): string {
  const c = normalizeChart(raw);
  const b = c.birthInfo, l = c.lunarInfo;
  const lines = [
    `性别：${b.gender === 'male' ? '男' : b.gender === 'female' ? '女' : '未提供'}；阴阳性别：${c.yinYangGender || '未提供'}`,
    `排盘公历：${shown(b.year)}年${shown(b.month)}月${shown(b.day)}日，${BRANCHES[b.hour] ?? '未知'}时（时辰索引，非钟点）`,
    `农历：${shown(l.lunarYear)}年${l.isLeapMonth ? '闰' : ''}${shown(l.lunarMonth)}月${shown(l.lunarDay)}日；生年干支：${STEMS[l.yearStem] ?? '?'}${BRANCHES[l.yearBranch] ?? '?'}`,
    `五行局：${c.wuxingJuName || (c.wuxingJu >= 2 ? c.wuxingJu + '局' : '未提供')}；命主：${c.mingZhu || '未提供'}；身主：${c.shenZhu || '未提供'}`,
    `命宫：${BRANCHES[c.mingGongBranch] ?? '未提供'}；身宫：${BRANCHES[c.shenGongBranch] ?? '未提供'}；当前虚岁：${shown(c.currentAge)}`,
  ];
  if (b.origInput) lines.push(`原始钟表输入（可能已做子时换日）：${b.origInput.year}-${b.origInput.month}-${b.origInput.day} ${b.origInput.clockHour}:${b.origInput.clockMinute}`);
  for (const p of c.palaces) {
    const stars = (type: string) => p.stars.filter(s => s.type === type).map(s => `${s.name}${s.brightnessRaw ? `（${s.brightnessRaw}）` : s.brightness ? `（粗亮度:${{ bright: '亮', normal: '平', dim: '暗' }[s.brightness]}）` : ''}`).join('、') || '无/未提供';
    const major = p.stars.filter(s => s.type === 'major');
    const opposite = p.branch >= 0 ? c.palaces.find(q => q.branch === (p.branch + 6) % 12) : undefined;
    lines.push(`\n【${p.name || '未知宫'}】${STEMS[p.stem] ?? '?'}${BRANCHES[p.branch] ?? '?'}${p.isShenGong ? '（身宫）' : ''}\n主星：${major.length ? stars('major') : `空宫；仅借对宫${opposite?.name ?? '未知'}的${opposite?.stars.filter(s => s.type === 'major').map(s => s.name).join('、') || '未提供'}参照，不是本宫坐星`}\n辅星：${stars('lucky')}；煞星：${stars('sha')}；杂曜：${stars('minor')}\n生年四化：${p.stars.filter(s => s.siHua).map(s => `${s.name}化${s.siHua}`).join('、') || '无标记'}；自化（仅已提供者）：${p.selfSihua?.map(s => `${s.starName}自化${s.siHua}`).join('、') || '未提供'}${p.daXianAge ? `；大限虚岁${p.daXianAge.join('–')}${p.isCurrentDaXian ? '（当前）' : ''}` : ''}`);
    if (p.branch >= 0) lines.push(`三方四正：${[4, 8, 6].map(offset => c.palaces.find(q => q.branch === (p.branch + offset) % 12)?.name || '未提供').join('、')}（末项为对宫）`);
  }
  const dx = c.daXians[c.currentDaXianIndex];
  if (dx) {
    lines.push(`\n当前大限：${dx.startAge}–${dx.endAge}虚岁，本命${dx.palaceName}，${BRANCHES[dx.palaceBranch] ?? '?'}位。`);
    const p = c.palaces.find(p => p.branch === dx.palaceBranch);
    if (p && p.stem >= 0) lines.push(`大限宫干四化（飞星补充层，非生年四化）：${Object.entries(getSiHuaByStem(p.stem)).map(([h, s]) => `${s}化${h}落${c.palaces.find(p => p.stars.some(x => x.name === s))?.name ?? '未知宫'}`).join('；')}`);
  } else lines.push('当前大限未提供或尚未起限，不可擅套第一大限。');
  if (c.liunianYear !== undefined) {
    const flow = getLiuNianSiHua(c.liunianYear);
    lines.push(`前端提供农历流年年份：${c.liunianYear}；流年干${flow.stemName}四化（落本命宫位，非重排流年十二宫）：${Object.entries(flow.transforms).map(([h, s]) => `${s}化${h}落${c.palaces.find(p => p.stars.some(x => x.name === s))?.name ?? '未知宫'}`).join('；')}`);
  } else lines.push(viewToText(undefined, c));
  return lines.join('\n');
}

/** Cross-chart flying transformations use A's birth stem but locate each star in B, and vice versa. */
export function crossTransformations(a: ZiweiChart, b: ZiweiChart): string {
  const direction = (from: ZiweiChart, to: ZiweiChart, label: string) => {
    if (from.lunarInfo.yearStem < 0) return `${label}：生年干缺失，不能推算。`;
    return `${label}（生年干${STEMS[from.lunarInfo.yearStem]}）：` + Object.entries(getSiHuaByStem(from.lunarInfo.yearStem)).map(([h, star]) => `${star}化${h}→${to.palaces.find(p => p.stars.some(s => s.name === star))?.name ?? '未知宫位'}`).join('；');
  };
  return [direction(a, b, 'A→B'), direction(b, a, 'B→A')].join('\n');
}
