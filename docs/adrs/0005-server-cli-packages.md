# ADR 0005: Server and CLI packages

## Status

Accepted (2026-09-02); amended 2026-09-04 (one user-facing bin, ADR 0010); amended 2026-09-04 (server is library-only); amended 2026-09-04 (exports + CLI-owned `service.json`, ADR 0012).

## Context

The HTTP server is the product. The CLI is an HTTP client. One `src/main.ts` still started the server and issued import/search requests. A third `api` package was rejected: the server owns the contract; the CLI depends on the server.

## Decision

- `@xkeep/server` (`packages/server`): sqlite, media, embed, HTTP, dump schema, `HttpApi`. Library only: no shebang, no `Command`, no `bin`.
- `@xkeep/cli` (`packages/cli`): user-facing bin `xkeep`. Owns argv and `service.json`. `service` owns the process. `api` is a curl-style client of the running server (`operationId` via live `/api/openapi.json`, or `METHOD /path`). `service serve` lazy-imports `@xkeep/server` (`layer`). `api` / `service start|stop|status` do not import sqlite.
- CLI depends on `"@xkeep/server": "workspace:*"`.
- Server `exports`: `"."` is `layer(overrides)`; `"./schema"` is HTTP wire schemas. No `./api`, no `./run-server`.
- Root package `xkeep` is private and has no `bin`. `nub run start` is `xkeep service serve`.

## Consequences

The user-facing command is `xkeep`. `api` does not spawn the daemon. `service start` and the bare command do.
