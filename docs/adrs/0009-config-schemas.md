# ADR 0009: two annotated config schemas

## Status

Accepted (2026-09-03)

## Context

ADR 0008 added a JSON config file decoded with Effect Schema. The resolved snapshot from ADR 0006 stayed a plain object built in `AppConfig.make`. Callers already treat that snapshot as the only config they need. The file schema was already private. The missing piece was a second schema for the resolved shape, plus annotations on both.

## Decision

Two annotated Effect Schemas:

- **Config file schema:** nested, all keys optional, disk JSON only. Internal to the server config module. Not exported through `@x-bookmarks/server/api`.
- **Resolved config schema:** the `AppConfig` contract. Flat and total. Includes listen, dirs, llama port, and derived fields (`sqlitePath`, `mediaDir`, `importsDir`, `llamaDir`, `ggufDir`, `textGgufPath`, `mmprojGgufPath`, `llamaBaseUrl`). Module constants that do not vary per machine (`EMBED_DIMS`, prompts, GGUF download URLs, `LLAMA_BUILD`) stay outside it.

`AppConfig.make` still owns precedence and path computation (flags > env > file > defaults). It then Schema-decodes the built snapshot. The rest of the app sees only that decoded shape via the service.

Annotations are documentation and future tooling, not runtime behavior.

Boot errors stay `ConfigError`. File, env, and flag problems keep source-aware messages (`listen.port`, `paths.data`). A failed resolved-schema decode is a derivation bug, reported as a distinct `ConfigError` reason.

The resolved schema is used inside `packages/server`. It is not added to `@x-bookmarks/server/api` until another package needs it.

This supersedes ADR 0006's "plain snapshot, no branded types" on the shape of the service: the snapshot is now the decoded resolved schema. ADR 0008's file location, precedence, and CLI-does-not-read-the-file rules stand.

## Consequences

`make` has one extra decode after merge. Tests that load `AppConfig` still assert the same fields. Adding a derived path means updating the resolved schema, not only the return object.
