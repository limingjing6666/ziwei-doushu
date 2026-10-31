import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { ALL_BOOKS, getBookBySlug, getChapter, getParagraphById, searchClassics } from '../../lib/classics';
import { CLASSICS_NOTICE } from '../../lib/classics/types';
import sitemap from '../../app/sitemap';
import { generateStaticParams as bookParams, generateMetadata as bookMetadata } from '../../app/library/[book]/page';
import { generateStaticParams as chapterParams, generateMetadata as chapterMetadata } from '../../app/library/[book]/[chapter]/page';

async function main() {
  assert.deepEqual(ALL_BOOKS.map(b => b.slug), ['quanshu']);
  assert.equal(getBookBySlug('gusuifu'), null);
  assert.equal(getBookBySlug('quanji'), null);
  const book = ALL_BOOKS[0];
  assert.ok(book.chapters.length >= 80);
  assert.equal(book.chapters.length, 89);
  assert.ok(book.wordCount > 50_000);
  assert.equal(book.source, 'https://zh.wikisource.org/wiki/紫微斗數全書');
  assert.ok(book.edition && book.license);
  assert.match(book.license, /CC BY-SA 4.0/);
  assert.match(CLASSICS_NOTICE, /维基文库/);
  assert.match(CLASSICS_NOTICE, /CC BY-SA 4.0/);
  const paragraphs = book.chapters.flatMap(c => c.paragraphs);
  const text = paragraphs.map(p => p.text).join('\n');
  assert.match(text, /太极星缠，乃群宿众星之主/);
  assert.ok(book.chapters.some(c => c.title === '卷一·斗数骨髓赋'));
  assert.doesNotMatch(text, /太极星曜|命宫者，一身之根本，万事之枢纽|\{\{|\[\[|<\/?(?:poem|nowiki)>/);
  assert.equal(new Set(paragraphs.map(p => p.id)).size, paragraphs.length);
  const placeholder = '【此处原书有表格或图表，暂未收录，请对照原书。】';
  assert.equal(paragraphs.filter(p => p.text === placeholder).length, 9);
  assert.equal(paragraphs.filter(p => p.text !== placeholder).reduce((sum, p) => sum + (p.text.match(/\p{Unified_Ideograph}/gu)?.length ?? 0), 0), book.wordCount);
  for (const [ci, chapter] of book.chapters.entries()) {
    assert.match(chapter.title, /^卷[一二三]·/);
    assert.ok(chapter.paragraphs.length);
    for (const [pi, p] of chapter.paragraphs.entries()) {
      assert.equal(p.id, `qs-${ci + 1}-${pi + 1}`);
      assert.equal(p.idx, pi + 1);
      assert.equal(getParagraphById(p.id)?.chapterIdx, ci);
    }
  }
  const intermediate = JSON.parse(readFileSync('scripts/build-classics/quanshu-simplified.json', 'utf8'));
  assert.deepEqual(intermediate.map((c: { paragraphs: string[] }) => c.paragraphs), book.chapters.map(c => c.paragraphs.map(p => p.text)));
  assert.ok(searchClassics('骨髓').length >= 2, 'chapter titles are searchable');
  assert.ok(searchClassics('紫微').length > 0);
  assert.ok(searchClassics('紫微', 2).length === 2);
  assert.deepEqual(searchClassics('  '), []);
  assert.equal(getChapter('quanshu', -1), null);
  assert.equal(getChapter('quanshu', 0.5), null);
  assert.equal(getChapter('quanshu', 89), null);
  assert.equal(getChapter('quanshu', NaN), null);
  assert.ok(getChapter('quanshu', 88));
  assert.deepEqual(await bookParams(), [{ book: 'quanshu' }]);
  assert.equal((await chapterParams()).length, 89);
  assert.match(String((await bookMetadata({ params: Promise.resolve({ book: 'quanshu' }) })).title), /古籍原文/);
  for (const chapter of ['0', '57', '88']) {
    assert.match(String((await chapterMetadata({ params: Promise.resolve({ book: 'quanshu', chapter }) })).title), /古籍原文/);
  }
  assert.deepEqual(await chapterMetadata({ params: Promise.resolve({ book: 'quanshu', chapter: '0junk' }) }), {});
  const entries = sitemap();
  assert.ok(entries.every(e => !/gusuifu|quanji/.test(e.url)));
  assert.equal(entries.filter(e => /\/library\/quanshu\/\d+$/.test(e.url)).length, 89);
  assert.equal(entries.filter(e => /\/library\/quanshu$/.test(e.url)).length, 1);
  const files = execFileSync('git', ['ls-files', '-z', '--', 'app/library'], { encoding: 'utf8' }).split('\0').filter(Boolean);
  for (const file of files) {
    assert.doesNotMatch(readFileSync(file, 'utf8'), /紫微斗数全集|主题整理|整理稿|含现代说明/, file);
  }
  for (const file of ['app/library/page.tsx', 'app/library/[book]/page.tsx', 'app/library/[book]/[chapter]/page.tsx', 'app/library/search/page.tsx']) {
    const source = readFileSync(file, 'utf8');
    assert.match(source, /\{CLASSICS_NOTICE\}/);
    assert.match(source, /原文来源：<a href=\{CLASSICS_SOURCE\}/);
    assert.match(source, /CC BY-SA 4.0，繁转简，未逐字校勘。/);
  }
  const require = createRequire(import.meta.url);
  const redirects = await require('../../next.config.js').redirects();
  assert.deepEqual(redirects.find((r: { source: string }) => r.source === '/library/gusuifu/:path*'),
    { source: '/library/gusuifu/:path*', destination: '/library/quanshu/45', permanent: true });
  assert.equal(book.chapters[45].title, '卷一·斗数骨髓赋');
  assert.deepEqual(redirects.find((r: { source: string }) => r.source === '/library/quanji/:path*'),
    { source: '/library/quanji/:path*', destination: '/library/quanshu', permanent: true });
  console.log(`✓ classics: 1 book, 89 chapters, ${book.wordCount} characters; search, IDs, metadata, sitemap, notices and redirects passed`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
