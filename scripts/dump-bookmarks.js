;(() => {
  const DUMP_SCHEMA = "x-bookmarks-dump/1"

  const boot = () => {
    if (!location.hostname.includes("x.com") && !location.hostname.includes("twitter.com")) {
      alert("Paste this on x.com (History / Bookmarks).")
      return
    }
    const onBookmarks =
      location.pathname.includes("/i/bookmarks") ||
      location.pathname.includes("/i/history") ||
      location.pathname.includes("/i/bookmark")
    if (!onBookmarks) {
      alert("Open History / Bookmarks, then paste again.")
      return
    }

    const isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value)
    const asString = (value) => (typeof value === "string" ? value : "")
    const asNumber = (value) => (typeof value === "number" ? value : 0)

    const unwrapTweet = (value) => {
      if (
        value.__typename === "TweetWithVisibilityResults" ||
        value.__typename === "TweetWithVisibilityResult"
      ) {
        return isRecord(value.tweet) ? value.tweet : value
      }
      return value
    }

    const isTweetRecord = (value) => {
      if (!isRecord(value)) return false
      const tweet = unwrapTweet(value)
      if (tweet.__typename === "User" || tweet.__typename === "TweetTombstone") return false
      if (typeof tweet.rest_id !== "string" || tweet.rest_id.length < 6) return false
      return isRecord(tweet.legacy)
    }

    const userFields = (tweet) => {
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

    const bestMp4 = (media) => {
      const info = isRecord(media.video_info) ? media.video_info : undefined
      const variants = info && Array.isArray(info.variants) ? info.variants : []
      const mp4s = variants
        .filter(isRecord)
        .filter(
          (variant) => variant.content_type === "video/mp4" && typeof variant.url === "string",
        )
        .sort((a, b) => asNumber(b.bitrate) - asNumber(a.bitrate))
      return mp4s[0]?.url || ""
    }

    const parseMediaList = (tweet) => {
      const legacy = isRecord(tweet.legacy) ? tweet.legacy : {}
      const extended = isRecord(legacy.extended_entities) ? legacy.extended_entities : undefined
      const entities = isRecord(legacy.entities) ? legacy.entities : undefined
      const raw = Array.isArray(extended?.media)
        ? extended.media
        : Array.isArray(entities?.media)
          ? entities.media
          : []
      const media = []
      for (const item of raw) {
        if (!isRecord(item)) continue
        const thumb = asString(item.media_url_https)
        if (item.type === "video" || item.type === "animated_gif") {
          const mp4 = bestMp4(item)
          const type = item.type === "animated_gif" ? "gif" : "video"
          if (mp4 && thumb) media.push({ type, url: mp4, poster: thumb })
          else if (mp4) media.push({ type, url: mp4 })
          else if (thumb) media.push({ type: "photo", url: thumb })
          continue
        }
        if (thumb) media.push({ type: "photo", url: thumb })
      }
      return media
    }

    const parseHashtags = (tweet) => {
      const legacy = isRecord(tweet.legacy) ? tweet.legacy : {}
      const entities = isRecord(legacy.entities) ? legacy.entities : undefined
      const tags = Array.isArray(entities?.hashtags) ? entities.hashtags : []
      return tags
        .filter(isRecord)
        .map((tag) => asString(tag.text))
        .filter(Boolean)
    }

    const parseUrls = (tweet) => {
      const legacy = isRecord(tweet.legacy) ? tweet.legacy : {}
      const entities = isRecord(legacy.entities) ? legacy.entities : undefined
      const urls = Array.isArray(entities?.urls) ? entities.urls : []
      return urls
        .filter(isRecord)
        .map((url) => asString(url.expanded_url))
        .filter(Boolean)
    }

    const tweetText = (tweet) => {
      const note = isRecord(tweet.note_tweet) ? tweet.note_tweet : undefined
      const noteResults =
        note && isRecord(note.note_tweet_results) ? note.note_tweet_results : undefined
      const noteInner = noteResults && isRecord(noteResults.result) ? noteResults.result : undefined
      const noteText = asString(noteInner?.text)
      if (noteText) return noteText
      const legacy = isRecord(tweet.legacy) ? tweet.legacy : {}
      return asString(legacy.full_text) || asString(legacy.text)
    }

    const toBookmark = (tweet, quoteDepth) => {
      const unwrapped = unwrapTweet(tweet)
      const user = userFields(unwrapped)
      const legacy = isRecord(unwrapped.legacy) ? unwrapped.legacy : {}
      const bookmark = {
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
      if (quotedWrap && isTweetRecord(quotedWrap.result)) {
        bookmark.quoted = toBookmark(quotedWrap.result, quoteDepth + 1)
      }
      return bookmark
    }

    const parseBookmarksFromGraphql = (pages) => {
      const seen = new Set()
      const out = []
      const collect = (value, depth) => {
        if (!value || typeof value !== "object" || depth > 16) return
        if (Array.isArray(value)) {
          for (const item of value) collect(item, depth + 1)
          return
        }
        if (isRecord(value.tweet_results) && isTweetRecord(value.tweet_results.result)) {
          const bookmark = toBookmark(value.tweet_results.result, 0)
          if (!seen.has(bookmark.id)) {
            seen.add(bookmark.id)
            out.push(bookmark)
          }
        }
        for (const [key, child] of Object.entries(value)) {
          if (key === "quoted_status_result") continue
          collect(child, depth + 1)
        }
      }
      for (const page of pages) collect(page, 0)
      return out
    }

    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

    const panel = document.createElement("div")
    Object.assign(panel.style, {
      position: "fixed",
      top: "12px",
      right: "12px",
      zIndex: "2147483647",
      padding: "10px 12px",
      background: "#18181b",
      color: "#fafafa",
      border: "1px solid #3f3f46",
      borderRadius: "8px",
      fontFamily: "system-ui,sans-serif",
      fontSize: "13px",
      boxShadow: "0 4px 16px rgba(0,0,0,.4)",
    })
    const status = document.createElement("div")
    status.textContent = "Installing hook…"
    const stopBtn = document.createElement("button")
    stopBtn.textContent = "Stop + download"
    Object.assign(stopBtn.style, {
      marginTop: "8px",
      padding: "6px 10px",
      background: "#4f46e5",
      color: "#fff",
      border: "none",
      borderRadius: "6px",
      cursor: "pointer",
      fontWeight: "600",
    })
    panel.append(status, stopBtn)
    document.body.appendChild(panel)

    const rawPages = []
    let autoScrolling = true

    const isBookmarksUrl = (url) => url.includes("/graphql/") && url.includes("/Bookmarks")

    const origFetch = window.fetch
    window.fetch = async function (...args) {
      const response = await origFetch.apply(this, args)
      try {
        const url = args[0] instanceof Request ? args[0].url : String(args[0])
        if (isBookmarksUrl(url)) {
          const contentType = response.headers.get("content-type") || ""
          if (contentType.includes("json")) rawPages.push(await response.clone().json())
        }
      } catch {}
      return response
    }

    const origOpen = XMLHttpRequest.prototype.open
    const origSend = XMLHttpRequest.prototype.send
    const xhrUrls = new WeakMap()
    XMLHttpRequest.prototype.open = function (...args) {
      xhrUrls.set(this, String(args[1] || ""))
      return origOpen.apply(this, args)
    }
    XMLHttpRequest.prototype.send = function (...args) {
      const xhr = this
      const url = xhrUrls.get(xhr) || ""
      if (isBookmarksUrl(url)) {
        xhr.addEventListener("load", () => {
          try {
            rawPages.push(JSON.parse(xhr.responseText))
          } catch {}
        })
      }
      return origSend.apply(this, args)
    }

    const count = () => parseBookmarksFromGraphql(rawPages).length

    const download = () => {
      window.fetch = origFetch
      XMLHttpRequest.prototype.open = origOpen
      XMLHttpRequest.prototype.send = origSend
      autoScrolling = false
      const bookmarks = parseBookmarksFromGraphql(rawPages)
      const dump = {
        schema: DUMP_SCHEMA,
        source: "bookmark",
        captured_at: new Date().toISOString(),
        bookmarks,
        raw_pages: rawPages,
      }
      const blob = new Blob([JSON.stringify(dump)], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = "x-bookmarks-dump.json"
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 2000)
      status.textContent = `Downloaded ${bookmarks.length} bookmarks`
      stopBtn.remove()
    }

    stopBtn.onclick = () => {
      autoScrolling = false
      download()
    }

    const run = async () => {
      status.textContent = `Scrolling… ${count()} captured`
      let stagnant = 0
      let lastCount = count()
      while (autoScrolling) {
        window.scrollTo(0, document.documentElement.scrollHeight)
        const col = document.querySelector('[data-testid="primaryColumn"]')
        if (col) col.scrollTo(0, col.scrollHeight)
        await sleep(900)
        const n = count()
        status.textContent = `Scrolling… ${n} captured`
        if (n > lastCount) {
          stagnant = 0
          lastCount = n
        } else {
          stagnant += 1
          if (stagnant >= 8) {
            window.scrollTo(0, document.documentElement.scrollHeight)
            await sleep(2000)
            if (count() === lastCount) break
            stagnant = 0
            lastCount = count()
          }
        }
      }
      if (autoScrolling) download()
    }

    void run()
  }

  if (document.body) boot()
  else document.addEventListener("DOMContentLoaded", boot)
})()
