---
name: verify-xkeep
description: "Launch and drive the real xkeep canvas with Playwriter, isolated data, deterministic embeddings, and durable evidence. Use after web, API, import, selection, deletion, or canvas interaction changes."
---

# Verify xkeep

Use this skill to prove xkeep through its web UI. The harness serves the production web build and the real HTTP, SSE, SQLite, import, projection, tag, and deletion code. It swaps only the large production embedding process for the repository's deterministic test embedding layer.

The harness uses port `55337` and the state files under `.audit/verify-xkeep/`. Run one verification instance at a time. Set `XKEEP_VERIFY_PORT` before launch when port `55337` is unavailable.

## Launch

Run from the repository root:

```bash
.agents/skills/verify-xkeep/scripts/launch.sh
```

The script runs `nub run build`, creates a unique directory under `.audit/verify-xkeep/runs/`, starts the verification server, and writes the current PID, URL, run directory, and evidence directory to `.audit/verify-xkeep/current.env` and `current.json`.

The app is ready when launch prints `xkeep verification ready` and the URL. The script waits for `GET /api/health` to return `{ "status": "ok" }` before it prints that line.

## Doctor

Run this read-only check before browser work:

```bash
.agents/skills/verify-xkeep/scripts/doctor.sh
```

Doctor verifies all of these conditions:

- The saved PID is running the verification `serve.ts` file.
- The saved server PID owns the saved HTTP port.
- `GET /api/health` reports `status: ok`.
- The isolated SQLite file exists.

## Drive

Use the extension-connected Chrome browser that is already running. Create a
private Playwriter automation session on that browser; this does not launch a
new or bundled browser. Do not reuse the default page or another agent's
automation session.

```bash
XKEEP_VERIFY_BROWSER="$(playwriter browser list | awk '$2 == "extension" { print $1; exit }')"
test -n "$XKEEP_VERIFY_BROWSER"
XKEEP_VERIFY_SESSION="$(playwriter session new --browser "$XKEEP_VERIFY_BROWSER" | sed -n 's/^Session \([0-9][0-9]*\).*/\1/p')"
playwriter -s "$XKEEP_VERIFY_SESSION" --timeout 120000 -f .agents/skills/verify-xkeep/scripts/verify-mutations.mjs
playwriter session delete "$XKEEP_VERIFY_SESSION"
```

Never pass `--browser headless` on this NixOS host. The bundled browser is not
part of this workflow and may fail to load system libraries. `verify-mutations.mjs`
reads `current.json`, so the Playwriter relay does not need shell environment
variables from the launch process.

The import proof uses these stable UI handles from the repository:

- `getByRole("application", { name: "Bookmark canvas" })`
- `getByLabel("Import bookmarks JSON")`
- `getByLabel("Search the canvas")`
- `getByRole("button", { name: "Filters" })`
- `getByRole("button", { name: "Tags" })`
- `getByRole("button", { name: "Clusters" })`
- `getByRole("button", { name: "Zoom in" })`
- `getByRole("button", { name: "Zoom out" })`
- `getByRole("button", { name: "Fit" })`
- `getByRole("button", { name: "Close inspector" })`
- `getByLabel("Add tag")`

Pixi bookmark marks do not have DOM locators. Set a fixed viewport first. For a one-bookmark fixture, click the center of the `Bookmark canvas` bounding box. For several marks, use a screenshot and `page.mouse` coordinates. Use held-mouse movement for marquee selection and panning.

Read the files under `features/` before driving another flow.

## Evidence

Store proof in the current run's `$XKEEP_VERIFY_EVIDENCE` directory. Evidence must include:

- A screenshot with `scale: "css"`.
- The API response or other observable output that proves the side effect.
- Browser logs when the flow fails.
- The exact URL and feature name.

`verify-mutations.mjs` writes before/after screenshots, `all-mutations.json`, and
`browser-logs.json`. It proves import, search, detail, cluster, single tag, tag
removal, bulk tag, deletion, and tombstone rejection through the browser. A
failure writes `failure.png`, `failure.json`, and `failure-logs.json`. The
isolated SQLite database remains under
`$XKEEP_VERIFY_RUN_DIR/data/xkeep.sqlite`.

## Cleanup

Delete the Playwriter session after browser work. Then stop only the saved verification process:

```bash
.agents/skills/verify-xkeep/scripts/cleanup.sh
```

Cleanup checks the saved server and wrapper commands before signaling those exact PIDs. It does not kill by process name. It keeps the run directory, database, logs, screenshots, and response bodies.

## Helpers

- `scripts/launch.sh`: build and start one isolated verification instance.
- `scripts/doctor.sh`: verify process ownership, socket ownership, health, and SQLite state.
- `scripts/cleanup.sh`: stop the saved verification PID and keep evidence.
- `scripts/serve.ts`: serve the built app with real storage and deterministic embeddings.
- `scripts/verify-mutations.mjs`: drive every web mutation through the UI and capture evidence.
- `fixtures/bookmarks.json` and `fixtures/bookmarks-more.json`: deterministic no-network bookmark dumps.

Run shell helpers directly. Run `serve.ts` with Nub only. Run `.mjs` browser helpers through `playwriter -f` only.
