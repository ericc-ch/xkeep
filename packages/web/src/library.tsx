import { Data, Effect, Option, Schema } from "effect"
import { AsyncResult } from "effect/unstable/reactivity"
import {
  RegistryProvider,
  useAtomMount,
  useAtomRefresh,
  useAtomSet,
  useAtomValue,
} from "@effect/atom-solid"
import { BookmarkDump } from "@xkeep/server/schema"
import * as stylex from "@stylexjs/stylex"
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  Match,
  onCleanup,
  Show,
  Switch,
  type JSX,
  untrack,
} from "solid-js"
import {
  addTagMutation,
  bookmarkDetail,
  bulkApplyTagMutation,
  clusterQuery,
  importDump,
  liveAtom,
  pileAtom,
  removeTagMutation,
  searchQuery,
  tagsAtom,
  type Detail,
  type PileItem,
  type SearchHit,
} from "./api.ts"
import {
  createMap,
  hasCoords,
  SPREAD_DEFAULT,
  SPREAD_MAX,
  SPREAD_MIN,
  type MapHandle,
} from "./map.ts"
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
  title: {
    margin: 0,
    fontSize: 18,
    letterSpacing: "0.04em",
  },
  search: {
    width: 220,
    padding: "6px 10px",
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: tokens.line,
    color: tokens.ink,
    backgroundColor: tokens.bg,
    fontSize: 13,
    pointerEvents: "auto",
  },
  count: {
    color: tokens.mute,
    fontSize: 12,
    pointerEvents: "auto",
    minWidth: 28,
  },
  countBad: {
    color: tokens.accent,
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
  toggle: {
    padding: "6px 10px",
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: tokens.line,
    color: tokens.mute,
    backgroundColor: tokens.bg,
    fontSize: 12,
    cursor: "pointer",
    pointerEvents: "auto",
  },
  toggleOn: {
    color: tokens.ink,
    borderColor: tokens.accent,
  },
  kInput: {
    width: 44,
    padding: "4px 6px",
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: tokens.line,
    color: tokens.ink,
    backgroundColor: tokens.bg,
    fontSize: 12,
    pointerEvents: "auto",
  },
  filterBar: {
    position: "absolute",
    top: 56,
    left: 16,
    zIndex: 2,
    display: "flex",
    gap: 8,
    alignItems: "center",
    pointerEvents: "none",
  },
  chip: {
    padding: "4px 8px",
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: tokens.line,
    color: tokens.mute,
    backgroundColor: tokens.bg,
    fontSize: 12,
    cursor: "pointer",
    pointerEvents: "auto",
  },
  chipOn: {
    color: tokens.ink,
    borderColor: tokens.accent,
  },
  select: {
    padding: "4px 6px",
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: tokens.line,
    color: tokens.ink,
    backgroundColor: tokens.bg,
    fontSize: 12,
    pointerEvents: "auto",
  },
  hits: {
    position: "absolute",
    top: 96,
    left: 16,
    zIndex: 2,
    width: 340,
    maxHeight: "42vh",
    overflowY: "auto",
    padding: 8,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: tokens.line,
    backgroundColor: tokens.card,
    pointerEvents: "auto",
  },
  hit: {
    display: "block",
    width: "100%",
    margin: 0,
    padding: "6px 4px",
    borderWidth: 0,
    borderBottomWidth: 1,
    borderBottomStyle: "solid",
    borderBottomColor: tokens.line,
    color: tokens.ink,
    backgroundColor: "transparent",
    textAlign: "left",
    fontSize: 12,
    cursor: "pointer",
  },
  hitWho: {
    margin: 0,
    color: tokens.mute,
    fontSize: 11,
  },
  hitText: {
    margin: 0,
    lineHeight: 1.35,
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
    width: 280,
    maxWidth: "min(280px, calc(100vw - 32px))",
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
  actions: {
    display: "flex",
    gap: 8,
    alignItems: "baseline",
  },
  xlink: {
    color: tokens.mute,
    fontSize: 12,
    textDecoration: "none",
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
  hashtags: {
    margin: "8px 0 0",
    color: tokens.mute,
    fontSize: 12,
  },
  urls: {
    margin: "8px 0 0",
    fontSize: 12,
    wordBreak: "break-all",
  },
  quoted: {
    margin: "8px 0 0",
    padding: 8,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: tokens.line,
    backgroundColor: tokens.bg,
  },
  quotedWho: {
    margin: 0,
    color: tokens.mute,
    fontSize: 11,
  },
  quotedBody: {
    margin: "4px 0 0",
    fontSize: 12,
    lineHeight: 1.4,
    whiteSpace: "pre-wrap",
  },
  tagsRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
    alignItems: "center",
    marginTop: 10,
  },
  tagChip: {
    display: "flex",
    gap: 4,
    alignItems: "center",
    padding: "2px 6px",
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: tokens.line,
    color: tokens.ink,
    fontSize: 11,
  },
  tagX: {
    margin: 0,
    padding: 0,
    borderWidth: 0,
    color: tokens.mute,
    backgroundColor: "transparent",
    fontSize: 11,
    cursor: "pointer",
  },
  addTag: {
    width: 90,
    padding: "2px 6px",
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: tokens.line,
    color: tokens.ink,
    backgroundColor: tokens.bg,
    fontSize: 11,
  },
  groupRow: {
    display: "flex",
    gap: 6,
    alignItems: "center",
    marginTop: 8,
    color: tokens.mute,
    fontSize: 11,
  },
})

