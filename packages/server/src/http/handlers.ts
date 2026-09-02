import { Effect } from "effect"
import { HttpApiBuilder, HttpApiError } from "effect/unstable/httpapi"
import { Llama } from "../embed/llama.ts"
import { importDump } from "../import/import-dump.ts"
import { Library } from "../library/library.ts"
import { search } from "../library/search.ts"
import { Api, ImportFailed } from "./api.ts"

export const handlers = HttpApiBuilder.group(Api, "library", (group) =>
  group
    .handle(
      "health",
      Effect.fn("health")(
        function* () {
          const library = yield* Library
          const llama = yield* Llama
          const counts = yield* library.counts()
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
