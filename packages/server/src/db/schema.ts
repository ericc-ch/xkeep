import { blob, primaryKey, real, sqliteTable, text } from "drizzle-orm/sqlite-core"

export const bookmarks = sqliteTable("bookmarks", {
  id: text("id").primaryKey(),
  author: text("author").notNull(),
  handle: text("handle").notNull(),
  avatar: text("avatar").notNull(),
  text: text("text").notNull(),
  timestamp: text("timestamp").notNull(),
  mediaJson: text("media_json").notNull(),
  hashtagsJson: text("hashtags_json").notNull(),
  urlsJson: text("urls_json").notNull(),
  quotedJson: text("quoted_json"),
  stillPaths: text("still_paths"),
  embedding: blob("embedding", { mode: "buffer" }),
  projX: real("proj_x"),
  projY: real("proj_y"),
})

export const bookmarkTags = sqliteTable(
  "bookmark_tags",
  {
    bookmarkId: text("bookmark_id").notNull(),
    tag: text("tag").notNull(),
  },
  (table) => [primaryKey({ columns: [table.bookmarkId, table.tag] })],
)

export const deletedBookmarks = sqliteTable("deleted_bookmarks", {
  bookmarkId: text("bookmark_id").primaryKey(),
  deletedAt: text("deleted_at").notNull(),
})
