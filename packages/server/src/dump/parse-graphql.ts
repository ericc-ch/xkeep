import { Schema } from "effect"

export const DUMP_SCHEMA = "xkeep-dump/1" as const

export const TweetId = Schema.String.check(Schema.isPattern(/^[0-9]{6,32}$/))

export const CapturedAt = Schema.String.check(
  Schema.isPattern(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/),
)

export const Media = Schema.Struct({
  type: Schema.Literals(["photo", "video", "gif"]),
  url: Schema.String.check(Schema.isNonEmpty()),
  poster: Schema.optionalKey(Schema.String.check(Schema.isNonEmpty())),
})

export type Media = typeof Media.Type

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

export const Bookmark: Schema.Codec<Bookmark> = Schema.Struct({
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
  schema: Schema.Literal(DUMP_SCHEMA),
  source: Schema.Literal("bookmark"),
  captured_at: CapturedAt,
  bookmarks: Schema.Array(Bookmark),
  raw_pages: Schema.Array(Schema.Unknown),
})

export type BookmarkDump = typeof BookmarkDump.Type

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const asString = (value: unknown): string => (typeof value === "string" ? value : "")

const unwrapTweet = (value: Record<string, unknown>): Record<string, unknown> => {
  if (
    value.__typename === "TweetWithVisibilityResults" ||
    value.__typename === "TweetWithVisibilityResult"
  ) {
    return isRecord(value.tweet) ? value.tweet : value
  }
  return value
}

const isTweetRecord = (value: unknown): value is Record<string, unknown> => {
  if (!isRecord(value)) return false
  const tweet = unwrapTweet(value)
  if (tweet.__typename === "User" || tweet.__typename === "TweetTombstone") return false
  if (typeof tweet.rest_id !== "string" || tweet.rest_id.length < 6) return false
  return isRecord(tweet.legacy)
}

const userFields = (
  tweet: Record<string, unknown>,
): { author: string; handle: string; avatar: string } => {
  const core = isRecord(tweet.core) ? tweet.core : undefined
  const userResults = core && isRecord(core.user_results) ? core.user_results : undefined
  const user = userResults && isRecord(userResults.result) ? userResults.result : undefined
  const userCore = user && isRecord(user.core) ? user.core : undefined
  const userLegacy = user && isRecord(user.legacy) ? user.legacy : undefined
  const avatar = user && isRecord(user.avatar) ? user.avatar : undefined
  return {
    author: asString(userCore?.name) || asString(userLegacy?.name) || "Unknown",
    handle: asString(userCore?.screen_name) || asString(userLegacy?.screen_name) || "unknown",
    avatar: asString(avatar?.image_url) || asString(userLegacy?.profile_image_url_https),
  }
}

const bestMp4 = (media: Record<string, unknown>): string => {
  const info = isRecord(media.video_info) ? media.video_info : undefined
  const variants = info && Array.isArray(info.variants) ? info.variants : []
  const mp4s = variants
    .filter(isRecord)
    .filter((variant) => variant.content_type === "video/mp4" && typeof variant.url === "string")
    .sort((a, b) => asNumber(b.bitrate) - asNumber(a.bitrate))
  const first = mp4s[0]
  return first && typeof first.url === "string" ? first.url : ""
}

const asNumber = (value: unknown): number => (typeof value === "number" ? value : 0)

const parseMediaList = (tweet: Record<string, unknown>): ReadonlyArray<Media> => {
  const legacy = isRecord(tweet.legacy) ? tweet.legacy : {}
  const extended = isRecord(legacy.extended_entities) ? legacy.extended_entities : undefined
  const entities = isRecord(legacy.entities) ? legacy.entities : undefined
  const raw = Array.isArray(extended?.media)
    ? extended.media
    : Array.isArray(entities?.media)
      ? entities.media
      : []
  const media: Array<Media> = []
  for (const item of raw) {
    if (!isRecord(item)) continue
    const thumb = asString(item.media_url_https)
    if (item.type === "video" || item.type === "animated_gif") {
      const mp4 = bestMp4(item)
      const type: Media["type"] = item.type === "animated_gif" ? "gif" : "video"
      if (mp4 && thumb) {
        media.push({ type, url: mp4, poster: thumb })
        continue
      }
      if (mp4) {
        media.push({ type, url: mp4 })
        continue
      }
      if (thumb) media.push({ type: "photo", url: thumb })
      continue
    }
    if (thumb) media.push({ type: "photo", url: thumb })
  }
  return media
}

