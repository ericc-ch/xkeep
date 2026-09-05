# Context

## Product

Local X bookmarks app. Intake is a JSON dump (`xkeep-dump/1`). No paid X API. No Chrome extension in v1. The pile is bookmarks; the process is the daemon.

## Terms

| Term     | Meaning                                                |
| -------- | ------------------------------------------------------ |
| bookmark | One saved X post. The only pile.                       |
| tag      | Durable hierarchical label (`id`, `name`, `parentId`). |
| cluster  | Ephemeral query result over embeddings — not stored.   |
| canvas   | Library view at `/`. Spatial map of every bookmark (thumb or trimmed text). Not a sqlite entity. |
| daemon   | Long-lived `xkeep` server process on loopback.   |

## Dump

A bookmark has `id` (numeric snowflake), author/handle, text, timestamp, hashtags, urls, avatar, optional quoted tweet, and `media[]` of type `photo` | `video` | `gif`. Videos may include a `poster` URL. Import rejects path-like ids and `captured_at`. Dump `schema` is `xkeep-dump/1` or the older `x-bookmarks-dump/1`.

## Media

`pbs.twimg.com` URLs need a browser User-Agent to download. Keep every photo, or one video/gif poster, not the mp4. Re-check the hostname after every redirect. Stay on `https` twimg hosts.

## Embed

Qwen3-VL-Embedding-2B via official llama.cpp Vulkan (`llama-server`, `--pooling last`, pinned media marker) at **256 image tokens**. One fused vector: tweet text + all stills. Store 2048-d. A drain fiber waits until llama is `ready`, then embeds rows with a null blob. Short GGUF files are deleted and fetched again. Hub GGUFs: PATH `hf` if present (`hf download` into `{cacheDir}/gguf/`); else HTTP. GitHub llama tarball is HTTP only.

## Locked (grilling)

