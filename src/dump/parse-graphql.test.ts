import { describe, expect, it } from "vitest"

import { parseBookmarksFromGraphql, parseDump } from "./parse-graphql.ts"

const photoTweet = {
  __typename: "Tweet",
  rest_id: "1000001",
  core: {
    user_results: {
      result: {
        __typename: "User",
        avatar: { image_url: "https://pbs.twimg.com/profile.jpg" },
        core: { name: "Ada", screen_name: "ada" },
      },
    },
  },
  legacy: {
    created_at: "Mon Aug 31 14:53:38 +0000 2026",
    full_text: "hello https://t.co/aaa",
    entities: {
      hashtags: [{ text: "hi" }],
      urls: [{ expanded_url: "https://example.com" }],
      media: [],
    },
    extended_entities: {
      media: [
        {
          type: "photo",
          media_url_https: "https://pbs.twimg.com/media/photo.png",
        },
      ],
    },
  },
}

const videoTweet = {
  __typename: "Tweet",
  rest_id: "1000002",
  core: {
    user_results: {
      result: {
        core: { name: "Bea", screen_name: "bea" },
      },
    },
  },
  legacy: {
    created_at: "Mon Aug 31 15:00:00 +0000 2026",
    full_text: "clip",
    entities: { hashtags: [], urls: [] },
    extended_entities: {
      media: [
        {
          type: "video",
          media_url_https: "https://pbs.twimg.com/media/poster.jpg",
          video_info: {
            variants: [
              { content_type: "application/x-mpegURL", url: "https://video.twimg.com/a.m3u8" },
              {
                content_type: "video/mp4",
                bitrate: 256000,
                url: "https://video.twimg.com/low.mp4",
              },
              {
                content_type: "video/mp4",
                bitrate: 2176000,
                url: "https://video.twimg.com/high.mp4",
              },
            ],
          },
        },
      ],
    },
  },
}

const quoteTweet = {
  __typename: "Tweet",
  rest_id: "1000003",
  core: {
    user_results: {
      result: {
        core: { name: "Cara", screen_name: "cara" },
      },
    },
  },
  legacy: {
    created_at: "Mon Aug 31 16:00:00 +0000 2026",
    full_text: "why the long face",
    is_quote_status: true,
    quoted_status_id_str: "1000004",
    entities: { hashtags: [], urls: [] },
    extended_entities: {
      media: [{ type: "photo", media_url_https: "https://pbs.twimg.com/media/outer.png" }],
    },
  },
  quoted_status_result: {
    result: {
      __typename: "Tweet",
      rest_id: "1000004",
      core: {
        user_results: {
          result: {
            core: { name: "Dee", screen_name: "dee" },
          },
        },
      },
      legacy: {
        created_at: "Mon Aug 31 15:30:00 +0000 2026",
        full_text: "inner",
        entities: { hashtags: [], urls: [] },
        extended_entities: {
          media: [
            { type: "photo", media_url_https: "https://pbs.twimg.com/media/q1.jpg" },
            { type: "photo", media_url_https: "https://pbs.twimg.com/media/q2.jpg" },
          ],
        },
      },
    },
  },
}

const graphqlPage = {
  data: {
    bookmark_timeline_v2: {
      timeline: {
        instructions: [
          {
            entries: [
              { content: { itemContent: { tweet_results: { result: photoTweet } } } },
              { content: { itemContent: { tweet_results: { result: videoTweet } } } },
              { content: { itemContent: { tweet_results: { result: quoteTweet } } } },
            ],
          },
        ],
      },
    },
  },
}

describe("parseBookmarksFromGraphql", () => {
  it("reads photo, highest-bitrate mp4, and nested quote media as urls", () => {
    const bookmarks = parseBookmarksFromGraphql([graphqlPage])
    expect(bookmarks.map((b) => b.id)).toEqual(["1000001", "1000002", "1000003"])
    expect(bookmarks[0]).toMatchObject({
      handle: "ada",
      author: "Ada",
      text: "hello https://t.co/aaa",
      media: [{ type: "photo", url: "https://pbs.twimg.com/media/photo.png" }],
      hashtags: ["hi"],
      urls: ["https://example.com"],
    })
    expect(bookmarks[1]?.media).toEqual([
      {
        type: "video",
        url: "https://video.twimg.com/high.mp4",
        poster: "https://pbs.twimg.com/media/poster.jpg",
      },
    ])
    expect(bookmarks[2]?.quoted).toMatchObject({
      id: "1000004",
      handle: "dee",
      text: "inner",
      media: [
        { type: "photo", url: "https://pbs.twimg.com/media/q1.jpg" },
        { type: "photo", url: "https://pbs.twimg.com/media/q2.jpg" },
      ],
    })
  })

  it("does not also list the quoted tweet as its own bookmark", () => {
    const bookmarks = parseBookmarksFromGraphql([graphqlPage])
    expect(bookmarks.some((b) => b.id === "1000004")).toBe(false)
  })
})

describe("parseDump", () => {
  it("accepts a v1 dump object", () => {
    const bookmarks = parseBookmarksFromGraphql([graphqlPage])
    const parsed = parseDump({
      schema: "x-bookmarks-dump/1",
      source: "bookmark",
      captured_at: "2026-09-01T00:00:00.000Z",
      bookmarks,
      raw_pages: [graphqlPage],
    })
    expect(parsed._tag).toBe("ok")
    if (parsed._tag !== "ok") return
    expect(parsed.value.bookmarks).toHaveLength(3)
    expect(parsed.value.raw_pages).toHaveLength(1)
  })

  it("rejects a missing schema", () => {
    const parsed = parseDump({ bookmarks: [] })
    expect(parsed._tag).toBe("err")
  })
})
