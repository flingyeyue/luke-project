# Demonstration guide

## Start

```bash
corepack enable pnpm
pnpm install --frozen-lockfile
pnpm dev
```

Open the URL printed by Vite. The demonstration requires no account, backend,
database, or network request after dependencies are installed.

## Single-source pipeline

1. Select `packages/test-fixtures/data/orders-small.csv`.
2. Add the Filter node. In visual mode, choose a binary expression, set the left
   value to column `status-4`, keep the equality operator, and set the right
   literal to `completed`. Apply the configuration.
3. Add CSV Output and run the pipeline.
4. Confirm the preview reports 7 rows, includes `ORD-1001` and `ORD-1010`, and
   infers `amount` as a number.
5. Switch between Visual and JSON on a selected node to confirm both editors
   represent the same configuration.
6. Export and confirm the downloaded `pipeline-output.csv` contains `ORD-1010`.

## Two-source Join

1. Select `orders-small.csv` as the first source.
2. Add another CSV Input and select a CSV with `region,owner` columns and north,
   south, east, and west rows.
3. Add Join. The two current terminals connect to its `left` and `right` ports.
4. In the visual editor, select Inner Join, set the left key to `region-3`, the
   right key to `region-1`, and the right-column prefix to `region.`. Apply the
   configuration.

5. Add CSV Output and run. Confirm 10 rows and an `owner` column are visible.

## Project recovery

After changing the graph, confirm the project status is unsaved. Save the
project, make another change, and verify that New/Open asks before discarding the
change. Reloading restores the local draft without embedding source rows or File
objects in the project JSON.

## Current limitations

- The UI file picker currently binds CSV sources; JSON and XLSX adapters are
  library capabilities without equivalent source controls in the workspace.
- Cancellation is checked at asynchronous file-read and node boundaries; a
  synchronous CSV parse already in progress cannot be preempted.
- The measured performance baseline comes from the current development machine,
  not a standardized hardware fleet.
