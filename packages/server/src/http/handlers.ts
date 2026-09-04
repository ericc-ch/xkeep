import { Effect } from "effect"
import { HttpApiBuilder, HttpApiError } from "effect/unstable/httpapi"
import { Llama } from "../embed/llama.ts"
import { importDump } from "../import/import-dump.ts"
import { Bookmarks } from "../bookmarks/bookmarks.ts"
import { search } from "../bookmarks/search.ts"
import { ImportFailed } from "../schema.ts"
import { Api } from "./api.ts"

export const handlers = HttpApiBuilder.group(Api, "xkeep", (group) =>
  group
    .handle(
      "health",
      Effect.fn("health")(
        function* () {
          const bookmarks = yield* Bookmarks
          const llama = yield* Llama
          const counts = yield* bookmarks.counts()
          const llamaState = yield* llama.state()
          return {
            status: "ok" as const,
            bookmarks: counts.bookmarks,
            embedded: counts.embedded,
            llama: llamaState,
          }
        },
        Effect.catchTag("EffectDrizzleQueryError", () => new HttpApiError.InternalServerError()),
      ),
    )
    .handle(
      "importDump",
      Effect.fn("importDump")(
        function* (ctx) {
          return yield* importDump(ctx.payload)
        },
        Effect.catchTags({
          ImportError: (error) => new ImportFailed({ reason: error.reason }),
          EffectDrizzleQueryError: () => new HttpApiError.InternalServerError(),
        }),
      ),
    )
    .handle(
      "search",
      Effect.fn("search")(
        function* (ctx) {
          return yield* search(ctx.query.q)
        },
        Effect.catchTags({
          LlamaUnavailable: () => new HttpApiError.ServiceUnavailable(),
          LlamaEmbedError: () => new HttpApiError.ServiceUnavailable(),
          EffectDrizzleQueryError: () => new HttpApiError.InternalServerError(),
        }),
      ),
    ),
)
