import type { Bookmark } from "../dump/parse-graphql.ts"

export const firstStillUrl = (bookmark: Bookmark): string | undefined => {
  const first = bookmark.media[0]
  if (first === undefined) return undefined
  if (first.type === "photo") return first.url
  return first.poster
}

export const stillExtension = (url: string): string => {
  const path = url.split("?")[0] ?? url
  const dot = path.lastIndexOf(".")
  if (dot < 0) return ".jpg"
  const ext = path.slice(dot).toLowerCase()
  if (ext === ".jpeg" || ext === ".jpg" || ext === ".png" || ext === ".webp" || ext === ".gif") {
    return ext
  }
  return ".jpg"
}

export const isAllowedStillUrl = (url: string): boolean => {
  if (!URL.canParse(url)) return false
  const parsed = new URL(url)
  if (parsed.protocol !== "https:") return false
  const host = parsed.hostname
  return host === "pbs.twimg.com" || host === "video.twimg.com" || host.endsWith(".twimg.com")
}
