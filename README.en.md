# Tianjipan · AI Zi Wei Chart

**Traditional charting · Three-harmony structure · Four transformations · AI interpretation**

An independently organized Next.js 16 application for Zi Wei Dou Shu charting, time-cycle views, chart comparison, topic retrieval and classical-text reading. No personal endorsement, authorized lineage or scientific prediction is claimed. Interpretations are cultural references, not medical, legal or investment advice.

See [README.md](./README.md) for setup, API contracts and deployment limitations. This branch does not implement payment or account authorization; these are required before offering a paid service.

```sh
npm ci
npm run typecheck
npm test
env -u DEEPSEEK_API_KEY npm run build
npm run start
```

Inject credentials only at runtime, never into build caches, source files or logs. Configure the server-side `DEEPSEEK_API_KEY` outside the repository.

## Attribution

Some reference data is derived from the Ziwei Doushu Open Interpretation Dataset v4.0, https://github.com/Renhuai123/ziwei-doushu, author **王多鱼AI**, licensed CC BY 4.0. This branch extracts, deduplicates and filters references, with an additional verbatim-overlap audit. Attribution does not grant rights to third-party quotations; protected lecture transcripts have been removed.

Code: MIT. Dataset: see `DATASET-LICENSE`. Historical public-domain texts do not imply a license to modern annotations. Method extraction was informed by the MIT-licensed [nuwa-skill](https://github.com/alchaincyf/nuwa-skill) framework; the resulting material is a neutral topic toolkit, not a personality imitation.
