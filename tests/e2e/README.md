# End-to-end tests

- `app-shell.spec.ts` verifies the M0 workspace in a real browser.
- `csv-upload.spec.ts` verifies Playwright can upload and read the synthetic CSV fixture.

The CSV test validates test infrastructure only. Replace it with the product import workflow when the source-file control is implemented in M1.

Run Chromium locally with `pnpm test:e2e`. Run the configured browser matrix with `pnpm test:e2e:all` after installing the corresponding Playwright browsers.
