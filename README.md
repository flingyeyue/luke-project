# Visual Data Pipeline

A browser-only visual workspace for importing, transforming, previewing, and exporting tabular data. Source data stays in the current browser session and is not sent to a backend.

## Status

M4 release candidate. The browser application supports visual CSV pipelines,
core transforms, grouped aggregation, two-source joins, project save/recovery,
visual and JSON node configuration, CSV/JSON/XLSX adapters, virtualized
previews, and local export. No backend or database is required.

## Requirements

- Node.js 24
- Corepack
- pnpm 11.11.0

## Commands

```bash
corepack enable pnpm
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm test:e2e:all
pnpm test:performance
pnpm audit --prod
pnpm build
pnpm dev
```

Install the Playwright browser matrix and host dependencies before the first
`test:e2e:all` run:

```bash
pnpm exec playwright install
sudo pnpm exec playwright install-deps
```

## Demonstration

See [docs/demo.md](docs/demo.md) for the repeatable single-source and two-source
Join demonstrations, expected results, and current limitations.

The latest verified baseline is 118 unit/component tests and 16 E2E scenarios
across desktop Chromium, Firefox, WebKit, and mobile Chromium. The dedicated
100,000-row Chromium performance benchmark remains available separately. These
numbers are evidence from the 2026-07-13 configuration editor review, not
permanent expectations; use the commands above to produce current results.

## Workspace

- `apps/web`: React and Vite browser application.
- `packages/contracts`: TypeScript and Zod shared contracts.
- `packages/file-adapters`: CSV, JSON, XLSX, and project-file adapters.
- `packages/pipeline-engine`: graph validation, transforms, Join, and caching.
- `packages/test-fixtures`: synthetic CSV and JSON fixtures.
- `tests/e2e`: browser workflows.
- `tests/performance`: deterministic browser performance benchmark.
- `docs/contracts.md`: project copy of the shared contract.
- `scripts/check-contract-sync.sh`: verifies both contract copies match.

## Project Knowledge

- [Knowledge base](https://github.com/flingyeyue/luke-study/tree/main/topics/visual-data-pipeline)
- [Development plan](https://github.com/flingyeyue/luke-study/blob/main/topics/visual-data-pipeline/04-development-plan.md)
- [Task board](https://github.com/flingyeyue/luke-study/blob/main/topics/visual-data-pipeline/05-task-board.md)
- [AI usage log](https://github.com/flingyeyue/luke-study/blob/main/topics/visual-data-pipeline/ai-usage-log.md)

The Markdown contract exists in both repositories. Update both copies together and run:

```bash
scripts/check-contract-sync.sh
```
