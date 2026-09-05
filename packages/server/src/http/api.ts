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
  BookmarkDetail,
  BookmarkDump,
  BookmarkList,
  BookmarkNotFound,
  BookmarkTagIds,
  ClusterK,
  ClusterResult,
  Health,
  ImportBusy,
  ImportFailed,
  ImportResult,
  MediaName,
  MediaNotFound,
  SearchResult,
  SseEvent,
  Tag,
  TagConflict,
  TagCreate,
  TagNotFound,
  TagList,
  TagPatch,
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
        HttpApiEndpoint.get("getMedia", "/media/:name", {
          params: { name: MediaName },
          success: HttpApiSchema.asUint8Array()(Schema.Uint8Array),
          error: [MediaNotFound, HttpApiError.InternalServerError],
        }),
      )
      .add(
        HttpApiEndpoint.get("listTags", "/tags", {
          success: TagList,
          error: HttpApiError.InternalServerError,
        }),
      )
      .add(
        HttpApiEndpoint.post("createTag", "/tags", {
          payload: TagCreate,
          success: Tag,
          error: [TagConflict, TagNotFound, HttpApiError.InternalServerError],
        }),
      )
      .add(
        HttpApiEndpoint.patch("updateTag", "/tags/:id", {
          params: { id: Schema.String },
          payload: TagPatch,
          success: Tag,
          error: [TagConflict, TagNotFound, HttpApiError.InternalServerError],
        }),
      )
      .add(
        HttpApiEndpoint.delete("deleteTag", "/tags/:id", {
          params: { id: Schema.String },
          success: Schema.Void,
          error: [TagNotFound, HttpApiError.InternalServerError],
        }),
      )
      .add(
        HttpApiEndpoint.put("replaceBookmarkTags", "/bookmarks/:id/tags", {
          params: { id: Schema.String },
          payload: BookmarkTagIds,
          success: BookmarkTagIds,
          error: [BookmarkNotFound, TagNotFound, HttpApiError.InternalServerError],
        }),
      )
      .add(
        HttpApiEndpoint.post("addBookmarkTag", "/bookmarks/:id/tags/:tagId", {
          params: { id: Schema.String, tagId: Schema.String },
          success: Schema.Void,
          error: [BookmarkNotFound, TagNotFound, HttpApiError.InternalServerError],
        }),
      )
      .add(
        HttpApiEndpoint.delete("removeBookmarkTag", "/bookmarks/:id/tags/:tagId", {
          params: { id: Schema.String, tagId: Schema.String },
          success: Schema.Void,
          error: [BookmarkNotFound, TagNotFound, HttpApiError.InternalServerError],
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
