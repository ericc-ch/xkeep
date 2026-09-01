export const DUMP_SCHEMA = "x-bookmarks-dump/1" as const

export class DumpParseError extends Error {
  readonly _tag = "DumpParseError" as const
  readonly reason: string

  constructor(reason: string) {
    super(reason)
    this.reason = reason
  }
}

export type DumpParseResult<T> =
  | { readonly _tag: "ok"; readonly value: T }
  | { readonly _tag: "err"; readonly error: DumpParseError }

export type MediaType = "photo" | "video" | "gif"

export type Media = {
  readonly type: MediaType
  readonly url: string
  readonly poster?: string
}

export type Bookmark = {
  readonly id: string
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

export type BookmarkDump = {
  readonly schema: typeof DUMP_SCHEMA
  readonly source: "bookmark"
  readonly captured_at: string
  readonly bookmarks: ReadonlyArray<Bookmark>
  readonly raw_pages: ReadonlyArray<unknown>
}

const ok = <T>(value: T): DumpParseResult<T> => ({ _tag: "ok", value })
const err = (reason: string): DumpParseResult<never> => ({
  _tag: "err",
  error: new DumpParseError(reason),
})

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

const userFields = (tweet: Record<string, unknown>): { author: string; handle: string; avatar: string } => {
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
      const type: MediaType = item.type === "animated_gif" ? "gif" : "video"
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
  return tags.filter(isRecord).map((tag) => asString(tag.text)).filter(Boolean)
}

const parseUrls = (tweet: Record<string, unknown>): ReadonlyArray<string> => {
  const legacy = isRecord(tweet.legacy) ? tweet.legacy : {}
  const entities = isRecord(legacy.entities) ? legacy.entities : undefined
  const urls = Array.isArray(entities?.urls) ? entities.urls : []
  return urls.filter(isRecord).map((url) => asString(url.expanded_url)).filter(Boolean)
}

const tweetText = (tweet: Record<string, unknown>): string => {
  const note = isRecord(tweet.note_tweet) ? tweet.note_tweet : undefined
  const noteResults = note && isRecord(note.note_tweet_results) ? note.note_tweet_results : undefined
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
  const quotedWrap = isRecord(unwrapped.quoted_status_result) ? unwrapped.quoted_status_result : undefined
  const quotedRaw = quotedWrap?.result
  if (isTweetRecord(quotedRaw)) {
    return { ...bookmark, quoted: toBookmark(quotedRaw, quoteDepth + 1) }
  }
  return bookmark
}

const collectFromTweetResults = (value: unknown, depth: number, acc: { seen: Set<string>; out: Array<Bookmark> }): void => {
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

export const parseBookmarksFromGraphql = (pages: ReadonlyArray<unknown>): ReadonlyArray<Bookmark> => {
  const acc = { seen: new Set<string>(), out: [] as Array<Bookmark> }
  for (const page of pages) collectFromTweetResults(page, 0, acc)
  return acc.out
}

const parseMedia = (value: unknown): Media | undefined => {
  if (!isRecord(value)) return undefined
  if (value.type !== "photo" && value.type !== "video" && value.type !== "gif") return undefined
  if (typeof value.url !== "string" || value.url.length === 0) return undefined
  if (typeof value.poster === "string") return { type: value.type, url: value.url, poster: value.poster }
  return { type: value.type, url: value.url }
}

const parseBookmark = (value: unknown): Bookmark | undefined => {
  if (!isRecord(value)) return undefined
  if (typeof value.id !== "string" || value.id.length === 0) return undefined
  const mediaRaw = Array.isArray(value.media) ? value.media : []
  const media = mediaRaw.map(parseMedia).filter((item): item is Media => item !== undefined)
  const hashtags = Array.isArray(value.hashtags)
    ? value.hashtags.filter((tag): tag is string => typeof tag === "string")
    : []
  const urls = Array.isArray(value.urls)
    ? value.urls.filter((url): url is string => typeof url === "string")
    : []
  const quoted = value.quoted === undefined ? undefined : parseBookmark(value.quoted)
  const bookmark: Bookmark = {
    id: value.id,
    author: asString(value.author) || "Unknown",
    handle: asString(value.handle) || "unknown",
    avatar: asString(value.avatar),
    timestamp: asString(value.timestamp),
    text: asString(value.text),
    media,
    hashtags,
    urls,
  }
  if (quoted) return { ...bookmark, quoted }
  return bookmark
}

export const parseDump = (value: unknown): DumpParseResult<BookmarkDump> => {
  if (!isRecord(value)) return err("dump is not an object")
  if (value.schema !== DUMP_SCHEMA) return err("unsupported dump schema")
  if (value.source !== "bookmark") return err("unsupported dump source")
  if (typeof value.captured_at !== "string") return err("captured_at missing")
  if (!Array.isArray(value.bookmarks)) return err("bookmarks missing")
  const bookmarks: Array<Bookmark> = []
  for (const item of value.bookmarks) {
    const bookmark = parseBookmark(item)
    if (!bookmark) return err("bookmark row failed to parse")
    bookmarks.push(bookmark)
  }
  const raw_pages = Array.isArray(value.raw_pages) ? value.raw_pages : []
  return ok({
    schema: DUMP_SCHEMA,
    source: "bookmark",
    captured_at: value.captured_at,
    bookmarks,
    raw_pages,
  })
}
