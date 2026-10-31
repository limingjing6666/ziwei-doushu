import { scan, check, collectFile, files, loadFingerprints } from './guard';
import { writeFileSync } from 'node:fs';

const report = scan();
// Optional generated pages / captured AI answers are checked with the same thresholds.
const extra = process.argv.indexOf('--extra');
if (extra >= 0) {
  const source = loadFingerprints();
  for (const path of process.argv.slice(extra + 1)) {
    const targets = path.endsWith('/') ? files(path) : [path];
    for (const target of targets.filter(p => /\.(txt|html|md|json|tsx?)$/.test(p))) for (const unit of collectFile(target)) {
      const result = check(unit.text, source);
      if (result.failed) report.failures.push({ ...unit, result });
    }
  }
}
writeFileSync('/tmp/tianjipan-copyright-result.json', JSON.stringify(report, null, 2));
for (const f of report.failures) console.error(`${f.path}:${f.line} continuous10=${f.result.continuous} eightRatio=${f.result.ratio.toFixed(3)}`);
console.log(`[copyright] ${report.files} files / ${report.units} text units / ${report.failures.length} failures`);
process.exitCode = report.failures.length ? 1 : 0;
