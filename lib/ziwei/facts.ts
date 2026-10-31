import { astro } from 'iztro';
import { BRANCHES, STEMS } from './constants';
import { resolveEffectiveLunarDate, type LunarMonthPolicy } from './algorithm';
import { getSiHuaByStem } from './sihua';
import type { ZiweiChart } from './types';

export interface FactOptions { currentYear?: number; currentDate?: string; selectedYear?: number }
export interface YearFact {
  year: number; nominalAge: number; marriagePalace: string; palaceNames: string[];
  transformations: { star: string; mark: string; palace: string; branch: number }[];
  decadal?: { index: number; palace: string; branch: number; startAge: number; endAge: number; startYear: number; endYear: number; stem: string; transformations: string };
}
export interface MarriageCandidate extends YearFact { score: number; reasons: string[] }
export interface MarriageFacts { unavailable: boolean; reason?: string; rangeText: string; years: number[]; candidates: MarriageCandidate[] }
export interface AgeWhitelist { ages: number[]; years: number[]; ageRanges: [number, number][]; yearRanges: [number, number][] }
export interface AgeFacts {
  birthYear: number; lunarBirthYear: number; currentYear: number; currentAge?: number; selected?: YearFact;
  currentDecadal?: YearFact['decadal']; decadals: NonNullable<YearFact['decadal']>[];
  marriage: MarriageFacts; health: { years: number[]; entries: { year: number; nominalAge: number; reasons: string[] }[] };
  whitelist: AgeWhitelist; birthTimeKnown: boolean; discrepancies: string[];
}
const mod = (n: number) => (n % 12 + 12) % 12;
const name = (s: string) => s.replace(/宫$/, '').replace('交友', '仆役');
/** 子年卯起逆行；天喜永远在红鸾对宫。输入/输出均为子起零基地支。 */
export function annualRomanceStars(yearBranch: number) {
  if (!Number.isInteger(yearBranch) || yearBranch < 0 || yearBranch > 11) throw new RangeError('invalid branch');
  const hongluan = mod(3 - yearBranch);
  return { hongluan, tianxi: mod(hongluan + 6) };
}

/** Only consumes already-corrected 排盘日/hour, NEVER applies clock/solar correction again.
 * No astro.config mutation: chart geometry/brightness/decadals always win over iztro.
 * Non-default leap policy is reconstructed exactly as generateChart does. */