- **Embed:** Qwen only. See `docs/adrs/0001-qwen-llamacpp-vulkan.md`.
- **Media:** download stills under the data media dir. Photos: every image. Video/gif: poster only, not the mp4. URLs stay in sqlite.
- **Surface:** one bin `xkeep`. `service` is process lifetime (`start|stop|restart|status|serve`). `api` is one curl-style command (`method path` or OpenAPI `operationId`, `--param`, `--data` / `@file`, `--header`). Discovers the daemon; does not spawn. Bare / `service start` / `restart` / foreground `serve`: ensure (or listen) then print the ready banner (art, pid, origin, `/api/`, `xkeep api` example). After the SPA exists, open the origin. Effect `HttpApi` (not RPC), OpenAPI, web UI on the same API + SSE. Loopback, no auth. See ADR 0010, 0014.
- **Paths:** `env-paths` (`xkeep`, no `-nodejs` suffix). Data: sqlite, `media/`, `imports/`. Cache: llama binary and GGUF. Log: `{logDir}/xkeep.log` (JSON, Effect `Logger.toFile`, append). Daemon only; `api` / status do not write it. See `docs/adrs/0002-env-paths.md`.
- **Weights:** Q4_K_M text + mmproj Q8_0. Store 2048-d vectors. See `docs/adrs/0003-gguf-and-dims.md`.
- **llama.cpp:** PATH `llama-server` if present, else fetch pinned official Vulkan build into cache (GitHub HTTP, not `hf`); spawn child; `--cache-ram 8192`. `-c` is total KV across `-np` slots (per request = `c / np`).
- **Hub fetch:** If `hf` is on PATH, use it for Hugging Face GGUF URLs. Parse repo/rev/file from the existing Hub URL constants (no duplicate names). One `hf download {repo} {missing files} --revision {rev} --local-dir {ggufDir}`. Inherit stdio. Binary name `hf` only. After download, min-size check; too small → delete → HTTP GET. Missing or failing `hf` also falls back to HTTP. No config key. `HF_HOME` is hf’s cache, not xkeep’s. GitHub URLs never go through `hf`.
- **Listen:** `127.0.0.1:8787`. HttpApi is prefixed `/api` (`/api/health`, `/api/imports`, `/api/search`). OpenAPI at `/api/openapi.json`. Scalar at `/api/docs`. Origin `/` is reserved for the library UI.
- **AppConfig:** `Context.Service` with `make(overrides)`. HTTP listen comes from the service. GGUF URLs, dims, prompts, and `LLAMA_BUILD` stay module constants. See `docs/adrs/0006-appconfig-service.md`.
- **Tooling:** Nub (`nub install`, `nub run`, `nub` for `.ts`). Not Bun. Root `"workspaces": ["packages/*"]`. No `.node-version` pin (Node 26 on this machine).
- **Packages:** `@xkeep/server` (`layer` + `./schema` dump + `./schema-http` wire + `./api` HttpApi), `@xkeep/cli` (`xkeep` bin, `service.json`), `@xkeep/web` (Solid 1.9 library SPA). See `docs/adrs/0004-nub-workspaces.md`, `0005`, `0010`, `0012`, `0014`.
- **Effect:** `4.0.0-rc.112`. `@effect/platform-node` and `@effect/sql-sqlite-node` match.
- **SQLite:** See `docs/adrs/0007-drizzle-effect-sqlite.md`. Drizzle `1.0.0-rc.4` + `@effect/sql-sqlite-node`. File is `{dataDir}/xkeep.sqlite`. `Bookmarks` is the Effect port over the bookmarks table (not a generic Database service). Tags share sqlite. `sqliteTable` as SQL shape, leak SQL errors, `EmbeddingDimsError` for dim mismatch. Kit generate + `migrate()` on boot. Upsert nulls the embedding blob when text/media/still change.
- **Server layout:** `db/` is sqlite (client, migrate on the shared layer, tables, `Bookmarks`, `Tags`). `lib/` is leftover one-offs (cluster, import, search). `http/` is api, handlers, server, wire schema. Root is dump `schema.ts`, `config.ts`, `log.ts`, `bus.ts`. A folder exists only when two or more files change together, except `lib/`.
- **Config:** server-only JSON at `~/.config/xkeep/config.json`. Never auto-created. Keys optional: `listen.host`, `listen.port`, `paths.data`, `paths.cache`, `paths.log`, `llama.port`. Precedence: flags > file > env-paths defaults. No `XKEEP_*`. CLI reads no config.json: `--url`, else `service.json`, else the built-in default. Two annotated schemas (file is a shape gate, the resolved is the service snapshot). `AppConfig.layer` requires `FileSystem`. `ConfigError` on boot. Resolved schema is not on `@xkeep/server/schema`. See `docs/adrs/0008-config-file.md` and `docs/adrs/0009-config-schemas.md`.
- **Domain:** **Bookmark** (saved post) + **Tag** tree (`id`, `name`, `parentId`). No `source` on bookmark-tag. Sibling names unique under the same `parentId` (case-sensitive). Delete a tag: drop its bookmark links, reparent children to its parent (no subtree wipe). **UMAP** `x`,`y` are written once per row on the drain (`umap-js`). Later rows `transform` into that space via an in-process fitted model (gone on restart). Already-placed rows are not rewritten (a full refit rotates the whole map). Not on import (no vectors yet). **Cluster** = read-only k-means in 2048-d (`groupId`) over embeddings; response reuses cached `x`,`y`. Not a table. Tag apply from a cluster is client-composed `memberIds`. Cluster skips unembedded (`skippedUnembedded`). No auto-tag. See ADR 0011, 0014.
- **Realtime:** Bus after sqlite commits (tag writes in `Tags`, upserts in import, embeddings in drain) + `GET /api/events` SSE. Fine: `tag.*`, `bookmark.tagged` / `untagged`, `bookmark.upserted` `{ ids }`, `bookmark.embedded` `{ ids }`. No coarse `bookmarks.changed`. Cluster reads do not publish. Web: `HttpApiClient.events()` stream + atoms; CLI does not subscribe. See ADR 0010, 0014.
- **Daemon:** Ensure on bare + `service start`/`restart` only. Spawn detached `service serve`. CLI writes `service.json` after listen config resolves. `api` discovers (`--url` else `service.json` else default) and fails if down. Healthy = HTTP 200 on `GET /api/health` with `status: ok`. See ADR 0010, 0012.
- **Intake:** `POST /api/imports` upserts sqlite and returns. Stills download on a daemon fiber. Second import while that fiber runs is `409`. Health `import` is `idle` | `running`. Dump schema `xkeep-dump/1` or `x-bookmarks-dump/1`. See ADR 0013.
- **Library UI:** Spatial map of the pile at `/`. Search + filters highlight ids only (not in the first cut). Search hits are id, score, handle, author, text — no disk `stillPaths`. `GET /api/bookmarks` one shot (includes cached UMAP `x`,`y` when present); `GET /api/bookmarks/:id` for the rest; `GET /api/media/:name` (basename only, inside `mediaDir`). Rows without cached `x`,`y` are not drawn. No cluster GET on first paint. `GET /api/clusters?k=` is k-means only. No `minSize`. Tag ids are UUIDs. Thumb is the first still at native aspect on a plate; tweet text is the open HTML card only (1× screen, pinned to the mark). UMAP `x`,`y` are AOT on the drain; the tab only multiplies them by a local **spread** (slider, `localStorage`). Drain writes still rungs 32/64/128/256 WebP (`magick`); map picks by on-screen size. One Pixi app, patch on SSE. `packages/web` is Solid 1.9 + Pixi 8 + StyleX + TanStack Router 1.x + `@effect/atom-solid` / `AtomHttpApi` over `@xkeep/server/api`. Server serves `packages/web/dist` at `/`. Bare / ensure opens the origin. See ADR 0014.
- **Ship order:** (1) daemon/ensure (done) (2) bus+sse + tag + cluster + pile + media APIs (done) (3) library SPA at `/` (first cut: empty state, drop, map, SSE patch).
- **E2E tests:** public boundary is HTTP `HttpApi` only (not CLI). Drive it in-process via `apiLayer` + `HttpApiClient` (no `xkeep` listen). Stub the `Llama` service (`state` + `embed`): `ready` immediately, 2048-d vectors derived from text (same text, same vector). Do not spawn `llama-server`. Import hits live `pbs.twimg.com` every time (wipe e2e `media/` too). `dataDir` is `/tmp/xkeep-e2e`. Default `vitest` / `nub run check` runs them. No git pre-commit hook. Tests live under `packages/server/test/`. Cases: health ready + empty store, import still (poll idle), poll embedded, search hit, re-import `updated` after idle, overlapping import 409, bad dump 400.
