import { Data, Schema } from "effect"

const DUMP_SCHEMA = "xkeep-dump/1" as const

const TweetId = Schema.String.check(Schema.isPattern(/^[0-9]{6,32}$/))

const CapturedAt = Schema.String.check(
  Schema.isPattern(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/),
)

const Media = Schema.Struct({
  type: Schema.Literals(["photo", "video", "gif"]),
  url: Schema.String.check(Schema.isNonEmpty()),
  poster: Schema.optionalKey(Schema.String.check(Schema.isNonEmpty())),
})

type Media = typeof Media.Type

export interface Bookmark {
  readonly id: typeof TweetId.Type
  readonly author: string
  readonly handle: string
  readonly avatar: string
  readonly timestamp: string
  readonly text: string
  readonly media: ReadonlyArray<Media>
  readonly hashtags: ReadonlyArray<string>
  readonly urls: ReadonlyArray<string>
  readonly quoted?: Bookmark
}

const Bookmark: Schema.Codec<Bookmark> = Schema.Struct({
  id: TweetId,
  author: Schema.String,
  handle: Schema.String,
  avatar: Schema.String,
  timestamp: Schema.String,
  text: Schema.String,
  media: Schema.Array(Media),
  hashtags: Schema.Array(Schema.String),
  urls: Schema.Array(Schema.String),
  quoted: Schema.optionalKey(Schema.suspend((): Schema.Codec<Bookmark> => Bookmark)),
})

export const BookmarkDump = Schema.Struct({
  schema: Schema.Literals([DUMP_SCHEMA, "x-bookmarks-dump/1"]),
  source: Schema.Literal("bookmark"),
  captured_at: CapturedAt,
  bookmarks: Schema.Array(Bookmark),
  raw_pages: Schema.Array(Schema.Unknown),
})

export type BookmarkDump = typeof BookmarkDump.Type

export const API_PREFIX = "/api" as const
export const HEALTH_PATH = "/api/health" as const
export const OPENAPI_PATH = "/api/openapi.json" as const
export const DOCS_PATH = "/api/docs" as const

export class ImportFailed extends Schema.TaggedError<ImportFailed>()(
  "ImportFailed",
  { reason: Schema.String },
  { httpApiStatus: 400 },
) {}

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
  stillPaths: Schema.optionalKey(Schema.Array(Schema.String)),
})

export const SearchResult = Schema.Struct({
  hits: Schema.Array(SearchHit),
})
