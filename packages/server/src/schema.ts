import { Schema } from "effect"

const DUMP_SCHEMA = "xkeep-dump/1" as const

const TweetId = Schema.String.check(Schema.isPattern(/^[0-9]{6,32}$/))

const CapturedAt = Schema.String.check(
  Schema.isPattern(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/),
)

export const Media = Schema.Struct({
  type: Schema.Literals(["photo", "video", "gif"]),
  url: Schema.String.check(Schema.isNonEmpty()),
  poster: Schema.optionalKey(Schema.String.check(Schema.isNonEmpty())),
})

export type Media = typeof Media.Type

export type Bookmark = {
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

export const BookmarkCodec: Schema.Codec<Bookmark> = Schema.Struct({
  id: TweetId,
  author: Schema.String,
  handle: Schema.String,
  avatar: Schema.String,
  timestamp: Schema.String,
  text: Schema.String,
  media: Schema.Array(Media),
  hashtags: Schema.Array(Schema.String),
  urls: Schema.Array(Schema.String),
  quoted: Schema.optionalKey(Schema.suspend((): Schema.Codec<Bookmark> => BookmarkCodec)),
})

export const BookmarkDump = Schema.Struct({
  schema: Schema.Literals([DUMP_SCHEMA, "x-bookmarks-dump/1"]),
  source: Schema.Literal("bookmark"),
  captured_at: CapturedAt,
  bookmarks: Schema.Array(BookmarkCodec),
  raw_pages: Schema.Array(Schema.Unknown),
})

export type BookmarkDump = typeof BookmarkDump.Type
