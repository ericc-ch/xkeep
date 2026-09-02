# Context

## Product

Local X bookmarks library. Intake is a JSON dump (`x-bookmarks-dump/1`). No paid X API. No Chrome extension in v1.

## Dump

A bookmark has `id` (numeric snowflake), author/handle, text, timestamp, hashtags, urls, avatar, optional quoted tweet, and `media[]` of type `photo` | `video` | `gif`. Videos may include a `poster` URL. Import rejects path-like ids and `captured_at`.

## Media

`pbs.twimg.com` URLs need a browser User-Agent to download. Keep the first photo, or a video/gif poster, not the mp4. Re-check the hostname after every redirect. Stay on `https` twimg hosts.

## Embed

Qwen3-VL-Embedding-2B via official llama.cpp Vulkan (`llama-server`, `--pooling last`, pinned media marker) at **256 image tokens**. Store 2048-d. A drain fiber waits until llama is `ready`, then embeds rows with a null blob. Short GGUF files are deleted and fetched again.

## Locked (grilling)

- **Embed:** Qwen only. See `docs/adrs/0001-qwen-llamacpp-vulkan.md`.
- **Media:** download and keep the first still (photo, or video/gif poster) under the library media dir. Not extra photos, not mp4s. URLs stay in sqlite.
- **Surface:** the HTTP server is the product. CLI is a client. Effect `HttpApi` (not RPC), OpenAPI, web canvas later on the same API.
- **Paths:** `env-paths` (`x-bookmarks`, no `-nodejs` suffix). Data dir overridable. See `docs/adrs/0002-env-paths.md`.
- **Weights:** Q4_K_M text + mmproj Q8_0. Store 2048-d vectors. See `docs/adrs/0003-gguf-and-dims.md`.
- **llama.cpp:** PATH `llama-server` if present, else fetch pinned official Vulkan build into cache; spawn child; `--no-cache-prompt`.
- **Listen:** `127.0.0.1:8787`. First routes: health, imports, search, OpenAPI.
- **AppConfig:** `Context.Service` with `make(overrides)`. Snapshot includes listen, dirs, derived paths, llama base URL. HTTP listen comes from the service. See `docs/adrs/0006-appconfig-service.md`.
- **Tooling:** Nub (`nub install`, `nub run`, `nub` for `.ts`). Not Bun. Root `"workspaces": ["packages/*"]`. No `.node-version` pin (Node 26 on this machine).
- **Packages:** `@x-bookmarks/server` in `packages/server` (library, embed, HTTP, dump schema, `HttpApi`) and `@x-bookmarks/cli` in `packages/cli` (HTTP client only). See `docs/adrs/0004-nub-workspaces.md` and `docs/adrs/0005-server-cli-packages.md`.
- **E2E tests:** public boundary is HTTP `HttpApi` only (not CLI). Drive it in-process via `apiLayer` + `HttpApiClient` (no `x-bookmarks` listen). Stub the `Llama` service (`state` + `embed`): `ready` immediately, 2048-d vectors derived from text (same text, same vector). Do not spawn `llama-server`. Import hits live `pbs.twimg.com` every time (wipe e2e `media/` too, no copy from the user library). `dataDir` is `/tmp/x-bookmarks-e2e`. Default `vitest` / `nub run check` runs them. No git pre-commit hook. Tests live under `packages/server/test/`. Cases: health ready + empty library, import still, poll embedded, search hit, re-import `updated`, bad dump 400.
