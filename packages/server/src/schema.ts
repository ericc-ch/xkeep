import { Schema } from "effect"

const TweetId = Schema.String.check(Schema.isPattern(/^[0-9]{6,32}$/))

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
  bookmarks: Schema.Array(BookmarkCodec),
})

export type BookmarkDump = typeof BookmarkDump.Type