export function factAstrolabe(chart: ZiweiChart) {
  const b = chart.birthInfo;
  if (b.year < 1800 || b.month < 1 || b.day < 1 || b.hour < 0 || !['male', 'female'].includes(b.gender)) throw new Error('incomplete birth');
  const policy = (b as typeof b & { leapMonthPolicy?: LunarMonthPolicy }).leapMonthPolicy ?? 'split';
  const l = resolveEffectiveLunarDate(b.year, b.month, b.day, policy);
  return policy !== 'split' && l.rawLunarMonth < 0
    ? astro.byLunar(`${l.lunarYear}-${l.lunarMonth}-${l.lunarDay}`, b.hour, b.gender === 'male' ? '男' : '女', l.isLeapMonth, false, 'zh-CN')
    : astro.bySolar(`${b.year}-${b.month}-${b.day}`, b.hour, b.gender === 'male' ? '男' : '女', true, 'zh-CN');
}
function engine(chart: ZiweiChart, opts: FactOptions) {
  const a = factAstrolabe(chart);
  const currentYear = opts.currentYear ?? chart.lunarInfo.lunarYear + chart.currentAge - 1;
  // Annual labels refer to the lunar year named by that Gregorian year (July 1 is after 春节).
  const at = (year: number) => a.horoscope(`${year}-7-1`);
  const ageAt = (year: number) => at(year).age.nominalAge;
  const base = currentYear - ageAt(currentYear) + 1;
  const decadals = chart.daXians.filter(d => d.startAge >= 1 && d.endAge >= d.startAge).map((d, i) => {
    const stem = chart.palaces.find(p => p.branch === d.palaceBranch)?.stem ?? -1;
    return { index: i + 1, palace: d.palaceName, branch: d.palaceBranch, startAge: d.startAge, endAge: d.endAge,
      startYear: base + d.startAge - 1, endYear: base + d.endAge - 1, stem: STEMS[stem] ?? '未知',
      transformations: Object.entries(getSiHuaByStem(stem)).map(([h, s]) => `${s}化${h}`).join('、') };
  });
  const yearFact = (year: number): YearFact => {
    const h = at(year), nominalAge = h.age.nominalAge;
    const palaceNames = a.palaces.map((p, i) => `${h.yearly.palaceNames[i]}→本命${chart.palaces.find(q => BRANCHES[q.branch] === p.earthlyBranch)?.name ?? '未知'}`);
    const spouseIndex = h.yearly.palaceNames.findIndex(n => name(n) === '夫妻');
    const branch = BRANCHES.indexOf(a.palaces[spouseIndex]?.earthlyBranch ?? '');
    return { year, nominalAge, marriagePalace: chart.palaces.find(p => p.branch === branch)?.name ?? '未知', palaceNames,
      decadal: decadals.find(d => nominalAge >= d.startAge && nominalAge <= d.endAge),
      transformations: h.yearly.mutagen.map((star, i) => {
        const p = chart.palaces.find(p => p.stars.some(s => s.name === star));
        return { star, mark: ['禄', '权', '科', '忌'][i], palace: p?.name ?? '未知', branch: p?.branch ?? -1 };
      }) };
  };
  const currentAge = opts.currentDate ? a.horoscope(opts.currentDate).age.nominalAge : ageAt(currentYear);
  return { a, currentYear, currentAge, ageAt, base, decadals, yearFact, at };
}
const unavailable = (reason: string): MarriageFacts => ({ unavailable: true, reason, rangeText: '', years: [], candidates: [] });
/** Transparent heuristic, NOT a prediction probability:
 * each annual 红鸾/天喜 entering natal 夫妻 +4, natal 命 +2 (year-branch placement);
 * each 禄权科 on natal spouse/trine/opposite +2; 忌 on natal spouse -3;
 * annual spouse same/opposite decadal 命 or 夫妻 +2 each (夫妻 = 大命-2);
 * natal spouse each 贪狼/廉贞/天姚/咸池 +0.5. Score descending, ties earlier year.
 * Scan current nominal age-2 through 55 inclusive, retain top 3. Range is envelope,
 * NOT a claim that every intervening year scores equally; years is the actual candidate set. */
export function getMarriageCandidates(chart: ZiweiChart, opts: FactOptions = {}): MarriageFacts {
  if (chart.birthInfo.birthTimeKnown === false) return unavailable('出生时辰未知，目前无法确定婚期');
  try {
    const e = engine(chart, opts), spouse = chart.palaces.find(p => name(p.name) === '夫妻');
    if (!spouse || chart.palaces.length !== 12) return unavailable('命盘资料不完整，目前无法确定');
    const candidates: MarriageCandidate[] = [];
    for (let year = Math.max(e.base + e.currentAge - 3, e.base); e.ageAt(year) <= 55; year++) {
      const f = e.yearFact(year), h = e.at(year), reasons: string[] = []; let score = 0;
      const add = (n: number, why: string) => { score += n; reasons.push(`${why}（${n > 0 ? '+' : ''}${n}）`); };
      const branchFor = (n: string) => BRANCHES.indexOf(e.a.palaces[h.yearly.palaceNames.findIndex(p => name(p) === n)]?.earthlyBranch ?? '');
      const romance = annualRomanceStars(BRANCHES.indexOf(h.yearly.earthlyBranch));
      for (const [star, branch] of [['红鸾', romance.hongluan], ['天喜', romance.tianxi]] as const) {
        if (branch === spouse.branch) add(4, `流年${star}入本命夫妻宫`);
        if (branch === chart.mingGongBranch) add(2, `流年${star}入本命命宫`);
      }
      for (const t of f.transformations) {
        if (t.mark !== '忌' && [0, 4, 6, 8].some(o => mod(spouse.branch + o) === t.branch)) add(2, `${t.star}流年化${t.mark}在本命${t.palace}，引动夫妻三方四正`);
        if (t.mark === '忌' && t.branch === spouse.branch) add(-3, `${t.star}流年化忌入本命夫妻，感情波折`);
      }
      if (f.decadal) for (const [label, branch] of [['命', f.decadal.branch], ['夫妻', mod(f.decadal.branch - 2)]] as const)
        if ([branch, mod(branch + 6)].includes(branchFor('夫妻'))) add(2, `流年夫妻与大限${label}同宫或对宫`);
      for (const s of spouse.stars) if (['贪狼', '廉贞', '天姚', '咸池'].includes(s.name)) add(0.5, `本命夫妻有${s.name}桃花辅助线索`);
      candidates.push({ ...f, score, reasons });
    }
    const top = candidates.sort((a, b) => b.score - a.score || a.year - b.year).slice(0, 3);
    if (top.length < 2) return unavailable('扫描范围内不足两个年份，目前无法确定候选');
    const years = top.map(c => c.year), lo = Math.min(...years), hi = Math.max(...years);
    return { unavailable: false, candidates: top, years, rangeText: `虚岁 ${e.ageAt(lo)}–${e.ageAt(hi)}（公历 ${lo}–${hi}）` };
  } catch { return unavailable('出生数据不足，目前无法确定'); }
}
/** Fifteen annual labels: current-2 through current+12. Only annual 忌 entering natal 命/疾厄.
 * Deliberately no speculative malefic-overlap scoring. */
