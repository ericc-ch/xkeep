# ADR 0004: Nub and npm workspaces

## Status

Accepted (2026-09-02); amended 2026-09-05 (`check` is read-only; references is not `prepare`; root `dev` / `build` / `start`); amended 2026-09-08 (Nub-native concurrency, dependency verification, development exports, workspace builds, and native E2E in `check`); amended 2026-09-08 (`xkeep` runs the bare CLI).

## Context

The repo used Bun as package manager and `.ts` runner (`bun.lock`, `#!/usr/bin/env bun`). Product code already uses `node:` APIs only. Nub is installed and runs TypeScript on stock Node. HTTP and CLI need separate packages.

## Decision

- Toolchain is Nub: `nub install`, `nub run`, `nub` for first-party `.ts`. Not Bun.
- Root is a private workspace with `"workspaces": ["packages/*"]`. Drop `bun.lock`. Lockfile is `nub.lock`.
- No `.node-version` pin. This machine runs Node 26.
- Root keeps `check`, `dev`, `build`, `start`, `xkeep`, oxlint, oxfmt, vitest, Playwright, tsc references, and `scripts/references.ts`. `check` is typecheck, deterministic test, lint, format, one `build`, then E2E against that build — no `--fix` / `--write` and no live network. `lint:fix` / `format:fix` write.
- `dev` uses Nub's regex script selector to run `dev:server` and `dev:web` concurrently. There is no repository-owned process supervisor and no `npm-run-all2` dependency.
- `nub.jsonc` activates the `development` package-export condition for source execution and sets `verifyDeps` to `error`, so scripts fail when installed dependencies are stale.
- `build` uses Nub's recursive topological runner. tsdown builds `@xkeep/server` before its dependents, then tsdown builds `@xkeep/cli` while Vite builds `@xkeep/web`. `prestart` runs the complete build; `start` launches the compiled CLI against the compiled server and static web `dist`. `xkeep` runs the source CLI with no subcommand.
- `test:e2e` builds then runs Playwright; `test:e2e:built` is the internal no-rebuild entry used by `check`. The live-network media canary is isolated behind `test:integration:network`.
- `prepare` is `effect-language-service patch` only; `nub scripts/references.ts` is manual. No git pre-commit hook.

## Consequences

Agents and scripts call `nub`, not `bun`. The user-facing bin is `xkeep` in `@xkeep/cli`. `npx xkeep` is the later install story in PLAN, not a server package bin. Workspace topology is the npm `workspaces` field, which Nub reads. Nub owns orchestration; tsdown and Vite own package-specific production output. `check` is the single deterministic merge gate, including browser and build-artifact E2E.
