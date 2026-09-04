import { Schema } from "effect"
import {
  HttpApi,
  HttpApiEndpoint,
  HttpApiError,
  HttpApiGroup,
  OpenApi,
} from "effect/unstable/httpapi"
import { API_PREFIX, BookmarkDump, Health, ImportBusy, ImportFailed, ImportResult, SearchResult } from "../schema.ts"

export const Api = HttpApi.make("xkeep")
  .annotate(OpenApi.Title, "xkeep")
  .annotate(OpenApi.Description, "Local X bookmarks")
  .add(
    HttpApiGroup.make("xkeep", { topLevel: true })
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
          error: [ImportFailed, ImportBusy, HttpApiError.InternalServerError],
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
  .prefix(API_PREFIX)
