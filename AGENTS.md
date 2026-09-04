xkeep is a local X bookmarks app. Nub + Effect. Product shape is in `docs/PLAN.md`.

## Architecture (directional)

- **Server** — `packages/server`: Effect HTTP on localhost. sqlite via Drizzle + `@effect/sql-sqlite-node`, embed worker, `HttpApi`. v1 intake is a json file. No paid X API. No chrome extension in v1.
- **CLI** — `packages/cli`: user-facing `xkeep` bin. `service *` manages the daemon and `service.json`. `api` is curl against the running server (`GET /api/openapi.json` for operation ids). `service serve` loads `@xkeep/server` (`layer`).
- **References sync** — `scripts/references.ts`: shallow-clones upstream sources into `/tmp/references/`.

Use Nub as package manager (`nub install`).
Run first-party `.ts` with Nub (`nub path/to/file.ts`, `#!/usr/bin/env nub`). Use `node:` imports only, no runtime-specific APIs except in compiled-binary build scripts.

After completing a task, run:

- `nub run check` — typecheck, `vitest`, lint

For TypeScript style, follow the code-conventions skill.

## Workspace

- `packages/server` — HTTP library (`drizzle/` migrations, `db:generate`)
- `packages/cli` — user-facing bin (`service`, `api`)
- `scripts/` — install-time tooling (`references.ts`)
- `docs/PLAN.md` — product shape

## References Directory

The `/tmp/references/` directory contains shallow clones of important external repositories (populated by `nub scripts/references.ts`).
Never make any changes in this directory — it is meant as reference only.

Prefer exploring and reading this directory over searching for documentation. Think of this as the source of truth.

Available references:

- effect — Effect (v4 on main)
- drizzle-orm — Drizzle ORM (`v1.0.0-rc.4`)