const parseHashtags = (tweet: Record<string, unknown>): ReadonlyArray<string> => {
  const legacy = isRecord(tweet.legacy) ? tweet.legacy : {}
  const entities = isRecord(legacy.entities) ? legacy.entities : undefined
  const tags = Array.isArray(entities?.hashtags) ? entities.hashtags : []
  return tags
    .filter(isRecord)
    .map((tag) => asString(tag.text))
    .filter(Boolean)
}

const parseUrls = (tweet: Record<string, unknown>): ReadonlyArray<string> => {
  const legacy = isRecord(tweet.legacy) ? tweet.legacy : {}
  const entities = isRecord(legacy.entities) ? legacy.entities : undefined
  const urls = Array.isArray(entities?.urls) ? entities.urls : []
  return urls
    .filter(isRecord)
    .map((url) => asString(url.expanded_url))
    .filter(Boolean)
}

const tweetText = (tweet: Record<string, unknown>): string => {
  const note = isRecord(tweet.note_tweet) ? tweet.note_tweet : undefined
  const noteResults =
    note && isRecord(note.note_tweet_results) ? note.note_tweet_results : undefined
  const noteInner = noteResults && isRecord(noteResults.result) ? noteResults.result : undefined
  const noteText = asString(noteInner?.text)
  if (noteText) return noteText
  const legacy = isRecord(tweet.legacy) ? tweet.legacy : {}
  return asString(legacy.full_text) || asString(legacy.text)
}

const toBookmark = (tweet: Record<string, unknown>, quoteDepth: number): Bookmark => {
  const unwrapped = unwrapTweet(tweet)
  const user = userFields(unwrapped)
  const legacy = isRecord(unwrapped.legacy) ? unwrapped.legacy : {}
  const bookmark: Bookmark = {
    id: asString(unwrapped.rest_id),
    author: user.author,
    handle: user.handle,
    avatar: user.avatar,
    timestamp: asString(legacy.created_at),
    text: tweetText(unwrapped),
    media: parseMediaList(unwrapped),
    hashtags: parseHashtags(unwrapped),
    urls: parseUrls(unwrapped),
  }
  if (quoteDepth > 0) return bookmark
  const quotedWrap = isRecord(unwrapped.quoted_status_result)
    ? unwrapped.quoted_status_result
    : undefined
  const quotedRaw = quotedWrap?.result
  if (isTweetRecord(quotedRaw)) {
    return { ...bookmark, quoted: toBookmark(quotedRaw, quoteDepth + 1) }
  }
  return bookmark
}

const collectFromTweetResults = (
  value: unknown,
  depth: number,
  acc: { seen: Set<string>; out: Array<Bookmark> },
): void => {
  if (!value || typeof value !== "object" || depth > 16) return
  if (Array.isArray(value)) {
    for (const item of value) collectFromTweetResults(item, depth + 1, acc)
    return
  }
  if (!isRecord(value)) return
  if (isRecord(value.tweet_results) && isTweetRecord(value.tweet_results.result)) {
    const bookmark = toBookmark(value.tweet_results.result, 0)
    if (!acc.seen.has(bookmark.id)) {
      acc.seen.add(bookmark.id)
      acc.out.push(bookmark)
    }
  }
  for (const [key, child] of Object.entries(value)) {
    if (key === "quoted_status_result") continue
    collectFromTweetResults(child, depth + 1, acc)
  }
}

export const parseBookmarksFromGraphql = (
  pages: ReadonlyArray<unknown>,
): ReadonlyArray<Bookmark> => {
  const acc = { seen: new Set<string>(), out: [] as Array<Bookmark> }
  for (const page of pages) collectFromTweetResults(page, 0, acc)
  return acc.out
}
