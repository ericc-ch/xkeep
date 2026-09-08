# Import and status

## Sub-features

- Import through the file chooser.
- Import by dropping JSON on the canvas.
- Imported, updated, and tombstone-skip counts.
- Background import and embedding status.
- SSE refresh after embedding.

## How to get to it (user POV)

Open `/`. Click `Import JSON` or drop an xkeep dump anywhere on the canvas. The status pill reports ready and embedding counts. Click the status pill for import and semantic-model details.

## Driving it with Playwriter

Run `scripts/verify-mutations.mjs`. The helper uses `getByLabel("Import bookmarks JSON")`, uploads the fixtures, waits for import notices, polls the real API until every bookmark has coordinates, and saves screenshots plus response bodies.

For drop coverage, create a `DataTransfer` in `page.evaluate`, attach the fixture as a `File`, and dispatch `dragover` plus `drop` on the page's `main` element.

## Gotchas

Use a new isolated server run for the expected `imported: 1` count. Reusing the same database changes the result to `updated: 1`. Tombstoned ids return `skippedDeleted` and do not reappear.
