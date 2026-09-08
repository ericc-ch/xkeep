# Import and status

## Status

`graduated-to-e2e` — `tests/e2e/xkeep.spec.ts` and `packages/server/test/http.e2e.test.ts`

## Sub-features

- Import through the file chooser.
- Import by dropping JSON on the canvas.
- Imported, updated, and tombstone-skip counts.
- Background import and embedding status.
- SSE refresh after embedding.

## How to get to it (user POV)

Open `/`. Open the app menu and choose `Import JSON`, or drop an xkeep dump anywhere on the canvas. The status pill reports ready and embedding counts. Click the status pill for import and semantic-model details.

## Driving it with native E2E

Run `nub run test:e2e:built`. The native browser test covers drag/drop and file-picker imports, notices, ready/model status, SSE-driven embedding refresh, and tombstone skips. The HTTP suite covers import/update counts and embedding completion without network access.

## Promotion Criteria

The browser and HTTP flows use isolated SQLite directories, deterministic embeddings, local fixture avatars, and no remote media. Imported, updated, ready, and tombstone-skip outcomes have API or visible-UI assertions.

## Gotchas

Use a new isolated server run for the expected `imported: 1` count. Reusing the same database changes the result to `updated: 1`. Tombstoned ids return `skippedDeleted` and do not reappear.
