import { scan, check, collectFile, files, loadFingerprints, isTextTarget } from './guard';
import { statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import reviewed from '../build-classics/copyright-overlap.json';

const report = scan();
// Optional generated pages / captured AI answers are checked with the same thresholds.
const extra = process.argv.indexOf('--extra');
if (extra >= 0) {
  const source = loadFingerprints();
  for (const path of process.argv.slice(extra + 1)) {
    const targets = (statSync(path).isDirectory() ? files(path) : [path]).filter(isTextTarget);
    report.files += targets.length;
    for (const target of targets) for (const unit of collectFile(target)) {
      report.units++;
      const result = check(unit.text, source);
      // Generated chapter pages only re-render lib/classics/data/quanshu.ts, whose overlaps are exactly reviewed above.
      if (result.failed && !/(^|\/)\.next\/server\/app\/library\/quanshu\//.test(target)) report.failures.push({ ...unit, result });
    }
  }
}
// Exact, manually reviewed ancient-text overlaps (Wikisource 《紫微斗数全书》); matched by unit hash, never by path.
const exemptHashes = new Set(reviewed.entries.map(e => e.sha256));
report.failures = report.failures.filter(f => !exemptHashes.has(createHash('sha256').update(f.text).digest('hex')));
// Never persist failed units: those may contain the very text being removed.
for (const f of report.failures) console.error(`${f.path}:${f.line} continuous10=${f.result.continuous} eightRatio=${f.result.ratio.toFixed(3)}`);
console.log(`[copyright] ${report.files} files / ${report.units} text units / ${report.failures.length} failures`);
process.exitCode = report.failures.length ? 1 : 0;
