# ADR 0010: Managed daemon, event bus, and SSE live updates

## Status

Accepted (2026-09-04); amended same day after grilling (bins, auth, events, bare command); amended 2026-09-04 (`service.json` is CLI-owned, ADR 0012); amended 2026-09-05 (fine bookmark ids, open the origin — ADR 0014); amended 2026-09-05 (default listen `5337`). Ship slices below are done.

## Context

The product is a localhost HTTP app (`packages/server`) with an HTTP-only CLI (`packages/cli`) on the same Effect `HttpApi` / OpenAPI contract. A web UI will be a third client on that API. Requirements:

- clear OpenAPI spec
- CLI
- web interface
- an edit in one place updates the other in realtime
- `npx xkeep` (and CLI verbs) should not require a separately started server for every call; the web UI should stay up after the CLI exits

Inspiration: anomalyco/opencode (v2). Two layers there are easy to conflate:

1. **Session persistence** — append-only durable events + projectors into sqlite (`EventTable` / `EventSequenceTable`). That is event sourcing for chat/session aggregates.
2. **Cross-client live updates** — in-process pub/sub bus after mutations, browser listens on SSE (`GET /event`). Live stream has no Last-Event-ID; reconnect means REST snapshot then resubscribe.

xkeep is not a chat transcript. Cluster renames, tags, imports, and embed progress do not need replayable aggregates or rebuilding the DB from a log. Full event sourcing (every mutation is an event, tables are projections) is rejected for v1: one user, one sqlite file, derived embed work would fight an append log, and OpenAPI stays request/response for mutations. Domain nouns: ADR 0011.

ADR 0008 parked "server-written discovery" for the CLI URL. That is revisited here: the managed daemon _is_ that discovery, via health + a CLI-owned state-dir registration file, not by deriving URL from the server config file.

## Decision

### Shape

One long-lived **server process** owns sqlite, embed drain, OpenAPI, static UI, and live events. CLI and web are clients. Mutations are ordinary HTTP. Realtime is a side channel off those writes.

```
cli / web  --HTTP mutation-->  server writes sqlite
                                 |
                               bus.publish
                                 |
                       +---------+---------+
                       |                   |
                    GET /api/events      other fibers
                       |                   (drain, etc.)
                      web applies / refetches
```

### OpenAPI

- Keep Effect `HttpApi` as the contract. Reads and mutations stay REST (GET/POST/PUT/PATCH) and appear in OpenAPI. Mount the API under `/api` so `/` stays free for the library UI (`/api/health`, `/api/openapi.json`, `/api/docs`).
- Add one streaming endpoint, `GET /api/events` (SSE). Document it as SSE in the spec; do not invent a second RPC surface.
- CLI and web both use HTTP (`@xkeep/server/schema-http` for wire types; web also `@xkeep/server/api`). No sqlite imports in clients (ADR 0005, 0012).

### In-process bus (not event sourcing)

- After a successful sqlite commit, publish a tagged event on an Effect `PubSub`.
- **Fine:** `tag.created` / `tag.updated` / `tag.deleted`, `bookmark.tagged` / `bookmark.untagged`, `bookmark.upserted` `{ ids }`, `bookmark.embedded` `{ ids }`.
- No coarse `bookmarks.changed` (ADR 0014).
- Publishers do not know subscribers. HTTP handlers and the embed drain both publish; neither imports the UI.
- Events are **notifications**, not the source of truth. Sqlite rows remain authoritative. Cluster queries do not publish (read-only, ephemeral — ADR 0011).
- Do **not** introduce an append-only event table or projectors for bookmark/tag mutations in v1. Opencode's durable session log is explicitly not copied.

### SSE (not WebSocket)

- `GET /api/events` subscribes to the bus and streams SSE (Effect `Sse.encode` or equivalent).
- On connect: emit `server.connected`, then live events; optional heartbeat.
- Web on boot: REST snapshot, then `client.events()` (`StreamSse`). On event: invalidate or refetch. On reconnect: snapshot again, then resubscribe (no Last-Event-ID replay on the live stream). First-cut tab only reacts to `bookmark.upserted` / `bookmark.embedded`.
- CLI does **not** subscribe. It is one-shot: mutate, print, exit.
- WebSocket rejected: traffic is server → client; mutations already use HTTP; SSE stays on the existing HTTP stack.