const MEDIA_KINDS = ["photo", "video", "gif", "link", "text"] as const

const DATE_DAYS = [undefined, 30, 90, 365] as const

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

class DetailFailed extends Data.TaggedError("DetailFailed") {}

class TagWriteFailed extends Data.TaggedError("TagWriteFailed") {}

class SearchFailed extends Data.TaggedError("SearchFailed") {}

class ClusterFailed extends Data.TaggedError("ClusterFailed") {}

type SearchState =
  | { readonly kind: "idle" }
  | { readonly kind: "loading" }
  | { readonly kind: "hits"; readonly hits: ReadonlyArray<SearchHit> }
  | { readonly kind: "failed" }

type CardProps = {
  readonly item: PileItem
  readonly detail: Detail | undefined
  readonly pin: { readonly x: number; readonly y: number }
  readonly group: number | undefined
  readonly groupSize: number
  readonly onClose: () => void
  readonly onAddTag: (tag: string) => void
  readonly onRemoveTag: (tag: string) => void
  readonly onTagGroup: (group: number, tag: string) => void
}

const snippet = (text: string, max: number) =>
  text.length <= max ? text : `${text.slice(0, max)}…`

const Card = (props: CardProps) => {
  const [tagDraft, setTagDraft] = createSignal("")
  const [groupDraft, setGroupDraft] = createSignal("")
  const tags = () => props.detail?.tags ?? props.item.tags
  const postUrl = () => `https://x.com/${props.item.handle}/status/${props.item.id}`
  return (
    <article
      {...stylex.attrs(chrome.open)}
      style={{
        left: `${String(props.pin.x)}px`,
        top: `${String(props.pin.y)}px`,
        transform: "translate(-50%, calc(-100% - 16px))",
      }}
    >
      <div {...stylex.attrs(chrome.who)}>
        <p {...stylex.attrs(chrome.name)}>
          {props.item.author} <span {...stylex.attrs(chrome.handle)}>@{props.item.handle}</span>
        </p>
        <div {...stylex.attrs(chrome.actions)}>
          <a {...stylex.attrs(chrome.xlink)} href={postUrl()} target="_blank" rel="noreferrer">
            open
          </a>
          <button type="button" {...stylex.attrs(chrome.close)} onClick={() => props.onClose()}>
            close
          </button>
        </div>
      </div>
      <Show
        when={props.detail}
        fallback={
          <For each={"still" in props.item ? [props.item.still] : []}>
            {(src) => <img {...stylex.attrs(chrome.photo)} src={src} alt="" />}
          </For>
        }
      >
        {(current) => (
          <Show
            when={current().media.length > 0}
            fallback={
              <For each={current().stills}>
                {(src) => <img {...stylex.attrs(chrome.photo)} src={src} alt="" />}
              </For>
            }
          >
            <For each={current().media}>
              {(media) => (
                <Switch>
                  <Match when={media.type === "photo"}>
                    <img {...stylex.attrs(chrome.photo)} src={media.url} alt="" />
                  </Match>
                  <Match when={media.type === "video"}>
                    <video
                      {...stylex.attrs(chrome.photo)}
                      src={media.url}
                      poster={media.poster}
                      controls
                      playsinline
                    />
                  </Match>
                  <Match when={media.type === "gif"}>
                    <video
                      {...stylex.attrs(chrome.photo)}
                      src={media.url}
                      poster={media.poster}
                      autoplay
                      loop
                      muted
                      playsinline
                    />
                  </Match>
                </Switch>
              )}
            </For>
          </Show>
        )}
      </Show>
      <p {...stylex.attrs(chrome.body)}>{props.item.text}</p>
      <Show when={(props.detail?.hashtags.length ?? 0) > 0}>
        <p {...stylex.attrs(chrome.hashtags)}>
          {props.detail?.hashtags.map((tag) => `#${tag}`).join(" ")}
        </p>
      </Show>
      <Show when={(props.detail?.urls.length ?? 0) > 0}>
        <For each={props.detail?.urls}>
          {(url) => (
            <p {...stylex.attrs(chrome.urls)}>
              <a href={url} target="_blank" rel="noreferrer">
                {url}
              </a>
            </p>
          )}
        </For>
      </Show>
      <Show when={props.detail?.quoted}>
        {(quoted) => (
          <div {...stylex.attrs(chrome.quoted)}>
            <p {...stylex.attrs(chrome.quotedWho)}>
              {quoted().author} @{quoted().handle}
            </p>
            <p {...stylex.attrs(chrome.quotedBody)}>{quoted().text}</p>
          </div>
        )}
      </Show>
      <div {...stylex.attrs(chrome.tagsRow)}>
        <For each={tags()}>
          {(tag) => (
            <span {...stylex.attrs(chrome.tagChip)}>
              {tag}
              <button
                type="button"
                {...stylex.attrs(chrome.tagX)}
                onClick={() => void props.onRemoveTag(tag)}
              >
                ×
              </button>
            </span>
          )}
        </For>
        <input
          {...stylex.attrs(chrome.addTag)}
          placeholder="+ tag"
          value={tagDraft()}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return
            const tag = tagDraft().trim()
            if (tag.length === 0) return
            setTagDraft("")
            void props.onAddTag(tag)
          }}
          onInput={(event) => setTagDraft(event.currentTarget.value)}
        />
      </div>
      <Show when={props.group !== undefined}>
        <div {...stylex.attrs(chrome.groupRow)}>
          group {String(props.group)} · {String(props.groupSize)}
          <input
            {...stylex.attrs(chrome.addTag)}
            placeholder="tag group"
            value={groupDraft()}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return
              const group = props.group
              const tag = groupDraft().trim()
              if (group === undefined || tag.length === 0) return
              setGroupDraft("")
              void props.onTagGroup(group, tag)
            }}
            onInput={(event) => setGroupDraft(event.currentTarget.value)}
          />
        </div>
      </Show>
    </article>
  )
}

