import { Effect, Schema } from "effect"
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
  deleteBookmarksMutation,
  healthAtom,
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
import { createMap, hasCoords, type MapHandle } from "./map.ts"
import { tokens } from "./tokens.stylex.ts"

const ui = stylex.create({
  root: {
    position: "relative",
    height: "100%",
    overflow: "hidden",
    color: tokens.ink,
    backgroundColor: tokens.bg,
    fontFamily: tokens.font,
  },
  map: { position: "absolute", inset: 0 },
  glass: {
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: tokens.line,
    backgroundColor: "rgba(0,0,0,.9)",
    backdropFilter: "blur(18px)",
  },
  brand: {
    position: "absolute",
    zIndex: 4,
    top: 14,
    left: 16,
    display: "flex",
    gap: 9,
    alignItems: "center",
    height: 44,
    padding: "0 15px",
    borderRadius: 999,
    fontSize: 16,
    fontWeight: 700,
  },
  x: { fontSize: 21, fontWeight: 500 },
  toolbar: {
    position: "absolute",
    zIndex: 4,
    top: 14,
    left: "50%",
    display: "flex",
    gap: 8,
    alignItems: "center",
    transform: "translateX(-50%)",
  },
  searchBox: { position: "relative", width: "min(390px,34vw)" },
  searchGlyph: {
    position: "absolute",
    top: 9,
    left: 13,
    color: tokens.mute,
    fontSize: 20,
    pointerEvents: "none",
  },
  search: {
    width: "100%",
    height: 44,
    padding: "0 38px",
    borderRadius: 12,
    color: tokens.ink,
    fontSize: 15,
    outline: "none",
    ":focus": { borderColor: tokens.accent },
    "::placeholder": { color: tokens.mute },
  },
  searchClear: {
    position: "absolute",
    top: 11,
    right: 11,
    width: 22,
    height: 22,
    padding: 0,
    borderWidth: 0,
    borderRadius: 999,
    color: tokens.bg,
    backgroundColor: tokens.mute,
    cursor: "pointer",
  },
  button: {
    height: 44,
    padding: "0 14px",
    borderRadius: 12,
    color: tokens.ink,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
    ":hover": { backgroundColor: "#16181c" },
  },
  buttonOn: { color: tokens.accent, borderColor: tokens.accent },
  popover: {
    position: "absolute",
    zIndex: 5,
    top: 66,
    left: "50%",
    width: 360,
    padding: 16,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: tokens.line,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,.97)",
    boxShadow: "0 14px 48px rgba(0,0,0,.68)",
    transform: "translateX(-50%)",
  },
  heading: { margin: "0 0 12px", fontSize: 16, fontWeight: 700 },
  label: {
    display: "block",
    margin: "12px 0 6px",
    color: tokens.mute,
    fontSize: 12,
    fontWeight: 600,
  },
  chips: { display: "flex", flexWrap: "wrap", gap: 7, alignItems: "center" },
  chip: {
    height: 30,
    padding: "0 10px",
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: tokens.line,
    borderRadius: 999,
    color: tokens.mute,
    backgroundColor: "transparent",
    fontSize: 12,
    cursor: "pointer",
  },
  chipOn: {
    color: tokens.accent,
    borderColor: tokens.accent,
    backgroundColor: "rgba(29,155,240,.1)",
  },
  select: {
    width: "100%",
    height: 36,
    padding: "0 10px",
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: tokens.line,
    borderRadius: 8,
    color: tokens.ink,
    backgroundColor: tokens.bg,
    fontSize: 13,
  },
  popoverFoot: {
    display: "flex",
    justifyContent: "space-between",
    marginTop: 15,
  },
  textButton: {
    padding: 0,
    borderWidth: 0,
    color: tokens.accent,
    backgroundColor: "transparent",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },
  results: {
    position: "absolute",
    zIndex: 5,
    top: 66,
    left: "50%",
    width: "min(470px,calc(100vw - 32px))",
    maxHeight: "48vh",
    overflowY: "auto",
    padding: 8,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: tokens.line,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,.97)",
    boxShadow: "0 14px 48px rgba(0,0,0,.68)",
    transform: "translateX(-50%)",
  },
  result: {
    display: "block",
    width: "100%",
    padding: "10px 12px",
    borderWidth: 0,
    borderRadius: 10,
    color: tokens.ink,
    backgroundColor: "transparent",
    textAlign: "left",
    cursor: "pointer",
    ":hover": { backgroundColor: "#16181c" },
  },
  quiet: { margin: "0 0 4px", color: tokens.mute, fontSize: 12 },
  resultText: { margin: 0, fontSize: 13, lineHeight: 1.4 },
  inspector: {
    position: "absolute",
    zIndex: 6,
    top: 0,
    right: 0,
    width: 384,
    maxWidth: "100vw",
    height: "100%",
    overflowY: "auto",
    borderLeftWidth: 1,
    borderLeftStyle: "solid",
    borderLeftColor: tokens.line,
    backgroundColor: "rgba(0,0,0,.98)",
    boxShadow: "-18px 0 44px rgba(0,0,0,.34)",
  },
  inspectorHead: {
    position: "sticky",
    zIndex: 1,
    top: 0,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    height: 62,
    padding: "0 20px",
    borderBottomWidth: 1,
    borderBottomStyle: "solid",
    borderBottomColor: tokens.line,
    backgroundColor: "rgba(0,0,0,.94)",
    backdropFilter: "blur(18px)",
  },
  inspectorTitle: { margin: 0, fontSize: 19, fontWeight: 700 },
  close: {
    display: "grid",
    width: 34,
    height: 34,
    padding: 0,
    placeItems: "center",
    borderWidth: 0,
    borderRadius: 999,
    color: tokens.mute,
    backgroundColor: "transparent",
    fontSize: 22,
    cursor: "pointer",
    ":hover": { color: tokens.ink, backgroundColor: "#16181c" },
  },
  inspectorBody: { padding: 20 },
  authorRow: { display: "flex", gap: 11, alignItems: "center", marginBottom: 18 },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 999,
    objectFit: "cover",
    backgroundColor: "#16181c",
  },
  author: { margin: 0, fontSize: 15, fontWeight: 700 },
  handle: { margin: "2px 0 0", color: tokens.mute, fontSize: 14 },
  body: { margin: "0 0 16px", fontSize: 16, lineHeight: 1.5, whiteSpace: "pre-wrap" },
  media: {
    display: "block",
    width: "100%",
    maxHeight: 390,
    marginBottom: 12,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: tokens.line,
    borderRadius: 14,
    objectFit: "contain",
    backgroundColor: "#050505",
  },
  meta: { margin: "12px 0 0", color: tokens.mute, fontSize: 13, lineHeight: 1.5 },
  divider: { height: 1, margin: "18px 0", backgroundColor: tokens.line },
  quote: {
    marginTop: 14,
    padding: 13,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: tokens.line,
    borderRadius: 14,
  },
  quoteBody: { margin: 0, fontSize: 14, lineHeight: 1.45, whiteSpace: "pre-wrap" },
  tag: {
    display: "inline-flex",
    gap: 6,
    alignItems: "center",
    height: 30,
    padding: "0 10px",
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: tokens.accent,
    borderRadius: 999,
    color: tokens.accent,
    fontSize: 13,
  },
  tagX: {
    padding: 0,
    borderWidth: 0,
    color: tokens.accent,
    backgroundColor: "transparent",
    cursor: "pointer",
  },
  tagInput: {
    width: 112,
    height: 30,
    padding: "0 10px",
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: tokens.line,
    borderRadius: 999,
    color: tokens.ink,
    backgroundColor: "transparent",
    fontSize: 13,
  },
  multiTitle: { margin: "4px 0 8px", fontSize: 22, fontWeight: 700 },
  multiCopy: { margin: "0 0 20px", color: tokens.mute, fontSize: 14, lineHeight: 1.5 },
  actions: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 20 },
  action: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    height: 44,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: tokens.accent,
    borderRadius: 9,
    color: tokens.accent,
    backgroundColor: "transparent",
    fontSize: 14,
    fontWeight: 700,
    textDecoration: "none",
    cursor: "pointer",
  },
  danger: { borderColor: "#f4212e", color: "#f4212e" },
  zoom: {
    position: "absolute",
    zIndex: 4,
    bottom: 16,
    left: 16,
    display: "flex",
    gap: 1,
    overflow: "hidden",
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: tokens.line,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,.9)",
  },
  zoomButton: {
    height: 42,
    minWidth: 46,
    padding: "0 13px",
    borderWidth: 0,
    borderRightWidth: 1,
    borderRightStyle: "solid",
    borderRightColor: tokens.line,
    color: tokens.ink,
    backgroundColor: "transparent",
    cursor: "pointer",
  },
  status: {
    position: "absolute",
    zIndex: 4,
    bottom: 16,
    left: "50%",
    display: "flex",
    gap: 9,
    alignItems: "center",
    height: 42,
    padding: "0 16px",
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: tokens.line,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,.9)",
    fontSize: 13,
    transform: "translateX(-50%)",
    cursor: "pointer",
  },
  statusPanel: {
    position: "absolute",
    zIndex: 5,
    bottom: 68,
    left: "50%",
    width: 280,
    padding: 14,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: tokens.line,
    borderRadius: 14,
    color: tokens.ink,
    backgroundColor: "rgba(0,0,0,.96)",
    boxShadow: "0 14px 48px rgba(0,0,0,.68)",
    fontSize: 13,
    lineHeight: 1.6,
    transform: "translateX(-50%)",
  },
  dot: { width: 9, height: 9, borderRadius: 999, backgroundColor: "#00ba7c" },
  dotBusy: { backgroundColor: tokens.accent },
  importer: { position: "absolute", zIndex: 4, right: 16, bottom: 16 },
  empty: {
    position: "absolute",
    zIndex: 2,
    inset: 0,
    display: "grid",
    placeItems: "center",
    pointerEvents: "none",
  },
  emptyCard: {
    maxWidth: 410,
    padding: 24,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: tokens.line,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,.92)",
    textAlign: "center",
  },
  emptyTitle: { margin: "0 0 8px", fontSize: 18, fontWeight: 700 },
  emptyCopy: { margin: 0, color: tokens.mute, fontSize: 14, lineHeight: 1.5 },
  backdrop: {
    position: "absolute",
    zIndex: 20,
    inset: 0,
    display: "grid",
    placeItems: "center",
    padding: 20,
    backgroundColor: "rgba(0,0,0,.72)",
    backdropFilter: "blur(5px)",
  },
  dialog: {
    width: "min(460px,100%)",
    padding: 22,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: tokens.line,
    borderRadius: 18,
    backgroundColor: tokens.bg,
    boxShadow: "0 24px 80px rgba(0,0,0,.8)",
  },
  dialogTitle: { margin: "0 0 8px", fontSize: 21, fontWeight: 700 },
  dialogCopy: { margin: "0 0 16px", color: tokens.mute, fontSize: 14, lineHeight: 1.5 },
  dialogItem: {
    padding: 14,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: tokens.line,
    borderRadius: 12,
    fontSize: 14,
    lineHeight: 1.45,
  },
  dialogActions: { display: "flex", gap: 9, justifyContent: "flex-end", marginTop: 18 },
  dialogButton: {
    height: 40,
    padding: "0 15px",
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: tokens.line,
    borderRadius: 999,
    color: tokens.ink,
    backgroundColor: "transparent",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
  },
  confirm: { color: tokens.bg, backgroundColor: tokens.ink },
  notice: {
    position: "absolute",
    zIndex: 30,
    right: 16,
    bottom: 72,
    maxWidth: 380,
    padding: "10px 14px",
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: tokens.line,
    borderRadius: 10,
    color: tokens.ink,
    backgroundColor: "rgba(0,0,0,.96)",
    fontSize: 13,
  },
})

