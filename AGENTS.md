xkeep is a local X bookmarks app. Nub + Effect. Product shape is in `docs/PLAN.md`. Locked implementation notes are in `docs/CONTEXT.md`. Decisions live in `docs/adrs/`. The repo is the source of truth; if a doc disagrees with code, fix the doc.

## Architecture (directional)

- **Server** — `packages/server`: Effect HTTP on localhost. sqlite via Drizzle + `@effect/sql-sqlite-node`, embed worker, `HttpApi`. v1 intake is a json file. No paid X API. No browser extension in v1.
- **CLI** — `packages/cli`: user-facing `xkeep` bin. `service *` manages the daemon and `service.json`. `api` is curl against the running server (`GET /api/openapi.json` for operation ids). `service serve` loads `@xkeep/server` (`layer`).
- **Web** — `packages/web`: Solid + Pixi canvas SPA. Buttons, menus, and panels are owned Kobalte + StyleX in `src/ui/`. Server serves `dist` at `/`.
- **Dump** — `scripts/dump-bookmarks.js`: console snippet for `x.com/i/history` → bookmark export JSON.
- **References sync** — `scripts/references.ts`: shallow-clones upstream sources into `/tmp/references/`.

Use Nub as package manager (`nub install`).
Run first-party `.ts` with Nub (`nub path/to/file.ts`, `#!/usr/bin/env nub`). Use `node:` imports only, no runtime-specific APIs except in compiled-binary build scripts.

After completing a task, always run:

- `nub run check` — typecheck, deterministic `vitest`, lint, format, one `build`, then HTTP/browser/build-artifact E2E

Useful focused commands:

- `nub run test:e2e` — build, then run native Playwright E2E against isolated data and deterministic embeddings
- `nub run test:e2e:built` — run E2E against the current build
- `nub run test:integration:network` — opt-in live media download canary; never part of `check`
- `nub run xkeep` — source CLI with no subcommand (ensure daemon, ready banner, open origin)
- `nub run dev` — Nub concurrently runs `dev:server` (`@xkeep/cli` source) and `dev:web` (Vite); smoke when development orchestration changes
- `nub run start` — build, then the compiled CLI serves static web `dist`; smoke when production startup changes

For TypeScript style, follow the code-conventions skill.

## Workspace

- `packages/server` — HTTP library (`db/`, `embed/`, `http/`, `lib/`; `drizzle/` migrations, `db:generate`)
- `packages/cli` — user-facing bin (`service`, `api`)
- `packages/web` — canvas SPA (Solid + Pixi). Server serves `dist` at `/`.
- `scripts/` — `dump-bookmarks.js`, `references.ts`
- `docs/PLAN.md` — product shape
- `docs/CONTEXT.md` — grilled locks (paths, HTTP, daemon, UI cut)
- `docs/adrs/` — accepted decisions (amend when the code changed the call)

## References Directory

The `/tmp/references/` directory contains shallow clones of important external repositories (populated by `nub scripts/references.ts`).
Never make any changes in this directory — it is meant as reference only.

Prefer exploring and reading this directory over searching for documentation. Think of this as the source of truth.

Available references:

- effect — Effect (v4 on main)
- drizzle-orm — Drizzle ORM (`v1.0.0-rc.4`)
