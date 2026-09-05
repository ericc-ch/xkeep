import { Data, Effect, Schema } from "effect"
import { AsyncResult } from "effect/unstable/reactivity"
import { RegistryProvider, useAtomMount, useAtomSet, useAtomValue } from "@effect/atom-solid"
import { BookmarkDump } from "@xkeep/server/schema"
import * as stylex from "@stylexjs/stylex"
import { createEffect, createSignal, onCleanup, Show, type JSX } from "solid-js"
import { importDump, liveAtom, pileAtom, type PileItem } from "./api.ts"
import { createMap, hasCoords, SPREAD_DEFAULT, SPREAD_MAX, SPREAD_MIN, type MapHandle } from "./map.ts"
import { tokens } from "./tokens.stylex.ts"

const chrome = stylex.create({
  root: {
    position: "relative",
    height: "100%",
    fontFamily: tokens.font,
    color: tokens.ink,
    backgroundColor: tokens.bg,
  },
  bar: {
    position: "absolute",
    top: 16,
    left: 16,
    zIndex: 2,
    display: "flex",
    gap: 12,
    alignItems: "center",
    pointerEvents: "none",
  },
  spread: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    pointerEvents: "auto",
    color: tokens.mute,
    fontSize: 12,
  },
  slider: {
    width: 120,
    accentColor: tokens.accent,
  },
  title: {
    margin: 0,
    fontSize: 18,
    letterSpacing: "0.04em",
  },
  hint: {
    color: tokens.mute,
    fontSize: 13,
  },
  map: {
    position: "absolute",
    inset: 0,
  },
  empty: {
    position: "absolute",
    inset: 0,
    zIndex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    pointerEvents: "none",
  },
  card: {
    maxWidth: 420,
    padding: 24,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: tokens.line,
    color: tokens.ink,
    backgroundColor: tokens.bg,
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
  error: {
    position: "absolute",
    right: 16,
    bottom: 16,
    zIndex: 2,
    color: tokens.accent,
    fontSize: 13,
  },
  open: {
    position: "absolute",
    zIndex: 3,
    width: 220,
    maxWidth: "min(220px, calc(100vw - 32px))",
    padding: 8,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: tokens.line,
    backgroundColor: tokens.card,
    boxShadow: "0 18px 50px rgba(0, 0, 0, 0.45)",
    pointerEvents: "auto",
  },
  who: {
    display: "flex",
    justifyContent: "space-between",
    gap: 8,
    alignItems: "baseline",
    marginBottom: 8,
  },
  name: {
    margin: 0,
    fontSize: 14,
    fontWeight: 600,
  },
  handle: {
    color: tokens.mute,
    fontSize: 12,
  },
  close: {
    margin: 0,
    padding: 0,
    borderWidth: 0,
    color: tokens.mute,
    backgroundColor: "transparent",
    fontSize: 13,
    cursor: "pointer",
  },
  photo: {
    display: "block",
    width: "100%",
    maxHeight: "22vh",
    margin: "0 0 8px",
    objectFit: "contain",
    backgroundColor: tokens.bg,
  },
  body: {
    margin: 0,
    fontSize: 13,
    lineHeight: 1.45,
    whiteSpace: "pre-wrap",
  },
})

const SPREAD_KEY = "xkeep.spread"

const readSpread = () => {
  const raw = localStorage.getItem(SPREAD_KEY)
  if (raw === null) return SPREAD_DEFAULT
  const n = Number(raw)
  if (!Number.isFinite(n)) return SPREAD_DEFAULT
  return Math.min(SPREAD_MAX, Math.max(SPREAD_MIN, n))
}

class DumpReadFailed extends Data.TaggedError("DumpReadFailed")<{
  readonly reason: string
}> {}

