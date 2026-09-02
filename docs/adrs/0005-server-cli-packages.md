# ADR 0005: Server and CLI packages

## Status

Accepted (2026-09-02)

## Context

The HTTP server is the product. The CLI is an HTTP client. One `src/main.ts` still started the server and issued import/search requests. A third `api` package was rejected: the server owns the contract; the CLI depends on the server.

## Decision

- `@x-bookmarks/server` (`packages/server`): sqlite, media, embed, HTTP, dump schema, `HttpApi`. Bin `x-bookmarks` listens (`--host --port --data-dir --cache-dir`).
- `@x-bookmarks/cli` (`packages/cli`): `import` and `search` only. Bin `x-bookmarks-cli`. `--url` defaults to `http://127.0.0.1:8787`.
- CLI depends on `"@x-bookmarks/server": "workspace:*"`.
- Server `exports`: `"."` is the serve entry; `"./api"` is `HttpApi` plus dump schemas. CLI imports `@x-bookmarks/server/api` and nothing else (no sqlite, llama, or `serverLayer`).
- Root package `x-bookmarks` is private and has no `bin`.

## Consequences

`x-bookmarks` and `x-bookmarks-cli` can be linked in one workspace. Starting the library is a server process. Import and search fail until that process is up. Adding a SPA later is a third package on the same `HttpApi`.
