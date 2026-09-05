import { Data, Schema } from "effect"
import { BookmarkCodec, BookmarkDump, Media } from "../schema.ts"

export const API_PREFIX = "/api" as const
export const HEALTH_PATH = "/api/health" as const
export const OPENAPI_PATH = "/api/openapi.json" as const
export const DOCS_PATH = "/api/docs" as const

export { BookmarkDump }

export class ImportBusy extends Schema.TaggedError<ImportBusy>()(
  "ImportBusy",
  { reason: Schema.String },
  { httpApiStatus: 409 },
) {}

export type ImportStatus = Data.TaggedEnum<{
  idle: {}
  running: {}
}>

export const ImportStatus = Data.taggedEnum<ImportStatus>()

const LlamaHealth = Schema.TaggedUnion({
  starting: {},
  ready: {},
  unavailable: { reason: Schema.String },
})

const ImportHealth = Schema.TaggedUnion({
  idle: {},
  running: {},
})

export const Health = Schema.Struct({
  status: Schema.Literal("ok"),
  bookmarks: Schema.Number,
  embedded: Schema.Number,
  llama: LlamaHealth,
  import: ImportHealth,
})

export const ImportResult = Schema.Struct({
  imported: Schema.Number,
  updated: Schema.Number,
  stillsPending: Schema.Number,
  pendingEmbeddings: Schema.Number,
})

const SearchHit = Schema.Struct({
  id: Schema.String,
  handle: Schema.String,
  author: Schema.String,
  text: Schema.String,
  score: Schema.Number,
})

export const SearchResult = Schema.Struct({
  hits: Schema.Array(SearchHit),
})

export const TagId = Schema.String.check(Schema.isNonEmpty())

export const Tag = Schema.Struct({
  id: TagId,
  name: Schema.String.check(Schema.isNonEmpty()),
  parentId: Schema.optionalKey(TagId),
})

export const TagList = Schema.Struct({
  tags: Schema.Array(Tag),
})

export const TagCreate = Schema.Struct({
  name: Schema.String.check(Schema.isNonEmpty()),
  parentId: Schema.optionalKey(TagId),
})

export const TagPatch = Schema.Struct({
  name: Schema.optionalKey(Schema.String.check(Schema.isNonEmpty())),
  parentId: Schema.optionalKey(Schema.NullOr(TagId)),
})

export const BookmarkTagIds = Schema.Struct({
  tagIds: Schema.Array(TagId).check(Schema.isUnique()),
})

const MediaType = Schema.Literals(["text", "photo", "video", "gif", "link"])

export const BookmarkListItem = Schema.Struct({
  id: Schema.String,
  author: Schema.String,
  handle: Schema.String,
  avatar: Schema.String,
  text: Schema.String,
  timestamp: Schema.String,
  mediaTypes: Schema.Array(MediaType),
  tagIds: Schema.Array(TagId),
  still: Schema.optionalKey(Schema.String),
  embedded: Schema.Boolean,
  x: Schema.optionalKey(Schema.Number),
  y: Schema.optionalKey(Schema.Number),
})

export const BookmarkList = Schema.Struct({
  bookmarks: Schema.Array(BookmarkListItem),
})

export const BookmarkDetail = Schema.Struct({
  id: Schema.String,
  author: Schema.String,
  handle: Schema.String,
  avatar: Schema.String,
  text: Schema.String,
  timestamp: Schema.String,
  media: Schema.Array(Media),
  hashtags: Schema.Array(Schema.String),
  urls: Schema.Array(Schema.String),
  quoted: Schema.optionalKey(BookmarkCodec),
  stills: Schema.Array(Schema.String),
  tagIds: Schema.Array(TagId),
  embedded: Schema.Boolean,
  x: Schema.optionalKey(Schema.Number),
  y: Schema.optionalKey(Schema.Number),
})

export const ClusterMember = Schema.Struct({
  id: Schema.String,
  x: Schema.Number,
  y: Schema.Number,
  groupId: Schema.Number,
})

export const ClusterResult = Schema.Struct({
  members: Schema.Array(ClusterMember),
  skippedUnembedded: Schema.Number,
})

const sseEvent = <Name extends string, Data extends Schema.Top>(name: Name, data: Data) =>
  Schema.Struct({
    event: Schema.Literal(name),
    data: Schema.fromJsonString(data),
  })

export const SseEvent = Schema.Union([
  sseEvent("server.connected", Schema.Struct({})),
  sseEvent("heartbeat", Schema.Struct({})),
  sseEvent("tag.created", Schema.Struct({ id: TagId })),
  sseEvent("tag.updated", Schema.Struct({ id: TagId })),
  sseEvent("tag.deleted", Schema.Struct({ id: TagId })),
  sseEvent("bookmark.tagged", Schema.Struct({ id: Schema.String, tagId: TagId })),
  sseEvent("bookmark.untagged", Schema.Struct({ id: Schema.String, tagId: TagId })),
  sseEvent("bookmark.upserted", Schema.Struct({ ids: Schema.Array(Schema.String) })),
  sseEvent("bookmark.embedded", Schema.Struct({ ids: Schema.Array(Schema.String) })),
])

export type SseEvent = typeof SseEvent.Type

export class TagConflict extends Schema.TaggedError<TagConflict>()(
  "TagConflict",
  { reason: Schema.String },
  { httpApiStatus: 409 },
) {}

export class TagNotFound extends Schema.TaggedError<TagNotFound>()(
  "TagNotFound",
  { id: Schema.String },
  { httpApiStatus: 404 },
) {}

export class BookmarkNotFound extends Schema.TaggedError<BookmarkNotFound>()(
  "BookmarkNotFound",
  { id: Schema.String },
  { httpApiStatus: 404 },
) {}

export class MediaNotFound extends Schema.TaggedError<MediaNotFound>()(
  "MediaNotFound",
  { name: Schema.String },
  { httpApiStatus: 404 },
) {}

export const MediaName = Schema.String.check(Schema.isPattern(/^(?!\.\.?$)[A-Za-z0-9][A-Za-z0-9._-]*$/))

export const ClusterK = Schema.NumberFromString.check(Schema.isInt(), Schema.isGreaterThan(0))
