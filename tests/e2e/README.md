# End-to-end tests

- `app-shell.spec.ts` verifies the project controls, canvas, node library, and configuration shell.
- `csv-upload.spec.ts` verifies CSV import, Worker execution, preview, Schema, and safe CSV download.
- `join-pipeline.spec.ts` builds a two-source order/region Join and verifies the joined preview.

All fixtures are synthetic. The Join test creates its small regions CSV in memory,
while the single-source test uses the committed orders fixture.

Run Chromium locally with `pnpm test:e2e`. Run the configured browser matrix with
`pnpm test:e2e:all` after installing the corresponding Playwright browsers and
host dependencies. Performance tests are separate because their CDP metrics and
thresholds are Chromium-specific: `pnpm test:performance`.
