import { Effect, Stream } from "effect"
import { FetchHttpClient } from "effect/unstable/http"
import { Atom, AtomHttpApi, Reactivity } from "effect/unstable/reactivity"
import { Api } from "@xkeep/server/api"
import {
  BookmarkDetail,
  BookmarkListItem,
  Health,
  SearchResult,
  TagCounts,
} from "@xkeep/server/schema-http"

export const XkeepApi = AtomHttpApi.Service()("xkeep/XkeepApi", {
  api: Api,
  httpClient: FetchHttpClient.layer,
})

const loadPile = XkeepApi.use((client) =>
  client.listBookmarks().pipe(Effect.map((listed) => listed.bookmarks)),
)

export const pileAtom = Atom.withReactivity(["bookmarks"])(XkeepApi.runtime.atom(loadPile))

export const tagsAtom = Atom.withReactivity(["tags"])(
  XkeepApi.runtime.atom(XkeepApi.use((client) => client.listTags())),
)

export const healthAtom = Atom.withReactivity(["health"])(
  XkeepApi.runtime.atom(XkeepApi.use((client) => client.health())),
)

export const liveAtom = Atom.keepAlive(
  XkeepApi.runtime.atom(
    XkeepApi.use((client) =>
      Effect.gen(function* () {
        const stream = yield* client.events()
        yield* Stream.runForEach(stream, (event) => {
          if (event.event === "import.status") return Reactivity.invalidate(["health"])
          if (event.event === "bookmark.tagged" || event.event === "bookmark.untagged") {
            return Reactivity.invalidate(["bookmarks", "tags"])
          }
          if (
            event.event === "bookmark.upserted" ||
            event.event === "bookmark.embedded" ||
            event.event === "bookmark.deleted"
          ) {
            return Reactivity.invalidate(["bookmarks", "health"])
          }
          return Effect.void
        })
      }),
    ),
  ),
)

export const importDump = XkeepApi.mutation("xkeep", "importDump")

export type PileItem = typeof BookmarkListItem.Type
export type Detail = typeof BookmarkDetail.Type
export type HealthStatus = typeof Health.Type
export type SearchHit = (typeof SearchResult.Type)["hits"][number]
export type TagCount = (typeof TagCounts.Type)["tags"][number]

export const searchQuery = XkeepApi.mutation("xkeep", "search")
export const bookmarkDetail = XkeepApi.mutation("xkeep", "getBookmark")
export const clusterQuery = XkeepApi.mutation("xkeep", "cluster")
export const addTagMutation = XkeepApi.mutation("xkeep", "addBookmarkTag")
export const removeTagMutation = XkeepApi.mutation("xkeep", "removeBookmarkTag")
export const bulkApplyTagMutation = XkeepApi.mutation("xkeep", "bulkApplyTag")
export const deleteBookmarksMutation = XkeepApi.mutation("xkeep", "deleteBookmarks")
