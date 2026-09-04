import { Schema } from "effect"
import {
  HttpApi,
  HttpApiEndpoint,
  HttpApiError,
  HttpApiGroup,
  OpenApi,
} from "effect/unstable/httpapi"
import { BookmarkDump } from "../dump/parse-graphql.ts"

export class ImportFailed extends Schema.TaggedError<ImportFailed>()(
  "ImportFailed",
  { reason: Schema.String },
  { httpApiStatus: 400 },
) {}

export const LlamaHealth = Schema.TaggedUnion({
  starting: {},
  ready: {},
  unavailable: { reason: Schema.String },
})

export const Health = Schema.Struct({
  status: Schema.Literal("ok"),
  bookmarks: Schema.Number,
  embedded: Schema.Number,
  llama: LlamaHealth,
})

export const ImportResult = Schema.Struct({
  imported: Schema.Number,
  updated: Schema.Number,
  stills: Schema.Number,
  stillFailed: Schema.Number,
  pendingEmbeddings: Schema.Number,
})

export const SearchHit = Schema.Struct({
  id: Schema.String,
  handle: Schema.String,
  author: Schema.String,
  text: Schema.String,
  score: Schema.Number,
  stillPath: Schema.optionalKey(Schema.String),
})

export const SearchResult = Schema.Struct({
  hits: Schema.Array(SearchHit),
})

export const Api = HttpApi.make("xkeep")
  .annotate(OpenApi.Title, "xkeep")
  .annotate(OpenApi.Description, "Local X bookmarks library")
  .add(
    HttpApiGroup.make("library", { topLevel: true })
      .add(
        HttpApiEndpoint.get("health", "/health", {
          success: Health,
          error: HttpApiError.InternalServerError,
        }),
      )
      .add(
        HttpApiEndpoint.post("importDump", "/imports", {
          payload: BookmarkDump,
          success: ImportResult,
          error: [ImportFailed, HttpApiError.InternalServerError],
        }),
      )
      .add(
        HttpApiEndpoint.get("search", "/search", {
          query: {
            q: Schema.String,
          },
          success: SearchResult,
          error: [HttpApiError.ServiceUnavailable, HttpApiError.InternalServerError],
        }),
      ),
  )
