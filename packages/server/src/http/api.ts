import { Schema } from "effect"
import {
  HttpApi,
  HttpApiEndpoint,
  HttpApiError,
  HttpApiGroup,
  HttpApiSchema,
  OpenApi,
} from "effect/unstable/httpapi"
import {
  API_PREFIX,
  BookmarkDeletion,
  BookmarkDeletionResult,
  BookmarkDetail,
  BookmarkDump,
  BookmarkList,
  BookmarkNotFound,
  BookmarkTags,
  BulkTagApply,
  BulkTagResult,
  ClusterK,
  ClusterResult,
  Health,
  ImportBusy,
  ImportResult,
  MediaName,
  MediaNotFound,
  SearchResult,
  SseEvent,
  TagCount,
  TagCounts,
  TagRename,
} from "./schema.ts"

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
          error: [ImportBusy, HttpApiError.InternalServerError],
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
      )
      .add(
        HttpApiEndpoint.get("events", "/events", {
          success: HttpApiSchema.StreamSse({ events: SseEvent }),
          error: HttpApiError.InternalServerError,
        }),
      )
      .add(
        HttpApiEndpoint.get("listBookmarks", "/bookmarks", {
          success: BookmarkList,
          error: HttpApiError.InternalServerError,
        }),
      )
      .add(
        HttpApiEndpoint.get("getBookmark", "/bookmarks/:id", {
          params: { id: Schema.String },
          success: BookmarkDetail,
          error: [BookmarkNotFound, HttpApiError.InternalServerError],
        }),
      )
      .add(
        HttpApiEndpoint.post("deleteBookmarks", "/bookmark-deletions", {
          payload: BookmarkDeletion,
          success: BookmarkDeletionResult,
          error: [BookmarkNotFound, HttpApiError.InternalServerError],
        }),
      )
      .add(
        HttpApiEndpoint.get("getMedia", "/media/:name", {
          params: { name: MediaName },
          success: HttpApiSchema.asUint8Array()(Schema.Uint8Array),
          error: [MediaNotFound, HttpApiError.InternalServerError],
        }),
      )
      .add(
        HttpApiEndpoint.get("listTags", "/tags", {
          success: TagCounts,
          error: HttpApiError.InternalServerError,
        }),
      )
      .add(
        HttpApiEndpoint.put("renameTag", "/tags/:tag", {
          params: { tag: Schema.String },
          payload: TagRename,
          success: TagCount,
          error: HttpApiError.InternalServerError,
        }),
      )
      .add(
        HttpApiEndpoint.put("replaceBookmarkTags", "/bookmarks/:id/tags", {
          params: { id: Schema.String },
          payload: BookmarkTags,
          success: BookmarkTags,
          error: [BookmarkNotFound, HttpApiError.InternalServerError],
        }),
      )
      .add(
        HttpApiEndpoint.post("addBookmarkTag", "/bookmarks/:id/tags/:tag", {
          params: { id: Schema.String, tag: Schema.String },
          success: Schema.Void,
          error: [BookmarkNotFound, HttpApiError.InternalServerError],
        }),
      )
      .add(
        HttpApiEndpoint.delete("removeBookmarkTag", "/bookmarks/:id/tags/:tag", {
          params: { id: Schema.String, tag: Schema.String },
          success: Schema.Void,
          error: [BookmarkNotFound, HttpApiError.InternalServerError],
        }),
      )
      .add(
        HttpApiEndpoint.post("bulkApplyTag", "/bookmarks/tags", {
          payload: BulkTagApply,
          success: BulkTagResult,
          error: [BookmarkNotFound, HttpApiError.InternalServerError],
        }),
      )
      .add(
        HttpApiEndpoint.get("cluster", "/clusters", {
          query: {
            k: Schema.optionalKey(ClusterK),
          },
          success: ClusterResult,
          error: HttpApiError.InternalServerError,
        }),
      ),
  )
  .prefix(API_PREFIX)
