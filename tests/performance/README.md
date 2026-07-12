# Browser performance benchmark

Run the dedicated Chromium benchmark from the repository root:

```bash
pnpm test:performance
```

The test generates a deterministic 100,000-row CSV in memory, imports it through
the same file input and Web Worker path as a user, and waits for the 1,000-row
preview. The emitted `PERFORMANCE_RESULT` JSON reports:

- source row and byte counts;
- elapsed wall time from file selection through preview completion;
- Chromium's JavaScript heap before and after the run;
- main-thread long-task count, longest duration, and total duration.

The committed guardrails are 30 seconds elapsed time and 512 MiB additional JS
heap. These broad limits detect severe regressions without treating
machine-specific benchmark variation as a product failure.
