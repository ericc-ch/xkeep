# Context

## Product

Local X bookmarks app. Intake is a JSON dump (`xkeep-dump/1`). No paid X API. No Chrome extension in v1. "Library" is not a product noun — the pile is bookmarks; the process is the daemon.

## Terms

| Term     | Meaning                                                |
| -------- | ------------------------------------------------------ |
| bookmark | One saved X post. The only pile.                       |
| tag      | Durable hierarchical label (`id`, `name`, `parentId`). |
| cluster  | Ephemeral query result over embeddings — not stored.   |
| canvas   | Not a domain object. Possible future UI view.          |
| library  | Not a product noun. Avoid in docs/API.                 |
| daemon   | Long-lived `xkeep` server process on loopback.   |

## Dump

A bookmark has `id` (numeric snowflake), author/handle, text, timestamp, hashtags, urls, avatar, optional quoted tweet, and `media[]` of type `photo` | `video` | `gif`. Videos may include a `poster` URL. Import rejects path-like ids and `captured_at`.

## Media

`pbs.twimg.com` URLs need a browser User-Agent to download. Keep the first photo, or a video/gif poster, not the mp4. Re-check the hostname after every redirect. Stay on `https` twimg hosts.

## Embed

Qwen3-VL-Embedding-2B via official llama.cpp Vulkan (`llama-server`, `--pooling last`, pinned media marker) at **256 image tokens**. Store 2048-d. A drain fiber waits until llama is `ready`, then embeds rows with a null blob. Short GGUF files are deleted and fetched again.

## Locked (grilling)

- **Embed:** Qwen only. See `docs/adrs/0001-qwen-llamacpp-vulkan.md`.
- **Media:** download and keep the first still (photo, or video/gif poster) under the data media dir. Not extra photos, not mp4s. URLs stay in sqlite.
- **Surface:** one bin `xkeep`. `service` is process lifetime (`start|stop|restart|status|serve`). `api` is a generated OpenAPI port (`HttpApi.reflect`); stdout JSON; no spawn. Bare command: ensure + print url (no browser until real UI). Effect `HttpApi` (not RPC), OpenAPI, web UI later on the same API + SSE. Loopback, no auth. See ADR 0010.
- **Paths:** `env-paths` (`xkeep`, no `-nodejs` suffix). Data: sqlite, `media/`, `imports/`. Cache: llama binary and GGUF. See `docs/adrs/0002-env-paths.md`.
- **Weights:** Q4_K_M text + mmproj Q8_0. Store 2048-d vectors. See `docs/adrs/0003-gguf-and-dims.md`.
- **llama.cpp:** PATH `llama-server` if present, else fetch pinned official Vulkan build into cache; spawn child; `--no-cache-prompt`.
- **Listen:** `127.0.0.1:8787`. First routes: health, imports, search, OpenAPI.
- **AppConfig:** `Context.Service` with `make(overrides)`. HTTP listen comes from the service. GGUF URLs, dims, prompts, and `LLAMA_BUILD` stay module constants. See `docs/adrs/0006-appconfig-service.md`.
- **Tooling:** Nub (`nub install`, `nub run`, `nub` for `.ts`). Not Bun. Root `"workspaces": ["packages/*"]`. No `.node-version` pin (Node 26 on this machine).
- **Packages:** `@xkeep/server` (embed, HTTP, dump schema, `HttpApi`) and `@xkeep/cli` (user-facing `xkeep` bin). See `docs/adrs/0004-nub-workspaces.md`, `0005`, `0010`.
- **Effect:** `4.0.0-rc.112`. `@effect/platform-node` and `@effect/sql-sqlite-node` match.
- **SQLite:** See `docs/adrs/0007-drizzle-effect-sqlite.md`. Drizzle `1.0.0-rc.4` + `@effect/sql-sqlite-node`. Internal bookmarks port (still named `Library` in code — rename later), `sqliteTable` as SQL shape, leak SQL errors, `EmbeddingDimsError` for dim mismatch. Kit generate + `migrate()` on boot. Upsert nulls the embedding blob when text/media/still change.
- **Config:** server-only JSON at `~/.config/xkeep/config.json`. Never auto-created. Keys optional: `listen.host`, `listen.port`, `paths.data`, `paths.cache`, `llama.port`. Precedence: flags > file > env-paths defaults. No `XKEEP_*`. CLI reads no config.json: `--url`, else `service.json`, else the built-in default. Two annotated schemas (file is a shape gate, the resolved is the service snapshot). `AppConfig.layer` requires `FileSystem`. `ConfigError` on boot. Resolved schema is not on `@xkeep/server/api`. See `docs/adrs/0008-config-file.md` and `docs/adrs/0009-config-schemas.md`.
- **Domain:** **Bookmark** (saved post) + **Tag** tree (`id`, `name`, `parentId`). No `source` on bookmark-tag. Sibling names unique under the same `parentId` (case-sensitive). Delete a tag: drop its bookmark links, reparent children to its parent (no subtree wipe). **Cluster** = read-only ephemeral query over embedded vectors (groups + coords); not a table. **Canvas** / **library** are not domain objects. Tag apply from a cluster is client-composed `memberIds`. Cluster skips unembedded (`skippedUnembedded`). See `docs/adrs/0011-bookmarks-tags-clusters.md`.
- **Realtime:** Bus after sqlite commits + `GET /events` SSE. Fine: tag.* + bookmark.tagged/untagged. Coarse: `bookmarks.changed` for import/embed. Not event sourcing. Web: REST snapshot then EventSource; CLI does not subscribe. See ADR 0010.
- **Daemon:** Ensure on bare + `service start`/`restart` only. Spawn detached `service serve`. `api` discovers (`--url` else `service.json` else default) and fails if down. Healthy = HTTP 200 + `status: ok`. Foreground `service serve` writes `service.json`. See ADR 0010.
- **Ship order:** (1) daemon/ensure (2) bus+sse (3) tag+cluster APIs (4) real UI later.
- **E2E tests:** public boundary is HTTP `HttpApi` only (not CLI). Drive it in-process via `apiLayer` + `HttpApiClient` (no `xkeep` listen). Stub the `Llama` service (`state` + `embed`): `ready` immediately, 2048-d vectors derived from text (same text, same vector). Do not spawn `llama-server`. Import hits live `pbs.twimg.com` every time (wipe e2e `media/` too, no copy from the user library). `dataDir` is `/tmp/xkeep-e2e`. Default `vitest` / `nub run check` runs them. No git pre-commit hook. Tests live under `packages/server/test/`. Cases: health ready + empty library, import still, poll embedded, search hit, re-import `updated`, bad dump 400.
