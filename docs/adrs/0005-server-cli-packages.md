# ADR 0005: Server and CLI packages

## Status

Accepted (2026-09-02); amended 2026-09-04 (one user-facing bin, ADR 0010).

## Context

The HTTP server is the product. The CLI is an HTTP client. One `src/main.ts` still started the server and issued import/search requests. A third `api` package was rejected: the server owns the contract; the CLI depends on the server.

## Decision

- `@x-bookmarks/server` (`packages/server`): sqlite, media, embed, HTTP, dump schema, `HttpApi`. `nub run start` / `src/main.ts` still listens (`--host --port --data-dir --cache-dir`). No user-facing bin.
- `@x-bookmarks/cli` (`packages/cli`): user-facing bin `x-bookmarks`. `service` owns the process. `api` is generated from `HttpApi` via `HttpApi.reflect`. `service serve` loads `@x-bookmarks/server/run-server`. `api` / `service start|stop|status` do not import sqlite or `serverLayer`.
- CLI depends on `"@x-bookmarks/server": "workspace:*"`.
- Server `exports`: `"."` is the serve entry; `"./api"` is `HttpApi` plus dump schemas and registration helpers; `"./run-server"` is the listen loop.
- Root package `x-bookmarks` is private and has no `bin`.

## Consequences

The user-facing command is `x-bookmarks`. `api` does not spawn the daemon. `service start` and the bare command do.
