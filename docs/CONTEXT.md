# Context

## Product

Local X bookmarks app. Intake is a JSON dump (`xkeep-dump/1`). No paid X API. No Chrome extension in v1. The pile is bookmarks; the process is the daemon.

## Terms

| Term     | Meaning                                                |
| -------- | ------------------------------------------------------ |
| bookmark | One saved X post. The only pile.                       |
| tag      | Durable hierarchical label (`id`, `name`, `parentId`). |
| cluster  | Ephemeral query result over embeddings — not stored.   |
| canvas   | Not a domain object. Possible future UI view.          |
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
- **Surface:** one bin `xkeep`. `service` is process lifetime (`start|stop|restart|status|serve`). `api` is one curl-style command (`method path` or OpenAPI `operationId`, `--param`, `--data` / `@file`, `--header`). Discovers the daemon; does not spawn. Bare / `service start` / `restart` / foreground `serve`: ensure (or listen) then print the ready banner (art, pid, origin, `/api/`, `xkeep api` example). No browser until a real UI. Effect `HttpApi` (not RPC), OpenAPI, web UI later on the same API + SSE. Loopback, no auth. See ADR 0010.
- **Paths:** `env-paths` (`xkeep`, no `-nodejs` suffix). Data: sqlite, `media/`, `imports/`. Cache: llama binary and GGUF. Log: `{logDir}/xkeep.log` (JSON, Effect `Logger.toFile`, append). Daemon only; `api` / status do not write it. See `docs/adrs/0002-env-paths.md`.
- **Weights:** Q4_K_M text + mmproj Q8_0. Store 2048-d vectors. See `docs/adrs/0003-gguf-and-dims.md`.
- **llama.cpp:** PATH `llama-server` if present, else fetch pinned official Vulkan build into cache (GitHub HTTP, not `hf`); spawn child; `--no-cache-prompt`.
- **Hub fetch:** If `hf` is on PATH, use it for Hugging Face GGUF URLs. Parse repo/rev/file from the existing Hub URL constants (no duplicate names). One `hf download {repo} {missing files} --revision {rev} --local-dir {ggufDir}`. Inherit stdio. Binary name `hf` only. After download, min-size check; too small → delete → HTTP GET. Missing or failing `hf` also falls back to HTTP. No config key. `HF_HOME` is hf’s cache, not xkeep’s. GitHub URLs never go through `hf`.
- **Listen:** `127.0.0.1:8787`. HttpApi is prefixed `/api` (`/api/health`, `/api/imports`, `/api/search`). OpenAPI at `/api/openapi.json`. Scalar at `/api/docs`. Origin `/` is reserved for the library UI.
- **AppConfig:** `Context.Service` with `make(overrides)`. HTTP listen comes from the service. GGUF URLs, dims, prompts, and `LLAMA_BUILD` stay module constants. See `docs/adrs/0006-appconfig-service.md`.
- **Tooling:** Nub (`nub install`, `nub run`, `nub` for `.ts`). Not Bun. Root `"workspaces": ["packages/*"]`. No `.node-version` pin (Node 26 on this machine).
- **Packages:** `@xkeep/server` (`layer` + `./schema`) and `@xkeep/cli` (user-facing `xkeep` bin, owns `service.json`). See `docs/adrs/0004-nub-workspaces.md`, `0005`, `0010`, `0012`.
- **Effect:** `4.0.0-rc.112`. `@effect/platform-node` and `@effect/sql-sqlite-node` match.
- **SQLite:** See `docs/adrs/0007-drizzle-effect-sqlite.md`. Drizzle `1.0.0-rc.4` + `@effect/sql-sqlite-node`. File is `{dataDir}/xkeep.sqlite`. `Bookmarks` is the Effect port over the bookmarks table (not a generic Database service). Tags get their own port later and share sqlite. `sqliteTable` as SQL shape, leak SQL errors, `EmbeddingDimsError` for dim mismatch. Kit generate + `migrate()` on boot. Upsert nulls the embedding blob when text/media/still change.
- **Config:** server-only JSON at `~/.config/xkeep/config.json`. Never auto-created. Keys optional: `listen.host`, `listen.port`, `paths.data`, `paths.cache`, `paths.log`, `llama.port`. Precedence: flags > file > env-paths defaults. No `XKEEP_*`. CLI reads no config.json: `--url`, else `service.json`, else the built-in default. Two annotated schemas (file is a shape gate, the resolved is the service snapshot). `AppConfig.layer` requires `FileSystem`. `ConfigError` on boot. Resolved schema is not on `@xkeep/server/schema`. See `docs/adrs/0008-config-file.md` and `docs/adrs/0009-config-schemas.md`.
- **Domain:** **Bookmark** (saved post) + **Tag** tree (`id`, `name`, `parentId`). No `source` on bookmark-tag. Sibling names unique under the same `parentId` (case-sensitive). Delete a tag: drop its bookmark links, reparent children to its parent (no subtree wipe). **Cluster** = read-only ephemeral query over embedded vectors (groups + coords); not a table. **Canvas** is not a domain object. Tag apply from a cluster is client-composed `memberIds`. Cluster skips unembedded (`skippedUnembedded`). See `docs/adrs/0011-bookmarks-tags-clusters.md`.
- **Realtime:** Bus after sqlite commits + `GET /api/events` SSE. Fine: tag.* + bookmark.tagged/untagged. Coarse: `bookmarks.changed` for import/embed. Not event sourcing. Web: REST snapshot then EventSource; CLI does not subscribe. See ADR 0010.
- **Daemon:** Ensure on bare + `service start`/`restart` only. Spawn detached `service serve`. CLI writes `service.json` after listen config resolves. `api` discovers (`--url` else `service.json` else default) and fails if down. Healthy = HTTP 200 on `GET /api/health` with `status: ok`. See ADR 0010, 0012.
- **Intake:** `POST /api/imports` upserts sqlite and returns. Stills download on a daemon fiber. Second import while that fiber runs is `409`. Health `import` is `idle` | `running`. Dump schema `xkeep-dump/1` or `x-bookmarks-dump/1`. See ADR 0013.
- **Ship order:** (1) daemon/ensure (2) bus+sse (3) tag+cluster APIs (4) real UI later.
- **E2E tests:** public boundary is HTTP `HttpApi` only (not CLI). Drive it in-process via `apiLayer` + `HttpApiClient` (no `xkeep` listen). Stub the `Llama` service (`state` + `embed`): `ready` immediately, 2048-d vectors derived from text (same text, same vector). Do not spawn `llama-server`. Import hits live `pbs.twimg.com` every time (wipe e2e `media/` too). `dataDir` is `/tmp/xkeep-e2e`. Default `vitest` / `nub run check` runs them. No git pre-commit hook. Tests live under `packages/server/test/`. Cases: health ready + empty store, import still (poll idle), poll embedded, search hit, re-import `updated` after idle, overlapping import 409, bad dump 400.
