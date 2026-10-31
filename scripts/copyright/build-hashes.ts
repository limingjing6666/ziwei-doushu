import { mkdirSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { fingerprint, sourceTexts } from './guard';

const raw = sourceTexts();
if (!raw) throw new Error('Read-only source checkout required to generate fingerprints.');
const source = fingerprint(raw);
mkdirSync('scripts/copyright', { recursive: true });
writeFileSync('scripts/copyright/source-hashes.json.gz', gzipSync(JSON.stringify({
  version: 1, algorithm: 'sha256', normalization: 'NFKC then Han-only, per entry/quote',
  eight: [...source.eight].sort(), ten: [...source.ten].sort(),
}), { level: 9 }));
console.log(`Fingerprints only: eight=${source.eight.size}, ten=${source.ten.size}`);
