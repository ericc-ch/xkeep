# ADR 0009: boundary config schema and inferred resolved snapshot

## Status

Accepted (2026-09-03); amended 2026-09-05: no `importsDir`; amended 2026-09-06: the resolved snapshot is inferred from `AppConfig.make`.

## Context

ADR 0008 added a JSON config file. File values and CLI overrides are untrusted input, while the resolved snapshot and its derived paths are constructed inside `AppConfig.make`. A second schema originally decoded that constructed snapshot, duplicating invariants already enforced on each merged scalar.

## Decision

Keep one annotated Effect Schema at the untrusted boundary: the nested config file shape. All keys are optional, its leaves are `Unknown`, and strict `onExcessProperty: "error"` rejects unknown keys. It remains internal to the server config module and is not exported from `@xkeep/server/schema`.

`AppConfig.make` owns precedence and path computation (flags > file > defaults). Each merged scalar goes through `decodeField({ key, schema, raw, fallback })`; `Port` and `NonBlankString` are the value invariants. `make` then derives paths and directly returns the flat, total snapshot. TypeScript infers the service contract from `make`; trusted application-created values are not decoded a second time. Module constants that do not vary per machine (`EMBED_DIMS`, prompts, GGUF download URLs, `LLAMA_BUILD`) stay outside the snapshot.

Boot errors stay `ConfigError`. Value failures use `invalid value for <dotted.key>: <complaint>, got <json>`. Unknown file keys use the `SchemaIssue` Pointer path as a dotted key (`listen.prot`).

## Consequences

Adding a config key means one file-schema leaf plus one `decodeField` call. Adding a derived path means adding it to the returned snapshot. If a package later needs a runtime codec for the resolved shape, add one at that package boundary instead of decoding trusted values during service construction.
