import { blob, sqliteTable, text } from "drizzle-orm/sqlite-core"

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
})
