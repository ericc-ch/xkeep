x-bookmarks is a local X bookmarks library. Bun + Effect. Product shape is in `PLAN.md`.

Our priorities are (not ordered, all are important):

- Maintainability
- Reliability
- Performance

If a tradeoff is required, choose correctness and robustness over short-term convenience.

## Architecture (directional)

- **CLI / server** — `src/main.ts`: Effect `Command` entry. v1 is `npx` localhost: sqlite, spa, embed worker. Intake is a json file. No paid X API. No chrome extension in v1.
- **References sync** — `scripts/references.ts`: shallow-clones upstream sources into `/tmp/references/`.

Use Bun as package manager (`bun install`).
Run first-party `.ts` with Bun (`bun path/to/file.ts`, `#!/usr/bin/env bun`). Use `node:` imports only, no Bun-specific runtime APIs except in compiled-binary build scripts.

After completing a task, run:

- `bun run check` — typecheck, `vitest`, lint

For TypeScript style, follow the code-conventions skill.

## Workspace

- `src/` — app and CLI
- `scripts/` — install-time tooling (`references.ts`)
- `PLAN.md` — product shape

## References Directory

The `/tmp/references/` directory contains shallow clones of important external repositories (populated by `bun scripts/references.ts`).
Never make any changes in this directory — it is meant as reference only.

Prefer exploring and reading this directory over searching for documentation. Think of this as the source of truth.

Available references:

- effect — Effect (v4 on main)
