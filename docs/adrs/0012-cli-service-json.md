# ADR 0012: CLI owns service.json; server exports layer and schema

## Status

Accepted (2026-09-04)

## Context

`service.json` lived in the server package so the CLI could find a running daemon without importing sqlite. That leaked path helpers, the registration schema, and listen defaults through `@xkeep/server/api`. The server is the HTTP app. The file is process-manager state (pid, url, stop). ADR 0005's extra export became a grab-bag.

## Decision

- `@xkeep/server` `"."` is `layer(overrides)`: listen, sqlite, embed. No `service.json`.
- `@xkeep/server/schema` is HTTP wire schemas only (health, dump, import/search). Not `HttpApi`, not daemon IO, not listen defaults.
- The CLI writes, reads, and clears `service.json` (`packages/cli`). `service serve` resolves listen via `AppConfig` on the heavy entry, then writes the file. Spawned serve is still that command, so the child writes the file.
- `HttpApi` (`Api`) stays unexported. Tests import it by path. `xkeep api` and a future web UI use HTTP / OpenAPI.

## Consequences

`api` / `start` / `status` import `@xkeep/server/schema` plus CLI registration. Only `service serve` imports `@xkeep/server`. Web must not import `"."`.
