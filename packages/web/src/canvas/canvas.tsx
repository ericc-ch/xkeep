import { Effect, Predicate, Schema } from "effect"
import { AsyncResult } from "effect/unstable/reactivity"
import { useAtomMount, useAtomRefresh, useAtomSet, useAtomValue } from "@effect/atom-solid"
import { BookmarkDump } from "@xkeep/server/schema"
import * as stylex from "@stylexjs/stylex"
import {
  createEffect,
  createMemo,
  createResource,
  createSignal,
  For,
  onCleanup,
  Show,
  untrack,
  type JSX,
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
  type HealthStatus,
  type PileItem,
  type SearchHit,
} from "../api.ts"
import { createMap, hasCoords, type MapHandle } from "../map/map.ts"
import { tokens } from "../tokens.stylex.ts"
import { postUrl } from "./bookmark.ts"
import { DeleteDialog, type DeleteRun } from "./delete-dialog.tsx"
import { Filters } from "./filters.tsx"
import { Inspector } from "./inspector.tsx"
import { Button, buttonAttrs } from "../ui/button.tsx"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu.tsx"
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover.tsx"
import { ClusterSlider } from "../ui/slider.tsx"
import { surface } from "../ui/surface.stylex.ts"
import { TextField, TextFieldInput } from "../ui/text-field.tsx"

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
  brandWrap: { position: "absolute", zIndex: 4, top: 14, left: 16 },
  brand: {
    display: "flex",
    gap: 9,
    alignItems: "center",
    height: 44,
    padding: "0 15px",
    borderRadius: 999,
    color: tokens.ink,
    fontSize: 16,
    fontWeight: 700,
    cursor: "pointer",
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
  hitsChip: {
    display: "inline-flex",
    alignItems: "center",
    height: 44,
    padding: "0 10px",
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: tokens.accent,
    borderRadius: 999,
    color: tokens.accent,
    backgroundColor: "rgba(29,155,240,.1)",
    fontSize: 12,
    fontWeight: 600,
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
  resultText: { margin: 0, fontSize: 13, lineHeight: 1.4 },
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
    color: tokens.ink,
    backgroundColor: "rgba(0,0,0,.9)",
    fontSize: 13,
    fontWeight: 600,
    whiteSpace: "nowrap",
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

type SearchState =
  | { readonly kind: "idle" }
  | { readonly kind: "loading" }
  | { readonly kind: "hits"; readonly hits: ReadonlyArray<SearchHit> }
  | { readonly kind: "failed"; readonly reason: "embeddings" | "error" }

const importLabel = (status: HealthStatus["import"]) =>
  Predicate.isTagged(status, "running") ? "running" : "idle"

const llamaLabel = (status: HealthStatus["llama"]) =>
  Predicate.isTagged(status, "ready")
    ? "ready"
    : Predicate.isTagged(status, "starting")
      ? "starting"
      : "unavailable"

const CanvasView = () => {
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
  const [selection, setSelection] = createSignal<ReadonlyArray<string>>([])
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
  const [tagDraft, setTagDraft] = createSignal("")
  const [deleteRun, setDeleteRun] = createSignal<DeleteRun>()
  const [importing, setImporting] = createSignal(false)
  const [statusOpen, setStatusOpen] = createSignal(false)
  const [notice, setNotice] = createSignal<string>()
  const [fileInput, setFileInput] = createSignal<HTMLInputElement>()
  const [host, setHost] = createSignal<HTMLDivElement>()
  let map: MapHandle | undefined
  let searchRequest = 0

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
  const [detail, { refetch: refetchDetail }] = createResource(
    () => selectedOne()?.id,
    (id) => runDetail({ params: { id } }),
  )
  const tagList = createMemo(() => {
    const result = tags()
    return AsyncResult.isSuccess(result) ? [...result.value.tags] : []
  })
  const authors = createMemo(() => [...new Set(items().map((item) => item.handle))].sort())
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
  const searchFailed = createMemo(() => {
    const state = search()
    return state.kind === "failed" ? state : undefined
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
  const clusterSource = createMemo(() => {
    if (!clusterOn()) return undefined
    return (
      String(clusterK()) +
      ":" +
      items()
        .filter((item) => item.embedded)
        .map((item) => item.id)
        .join(",")
    )
  })
  const [cluster] = createResource(clusterSource, (key) =>
    runCluster({ query: { k: Number(key.slice(0, key.indexOf(":"))) } }),
  )
  const groups = createMemo(() => {
    if (!clusterOn()) return undefined
    const value = cluster()
    if (value === undefined) return undefined
    return new Map(value.members.map((member) => [member.id, member.groupId]))
  })
  const status = createMemo(() => {
    const result = health()
    const bookmarks = AsyncResult.isSuccess(result) ? result.value.bookmarks : items().length
    const embedded = AsyncResult.isSuccess(result)
      ? result.value.embedded
      : items().filter((item) => item.embedded).length
    const importingNow =
      AsyncResult.isSuccess(result) && Predicate.isTagged(result.value.import, "running")
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
        if (ids.length === 1) void refetchDetail()
      })
      .catch(() => setNotice("Could not apply that tag."))
  }

  const removeTag = (tag: string) => {
    const ids = selection()
    const first = ids[0]
    void Promise.all(ids.map((id) => runRemoveTag({ params: { id, tag } })))
      .then(() => {
        refreshTags()
        if (ids.length === 1 && first !== undefined) void refetchDetail()
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
      .catch((cause) => {
        if (request !== searchRequest) return
        setSearch({
          kind: "failed",
          reason: Predicate.isTagged(cause, "ServiceUnavailable") ? "embeddings" : "error",
        })
      })
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
      .catch((cause) => {
        setNotice(
          Predicate.isTagged(cause, "ImportBusy")
            ? "An import is already running. Try again in a moment."
            : "That file could not be imported.",
        )
      })
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
      onSelectionChange: setSelection,
      onDelete: beginDelete,
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
    const current = untrack(selection)
    const next = current.filter((id) => valid.has(id))
    if (next.length !== current.length) setSelected(next)
  })
  createEffect(() => {
    map?.setHighlight(highlighted())
    map?.setTagOverlay(tagOverlay())
    map?.setGroups(groups())
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
      <div {...stylex.attrs(ui.brandWrap)}>
        <DropdownMenu>
          <DropdownMenuTrigger aria-label="App menu" {...stylex.attrs([ui.brand, surface.glass])}>
            <span {...stylex.attrs(ui.x)}>𝕏</span>
            xkeep
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem
              disabled={importing()}
              onSelect={() => {
                fileInput()?.click()
              }}
            >
              {importing() ? "Importing…" : "Import JSON"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <input
          ref={setFileInput}
          type="file"
          aria-label="Import bookmarks JSON"
          accept="application/json,.json"
          hidden
          onChange={(event) => {
            const file = event.currentTarget.files?.item(0)
            if (file !== null && file !== undefined) importFile(file)
            event.currentTarget.value = ""
          }}
        />
      </div>
      <div {...stylex.attrs(ui.toolbar)}>
        <div {...stylex.attrs(ui.searchBox)}>
          <span {...stylex.attrs(ui.searchGlyph)}>⌕</span>
          <TextField value={queryDraft()} onChange={setQueryDraft}>
            <TextFieldInput
              variant="search"
              aria-label="Search the canvas"
              placeholder="Search the canvas"
              onKeyDown={(event: KeyboardEvent) => {
                if (event.key === "Enter") submitSearch()
                if (event.key === "Escape") clearSearch()
              }}
            />
          </TextField>
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
        <Show when={search().kind === "hits"}>
          <span {...stylex.attrs(ui.hitsChip)}>{String(hits().length)} hits</span>
        </Show>
        <Popover
          open={filtersOpen()}
          onOpenChange={setFiltersOpen}
          modal={false}
          placement="bottom"
        >
          <PopoverTrigger {...buttonAttrs("glass", "default", filtersOpen() || filterCount() > 0)}>
            Filters{filterCount() > 0 ? " · " + String(filterCount()) : ""}
          </PopoverTrigger>
          <PopoverContent
            onInteractOutside={(event) => event.preventDefault()}
            onFocusOutside={(event) => event.preventDefault()}
          >
            <Filters
              mediaFilter={mediaFilter()}
              tagFilter={tagFilter()}
              authorFilter={authorFilter()}
              dateDays={dateDays()}
              tagList={tagList()}
              authors={authors()}
              onMediaFilter={setMediaFilter}
              onTagFilter={setTagFilter}
              onAuthorFilter={setAuthorFilter}
              onDateDays={setDateDays}
              onClear={clearFilters}
              onDone={() => setFiltersOpen(false)}
            />
          </PopoverContent>
        </Popover>
        <Button
          variant="glass"
          pressed={tagOverlay()}
          onClick={() => {
            setTagOverlay((on) => {
              if (!on) setClusterOn(false)
              return !on
            })
          }}
        >
          Tags
        </Button>
        <Button
          variant="glass"
          pressed={clusterOn()}
          onClick={() => {
            setClusterOn((on) => {
              if (!on) setTagOverlay(false)
              return !on
            })
          }}
        >
          Clusters
        </Button>
        <Show when={clusterOn()}>
          <ClusterSlider value={clusterK()} onChange={setClusterK} />
        </Show>
      </div>

      <Show when={search().kind !== "idle"}>
        <section {...stylex.attrs(ui.results)}>
          <Show when={search().kind === "loading"}>
            <p {...stylex.attrs(surface.quiet)}>Searching by meaning…</p>
          </Show>
          <Show when={searchFailed()}>
            {(failed) => (
              <p {...stylex.attrs(surface.quiet)}>
                {failed().reason === "embeddings"
                  ? "Search is waiting for embeddings."
                  : "Search failed. Try again."}
              </p>
            )}
          </Show>
          <Show when={search().kind === "hits"}>
            <p {...stylex.attrs(surface.quiet)}>{String(hits().length)} hits</p>
          </Show>
          <For each={hits()}>
            {(hit) => (
              <button type="button" {...stylex.attrs(ui.result)} onClick={() => selectHit(hit)}>
                <p {...stylex.attrs(surface.quiet)}>
                  {hit.author} @{hit.handle} · {hit.score.toFixed(3)}
                </p>
                <p {...stylex.attrs(ui.resultText)}>
                  {hit.text.length <= 130 ? hit.text : hit.text.slice(0, 129) + "…"}
                </p>
              </button>
            )}
          </For>
        </section>
      </Show>
      <Show when={cluster.error}>
        <p {...stylex.attrs(ui.notice)}>Could not calculate clusters.</p>
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
                Import {importLabel(current().import)}
                <br />
                Semantic model {llamaLabel(current().llama)}
              </>
            )}
          </Show>
        </div>
      </Show>
      <button
        type="button"
        aria-expanded={statusOpen()}
        {...stylex.attrs(ui.status)}
        onClick={() => setStatusOpen((open) => !open)}
      >
        <span {...stylex.attrs([ui.dot, status().busy && ui.dotBusy])} />
        {status().label}
      </button>

      <Show when={selectedItems().length > 0}>
        <Inspector
          selectedItems={selectedItems}
          selectedOne={selectedOne}
          detail={detail}
          tagDraft={tagDraft}
          onTagDraft={setTagDraft}
          tagStates={tagStates}
          onAddTag={addTag}
          onRemoveTag={removeTag}
          onClose={() => setSelected([])}
          onDelete={() => beginDelete(selection())}
          onCopyLinks={copyLinks}
          onExport={exportSelection}
        />
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
          <DeleteDialog
            run={run}
            item={currentDeleteItem}
            onCancel={() => setDeleteRun(undefined)}
            onConfirm={confirmDeletedOnX}
          />
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

export const Canvas = CanvasView
