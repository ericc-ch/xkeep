# ADR 0002: env-paths library layout

## Status

Accepted (2026-09-02)

## Context

Media + sqlite + GGUF are large. Defaults should follow XDG via `env-paths`, but the data dir must be overridable (e.g. `/mnt/hdd`).

## Decision

Use `env-paths` with name `xkeep` and `suffix: ""`.

- data: sqlite, `media/`, `imports/`
- cache: Vulkan `llama-server` binary, GGUF + mmproj
- log: daemon JSON log (`xkeep.log`). Default is env-paths `log` (`~/.local/state/xkeep` on Linux).
- config: as env-paths defines

Overrides: CLI flags and the config file (`paths.data`, `paths.cache`, `paths.log`).

## Consequences

Backup = rsync the data dir. Wiping cache only forces a re-download of the embed runtime, not the library.
