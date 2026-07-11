# Visual Data Pipeline

A browser-only visual workspace for importing, transforming, previewing, and exporting tabular data. Source data stays in the current browser session and is not sent to a backend.

## Status

M0 engineering baseline: workspace, shared contracts, Worker protocol, tests, and fixtures.

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
pnpm build
pnpm dev
```

## Workspace

- `apps/web`: React and Vite browser application.
- `packages/contracts`: TypeScript and Zod shared contracts.
- `packages/test-fixtures`: synthetic CSV and JSON fixtures.
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
