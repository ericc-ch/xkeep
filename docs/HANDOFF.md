# Handoff (2026-09-08)

State: The review follow-up is complete. This note ships in the same commit as
the fixes. The isolated verification server and Playwriter session are stopped.

Done:

- Updated `docs/CONTEXT.md` for the canvas UI, realtime events, import counts,
  deletion tombstones, thumbnails, and the pinned Effect HTTP client bug.
- Replaced broken `AtomHttpApi.mutation` calls with typed runtime functions.
  Effect `4.0.0-rc.112` does not resolve endpoints in a top-level API group.
- Removed an unused web memo and fixed the Pixi child-removal lint findings.
- Added accessible names for the import input and interactive Pixi canvas.
- Added `.agents/skills/verify-xkeep/`. The skill builds and drives the real web
  bundle with isolated SQLite data and deterministic test embeddings.
- Hardened verification launch and cleanup. Launch rejects occupied ports and
  verifies process ownership. Failed runs save evidence and close their page.

Verified:

- `nub run check` passes typecheck, 34 tests, lint, formatting, and the web build.
- The browser flow passed through the existing extension-connected Chrome. It
  covered import, search, detail, cluster, add tag, remove tag, bulk tag,
  deletion, and tombstone rejection.
- Evidence is under
  `.audit/verify-xkeep/runs/20260908T022805Z-1252488/evidence/`.
- Doctor, occupied-port rejection, process ownership checks, failure evidence,
  page cleanup, and process cleanup all passed.

Next:

1. Run the synthetic 25,000-bookmark canvas performance check.
2. Add browser coverage for navigation, filters, overlays, link copy, and JSON
   export when those areas change.
3. Add a favicon if the expected `/favicon.ico` console 404 becomes distracting.

Decisions made:

- Use the existing extension-connected Chrome for Playwriter on this NixOS host.
- Keep verification data under `.audit/verify-xkeep/` and keep evidence after
  cleanup.
- Exercise production HTTP, SSE, SQLite, and web code. Replace only the large
  GGUF embedding process with the deterministic test layer.

Gotchas:

- Use Nub commands from `AGENTS.md`, not npm or pnpm.
- Pixi marks have no DOM locators. Coordinate gestures must avoid the Playwriter
  toolbar and the app's fixed overlays.
- The browser log for the passing run contains the expected favicon 404 and one
  autofocus information message. The mutation flow has no application errors.
