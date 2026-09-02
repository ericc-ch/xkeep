# ADR 0006: AppConfig as a Context.Service

## Status

Accepted (2026-09-02)

## Context

Listen address, data/cache dirs, and derived library paths were a tagged `LibraryPaths` bag plus free helpers. The composition root parsed env/CLI then `Layer.succeed`. Callers still threaded the bag. HTTP listen was passed into `serverLayer` separately from the same values.

## Decision

`AppConfig` is a v4 `Context.Service` with `make`. CLI flags override `X_BOOKMARKS_*`, then `env-paths` / defaults. `make` returns a snapshot: listen, dirs, derived paths, llama base URL. `AppConfig.layer(overrides)` is `Layer.effect(this, this.make(overrides))`. `serverLayer` reads host/port from the service. GGUF URLs, dims, prompts, and `LLAMA_BUILD` stay module constants. No branded path/port types.

## Consequences

Tests and layers provide `AppConfig.layer({ ... })`. There is one listen address. Path helpers and `LibraryPaths` are gone.