const LibraryView = () => {
  useAtomMount(() => liveAtom)
  const pile = useAtomValue(() => pileAtom)
  const runImport = useAtomSet(() => importDump, { mode: "promise" })
  const [host, setHost] = createSignal<HTMLDivElement>()
  const [open, setOpen] = createSignal<PileItem>()
  const [pin, setPin] = createSignal({ x: 0, y: 0 })
  const [spread, setSpread] = createSignal(readSpread())
  let map: MapHandle | undefined

  const drop = Effect.fn("drop")(function* (file: File) {
    const text = yield* Effect.tryPromise({
      try: () => file.text(),
      catch: (cause) => new DumpReadFailed({ reason: String(cause) }),
    })
    const json = yield* Effect.try({
      try: () => JSON.parse(text) as unknown,
      catch: (cause) => new DumpReadFailed({ reason: String(cause) }),
    })
    const dump = yield* Schema.decodeUnknownEffect(BookmarkDump)(json)
    yield* Effect.tryPromise({
      try: () => runImport({ payload: dump }),
      catch: (cause) => new DumpReadFailed({ reason: String(cause) }),
    })
  })

  const onDrop: JSX.EventHandlerUnion<HTMLElement, DragEvent> = (event) => {
    event.preventDefault()
    const file = event.dataTransfer?.files.item(0)
    if (file === null || file === undefined) return
    void Effect.runPromise(drop(file))
  }

  const follow = (id?: string) => {
    const target = id ?? open()?.id
    if (target === undefined || map === undefined) return
    const placed = map.screenOfId(target)
    if (placed !== undefined) setPin(placed)
  }

  createEffect(() => {
    const el = host()
    if (el === undefined) return
    const handle = createMap(el, {
      onPick: (item) => {
        setOpen(item)
        follow(item.id)
      },
      onView: follow,
      spread: readSpread(),
    })
    map = handle
    onCleanup(() => {
      handle.destroy()
      if (map === handle) map = undefined
    })
  })

  createEffect(() => {
    const result = pile()
    const items = AsyncResult.isSuccess(result) ? result.value.filter(hasCoords) : undefined
    if (items === undefined || map === undefined) return
    map.sync(items)
    const current = open()
    if (current !== undefined && !items.some((row) => row.id === current.id)) setOpen(undefined)
  })

  return (
    <main
      {...stylex.attrs(chrome.root)}
      onDragOver={(event) => event.preventDefault()}
      onDrop={onDrop}
    >
      <div {...stylex.attrs(chrome.bar)}>
        <h1 {...stylex.attrs(chrome.title)}>xkeep</h1>
        <span {...stylex.attrs(chrome.hint)}>drop a bookmarks export</span>
        <label {...stylex.attrs(chrome.spread)}>
          spread
          <input
            {...stylex.attrs(chrome.slider)}
            type="range"
            min={SPREAD_MIN}
            max={SPREAD_MAX}
            value={spread()}
            onInput={(event) => {
              const next = Number(event.currentTarget.value)
              setSpread(next)
              localStorage.setItem(SPREAD_KEY, String(next))
              map?.setSpread(next)
            }}
          />
        </label>
      </div>
      <div ref={setHost} {...stylex.attrs(chrome.map)} />
      <Show when={open()}>
        {(item) => (
          <article
            {...stylex.attrs(chrome.open)}
            style={{
              left: `${String(pin().x)}px`,
              top: `${String(pin().y)}px`,
              transform: "translate(-50%, calc(-100% - 16px))",
            }}
          >
            <div {...stylex.attrs(chrome.who)}>
              <p {...stylex.attrs(chrome.name)}>
                {item().author} <span {...stylex.attrs(chrome.handle)}>@{item().handle}</span>
              </p>
              <button type="button" {...stylex.attrs(chrome.close)} onClick={() => setOpen(undefined)}>
                close
              </button>
            </div>
            <Show when={"still" in item() ? item().still : undefined}>
              {(src) => <img {...stylex.attrs(chrome.photo)} src={src()} alt="" />}
            </Show>
            <p {...stylex.attrs(chrome.body)}>{item().text}</p>
          </article>
        )}
      </Show>
      {AsyncResult.match(pile(), {
        onInitial: () => (
          <div {...stylex.attrs(chrome.empty)}>
            <div {...stylex.attrs(chrome.card)}>
              <p {...stylex.attrs(chrome.lead)}>Loading the pile…</p>
            </div>
          </div>
        ),
        onFailure: () => (
          <p {...stylex.attrs(chrome.error)}>Could not load bookmarks.</p>
        ),
        onSuccess: (result) => {
          const ready = result.value.filter(hasCoords)
          if (result.value.length === 0) {
            return (
              <div {...stylex.attrs(chrome.empty)}>
                <div {...stylex.attrs(chrome.card)}>
                  <p {...stylex.attrs(chrome.lead)}>The library is empty.</p>
                  <p {...stylex.attrs(chrome.copy)}>
                    On x.com/i/bookmarks, run the export snippet and drop the JSON file here.
                    Embeddings fill in the background. Search and tags come next.
                  </p>
                </div>
              </div>
            )
          }
          if (ready.length === 0) {
            return (
              <div {...stylex.attrs(chrome.empty)}>
                <div {...stylex.attrs(chrome.card)}>
                  <p {...stylex.attrs(chrome.lead)}>Embedding the pile…</p>
                  <p {...stylex.attrs(chrome.copy)}>
                    Thumbs show after each bookmark has a vector and a UMAP point.
                  </p>
                </div>
              </div>
            )
          }
          return undefined
        },
      })}
    </main>
  )
}

export const Library = () => (
  <RegistryProvider>
    <LibraryView />
  </RegistryProvider>
)
