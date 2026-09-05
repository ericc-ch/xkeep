# ADR 0013: Import returns after sqlite; stills are a daemon fiber

## Status

Accepted (2026-09-04); amended 2026-09-05: no `imports/` copy.

## Context

`POST /api/imports` downloaded every still on the request fiber. A 1575-bookmark dump held the HTTP connection for minutes. Node `fetch` aborted at 300s (`headersTimeout`) and interrupted ingest. Embeddings were already a background drain. Stills were not.

Options: keep blocking (A); return after the dump file is saved (B); upsert sqlite on the request and download stills in the background (C). Overlap: 409 until idle.

## Decision

**C.** Validate the export (`{ bookmarks }`), upsert every bookmark with empty still paths, return `{ imported, updated, stillsPending, pendingEmbeddings }`. Do not write an on-disk copy of the export. A detached fiber downloads stills and upserts paths (ADR 0007 nulls embeddings when stills change). One import at a time: a second POST while that fiber runs is `409 ImportBusy`. `GET /api/health` includes `import: idle | running`. CLI stays one-shot; it prints the upsert result and does not wait for stills.

Rejected: A (the hang). B (library empty until stills finish). Queued or concurrent imports.

## Consequences

Text is searchable before images land. Drain may embed text-only, then re-embed after stills. Dropping the client does not stop stills. Daemon death mid-stills: re-POST the same dump; existing files are skipped.
