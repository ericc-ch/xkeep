import type { Bookmark } from "../schema.ts"

export const stillUrls = (bookmark: Bookmark): ReadonlyArray<string> => {
  const urls: Array<string> = []
  for (const item of bookmark.media) {
    if (item.type === "photo") {
      urls.push(item.url)
      continue
    }
    if (item.poster !== undefined) urls.push(item.poster)
  }
  return urls
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
