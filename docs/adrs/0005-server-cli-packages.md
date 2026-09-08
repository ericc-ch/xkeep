# ADR 0005: Server and CLI packages

## Status

Accepted (2026-09-02); amended 2026-09-04 (one user-facing bin, ADR 0010); amended 2026-09-04 (server is library-only); amended 2026-09-04 (exports + CLI-owned `service.json`, ADR 0012); amended 2026-09-05 (root `start` builds web first); amended 2026-09-08 (tsdown output and conditional exports).

## Context

The HTTP server is the product. The CLI is an HTTP client. One `src/main.ts` still started the server and issued import/search requests. A third `api` package was rejected: the server owns the contract; the CLI depends on the server.

## Decision

- `@xkeep/server` (`packages/server`): sqlite, media, embed, HTTP, dump schema, `HttpApi`. Library only: no shebang, no `Command`, no `bin`.
- `@xkeep/cli` (`packages/cli`): user-facing bin `xkeep`. Owns argv and `service.json`. `service` owns the process. `api` is a curl-style client of the running server (`operationId` via live `/api/openapi.json`, or `METHOD /path`). `service serve` lazy-imports `@xkeep/server` (`layer`). `api` / `service start|stop|status` do not import sqlite.
- CLI depends on `"@xkeep/server": "workspace:*"`.
- Server `exports`: `"."` is `layer(overrides)`; `"./schema"` is dump intake; `"./schema-http"` is HTTP wire; `"./api"` is the `HttpApi` value. No `./run-server`. Each export selects TypeScript source for `development`, declarations for `types`, and built ESM by default.
- tsdown builds server/CLI as unbundled ESM with declarations and source maps, keeping package dependencies external. The CLI source remains directly runnable with Nub in development; the published-style `xkeep` bin points to executable `dist/main.js`.
- Root package `xkeep` is private and has no `bin`. `nub run start` runs the full workspace build then the compiled `xkeep service serve`.

## Consequences

The user-facing command is `xkeep`. `api` does not spawn the daemon. `service start` and the bare command do. Workspace development gets source-level iteration while normal Node resolution exercises the same compiled boundary intended for later npm publication.
