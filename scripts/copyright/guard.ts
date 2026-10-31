import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { gunzipSync } from 'node:zlib';
import ts from 'typescript';

export const normalize = (text: string) => (text.normalize('NFKC').match(/\p{Script=Han}/gu) ?? []).join('');
export const digest = (text: string) => createHash('sha256').update(text).digest('hex');
export function grams(text: string, n: number): string[] {
  const chars = [...normalize(text)];
  return Array.from({ length: Math.max(0, chars.length - n + 1) }, (_, i) => chars.slice(i, i + n).join(''));
}
export type Fingerprints = { eight: Set<string>; ten: Set<string> };
export function fingerprint(texts: string[]): Fingerprints {
  return { eight: new Set(texts.flatMap(t => grams(t, 8).map(digest))),
    ten: new Set(texts.flatMap(t => grams(t, 10).map(digest))) };
}
export function check(text: string, source: Fingerprints) {
  const eight = grams(text, 8);
  const overlap = eight.filter(g => source.eight.has(digest(g))).length;
  const ratio = eight.length ? overlap / eight.length : 0;
  const continuous = grams(text, 10).some(g => source.ten.has(digest(g)));
  return { failed: continuous || ratio > 0.1, continuous, ratio, overlap, windows: eight.length };
}

export const SOURCE_ROOT = '/tmp/zw';
export function sourceTexts(root = SOURCE_ROOT): string[] | null {
  const path = join(root, 'docs/tianji-ziwei/entries.jsonl');
  if (!existsSync(path)) return null;
  const entries = readFileSync(path, 'utf8').trim().split('\n').map(l => JSON.parse(l));
  if (entries.length !== 1848) throw new Error('Unexpected source entry count.');
  // All 1,848 entries, not merely the extraction subset. Include notes and headings.
  const texts = entries.flatMap(e => [e.quote, e.note, e.h2, e.h3, e.section].filter(v => typeof v === 'string'));
  const lectures = readFileSync(join(root, 'lib/nihai/tianji.ts'), 'utf8');
  const quotes = lectures.slice(lectures.indexOf('export const TIANJI_QUOTES'), lectures.indexOf('// ─── 统计'));
  const lectureQuotes = Array.from(quotes.matchAll(/text: '([^']*)'/g), m => m[1]);
  const marriage = readFileSync(join(root, 'lib/ziwei/heming-knowledge.ts'), 'utf8');
  const marriageQuotes = Array.from(marriage.matchAll(/ni_quote: '([^']*)'/g), m => m[1]);
  if (lectureQuotes.length !== 29 || marriageQuotes.length !== 9) throw new Error('Incomplete legacy quotation sources.');
  texts.push(...lectureQuotes, ...marriageQuotes);
  return texts;
}

export function loadFingerprints(sourceRoot = SOURCE_ROOT): Fingerprints {
  const raw = sourceTexts(sourceRoot);
  const baseline = JSON.parse(gunzipSync(readFileSync('scripts/copyright/source-hashes.json.gz')).toString());
  if (raw) {
    const current = fingerprint(raw);
    // Baseline must not silently miss new material or change corpus semantics.
    for (const key of ['eight', 'ten'] as const) {
      if (current[key].size !== baseline[key].length || baseline[key].some((h: string) => !current[key].has(h))) {
        throw new Error('Source fingerprints changed; review before regenerating baseline.');
      }
    }
    return current;
  }
  console.warn('[copyright] External source unavailable; raw-source verification skipped; CI hashes still enforce full scan.');
  return { eight: new Set(baseline.eight), ten: new Set(baseline.ten) };
}

export type TextUnit = { path: string; line: number; text: string; start?: number; end?: number };
export function collectFile(path: string): TextUnit[] {
  const text = readFileSync(path, 'utf8');
  if (!/\.[cm]?[jt]sx?$/.test(path)) {
    if (path.endsWith('.html')) {
      const rendered = text.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, '')
        .replace(/&#(x[0-9a-f]+|\d+);/gi, (_, code: string) => String.fromCodePoint(code[0].toLowerCase() === 'x' ? parseInt(code.slice(1), 16) : Number(code)))
        .replace(/&(?:nbsp|amp|quot|lt|gt|apos);/g, '');
      return [{ path, line: 1, text: rendered }];
    }
    if (path.endsWith('.json')) {
      const units: TextUnit[] = [];
      const visit = (v: unknown) => {
        if (typeof v === 'string') units.push({ path, line: 1, text: v });
        else if (v && typeof v === 'object') Object.values(v).forEach(visit);
      };
      visit(JSON.parse(text));
      return units;
    }
    return text.split(/\n\s*\n/).map((text, i) => ({ path, line: i + 1, text }));
  }
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true,
    path.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const units: TextUnit[] = [];
  const add = (node: ts.Node, text: string) => units.push({ path,
    line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
    text, start: node.getStart(source), end: node.end });
  function visit(node: ts.Node) {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isJsxText(node)) add(node, node.text);
    else if (ts.isTemplateExpression(node)) {
      // Inspect fixed pieces independently; never splice across unknown user data.
      add(node.head, node.head.text);
      node.templateSpans.forEach(s => add(s.literal, s.literal.text));
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  // Also join adjacent static JSX text around formatting elements (e.g. <strong>).
  function jsxText(node: ts.JsxChild): string | null {
    if (ts.isJsxText(node)) return node.text;
    if (ts.isJsxElement(node) || ts.isJsxFragment(node)) {
      const pieces = node.children.map(jsxText);
      return pieces.every(p => p !== null) ? pieces.join('') : null;
    }
    if (ts.isJsxExpression(node) && node.expression && ts.isStringLiteralLike(node.expression)) return node.expression.text;
    return null;
  }
  function jsx(node: ts.Node) {
    if (ts.isJsxElement(node) || ts.isJsxFragment(node)) {
      let pending = '';
      for (const child of node.children) {
        const value = jsxText(child);
        if (value === null) { if (pending) add(node, pending); pending = ''; }
        else pending += value;
      }
      if (pending) add(node, pending);
    }
    ts.forEachChild(node, jsx);
  }
  jsx(source);
  return units;
}

export function files(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap(e => e.isDirectory()
    ? files(join(root, e.name)) : [join(root, e.name)]);
}
export function scan(root = process.cwd()) {
  const source = loadFingerprints();
  const targets = ['app', 'components', 'lib', 'docs'].flatMap(d => existsSync(join(root, d)) ? files(join(root, d)) : []);
  targets.push(...files(join(root, 'scripts')).filter(p => p.endsWith('.md')));
  targets.push(...['README.md', 'README.en.md', 'CONTRIBUTING.md', 'DATASET-LICENSE'].map(p => join(root, p)));
  const units = targets.filter(p => /\.(tsx?|jsx?|json|md)$/.test(p) || p.endsWith('DATASET-LICENSE')).flatMap(collectFile);
  const failures = units.map(u => ({ ...u, result: check(u.text, source) })).filter(u => u.result.failed);
  return { units: units.length, files: targets.length, failures: failures.map(f => ({ ...f, path: relative(root, f.path) })) };
}
