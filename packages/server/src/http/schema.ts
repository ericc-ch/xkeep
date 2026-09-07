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
  skippedDeleted: Schema.Number,
  stillsPending: Schema.Number,
  pendingEmbeddings: Schema.Number,
})

export const BookmarkDeletion = Schema.Struct({
  ids: Schema.Array(Schema.String).check(Schema.isUnique(), Schema.isMinLength(1)),
})

export const BookmarkDeletionResult = Schema.Struct({
  deleted: Schema.Number,
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

export const TagName = Schema.String.check(Schema.isNonEmpty())

export const TagCount = Schema.Struct({
  tag: TagName,
  count: Schema.Number,
})

export const TagCounts = Schema.Struct({
  tags: Schema.Array(TagCount),
})

export const TagRename = Schema.Struct({
  tag: TagName,
})

export const BookmarkTags = Schema.Struct({
  tags: Schema.Array(TagName).check(Schema.isUnique()),
})

export const BulkTagApply = Schema.Struct({
  memberIds: Schema.Array(Schema.String).check(Schema.isUnique()),
  tag: TagName,
})

export const BulkTagResult = Schema.Struct({
  tagged: Schema.Number,
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
  tags: Schema.Array(TagName),
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
  tags: Schema.Array(TagName),
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
  sseEvent("import.status", Schema.Struct({ status: Schema.Literals(["running", "idle"]) })),
  sseEvent("bookmark.tagged", Schema.Struct({ id: Schema.String, tag: TagName })),
  sseEvent("bookmark.untagged", Schema.Struct({ id: Schema.String, tag: TagName })),
  sseEvent("bookmark.upserted", Schema.Struct({ ids: Schema.Array(Schema.String) })),
  sseEvent("bookmark.embedded", Schema.Struct({ ids: Schema.Array(Schema.String) })),
  sseEvent("bookmark.deleted", Schema.Struct({ ids: Schema.Array(Schema.String) })),
])

export type SseEvent = typeof SseEvent.Type

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

export const MediaName = Schema.String.check(
  Schema.isPattern(/^(?!\.\.?$)[A-Za-z0-9][A-Za-z0-9._-]*$/),
)

export const ClusterK = Schema.NumberFromString.check(Schema.isInt(), Schema.isGreaterThan(0))
