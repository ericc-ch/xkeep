# ADR 0008: config file and server/client ownership

## Status

Accepted (2026-09-03)

## Context

`AppConfig` took overrides only from CLI flags and `X_BOOKMARKS_*` env (ADR 0006). Durable per-machine settings (data/cache dirs) had to be restated every boot or exported in a shell profile. The whole configurable surface is five scalars (host, port, dataDir, cacheDir, llamaPort) plus one client string (server URL).

Ownership options considered:

- shared file, client derives URL from the listen section: derived state goes stale when a flag overrides the file
- two files (server + client): the client's declared URL drifts from the server's real listen address
- server-written discovery file (`server.json` in the state dir): zero staleness, but crash-tolerance, lifecycle, and a second file to serve one string

Rejected all three: the client config surface is one URL string, and `--url` / `X_BOOKMARKS_URL` fix the moved-port case for free. Discovery is parked in PLAN.md "later".

## Decision

One JSON file at the env-paths config dir (`~/.config/x-bookmarks/config.json`), read by the server only. Never auto-created; missing file means all defaults. Strict Effect Schema decode: an unknown key or bad value fails boot with a message naming the key. All keys optional:

```json
{
  "listen": { "host": "127.0.0.1", "port": 8787 },
  "paths": { "data": "/mnt/hdd/x-bookmarks", "cache": "/mnt/hdd/x-cache" },
  "llama": { "port": 8913 }
}
```

Precedence: CLI flags > `X_BOOKMARKS_*` env > config file > env-paths defaults. An empty-string env var counts as unset for every key. `AppConfig.make` gains the file as a source between env and defaults; the snapshot shape from ADR 0006 is unchanged. `AppConfigOverrides` gains one internal escape hatch, `configPath` (tests and embedders point it at a fixture; there is no CLI flag or env var for it). `make` now requires `FileSystem`, and `AppConfig.layer` provisions `NodeFileSystem.layer` itself, so consumers stay unchanged — this supersedes ADR 0006's literal `Layer.effect(this, this.make(overrides))` formula. The file schema lives in the server package; it is not exported through `@x-bookmarks/server/api` because the CLI never reads the file.

The CLI reads no config from disk: `--url` > `X_BOOKMARKS_URL` > built-in default.

## Consequences

Moving the server's port persistently means `X_BOOKMARKS_URL` exported once, or `--url` per CLI call. ADR 0002's env overrides remain valid; this inserts the file one step above defaults. A typo'd key fails the boot instead of silently using a default; port errors name the file key (`listen.port`, `llama.port`) regardless of which source supplied the value.
