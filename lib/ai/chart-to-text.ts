import { BRANCHES, STEMS } from '@/lib/ziwei/constants';
import { getSiHuaByStem } from '@/lib/ziwei/sihua';
import { buildAgeFacts, type AgeFacts } from '@/lib/ziwei/facts';
import type { ZiweiChart } from '@/lib/ziwei/types';
import { normalizeChart, normalizeView } from './input';
import { isMarriageQuestion, isHealthQuestion } from './intent';

export { isMarriageQuestion, isHealthQuestion, isNumericSensitive } from './intent';

export function ageFactsToText(f: AgeFacts, question = ''): string {
  const dx = f.currentDecadal, selected = f.selected;
  const lines = ['【年龄与运限事实（唯一来源）】',
    `当前公历年：${f.currentYear}；出生公历年：${f.birthYear > 0 ? f.birthYear : '未提供'}；农历生年：${f.lunarBirthYear > 0 ? f.lunarBirthYear : '未提供'}；当前虚岁：${f.currentAge ?? '未提供'}（唯一）。`,
    '所有年龄均为虚岁；公历流年标签指该年春节开始的农历年，不是生日实岁；年份区间含首尾。“今年”“最近”均指所选流年，不是当前公历年。',
    dx ? `当前大限：第${dx.index}限，本命${dx.palace}；虚岁 ${dx.startAge}–${dx.endAge}（公历 ${dx.startYear}–${dx.endYear}）；宫干${dx.stem}；大限四化：${dx.transformations}` : '当前大限未提供或尚未起限，不擅套第一限。',
    selected ? `所选流年：${selected.year}年；虚岁 ${selected.nominalAge}；流年干${STEMS[((selected.year - 4) % 10 + 10) % 10]}四化：${selected.transformations.map(t => `${t.star}化${t.mark}落本命${t.palace}`).join('、')}\n流年十二宫：${selected.palaceNames.join('；')}` : '所选流年数据未提供，不自行推算。',
    `birthTimeKnown: ${f.birthTimeKnown}。${f.birthTimeKnown ? '出生时辰已提供。' : '因出生时辰未知，命宫/身宫/宫位排布不可靠，下面只作参考。不得对依赖宫位的内容作肯定判断。'}`];
  if (isMarriageQuestion(question)) {
    if (f.marriage.unavailable) lines.push(`婚期候选 unavailable：${f.marriage.reason}。目前无法确定，不使用婚期占位符。`);
    else lines.push(`婚期仅允许 {{MARRIAGE_RANGE}} = ${f.marriage.rangeText}；具体候选仅允许 {{MARRIAGE_YEARS}} = ${f.marriage.years.join('、')} 年。范围只是候选包络，不表示中间每年同等有利，不保证结婚。`,
      ...f.marriage.candidates.map(c => `候选 ${c.year}年，虚岁 ${c.nominalAge}；流年夫妻落本命${c.marriagePalace}；第${c.decadal?.index ?? '?'}大限（本命${c.decadal?.palace ?? '未知'}）；分数${c.score}；${c.reasons.join('；')}`));
  }
  if (isHealthQuestion(question)) lines.push(f.health.years.length ? `健康关键年份仅允许 {{HEALTH_YEARS}} = ${f.health.entries.map(e => `${e.year}年（虚岁 ${e.nominalAge}）：${e.reasons.join('、')}`).join('；')}` : '健康关键年份 unavailable：目前无法确定，不使用健康占位符。');
  lines.push('【大限一览表】\n序号｜本命宫位｜虚岁起止｜公历年起止', ...f.decadals.map(d => `${d.index}｜${d.palace}｜虚岁 ${d.startAge}–${d.endAge}｜公历 ${d.startYear}–${d.endYear}`),
    '【事实使用边界】仅当用户明确问某个大限时才引用大限段年龄；其它年龄一律使用事实区块里的数字。某宫的大限段绝不是婚期，禁止将夫妻宫大限段当成婚期。');
  return lines.join('\n');
}

/** Display selection only: numeric ages live exclusively in ageFactsToText.
 * A client-selected decade is matched back to the page chart, never trusted as a second fact source. */
