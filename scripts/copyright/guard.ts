import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';

export const normalize = (text: string) => (text.normalize('NFKC').match(/\p{Script=Han}/gu) ?? []).join('');
// 128-bit SHA-256 prefixes: ~213k windows have negligible collision risk (~7e-29).
// Hashes are not ciphertext; short, guessable inputs still admit dictionary tests.
export const digest = (text: string) => createHash('sha256').update(text).digest('hex').slice(0, 32);
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
  if (baseline.version !== 2 || baseline.algorithm !== 'sha256-128'
    || !['eight', 'ten'].every(k => Array.isArray(baseline[k]) && baseline[k].every((h: unknown) => typeof h === 'string' && /^[a-f0-9]{32}$/.test(h)))) {
    throw new Error('Invalid fingerprints-only baseline.');
  }
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
export function collectFile(path: string, text = readFileSync(path, 'utf8')): TextUnit[] {
  if (!/\.[cm]?[jt]sx?$/.test(path)) {
    if (path.endsWith('.html')) {
      const rendered = text.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, '')
        .replace(/&#(x[0-9a-f]+|\d+);/gi, (_, code: string) => String.fromCodePoint(code[0].toLowerCase() === 'x' ? parseInt(code.slice(1), 16) : Number(code)))
        .replace(/&(?:nbsp|amp|quot|lt|gt|apos);/g, '');
      return [{ path, line: 1, text: rendered }];
    }
    if (/\.(json|map)$/.test(path)) {
      const units: TextUnit[] = [];
      const visit = (v: unknown) => {
        if (typeof v === 'string') units.push({ path, line: 1, text: v });
        else if (v && typeof v === 'object') Object.values(v).forEach(visit);
      };
      const parsed = JSON.parse(text);
      if (path.endsWith('.map') && Array.isArray(parsed.sourcesContent)) {
        // A source map embeds code, not a single rendered string. Parse each
        // embedded source just like tracked code; never join unrelated literals.
        parsed.sourcesContent.forEach((content: unknown, i: number) => {
          if (typeof content === 'string') units.push(...collectFile(`${path}#${parsed.sources?.[i] ?? 'embedded.js'}`, content));
        });
        const { sourcesContent: _embedded, ...metadata } = parsed;
        visit(metadata);
      } else visit(parsed);
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
  // Comments are shipped too; do not silently exempt them from content review.
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, false, ts.LanguageVariant.Standard, text);
  for (let token = scanner.scan(); token !== ts.SyntaxKind.EndOfFileToken; token = scanner.scan()) {
    if (token === ts.SyntaxKind.SingleLineCommentTrivia || token === ts.SyntaxKind.MultiLineCommentTrivia) {
      units.push({ path, line: source.getLineAndCharacterOfPosition(scanner.getTokenPos()).line + 1, text: scanner.getTokenText() });
    }
  }
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
export const isTextTarget = (path: string) => /\.(?:[cm]?[jt]sx?|json|map|md|txt|html|rsc|py|ya?ml|css)$/.test(path)
  || /(?:^|\/)(?:LICENSE|DATASET-LICENSE|\.gitignore|\.env\.example)$/.test(path);

export function scan(root = process.cwd()) {
  const source = loadFingerprints();
  // The tracked tree is the boundary, including scripts, CI, licenses and comments.
  const targets = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' }).split('\0')
    .filter(Boolean).map(p => join(root, p))
    .filter(p => existsSync(p) && (isTextTarget(p) || !readFileSync(p).includes(0)));
  const units = targets.flatMap(p => collectFile(p));
  const failures = units.map(u => ({ ...u, result: check(u.text, source) })).filter(u => u.result.failed);
  return { units: units.length, files: targets.length, failures: failures.map(f => ({ ...f, path: relative(root, f.path) })) };
}
