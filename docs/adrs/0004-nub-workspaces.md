# ADR 0004: Nub and npm workspaces

## Status

Accepted (2026-09-02); amended 2026-09-05 (`check` is read-only; references is not `prepare`; root `dev` / `build` / `start`).

## Context

The repo used Bun as package manager and `.ts` runner (`bun.lock`, `#!/usr/bin/env bun`). Product code already uses `node:` APIs only. Nub is installed and runs TypeScript on stock Node. HTTP and CLI need separate packages.

## Decision

- Toolchain is Nub: `nub install`, `nub run`, `nub` for first-party `.ts`. Not Bun.
- Root is a private workspace with `"workspaces": ["packages/*"]`. Drop `bun.lock`. Lockfile is `nub.lock`.
- No `.node-version` pin. This machine runs Node 26.
- Root keeps `check`, `dev`, `build`, `start`, oxlint, oxfmt, vitest, tsc references, and `scripts/references.ts`. `check` is typecheck, test, lint, format, `build` — no `--fix` / `--write`. `lint:fix` / `format:fix` write. `dev` is foreground `service serve` plus Vite. `build` is `@xkeep/web` `dist`. `prestart` runs `build`; `start` is `service serve` of that `dist`. `prepare` is `effect-language-service patch` only; `nub scripts/references.ts` is manual. No git pre-commit hook.

## Consequences

Agents and scripts call `nub`, not `bun`. The user-facing bin is `xkeep` in `@xkeep/cli`. `npx xkeep` is the later install story in PLAN, not a server package bin. Workspace topology is the npm `workspaces` field, which Nub reads.