So "edit in one place updates the other" means: both clients hit the same server; the server bus fans out to SSE; the web updates. CLI → web works. Web → CLI does not matter (no long-running CLI UI).

### Managed daemon (simple ensure)

Copy opencode's _lifecycle idea_, not its multi-contender election (many clients racing `serve --service` over one port).

**One user-facing bin:** `xkeep`. Top level is `service` (process) and `api` (HttpApi). Package split may remain internal.

**Auth:** trust loopback. No password in `service.json` (pid/host/port/url/startedAt only). Revisit if bind leaves `127.0.0.1`.

**Bare `xkeep` (no subcommand):** ensure daemon, print the ready banner (art, pid when registered, origin, `/api/`, `xkeep api` example). Do not print llama state: HTTP is up while setup is still forked, so it would almost always say starting. Open the origin (`xdg-open`). Do not open `/api/docs`.

**Ensure URL** (bare + `service start` / `restart`): `--url` if set → probe that URL only (do not spawn). Else a `service.json` whose pid is alive and `GET /api/health` is HTTP 200 with `status: ok`. Else default `http://127.0.0.1:5337`. Else spawn detached `xkeep service serve`. Do not wait for `llama: ready`.

**`api` URL** (no spawn): same probe order, then fail with “run `xkeep service start`” if nothing is up.

Foreground `service serve` writes `service.json` (CLI, after `AppConfig` resolves). `service stop` may stop a debug serve.

On `service start` / bare / restart spawn:

1. Probe as in **Ensure URL** above.
2. If healthy → use it.
3. If not (and `--url` was not set) → spawn **detached** `xkeep service serve`, **unref** the child, poll until `service.json` + `/api/health` are ready (or fail with a stderr tail).
4. If bind fails because something else already took the port, re-probe health and attach; do not run a voting/election protocol. If the occupant is not our health payload, fail with a clear message; do not kill strangers.

### CLI surface

| Command                       | Role                                                                                                                                                                                                                                                                     |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `xkeep`                 | Ensure daemon, print ready banner                                                                                                                                                                        |
| `xkeep service serve`   | Foreground server (debug); print the same banner after listen                                                                                                                                           |
| `xkeep service start`   | Ensure daemon running                                                                                                                                                                                                                                                    |
| `xkeep service stop`    | Stop the registered daemon                                                                                                                                                                                                                                               |
| `xkeep service restart` | Stop then start; must not silently reuse an unresponsive incumbent                                                                                                                                                                                                       |
| `xkeep service status`  | Registration + health                                                                                                                                                                                                                                                    |
| `xkeep api …`           | One command. `METHOD /path` or OpenAPI `operationId` (resolved from live `GET /api/openapi.json`). `--param key=value` fills `{path}` then leftover query. `--data` / `-d` is the body (`@file` or `@-` for stdin). `--header` / `-H` `name:value`. Stdout is the response body. Does not spawn. |

Exiting the CLI or closing the browser does not stop the daemon. Only `service stop`, an explicit kill, or reboot does (user-level systemd/launchd for reboot persistence is optional later, not v1).

Stale `service.json` (dead pid): treat as missing and start fresh. Port still held by a foreign process: fail with a clear message, do not kill strangers.

This revises ADR 0008's "CLI reads no discovery file": the CLI may read `service.json` / health for ensure, but still does not read `~/.config/xkeep/config.json`. Server listen config remains server-owned.

### Packages

- Server: bus, `GET /api/events`, tag tree, cluster query, pile/media (ADR 0011, 0014).
- CLI: `service *`, `api`, `service.json`.
- Web: REST snapshot + `client.events()`; same mutation endpoints. First cut is drop + map at `/`.

## Consequences

- Realtime costs one SSE route and a bus publish after writes; OpenAPI stays the source of client contracts.
- Cold CLI pays a one-time daemon spawn; warm CLI is a health check + HTTP.
- Web UI can stay up indefinitely while the user runs many CLI commands.
- No event-log migration, no projector framework, no WebSocket stack in v1.
- No stored cluster rows to invalidate; tag events are stable ids; import/embed publish `bookmark.upserted` / `bookmark.embedded` with ids (ADR 0014).
- Opencode's durable session event sourcing remains a reference if we later need auditable replay for a specific aggregate; it is not the default for bookmark/tag CRUD.
