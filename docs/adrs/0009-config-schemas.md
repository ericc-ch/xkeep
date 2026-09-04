# ADR 0009: two annotated config schemas

## Status

Accepted (2026-09-03)

## Context

ADR 0008 added a JSON config file. The resolved snapshot from ADR 0006 was a plain object built in `AppConfig.make`. Callers already treat that snapshot as the only config they need. The missing piece was a second schema for the resolved shape, plus annotations on both, and one validation path so file and flags share error messages.

## Decision

Two annotated Effect Schemas:

- Config file schema: nested, all keys optional, disk JSON only. Shape gate: `Unknown` leaves, strict `onExcessProperty: "error"`. Internal to the server config module. Not exported through `@x-bookmarks/server/api`.
- Resolved config schema: the `AppConfig` contract. Flat and total. Includes listen, dirs, llama port, and derived fields (`sqlitePath`, `mediaDir`, `importsDir`, `llamaDir`, `ggufDir`, `textGgufPath`, `mmprojGgufPath`, `llamaBaseUrl`). Module constants that do not vary per machine (`EMBED_DIMS`, prompts, GGUF download URLs, `LLAMA_BUILD`) stay outside it.

`AppConfig.make` owns precedence and path computation (flags > file > defaults). Each merged scalar goes through `decodeField({ key, schema, raw, fallback })`. `Port` and `NonBlankString` are the value invariants. `make` then Schema-decodes the built snapshot. The rest of the app sees only that decoded shape via the service.

Annotations are documentation and future tooling, not runtime behavior.

Boot errors stay `ConfigError`. Value failures use `invalid value for <dotted.key>: <complaint>, got <json>`. Unknown file keys use the `SchemaIssue` Pointer path as a dotted key (`listen.prot`). A failed resolved-schema decode is a derivation bug, reported as a distinct `ConfigError` reason.

The resolved schema is used inside `packages/server`. It is not added to `@x-bookmarks/server/api` until another package needs it.

## Consequences

`make` has one extra decode after merge. Tests that load `AppConfig` still assert the same fields. Adding a config key means one file-schema leaf plus one `decodeField` call. Adding a derived path means updating the resolved schema, not only the return object.
