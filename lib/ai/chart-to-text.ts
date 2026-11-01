import { BRANCHES, STEMS } from '@/lib/ziwei/constants';
import { getSiHuaByStem } from '@/lib/ziwei/sihua';
import { buildAgeFacts, type AgeFacts } from '@/lib/ziwei/facts';
import type { ZiweiChart } from '@/lib/ziwei/types';
import { normalizeChart, normalizeView } from './input';
import { isMarriageQuestion, isHealthQuestion } from './intent';

export { isMarriageQuestion, isHealthQuestion, isNumericSensitive } from './intent';

export function ageFactsToText(f: AgeFacts, question = ''): string {
  const dx = f.currentDecadal, selected = f.selected;
  const today = `今天：${f.currentDate}（公历）；你现年虚岁${f.currentAge ?? '未提供'}；所选流年：${selected ? `${selected.year}年（虚岁${selected.nominalAge}）` : '未提供'}。`;
  const transformations = [
    `【生年四化】${f.natalTransformations}`,
    ...(f.birthTimeKnown ? [dx ? `【当前大限四化（大限宫干${dx.stem}）】${dx.transformations}` : '【当前大限四化】未提供或尚未起限。'] : []),
    selected ? `【所选流年四化（流年干${STEMS[((selected.year - 4) % 10 + 10) % 10]}）】${selected.transformations.map(t => `${t.star}化${t.mark}${f.birthTimeKnown ? `落本命${t.palace}` : ''}`).join('、')}` : '【所选流年四化】未提供。',
  ];
  const lines = [today, '【年龄与运限事实（唯一来源）】',
    `出生公历年：${f.birthYear > 0 ? f.birthYear : '未提供'}；农历生年：${f.lunarBirthYear > 0 ? f.lunarBirthYear : '未提供'}。所有年龄均为虚岁。`,
    ...transformations,
    '“今年”“最近”均指所选流年；现实当前大限按今天的虚岁。过去年份只作回顾，不作为未来候选。',
    `birthTimeKnown: ${f.birthTimeKnown}。`];
  if (!f.birthTimeKnown) return lines.join('\n');
  if (dx) lines.push(`当前大限：第${dx.index}限，本命${dx.palace}；虚岁 ${dx.startAge}–${dx.endAge}（公历 ${dx.startYear}–${dx.endYear}）。`);
  if (selected) lines.push(`流年十二宫：${selected.palaceNames.join('；')}`);
  if (isMarriageQuestion(question)) {
    if (!f.marriage.unavailable) lines.push(`婚期线索：${f.marriage.rangeText}；按时间先后列出线索年份，各年依据见下。`,
      ...f.marriage.candidates.map(c => `婚期线索年 ${c.year}年，虚岁 ${c.nominalAge}；流年夫妻落本命${c.marriagePalace}；第${c.decadal?.index ?? '?'}大限（本命${c.decadal?.palace ?? '未知'}）；${c.reasons.join('；')}`));
  }
  if (isHealthQuestion(question) && f.health.years.length) lines.push(`健康关键年份（按时间先后）：${f.health.entries.map(e => `${e.year}年（虚岁 ${e.nominalAge}）：${e.reasons.join('、')}`).join('；')}`);
  lines.push('【大限一览表】\n序号｜本命宫位｜虚岁起止｜公历年起止', ...f.decadals.map(d => `${d.index}｜${d.palace}｜虚岁 ${d.startAge}–${d.endAge}｜公历 ${d.startYear}–${d.endYear}`),
    '【事实使用边界】仅当用户明确问某个大限时才引用大限段年龄；其它年龄一律使用事实区块里的数字。某宫的大限段绝不是婚期，禁止将夫妻宫大限段当成婚期。');
  return lines.join('\n');
}

/** Display selection only: numeric ages live exclusively in ageFactsToText.
 * A client-selected decade is matched back to the page chart, never trusted as a second fact source. */
export function viewToText(raw: unknown, chart: ZiweiChart, currentYear = new Date().getFullYear()): string {
  const v = normalizeView(raw, chart, currentYear);
  if (chart.birthInfo.birthTimeKnown === false) return `【当前所选运势层】\n所选流年：${v.year}年；birthTimeKnown: false。时辰未知。`;
  const d = v.decadal && chart.daXians.find(d => d.startAge === v.decadal!.startAge && d.endAge === v.decadal!.endAge && palaceKey(d.palaceName) === palaceKey(v.decadal!.palaceName));
  return `【当前所选运势层】\n视图：${{ natal: '本命', decadal: '大限', yearly: '流年' }[v.type]}；所选流年：${v.year}年（详情仅见唯一事实区块）\n所选大限：${d ? `本命${d.palaceName}（数字及四化以事实区块/一览表为准）` : '未匹配页面大限，不采信客户端年龄/宫干'}\nbirthTimeKnown: true。出生时辰已提供。`;
}
export const palaceKey = (name: string) => name === '命宫' ? '命宫' : name.replace(/宫$/, '').replace('交友', '仆役');
const shown = (n: number) => n >= 0 ? String(n) : '未提供';
export function chartToText(raw: unknown, options: { facts?: AgeFacts; question?: string; currentYear?: number } = {}): string {
  const c = normalizeChart(raw), b = c.birthInfo, l = c.lunarInfo;
  const f = options.facts ?? buildAgeFacts(c, { currentYear: options.currentYear ?? new Date().getFullYear(), selectedYear: (c as ZiweiChart & { liunianYear?: number }).liunianYear });
  if (b.birthTimeKnown === false) return [
    ageFactsToText({ ...f, birthTimeKnown: false }),
    `性别：${b.gender === 'male' ? '男' : '女'}；公历生日：${b.year}年${b.month}月${b.day}日`,
    `农历生日：${f.lunarBirthYear}年${l.isLeapMonth ? '闰' : ''}${l.lunarMonth}月${l.lunarDay}日；生年干支：${STEMS[l.yearStem] ?? '?'}${BRANCHES[l.yearBranch] ?? '?'}`,
    `生年四化：${Object.entries(getSiHuaByStem(l.yearStem)).map(([mark, star]) => `${star}化${mark}`).join('、')}`,
  ].join('\n');
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
    if (to.birthInfo.birthTimeKnown === false) return '';
    if (from.lunarInfo.yearStem < 0) return `${label}：生年干缺失，不能推算。`;
    return `${label}（生年干${STEMS[from.lunarInfo.yearStem]}）：` + Object.entries(getSiHuaByStem(from.lunarInfo.yearStem)).map(([h, star]) => `${star}化${h}→${to.palaces.find(p => p.stars.some(s => s.name === star))?.name ?? '未知宫位'}`).join('；');
  };
  return [direction(a, b, 'A→B'), direction(b, a, 'B→A')].filter(Boolean).join('\n');
}
