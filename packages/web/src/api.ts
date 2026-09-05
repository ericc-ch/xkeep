import { Effect, Stream } from "effect"
import { FetchHttpClient } from "effect/unstable/http"
import { Atom, AtomHttpApi, Reactivity } from "effect/unstable/reactivity"
import { Api } from "@xkeep/server/api"
import { BookmarkListItem } from "@xkeep/server/schema-http"

export const XkeepApi = AtomHttpApi.Service()("xkeep/XkeepApi", {
  api: Api,
  httpClient: FetchHttpClient.layer,
})

const loadPile = XkeepApi.use((client) =>
  client.listBookmarks().pipe(Effect.map((listed) => listed.bookmarks)),
)

export const pileAtom = Atom.withReactivity(["bookmarks"])(XkeepApi.runtime.atom(loadPile))

export const liveAtom = Atom.keepAlive(
  XkeepApi.runtime.atom(
    XkeepApi.use((client) =>
      Effect.gen(function* () {
        const stream = yield* client.events()
        yield* Stream.runForEach(stream, (event) => {
          if (event.event === "bookmark.upserted" || event.event === "bookmark.embedded") {
            return Reactivity.invalidate(["bookmarks"])
          }
          return Effect.void
        })
      }),
    ),
  ),
)

export const importDump = XkeepApi.mutation("xkeep", "importDump")

export type PileItem = typeof BookmarkListItem.Type
