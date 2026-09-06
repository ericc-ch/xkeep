import { Data, Effect, Predicate, Schema } from "effect"
import { RegistryProvider, useAtomSet } from "@effect/atom-solid"
import { BookmarkDump } from "@xkeep/server/schema"
import * as stylex from "@stylexjs/stylex"
import { createSignal, Match, onCleanup, onMount, Switch } from "solid-js"
import { importDump } from "./api.ts"
import { tokens } from "./tokens.stylex.ts"

const chrome = stylex.create({
  root: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: tokens.font,
    color: tokens.ink,
    backgroundColor: tokens.bg,
  },
  card: {
    maxWidth: 420,
    padding: 24,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: tokens.line,
    backgroundColor: tokens.card,
  },
  lead: {
    margin: "0 0 12px",
    fontSize: 16,
  },
  copy: {
    margin: 0,
    color: tokens.mute,
    lineHeight: 1.5,
  },
  bad: {
    color: tokens.accent,
  },
})

const ALLOWED_ORIGINS = new Set(["https://x.com", "https://twitter.com"])

type ImportState =
  | { readonly kind: "waiting" }
  | { readonly kind: "importing" }
  | { readonly kind: "done"; readonly imported: number; readonly updated: number }
  | { readonly kind: "busy" }
  | { readonly kind: "error"; readonly reason: string }

class ImportMessageFailed extends Data.TaggedError("ImportMessageFailed")<{
  readonly reason: string
}> {}

class ImportBusySignal extends Data.TaggedError("ImportBusySignal") {}

const isImportBusy = (cause: unknown): boolean => Predicate.isTagged(cause, "ImportBusy")

const ImportView = () => {
  const runImport = useAtomSet(() => importDump, { mode: "promise" })
  const [state, setState] = createSignal<ImportState>({ kind: "waiting" })

  onMount(() => {
    const onMessage = (event: MessageEvent) => {
      if (!ALLOWED_ORIGINS.has(event.origin)) return
      if (event.source !== window.opener) return
      if (state().kind === "importing" || state().kind === "done") return
      const handle = Effect.gen(function* () {
        const dump = yield* Schema.decodeUnknownEffect(BookmarkDump)(event.data).pipe(
          Effect.mapError(
            (cause) => new ImportMessageFailed({ reason: `bad export payload: ${String(cause)}` }),
          ),
        )
        setState({ kind: "importing" })
        return yield* Effect.tryPromise({
          try: () => runImport({ payload: dump }),
          catch: (cause) =>
            isImportBusy(cause)
              ? new ImportBusySignal()
              : new ImportMessageFailed({ reason: String(cause) }),
        })
      }).pipe(
        Effect.tap((result) =>
          Effect.sync(() => {
            setState({ kind: "done", imported: result.imported, updated: result.updated })
            window.setTimeout(() => window.close(), 1500)
          }),
        ),
        Effect.catch((error) =>
          Effect.sync(() =>
            setState(
              error instanceof ImportBusySignal
                ? { kind: "busy" }
                : {
                    kind: "error",
                    reason:
                      error instanceof ImportMessageFailed
                        ? error.reason
                        : "Import failed. Close this window and try again.",
                  },
            ),
          ),
        ),
      )
      void Effect.runPromise(handle)
    }
    window.addEventListener("message", onMessage)
    window.opener?.postMessage("xkeep:ready", "*")
    onCleanup(() => window.removeEventListener("message", onMessage))
  })

  return (
    <main {...stylex.attrs(chrome.root)}>
      <div {...stylex.attrs(chrome.card)}>
        <Switch>
          <Match when={state().kind === "waiting"}>
            <p {...stylex.attrs(chrome.lead)}>Waiting for the export…</p>
          </Match>
          <Match when={state().kind === "importing"}>
            <p {...stylex.attrs(chrome.lead)}>Importing…</p>
          </Match>
          <Match when={state().kind === "done" ? { kind: "done" as const } : undefined}>
            <p {...stylex.attrs(chrome.lead)}>Imported. Closing…</p>
          </Match>
          <Match when={state().kind === "busy"}>
            <p {...stylex.attrs([chrome.lead, chrome.bad])}>
              An import is already running. Try again in a moment.
            </p>
          </Match>
          <Match when={state().kind === "error"}>
            <p {...stylex.attrs([chrome.lead, chrome.bad])}>
              Something failed. Close this window and try again.
            </p>
          </Match>
        </Switch>
        <p {...stylex.attrs(chrome.copy)}>
          Run the export snippet on x.com/i/bookmarks to send bookmarks here.
        </p>
      </div>
    </main>
  )
}

export const Import = () => (
  <RegistryProvider>
    <ImportView />
  </RegistryProvider>
)