const MEDIA_KINDS = ["photo", "video", "gif", "link", "text"] as const
const DATE_DAYS = [30, 90, 365] as const
const postUrl = (item: PileItem) => "https://x.com/" + item.handle + "/status/" + item.id
const short = (text: string, max: number) =>
  text.length <= max ? text : text.slice(0, max - 1) + "…"

type SearchState =
  | { readonly kind: "idle" }
  | { readonly kind: "loading" }
  | { readonly kind: "hits"; readonly hits: ReadonlyArray<SearchHit> }
  | { readonly kind: "failed" }

type DeleteRun = {
  readonly ids: ReadonlyArray<string>
  readonly index: number
  readonly deleting: boolean
}

const LibraryView = () => {
  useAtomMount(() => liveAtom)
  const pile = useAtomValue(() => pileAtom)
  const tags = useAtomValue(() => tagsAtom)
  const health = useAtomValue(() => healthAtom)
  const refreshTags = useAtomRefresh(() => tagsAtom)
  const runImport = useAtomSet(() => importDump, { mode: "promise" })
  const runSearch = useAtomSet(() => searchQuery, { mode: "promise" })
  const runDetail = useAtomSet(() => bookmarkDetail, { mode: "promise" })
  const runCluster = useAtomSet(() => clusterQuery, { mode: "promise" })
  const runAddTag = useAtomSet(() => addTagMutation, { mode: "promise" })
  const runRemoveTag = useAtomSet(() => removeTagMutation, { mode: "promise" })
  const runBulkTag = useAtomSet(() => bulkApplyTagMutation, { mode: "promise" })
  const runDelete = useAtomSet(() => deleteBookmarksMutation, { mode: "promise" })
  const [host, setHost] = createSignal<HTMLDivElement>()
  const [selection, setSelection] = createSignal<ReadonlyArray<string>>([])
  const [detail, setDetail] = createSignal<Detail>()
  const [queryDraft, setQueryDraft] = createSignal("")
  const [search, setSearch] = createSignal<SearchState>({ kind: "idle" })
  const [filtersOpen, setFiltersOpen] = createSignal(false)
  const [mediaFilter, setMediaFilter] = createSignal<ReadonlySet<string>>(new Set())
  const [tagFilter, setTagFilter] = createSignal<string>()
  const [authorFilter, setAuthorFilter] = createSignal("")
  const [dateDays, setDateDays] = createSignal<number>()
  const [tagOverlay, setTagOverlay] = createSignal(false)
  const [clusterOn, setClusterOn] = createSignal(false)
  const [clusterK, setClusterK] = createSignal(12)
  const [groups, setGroups] = createSignal<ReadonlyMap<string, number>>()
  const [tagDraft, setTagDraft] = createSignal("")
  const [deleteRun, setDeleteRun] = createSignal<DeleteRun>()
  const [importing, setImporting] = createSignal(false)
  const [statusOpen, setStatusOpen] = createSignal(false)
  const [notice, setNotice] = createSignal<string>()
  const [fileInput, setFileInput] = createSignal<HTMLInputElement>()
  let map: MapHandle | undefined
  let detailRequest = 0
  let searchRequest = 0
  let clusterRequest = 0

  const items = createMemo<Array<PileItem>>(() => {
    const result = pile()
    return AsyncResult.isSuccess(result) ? [...result.value] : []
  })
  const selectedItems = createMemo(() => {
    const indexed = new Map(items().map((item) => [item.id, item]))
    return selection().flatMap((id) => {
      const item = indexed.get(id)
      return item === undefined ? [] : [item]
    })
  })
  const selectedOne = createMemo(() =>
    selectedItems().length === 1 ? selectedItems()[0] : undefined,
  )
  const tagList = createMemo(() => {
    const result = tags()
    return AsyncResult.isSuccess(result) ? [...result.value.tags] : []
  })
  const authors = createMemo(() => [...new Set(items().map((item) => item.handle))].sort())
  const sharedTags = createMemo(() => {
    const selected = selectedItems()
    const first = selected[0]
    return first === undefined
      ? []
      : first.tags.filter((tag) => selected.every((item) => item.tags.includes(tag)))
  })
  const tagStates = createMemo(() => {
    const selected = selectedItems()
    const all = new Set(selected.flatMap((item) => item.tags))
    return [...all].sort().map((tag) => ({
      tag,
      shared: selected.every((item) => item.tags.includes(tag)),
    }))
  })
  const hits = createMemo(() => {
    const state = search()
    return state.kind === "hits" ? state.hits : []
  })
  const searchIds = createMemo<ReadonlySet<string> | undefined>(() => {
    const state = search()
    return state.kind === "hits" ? new Set(state.hits.map((hit) => hit.id)) : undefined
  })
  const filterCount = createMemo(
    () =>
      mediaFilter().size +
      (tagFilter() === undefined ? 0 : 1) +
      (authorFilter() === "" ? 0 : 1) +
      (dateDays() === undefined ? 0 : 1),
  )
  const filterIds = createMemo<ReadonlySet<string> | undefined>(() => {
    if (filterCount() === 0) return undefined
    const media = mediaFilter()
    const tag = tagFilter()
    const author = authorFilter()
    const days = dateDays()
    const cutoff = days === undefined ? undefined : Date.now() - days * 86_400_000
    return new Set(
      items()
        .filter((item) => media.size === 0 || item.mediaTypes.some((kind) => media.has(kind)))
        .filter((item) => tag === undefined || item.tags.includes(tag))
        .filter((item) => author === "" || item.handle === author)
        .filter((item) => cutoff === undefined || Date.parse(item.timestamp) >= cutoff)
        .map((item) => item.id),
    )
  })
  const highlighted = createMemo<ReadonlySet<string> | undefined>(() => {
    const searched = searchIds()
    const filtered = filterIds()
    return searched !== undefined && filtered !== undefined
      ? new Set([...searched].filter((id) => filtered.has(id)))
      : (searched ?? filtered)
  })
  const currentDeleteItem = createMemo(() => {
    const run = deleteRun()
    return run === undefined ? undefined : items().find((item) => item.id === run.ids[run.index])
  })
  const status = createMemo(() => {
    const result = health()
    const bookmarks = AsyncResult.isSuccess(result) ? result.value.bookmarks : items().length
    const embedded = AsyncResult.isSuccess(result)
      ? result.value.embedded
      : items().filter((item) => item.embedded).length
    const importingNow = AsyncResult.isSuccess(result) && result.value.import._tag === "running"
    return {
      busy: importingNow || embedded < bookmarks,
      label: String(embedded) + " ready · " + String(bookmarks - embedded) + " embedding",
    }
  })
  const healthValue = createMemo(() => {
    const result = health()
    return AsyncResult.isSuccess(result) ? result.value : undefined
  })

  const setSelected = (ids: ReadonlyArray<string>) => {
    setSelection(ids)
    map?.setSelection(new Set(ids))
  }

  const loadDetail = (id: string) => {
    const request = ++detailRequest
    void runDetail({ params: { id } })
      .then((value) => {
        if (request === detailRequest && selectedOne()?.id === id) setDetail(value)
      })
      .catch(() => request === detailRequest && setNotice("Could not load this bookmark."))
  }

  const addTag = (raw: string) => {
    const tag = raw.trim()
    const ids = selection()
    if (tag === "" || ids.length === 0) return
    const first = ids[0]
    if (first === undefined) return
    setTagDraft("")
    const write =
      ids.length === 1
        ? runAddTag({ params: { id: first, tag } })
        : runBulkTag({ payload: { memberIds: [...ids], tag } })
    void write
      .then(() => {
        refreshTags()
        if (ids.length === 1) loadDetail(first)
      })
      .catch(() => setNotice("Could not apply that tag."))
  }

  const removeTag = (tag: string) => {
    const ids = selection()
    const first = ids[0]
    void Promise.all(ids.map((id) => runRemoveTag({ params: { id, tag } })))
      .then(() => {
        refreshTags()
        if (ids.length === 1 && first !== undefined) loadDetail(first)
      })
      .catch(() => setNotice("Could not remove that tag."))
  }

  const submitSearch = () => {
    const q = queryDraft().trim()
    if (q === "") {
      searchRequest += 1
      setSearch({ kind: "idle" })
      return
    }
    const request = ++searchRequest
    setSearch({ kind: "loading" })
    void runSearch({ query: { q } })
      .then((value) => {
        if (request === searchRequest) setSearch({ kind: "hits", hits: value.hits })
      })
      .catch(() => request === searchRequest && setSearch({ kind: "failed" }))
  }

  const clearSearch = () => {
    searchRequest += 1
    setQueryDraft("")
    setSearch({ kind: "idle" })
  }

  const selectHit = (hit: SearchHit) => {
    setSelected([hit.id])
    map?.focus(hit.id)
    clearSearch()
  }

  const importFile = (file: File) => {
    setImporting(true)
    setNotice(undefined)
    void file
      .text()
      .then((text) => JSON.parse(text) as unknown)
      .then((json) => Effect.runPromise(Schema.decodeUnknownEffect(BookmarkDump)(json)))
      .then((dump) => runImport({ payload: dump }))
      .then((result) => {
        setNotice(
          "Imported " +
            String(result.imported) +
            ", updated " +
            String(result.updated) +
            ", kept " +
            String(result.skippedDeleted) +
            " deleted.",
        )
      })
      .catch(() => setNotice("That file could not be imported."))
      .finally(() => setImporting(false))
  }

  const onDrop: JSX.EventHandlerUnion<HTMLElement, DragEvent> = (event) => {
    event.preventDefault()
    const file = event.dataTransfer?.files.item(0)
    if (file !== null && file !== undefined) importFile(file)
  }

  const beginDelete = (ids: ReadonlyArray<string>) => {
    const available = new Set(items().map((item) => item.id))
    const present = ids.filter((id) => available.has(id))
    if (present.length > 0) setDeleteRun({ ids: present, index: 0, deleting: false })
  }

  const confirmDeletedOnX = () => {
    const run = deleteRun()
    const item = currentDeleteItem()
    if (run === undefined || item === undefined || run.deleting) return
    setDeleteRun({ ...run, deleting: true })
    void runDelete({ payload: { ids: [item.id] } })
      .then(() => {
        setSelected(selection().filter((id) => id !== item.id))
        if (run.index + 1 >= run.ids.length) {
          setDeleteRun(undefined)
          setNotice(
            String(run.ids.length) + " bookmark" + (run.ids.length === 1 ? "" : "s") + " removed.",
          )
        } else {
          setDeleteRun({ ids: run.ids, index: run.index + 1, deleting: false })
        }
      })
      .catch(() => {
        setDeleteRun({ ...run, deleting: false })
        setNotice("Could not remove the local bookmark.")
      })
  }

  const copyLinks = () => {
    const links = selectedItems().map(postUrl).join("\n")
    void navigator.clipboard
      .writeText(links)
      .then(() => setNotice(selection().length === 1 ? "Link copied." : "Links copied."))
      .catch(() => setNotice("Could not copy the links."))
  }

  const exportSelection = () => {
    const ids = selection()
    void Promise.all(ids.map((id) => runDetail({ params: { id } })))
      .then((details) => ({
        bookmarks: details.map((item) => ({
          id: item.id,
          author: item.author,
          handle: item.handle,
          avatar: item.avatar,
          text: item.text,
          timestamp: item.timestamp,
          media: item.media,
          hashtags: item.hashtags,
          urls: item.urls,
          ...(item.quoted === undefined ? {} : { quoted: item.quoted }),
        })),
      }))
      .then((dump) => Effect.runPromise(Schema.decodeUnknownEffect(BookmarkDump)(dump)))
      .then((dump) => {
        const blob = new Blob([JSON.stringify(dump, undefined, 2)], { type: "application/json" })
        const url = URL.createObjectURL(blob)
        const link = document.createElement("a")
        link.href = url
        link.download = "xkeep-selection.json"
        link.click()
        URL.revokeObjectURL(url)
      })
      .catch(() => setNotice("Could not export the complete selection."))
  }

  createEffect(() => {
    const element = host()
    if (element === undefined) return
    const handle = createMap(element, {
      onPick: () => undefined,
      onSelectionChange: setSelection,
      onDelete: beginDelete,
      onView: () => undefined,
    })
    map = handle
    untrack(() => {
      handle.setHighlight(highlighted())
      handle.setGroups(groups())
      handle.setTagOverlay(tagOverlay())
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
    map?.sync(result.value.filter(hasCoords))
    const valid = new Set(result.value.map((item) => item.id))
    if (selection().some((id) => !valid.has(id)))
      setSelected(selection().filter((id) => valid.has(id)))
  })
  createEffect(() => map?.setHighlight(highlighted()))
  createEffect(() => map?.setTagOverlay(tagOverlay()))
  createEffect(() => {
    const item = selectedOne()
    setDetail(undefined)
    if (item === undefined) {
      detailRequest += 1
    } else {
      loadDetail(item.id)
    }
  })
  createEffect(() => {
    if (!clusterOn()) {
      clusterRequest += 1
      setGroups(undefined)
      map?.setGroups(undefined)
      return
    }
    const request = ++clusterRequest
    const k = clusterK()
    void Effect.runPromise(
      Effect.tryPromise({
        try: () => runCluster({ query: { k } }),
        catch: () => "cluster failed" as const,
      }).pipe(
        Effect.match({
          onFailure: () => {
            if (request === clusterRequest) setNotice("Could not calculate clusters.")
          },
          onSuccess: (value) => {
            if (request !== clusterRequest || !clusterOn()) return
            const next = new Map(value.members.map((member) => [member.id, member.groupId]))
            setGroups(next)
            map?.setGroups(next)
          },
        }),
      ),
    )
  })

  const clearFilters = () => {
    setMediaFilter(new Set<string>())
    setTagFilter(undefined)
    setAuthorFilter("")
    setDateDays(undefined)
  }

  return (
    <main {...stylex.attrs(ui.root)} onDragOver={(event) => event.preventDefault()} onDrop={onDrop}>
      <div ref={setHost} {...stylex.attrs(ui.map)} />
      <div {...stylex.attrs([ui.brand, ui.glass])}>
        <span {...stylex.attrs(ui.x)}>𝕏</span>
        xkeep
      </div>
      <div {...stylex.attrs(ui.toolbar)}>
        <div {...stylex.attrs(ui.searchBox)}>
          <span {...stylex.attrs(ui.searchGlyph)}>⌕</span>
          <input
            {...stylex.attrs([ui.search, ui.glass])}
            aria-label="Search the canvas"
            placeholder="Search the canvas"
            value={queryDraft()}
            onInput={(event) => setQueryDraft(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") submitSearch()
              if (event.key === "Escape") clearSearch()
            }}
          />
          <Show when={queryDraft() !== ""}>
            <button
              type="button"
              aria-label="Clear search"
              {...stylex.attrs(ui.searchClear)}
              onClick={clearSearch}
            >
              ×
            </button>
          </Show>
        </div>
        <button
          type="button"
          {...stylex.attrs([
            ui.button,
            ui.glass,
            (filtersOpen() || filterCount() > 0) && ui.buttonOn,
          ])}
          onClick={() => setFiltersOpen((open) => !open)}
        >
          Filters{filterCount() > 0 ? " · " + String(filterCount()) : ""}
        </button>
        <button
          type="button"
          {...stylex.attrs([ui.button, ui.glass, tagOverlay() && ui.buttonOn])}
          onClick={() => {
            setTagOverlay((on) => !on)
            if (!tagOverlay()) setClusterOn(false)
          }}
        >
          Tags
        </button>
        <button
          type="button"
          {...stylex.attrs([ui.button, ui.glass, clusterOn() && ui.buttonOn])}
          onClick={() => {
            setClusterOn((on) => !on)
            if (!clusterOn()) setTagOverlay(false)
          }}
        >
          Clusters
        </button>
      </div>

      <Show when={filtersOpen()}>
        <section {...stylex.attrs(ui.popover)}>
          <h2 {...stylex.attrs(ui.heading)}>Filters</h2>
          <span {...stylex.attrs(ui.label)}>Media</span>
          <div {...stylex.attrs(ui.chips)}>
            <For each={[...MEDIA_KINDS]}>
              {(kind) => (
                <button
                  type="button"
                  {...stylex.attrs([ui.chip, mediaFilter().has(kind) && ui.chipOn])}
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
          </div>
          <label {...stylex.attrs(ui.label)} for="tag-filter">
            Tag
          </label>
          <select
            id="tag-filter"
            {...stylex.attrs(ui.select)}
            value={tagFilter() ?? ""}
            onChange={(event) =>
              setTagFilter(event.currentTarget.value === "" ? undefined : event.currentTarget.value)
            }
          >
            <option value="">Any tag</option>
            <For each={tagList()}>
              {(entry) => (
                <option value={entry.tag}>
                  {entry.tag} · {String(entry.count)}
                </option>
              )}
            </For>
          </select>
          <label {...stylex.attrs(ui.label)} for="author-filter">
            Author
          </label>
          <select
            id="author-filter"
            {...stylex.attrs(ui.select)}
            value={authorFilter()}
            onChange={(event) => setAuthorFilter(event.currentTarget.value)}
          >
            <option value="">Any author</option>
            <For each={authors()}>{(author) => <option value={author}>@{author}</option>}</For>
          </select>
          <label {...stylex.attrs(ui.label)} for="date-filter">
            Saved
          </label>
          <select
            id="date-filter"
            {...stylex.attrs(ui.select)}
            value={dateDays() === undefined ? "" : String(dateDays())}
            onChange={(event) =>
              setDateDays(
                event.currentTarget.value === "" ? undefined : Number(event.currentTarget.value),
              )
            }
          >
            <option value="">Any time</option>
            <For each={[...DATE_DAYS]}>
              {(days) => <option value={String(days)}>Last {String(days)} days</option>}
            </For>
          </select>
          <Show when={clusterOn()}>
            <label {...stylex.attrs(ui.label)} for="cluster-count">
              Cluster count · {String(clusterK())}
            </label>
            <input
              id="cluster-count"
              type="range"
              min="2"
              max="40"
              value={clusterK()}
              style={{ width: "100%", "accent-color": "#1d9bf0" }}
              onChange={(event) => setClusterK(Number(event.currentTarget.value))}
            />
          </Show>
          <div {...stylex.attrs(ui.popoverFoot)}>
            <button type="button" {...stylex.attrs(ui.textButton)} onClick={clearFilters}>
              Clear all
            </button>
            <button
              type="button"
              {...stylex.attrs(ui.textButton)}
              onClick={() => setFiltersOpen(false)}
            >
              Done
            </button>
          </div>
        </section>
      </Show>

      <Show when={search().kind === "loading" || search().kind === "failed" || hits().length > 0}>
        <section {...stylex.attrs(ui.results)}>
          <Show when={search().kind === "loading"}>
            <p {...stylex.attrs(ui.quiet)}>Searching by meaning…</p>
          </Show>
          <Show when={search().kind === "failed"}>
            <p {...stylex.attrs(ui.quiet)}>Search is waiting for embeddings.</p>
          </Show>
          <For each={hits()}>
            {(hit) => (
              <button type="button" {...stylex.attrs(ui.result)} onClick={() => selectHit(hit)}>
                <p {...stylex.attrs(ui.quiet)}>
                  {hit.author} @{hit.handle} · {hit.score.toFixed(3)}
                </p>
                <p {...stylex.attrs(ui.resultText)}>{short(hit.text, 130)}</p>
              </button>
            )}
          </For>
        </section>
      </Show>

      <div {...stylex.attrs(ui.zoom)}>
        <button
          type="button"
          aria-label="Zoom out"
          {...stylex.attrs(ui.zoomButton)}
          onClick={() => map?.zoomBy(0.82)}
        >
          −
        </button>
        <button
          type="button"
          aria-label="Zoom in"
          {...stylex.attrs(ui.zoomButton)}
          onClick={() => map?.zoomBy(1.22)}
        >
          +
        </button>
        <button type="button" {...stylex.attrs(ui.zoomButton)} onClick={() => map?.fitAll()}>
          Fit
        </button>
      </div>
      <Show when={statusOpen()}>
        <div {...stylex.attrs(ui.statusPanel)}>
          <strong>Canvas status</strong>
          <br />
          {status().label}
          <Show when={healthValue()}>
            {(current) => (
              <>
                <br />
                Import {current().import._tag}
                <br />
                Semantic model {current().llama._tag}
              </>
            )}
          </Show>
        </div>
      </Show>
      <button
        type="button"
        {...stylex.attrs(ui.status)}
        onClick={() => setStatusOpen((open) => !open)}
      >
        <span {...stylex.attrs([ui.dot, status().busy && ui.dotBusy])} />
        {status().label}
      </button>
      <div {...stylex.attrs(ui.importer)}>
        <input
          ref={setFileInput}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(event) => {
            const file = event.currentTarget.files?.item(0)
            if (file !== null && file !== undefined) importFile(file)
            event.currentTarget.value = ""
          }}
        />
        <button
          type="button"
          {...stylex.attrs([ui.button, ui.glass])}
          disabled={importing()}
          onClick={() => fileInput()?.click()}
        >
          {importing() ? "Importing…" : "Import JSON"}
        </button>
      </div>

      <Show when={selectedItems().length > 0}>
        <aside {...stylex.attrs(ui.inspector)}>
          <header {...stylex.attrs(ui.inspectorHead)}>
            <h2 {...stylex.attrs(ui.inspectorTitle)}>
              {selectedItems().length === 1 ? "Bookmark" : "Selection"}
            </h2>
            <button
              type="button"
              aria-label="Close inspector"
              {...stylex.attrs(ui.close)}
              onClick={() => setSelected([])}
            >
              ×
            </button>
          </header>
          <div {...stylex.attrs(ui.inspectorBody)}>
            <Show
              when={selectedOne()}
              fallback={
                <>
                  <p {...stylex.attrs(ui.multiTitle)}>{String(selectedItems().length)} bookmarks</p>
                  <p {...stylex.attrs(ui.multiCopy)}>
                    Edit shared tags, or step through a safe cleanup on X.
                  </p>
                </>
              }
            >
              {(item) => (
                <>
                  <div {...stylex.attrs(ui.authorRow)}>
                    <img {...stylex.attrs(ui.avatar)} src={item().avatar} alt="" />
                    <div>
                      <p {...stylex.attrs(ui.author)}>{item().author}</p>
                      <p {...stylex.attrs(ui.handle)}>@{item().handle}</p>
                    </div>
                  </div>
                  <p {...stylex.attrs(ui.body)}>{item().text}</p>
                  <Show when={detail()}>
                    {(current) => (
                      <>
                        <Show
                          when={current().media.length > 0}
                          fallback={
                            <For each={current().stills}>
                              {(src) => <img {...stylex.attrs(ui.media)} src={src} alt="" />}
                            </For>
                          }
                        >
                          <For each={current().media}>
                            {(media) => (
                              <Switch>
                                <Match when={media.type === "photo"}>
                                  <img {...stylex.attrs(ui.media)} src={media.url} alt="" />
                                </Match>
                                <Match when={media.type === "video"}>
                                  <video
                                    {...stylex.attrs(ui.media)}
                                    src={media.url}
                                    poster={media.poster}
                                    controls
                                    playsinline
                                  />
                                </Match>
                                <Match when={media.type === "gif"}>
                                  <video
                                    {...stylex.attrs(ui.media)}
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
                        <Show when={current().quoted}>
                          {(quoted) => (
                            <div {...stylex.attrs(ui.quote)}>
                              <p {...stylex.attrs(ui.quiet)}>
                                {quoted().author} @{quoted().handle}
                              </p>
                              <p {...stylex.attrs(ui.quoteBody)}>{quoted().text}</p>
                            </div>
                          )}
                        </Show>
                        <Show when={current().hashtags.length > 0}>
                          <p {...stylex.attrs(ui.meta)}>
                            {current().hashtags.map((tag) => "#" + tag).join(" ")}
                          </p>
                        </Show>
                        <For each={current().urls}>
                          {(url) => (
                            <p {...stylex.attrs(ui.meta)}>
                              <a href={url} target="_blank" rel="noreferrer">
                                {url}
                              </a>
                            </p>
                          )}
                        </For>
                        <p {...stylex.attrs(ui.meta)}>
                          Saved locally · Posted {new Date(current().timestamp).toLocaleString()}
                        </p>
                      </>
                    )}
                  </Show>
                </>
              )}
            </Show>
            <div {...stylex.attrs(ui.divider)} />
            <span {...stylex.attrs(ui.label)}>
              {selectedItems().length === 1 ? "Tags" : "Shared tags"}
            </span>
            <div {...stylex.attrs(ui.chips)}>
              <For
                each={
                  selectedItems().length === 1
                    ? selectedItems()[0]?.tags.map((tag) => ({ tag, shared: true }))
                    : tagStates()
                }
              >
                {(state) => (
                  <span {...stylex.attrs(ui.tag)}>
                    {state.tag}{state.shared ? "" : " · mixed"}
                    <button
                      type="button"
                      aria-label={(state.shared ? "Remove " : "Apply ") + state.tag}
                      {...stylex.attrs(ui.tagX)}
                      onClick={() => state.shared ? removeTag(state.tag) : addTag(state.tag)}
                    >
                      ×
                    </button>
                  </span>
                )}
              </For>
              <input
                {...stylex.attrs(ui.tagInput)}
                aria-label="Add tag"
                placeholder="+ Add tag"
                value={tagDraft()}
                onInput={(event) => setTagDraft(event.currentTarget.value)}
                onKeyDown={(event) => event.key === "Enter" && addTag(tagDraft())}
              />
            </div>
            <div {...stylex.attrs(ui.actions)}>
              <Show when={selectedOne()} fallback={<span />}>
                {(item) => (
                  <a
                    {...stylex.attrs(ui.action)}
                    href={postUrl(item())}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open on X
                  </a>
                )}
              </Show>
              <button
                type="button"
                {...stylex.attrs([ui.action, ui.danger])}
                onClick={() => beginDelete(selection())}
              >
                Delete
              </button>
            </div>
            <div {...stylex.attrs([ui.popoverFoot, ui.chips])}>
              <button type="button" {...stylex.attrs(ui.textButton)} onClick={copyLinks}>
                Copy {selection().length === 1 ? "link" : "links"}
              </button>
              <button type="button" {...stylex.attrs(ui.textButton)} onClick={exportSelection}>
                Export selection
              </button>
            </div>
          </div>
        </aside>
      </Show>

      {AsyncResult.match(pile(), {
        onInitial: () => (
          <div {...stylex.attrs(ui.empty)}>
            <div {...stylex.attrs(ui.emptyCard)}>
              <p {...stylex.attrs(ui.emptyTitle)}>Loading your canvas…</p>
            </div>
          </div>
        ),
        onFailure: () => <p {...stylex.attrs(ui.notice)}>Could not load bookmarks.</p>,
        onSuccess: (result) => {
          const ready = result.value.filter(hasCoords)
          if (result.value.length === 0) {
            return (
              <div {...stylex.attrs(ui.empty)}>
                <div {...stylex.attrs(ui.emptyCard)}>
                  <p {...stylex.attrs(ui.emptyTitle)}>Your canvas is empty.</p>
                  <p {...stylex.attrs(ui.emptyCopy)}>
                    Import an xkeep JSON dump, or drop the file anywhere on the canvas.
                  </p>
                </div>
              </div>
            )
          }
          if (ready.length === 0) {
            return (
              <div {...stylex.attrs(ui.empty)}>
                <div {...stylex.attrs(ui.emptyCard)}>
                  <p {...stylex.attrs(ui.emptyTitle)}>Arranging your canvas…</p>
                  <p {...stylex.attrs(ui.emptyCopy)}>
                    Bookmarks appear as their embeddings and positions finish.
                  </p>
                </div>
              </div>
            )
          }
          return undefined
        },
      })}

      <Show when={deleteRun()}>
        {(run) => (
          <div
            {...stylex.attrs(ui.backdrop)}
            onKeyDown={(event) => {
              if (event.key === "Escape" && !run().deleting) setDeleteRun(undefined)
            }}
          >
            <section
              {...stylex.attrs(ui.dialog)}
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-title"
            >
              <h2 id="delete-title" {...stylex.attrs(ui.dialogTitle)}>
                Remove bookmark {String(run().index + 1)} of {String(run().ids.length)}
              </h2>
              <p {...stylex.attrs(ui.dialogCopy)}>
                Open the post and remove its bookmark on X. Then confirm here so xkeep forgets it
                and will not re-import it.
              </p>
              <Show when={currentDeleteItem()}>
                {(item) => (
                  <div {...stylex.attrs(ui.dialogItem)}>
                    <strong>@{item().handle}</strong>
                    <br />
                    {short(item().text, 180)}
                  </div>
                )}
              </Show>
              <div {...stylex.attrs(ui.dialogActions)}>
                <button
                  type="button"
                  {...stylex.attrs(ui.dialogButton)}
                  autofocus
                  disabled={run().deleting}
                  onClick={() => setDeleteRun(undefined)}
                >
                  Cancel
                </button>
                <Show when={currentDeleteItem()}>
                  {(item) => (
                    <a
                      {...stylex.attrs([ui.dialogButton, ui.action])}
                      href={postUrl(item())}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open on X
                    </a>
                  )}
                </Show>
                <button
                  type="button"
                  {...stylex.attrs([ui.dialogButton, ui.confirm])}
                  disabled={run().deleting}
                  onClick={confirmDeletedOnX}
                >
                  {run().deleting ? "Removing…" : "Removed on X"}
                </button>
              </div>
            </section>
          </div>
        )}
      </Show>
      <Show when={notice()}>
        {(message) => (
          <button type="button" {...stylex.attrs(ui.notice)} onClick={() => setNotice(undefined)}>
            {message()}
          </button>
        )}
      </Show>
    </main>
  )
}

export const Library = () => (
  <RegistryProvider>
    <LibraryView />
  </RegistryProvider>
)