const LibraryView = () => {
  useAtomMount(() => liveAtom)
  const pile = useAtomValue(() => pileAtom)
  const tags = useAtomValue(() => tagsAtom)
  const refreshTags = useAtomRefresh(() => tagsAtom)
  const runImport = useAtomSet(() => importDump, { mode: "promise" })
  const runSearch = useAtomSet(() => searchQuery, { mode: "promise" })
  const runDetail = useAtomSet(() => bookmarkDetail, { mode: "promise" })
  const runCluster = useAtomSet(() => clusterQuery, { mode: "promise" })
  const runAddTag = useAtomSet(() => addTagMutation, { mode: "promise" })
  const runRemoveTag = useAtomSet(() => removeTagMutation, { mode: "promise" })
  const runBulkTag = useAtomSet(() => bulkApplyTagMutation, { mode: "promise" })

  const [host, setHost] = createSignal<HTMLDivElement>()
  const [open, setOpen] = createSignal<PileItem>()
  const [detail, setDetail] = createSignal<Detail>()
  const [pin, setPin] = createSignal({ x: 0, y: 0 })
  const [spread, setSpread] = createSignal(readSpread())
  const [queryDraft, setQueryDraft] = createSignal("")
  const [search, setSearch] = createSignal<SearchState>({ kind: "idle" })
  const [mediaFilter, setMediaFilter] = createSignal<ReadonlySet<string>>(new Set())
  const [tagFilter, setTagFilter] = createSignal<string>()
  const [authorFilter, setAuthorFilter] = createSignal("")
  const [dateDays, setDateDays] = createSignal<number>()
  const [clusterOn, setClusterOn] = createSignal(false)
  const [clusterK, setClusterK] = createSignal(12)
  const [groups, setGroups] = createSignal<ReadonlyMap<string, number>>()
  const [actionError, setActionError] = createSignal<string>()
  let map: MapHandle | undefined
  let clusterRequest = 0
  let detailRequest = 0
  let searchRequest = 0

  const items = createMemo<Array<PileItem>>(() => {
    const result = pile()
    return AsyncResult.isSuccess(result) ? [...result.value] : []
  })

  const tagList = createMemo<Array<{ readonly tag: string; readonly count: number }>>(() => {
    const current = tags()
    return AsyncResult.isSuccess(current) ? [...current.value.tags] : []
  })

  const hits = createMemo<ReadonlyArray<SearchHit>>(() => {
    const state = search()
    return state.kind === "hits" ? state.hits : []
  })

  const countLabel = createMemo(() => {
    const state = search()
    if (state.kind === "loading") return "…"
    if (state.kind === "hits") return String(state.hits.length)
    if (state.kind === "failed") return "!"
    return ""
  })

  const searchIds = createMemo<ReadonlySet<string> | undefined>(() => {
    const state = search()
    return state.kind === "hits" ? new Set(state.hits.map((hit) => hit.id)) : undefined
  })

  const filtersActive = createMemo(
    () =>
      mediaFilter().size > 0 ||
      tagFilter() !== undefined ||
      authorFilter().trim() !== "" ||
      dateDays() !== undefined,
  )

  const filterIds = createMemo<ReadonlySet<string> | undefined>(() => {
    if (!filtersActive()) return undefined
    const media = mediaFilter()
    const tag = tagFilter()
    const author = authorFilter().trim()
    const days = dateDays()
    const cutoff = days === undefined ? undefined : Date.now() - days * 86_400_000
    const matched = new Set<string>()
    for (const item of items()) {
      if (media.size > 0 && !item.mediaTypes.some((kind) => media.has(kind))) continue
      if (tag !== undefined && !item.tags.includes(tag)) continue
      if (author !== "" && item.handle !== author) continue
      if (cutoff !== undefined && Date.parse(item.timestamp) < cutoff) continue
      matched.add(item.id)
    }
    return matched
  })

  const highlighted = createMemo<ReadonlySet<string> | undefined>(() => {
    const searched = searchIds()
    const filtered = filterIds()
    if (searched !== undefined && filtered !== undefined) {
      return new Set([...searched].filter((id) => filtered.has(id)))
    }
    return searched ?? filtered
  })

  const authors = createMemo<Array<string>>(() =>
    [...new Set(items().map((item) => item.handle))].sort(),
  )

  const follow = (id?: string) => {
    const target = id ?? open()?.id
    if (target === undefined || map === undefined) return
    const placed = map.screenOfId(target)
    if (placed !== undefined) setPin(placed)
  }

  const loadDetail = Effect.fn("loadDetail")(function* (id: string) {
    const request = ++detailRequest
    const fetched = yield* Effect.tryPromise({
      try: () => runDetail({ params: { id } }),
      catch: () => new DetailFailed(),
    }).pipe(Effect.option)
    if (request === detailRequest && Option.isSome(fetched) && open()?.id === id) {
      setDetail(fetched.value)
    }
  })

  const addTag = (tag: string) => {
    const id = open()?.id
    if (id === undefined) return
    void Effect.runPromise(
      Effect.gen(function* () {
        const result = yield* Effect.tryPromise({
          try: () => runAddTag({ params: { id, tag } }),
          catch: () => new TagWriteFailed(),
        }).pipe(Effect.option)
        if (Option.isNone(result)) {
          setActionError("Could not add the tag.")
          return
        }
        setActionError(undefined)
        yield* loadDetail(id)
        refreshTags()
      }),
    )
  }

  const removeTag = (tag: string) => {
    const id = open()?.id
    if (id === undefined) return
    void Effect.runPromise(
      Effect.gen(function* () {
        const result = yield* Effect.tryPromise({
          try: () => runRemoveTag({ params: { id, tag } }),
          catch: () => new TagWriteFailed(),
        }).pipe(Effect.option)
        if (Option.isNone(result)) {
          setActionError("Could not remove the tag.")
          return
        }
        setActionError(undefined)
        yield* loadDetail(id)
        refreshTags()
      }),
    )
  }

  const tagGroup = (group: number, tag: string) => {
    const current = groups()
    if (current === undefined) return
    const memberIds = [...current.entries()]
      .filter(([, other]) => other === group)
      .map(([id]) => id)
    if (memberIds.length === 0) return
    void Effect.runPromise(
      Effect.gen(function* () {
        const result = yield* Effect.tryPromise({
          try: () => runBulkTag({ payload: { memberIds, tag } }),
          catch: () => new TagWriteFailed(),
        }).pipe(Effect.option)
        if (Option.isNone(result)) {
          setActionError("Could not tag the group.")
          return
        }
        setActionError(undefined)
        refreshTags()
      }),
    )
  }

  const submitSearch = (raw: string) => {
    const q = raw.trim()
    if (q.length === 0) {
      searchRequest += 1
      setSearch({ kind: "idle" })
      return
    }
    const request = ++searchRequest
    setSearch({ kind: "loading" })
    void Effect.runPromise(
      Effect.gen(function* () {
        const result = yield* Effect.tryPromise({
          try: () => runSearch({ query: { q } }),
          catch: () => new SearchFailed(),
        }).pipe(Effect.option)
        if (request === searchRequest) {
          setSearch(
            Option.isSome(result) ? { kind: "hits", hits: result.value.hits } : { kind: "failed" },
          )
        }
      }),
    )
  }

  const clearSearch = () => {
    searchRequest += 1
    setQueryDraft("")
    setSearch({ kind: "idle" })
  }

  const openHit = (hit: SearchHit) => {
    const item = items().find((row) => row.id === hit.id)
    if (item === undefined) return
    setOpen(item)
    follow(item.id)
  }

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

  createEffect(() => {
    const el = host()
    if (el === undefined) return
    const handle = createMap(el, {
      onPick: (item) => {
        setOpen(item)
        follow(item.id)
      },
      onView: () => follow(),
      spread: readSpread(),
    })
    map = handle
    untrack(() => {
      handle.setHighlight(highlighted())
      handle.setGroups(groups())
      const result = pile()
      if (AsyncResult.isSuccess(result)) handle.sync(result.value.filter(hasCoords))
    })
    onCleanup(() => {
      handle.destroy()
      if (map === handle) map = undefined
    })
  })

  createEffect(() => {
    const result = pile()
    if (!AsyncResult.isSuccess(result)) return
    const fresh = result.value
    map?.sync(fresh.filter(hasCoords))
    const current = open()
    if (current !== undefined) {
      const next = fresh.find((row) => row.id === current.id)
      if (next === undefined) setOpen(undefined)
      else if (next !== current) setOpen(next)
    }
  })

  createEffect(() => {
    map?.setHighlight(highlighted())
  })

  createEffect(() => {
    if (!clusterOn()) {
      clusterRequest += 1
      setGroups(undefined)
      map?.setGroups(undefined)
      return
    }
    const k = clusterK()
    const request = ++clusterRequest
    void Effect.runPromise(
      Effect.gen(function* () {
        const result = yield* Effect.tryPromise({
          try: () => runCluster({ query: k >= 1 ? { k } : {} }),
          catch: () => new ClusterFailed(),
        }).pipe(Effect.option)
        if (request !== clusterRequest || !clusterOn() || clusterK() !== k) return
        if (Option.isNone(result)) {
          setGroups(undefined)
          map?.setGroups(undefined)
          return
        }
        const next = new Map(result.value.members.map((member) => [member.id, member.groupId]))
        setGroups(next)
        map?.setGroups(next)
      }),
    )
  })

  createEffect(() => {
    const item = open()
    if (item === undefined) {
      detailRequest += 1
      setDetail(undefined)
      return
    }
    const id = item.id
    setDetail(undefined)
    void Effect.runPromise(loadDetail(id))
  })

  const openGroup = () => {
    const id = open()?.id
    const current = groups()
    if (id === undefined || current === undefined) return undefined
    return current.get(id)
  }

  const groupSize = (group: number) => {
    const current = groups()
    if (current === undefined) return 0
    let n = 0
    for (const other of current.values()) {
      if (other === group) n += 1
    }
    return n
  }

  return (
    <main
      {...stylex.attrs(chrome.root)}
      onDragOver={(event) => event.preventDefault()}
      onDrop={onDrop}
    >
      <div {...stylex.attrs(chrome.bar)}>
        <h1 {...stylex.attrs(chrome.title)}>xkeep</h1>
        <input
          {...stylex.attrs(chrome.search)}
          placeholder="search the pile ⏎"
          value={queryDraft()}
          onInput={(event) => setQueryDraft(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") submitSearch(queryDraft())
            if (event.key === "Escape") clearSearch()
          }}
        />
        <span
          {...stylex.attrs(
            search().kind === "failed" ? [chrome.count, chrome.countBad] : chrome.count,
          )}
        >
          {countLabel()}
        </span>
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
        <button
          type="button"
          {...stylex.attrs(clusterOn() ? [chrome.toggle, chrome.toggleOn] : chrome.toggle)}
          onClick={() => setClusterOn((on) => !on)}
        >
          clusters
        </button>
        <Show when={clusterOn()}>
          <label {...stylex.attrs(chrome.spread)}>
            k
            <input
              {...stylex.attrs(chrome.kInput)}
              type="number"
              min={1}
              max={64}
              value={clusterK()}
              onInput={(event) => setClusterK(Number(event.currentTarget.value))}
            />
          </label>
        </Show>
      </div>
      <div {...stylex.attrs(chrome.filterBar)}>
        <For each={[...MEDIA_KINDS]}>
          {(kind) => (
            <button
              type="button"
              {...stylex.attrs(
                mediaFilter().has(kind) ? [chrome.chip, chrome.chipOn] : chrome.chip,
              )}
              onClick={() => {
                const next = new Set(mediaFilter())
                if (next.has(kind)) next.delete(kind)
                else next.add(kind)
                setMediaFilter(next)
              }}
            >
              {kind}
            </button>
          )}
        </For>
        <select
          {...stylex.attrs(chrome.select)}
          value={tagFilter() ?? ""}
          onChange={(event) =>
            setTagFilter(event.currentTarget.value === "" ? undefined : event.currentTarget.value)
          }
        >
          <option value="">tag: any</option>
          <For each={tagList()}>
            {(entry) => (
              <option value={entry.tag}>
                {entry.tag} ({String(entry.count)})
              </option>
            )}
          </For>
        </select>
        <input
          {...stylex.attrs(chrome.search)}
          style={{ width: "120px" }}
          placeholder="@author"
          list="xkeep-authors"
          value={authorFilter()}
          onInput={(event) => setAuthorFilter(event.currentTarget.value)}
        />
        <datalist id="xkeep-authors">
          <For each={authors()}>{(handle) => <option value={handle} />}</For>
        </datalist>
        <select
          {...stylex.attrs(chrome.select)}
          value={dateDays() === undefined ? "any" : String(dateDays())}
          onChange={(event) =>
            setDateDays(
              event.currentTarget.value === "any" ? undefined : Number(event.currentTarget.value),
            )
          }
        >
          <option value="any">any time</option>
          <For each={[...DATE_DAYS]}>
            {(days) =>
              days === undefined ? undefined : (
                <option value={String(days)}>{`${String(days)} days`}</option>
              )
            }
          </For>
        </select>
        <Show when={filtersActive()}>
          <button
            type="button"
            {...stylex.attrs(chrome.chip)}
            onClick={() => {
              setMediaFilter(new Set<string>())
              setTagFilter(undefined)
              setAuthorFilter("")
              setDateDays(undefined)
            }}
          >
            clear
          </button>
        </Show>
      </div>
      <Show when={search().kind === "failed"}>
        <div {...stylex.attrs(chrome.hits)}>
          <p {...stylex.attrs(chrome.hitWho)}>embedding not ready — try again shortly</p>
        </div>
      </Show>
      <Show when={hits().length > 0}>
        <div {...stylex.attrs(chrome.hits)}>
          <For each={hits()}>
            {(hit) => (
              <button type="button" {...stylex.attrs(chrome.hit)} onClick={() => openHit(hit)}>
                <p {...stylex.attrs(chrome.hitWho)}>
                  {hit.author} @{hit.handle} · {hit.score.toFixed(3)}
                </p>
                <p {...stylex.attrs(chrome.hitText)}>{snippet(hit.text, 90)}</p>
              </button>
            )}
          </For>
        </div>
      </Show>
      <div ref={setHost} {...stylex.attrs(chrome.map)} />
      <Show when={open()}>
        {(item) => (
          <Card
            item={item()}
            detail={detail()}
            pin={pin()}
            group={openGroup()}
            groupSize={openGroup() === undefined ? 0 : groupSize(openGroup() ?? 0)}
            onClose={() => setOpen(undefined)}
            onAddTag={addTag}
            onRemoveTag={removeTag}
            onTagGroup={tagGroup}
          />
        )}
      </Show>
      <Show when={actionError()}>
        {(message) => <p {...stylex.attrs(chrome.error)}>{message()}</p>}
      </Show>
      {AsyncResult.match(pile(), {
        onInitial: () => (
          <div {...stylex.attrs(chrome.empty)}>
            <div {...stylex.attrs(chrome.card)}>
              <p {...stylex.attrs(chrome.lead)}>Loading the pile…</p>
            </div>
          </div>
        ),
        onFailure: () => <p {...stylex.attrs(chrome.error)}>Could not load bookmarks.</p>,
        onSuccess: (result) => {
          const ready = result.value.filter(hasCoords)
          if (result.value.length === 0) {
            return (
              <div {...stylex.attrs(chrome.empty)}>
                <div {...stylex.attrs(chrome.card)}>
                  <p {...stylex.attrs(chrome.lead)}>The library is empty.</p>
                  <p {...stylex.attrs(chrome.copy)}>
                    On x.com/i/bookmarks, run the export snippet — it opens xkeep and imports right
                    in. Or drop a downloaded export JSON here. Embeddings fill in the background.
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