export function viewToText(raw: unknown, chart: ZiweiChart, currentYear = new Date().getFullYear()): string {
  const v = normalizeView(raw, chart, currentYear);
  const d = v.decadal && chart.daXians.find(d => d.startAge === v.decadal!.startAge && d.endAge === v.decadal!.endAge && palaceKey(d.palaceName) === palaceKey(v.decadal!.palaceName));
  return `【当前所选运势层】\n视图：${{ natal: '本命', decadal: '大限', yearly: '流年' }[v.type]}；所选流年：${v.year}年（详情仅见唯一事实区块）\n所选大限：${d ? `本命${d.palaceName}（数字及四化以事实区块/一览表为准）` : '未匹配页面大限，不采信客户端年龄/宫干'}\nbirthTimeKnown: ${chart.birthInfo.birthTimeKnown !== false}。${chart.birthInfo.birthTimeKnown === false ? '因出生时辰未知，命宫/身宫/宫位排布不可靠，下面只作参考。' : '出生时辰已提供。'}`;
}
export const palaceKey = (name: string) => name === '命宫' ? '命宫' : name.replace(/宫$/, '').replace('交友', '仆役');
const shown = (n: number) => n >= 0 ? String(n) : '未提供';
export function chartToText(raw: unknown, options: { facts?: AgeFacts; question?: string; currentYear?: number } = {}): string {
  const c = normalizeChart(raw), b = c.birthInfo, l = c.lunarInfo;
  const f = options.facts ?? buildAgeFacts(c, { currentYear: options.currentYear ?? new Date().getFullYear(), selectedYear: (c as ZiweiChart & { liunianYear?: number }).liunianYear });
  const lines = [ageFactsToText(f, options.question),
    `性别：${b.gender === 'male' ? '男' : b.gender === 'female' ? '女' : '未提供'}；阴阳性别：${c.yinYangGender || '未提供'}`,
    `排盘日期月日：${shown(b.month)}月${shown(b.day)}日，${BRANCHES[b.hour] ?? '未知'}时（已校正的时辰索引，非钟点；不再重算日期时间）`,
    `农历月日：${l.isLeapMonth ? '闰' : ''}${shown(l.lunarMonth)}月${shown(l.lunarDay)}日；生年干支：${STEMS[l.yearStem] ?? '?'}${BRANCHES[l.yearBranch] ?? '?'}`,
    `五行局：${c.wuxingJuName || (c.wuxingJu >= 2 ? c.wuxingJu + '局' : '未提供')}；命主：${c.mingZhu || '未提供'}；身主：${c.shenZhu || '未提供'}`,
    `命宫：${BRANCHES[c.mingGongBranch] ?? '未提供'}；身宫：${BRANCHES[c.shenGongBranch] ?? '未提供'}`];
  for (const p of c.palaces) {
    const stars = (type: string) => p.stars.filter(s => s.type === type).map(s => `${s.name}${s.brightnessRaw ? `（${s.brightnessRaw}）` : s.brightness ? `（粗亮度:${{ bright: '亮', normal: '平', dim: '暗' }[s.brightness]}）` : ''}`).join('、') || '无/未提供';
    const major = p.stars.filter(s => s.type === 'major');
    const opposite = p.branch >= 0 ? c.palaces.find(q => q.branch === (p.branch + 6) % 12) : undefined;
    lines.push(`\n【${p.name || '未知宫'}】宫干${STEMS[p.stem] ?? '?'}；地支${BRANCHES[p.branch] ?? '?'}${p.isShenGong ? '（身宫）' : ''}\n主星：${major.length ? stars('major') : `空宫；仅借对宫${opposite?.name ?? '未知'}的${opposite?.stars.filter(s => s.type === 'major').map(s => s.name).join('、') || '未提供'}参照，不是本宫坐星`}\n辅星：${stars('lucky')}；煞星：${stars('sha')}；杂曜：${stars('minor')}\n生年四化：${p.stars.filter(s => s.siHua).map(s => `${s.name}化${s.siHua}`).join('、') || '无标记'}；自化（仅已提供者）：${p.selfSihua?.map(s => `${s.starName}自化${s.siHua}`).join('、') || '未提供'}`);
    if (p.branch >= 0) lines.push(`三方四正：${[4, 8, 6].map(offset => c.palaces.find(q => q.branch === (p.branch + offset) % 12)?.name || '未提供').join('、')}（末项为对宫）`);
  }
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
