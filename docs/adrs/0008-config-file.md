# ADR 0008: config file and server/client ownership

## Status

Accepted (2026-09-03); amended 2026-09-04: CLI may read `service.json` (ADR 0012), still not this file.

## Context

`AppConfig` took overrides only from CLI flags and env vars. Durable per-machine settings (data/cache dirs) had to be restated every boot or exported in a shell profile. The whole configurable surface is six scalars (host, port, dataDir, cacheDir, logDir, llamaPort) plus one client string (server URL).

Ownership options considered:

- shared file, client derives URL from the listen section: derived state goes stale when a flag overrides the file
- two files (server + client): the client's declared URL drifts from the server's real listen address
- server-written discovery file (`server.json` in the state dir): zero staleness, but crash-tolerance, lifecycle, and a second file to serve one string

Rejected all three: the client config surface is one URL string, and `--url` fixes the moved-port case. Discovery is parked in PLAN.md "later". Env vars overlapped flags and the file (three sources, empty-string-as-unset, env-scrubbing in tests) and expressed nothing flags plus the file cannot.

## Decision

One JSON file at the env-paths config dir (`~/.config/xkeep/config.json`), read by the server only. Never auto-created; missing file means all defaults. All keys optional:

```json
{
  "listen": { "host": "127.0.0.1", "port": 8787 },
  "paths": { "data": "/mnt/hdd/xkeep", "cache": "/mnt/hdd/x-cache", "log": "/mnt/hdd/xkeep-log" },
  "llama": { "port": 8913 }
}
```

Precedence: CLI flags > config file > env-paths defaults. No `XKEEP_*` reads. `llamaPort` has `--llama-port` so every key has a flag. `logDir` has `--log-dir`. `AppConfigOverrides` has one internal escape hatch, `configPath` (tests and embedders point it at a fixture; there is no CLI flag for it). The file schema lives in the server package; it is not on `@xkeep/server/schema` because the CLI never reads the file.

The CLI does not read this file. Discovery is `--url` > `service.json` > built-in default (ADR 0010, 0012).

`process.env` passthrough when spawning `llama-server` (`PATH`, `LD_LIBRARY_PATH`) is child-process inheritance, not config.

## Consequences

Moving the server's port persistently means `--url` per CLI call. A typo'd key fails the boot instead of silently using a default. Shell profiles exporting `XKEEP_*` do nothing.