export function getHealthYears(chart: ZiweiChart, opts: FactOptions = {}) {
  const entries: AgeFacts['health']['entries'] = [];
  if (chart.birthInfo.birthTimeKnown !== false) try {
    const e = engine(chart, opts);
    for (let year = e.currentYear - 2; year <= e.currentYear + 12; year++) {
      const f = e.yearFact(year), hits = f.transformations.filter(t => t.mark === '忌' && ['命', '疾厄'].includes(name(t.palace)));
      if (hits.length) entries.push({ year, nominalAge: f.nominalAge, reasons: hits.map(t => `${t.star}流年化忌入本命${t.palace}`) });
    }
  } catch { /* missing facts never invented */ }
  return { years: entries.map(e => e.year), entries };
}
export function buildAgeFacts(chart: ZiweiChart, opts: FactOptions = {}): AgeFacts {
  const facts: AgeFacts = { birthYear: chart.birthInfo.year, lunarBirthYear: chart.lunarInfo.lunarYear,
    currentYear: opts.currentYear ?? chart.lunarInfo.lunarYear + chart.currentAge - 1,
    decadals: [], marriage: getMarriageCandidates(chart, opts), health: getHealthYears(chart, opts), birthTimeKnown: chart.birthInfo.birthTimeKnown !== false,
    whitelist: { ages: [], years: [], ageRanges: [], yearRanges: [] }, discrepancies: [] };
  try {
    const e = engine(chart, opts);
    facts.currentAge = e.currentAge;
    facts.selected = e.yearFact(opts.selectedYear ?? e.currentYear);
    facts.decadals = e.decadals;
    facts.currentDecadal = e.decadals.find(d => facts.currentAge! >= d.startAge && facts.currentAge! <= d.endAge);
    for (const p of e.a.palaces) {
      const own = chart.daXians.find(d => BRANCHES[d.palaceBranch] === p.earthlyBranch);
      if (!own || own.startAge !== p.decadal.range[0] || own.endAge !== p.decadal.range[1]) facts.discrepancies.push(`本命${p.name}大限范围不同，以页面数据为准`);
    }
    const w = facts.whitelist;
    w.ages = [facts.currentAge, facts.selected.nominalAge, ...facts.marriage.candidates.map(c => c.nominalAge), ...facts.health.entries.map(c => c.nominalAge)];
    w.years = [facts.birthYear, facts.currentYear, facts.selected.year, ...facts.marriage.years, ...facts.health.years];
    w.ageRanges = e.decadals.map(d => [d.startAge, d.endAge]);
    w.yearRanges = e.decadals.map(d => [d.startYear, d.endYear]);
  } catch { /* partial chart supported */ }
  return facts;
}
export function buildAgeWhitelist(chart: ZiweiChart, opts: FactOptions = {}): AgeWhitelist { return buildAgeFacts(chart, opts).whitelist; }
