import { and, eq, inArray, sql } from "drizzle-orm"
import { EffectDrizzleQueryError } from "drizzle-orm/effect-core/errors"
import * as SQLiteNodeDrizzle from "drizzle-orm/effect-sqlite-node"
import { Context, Effect, Layer } from "effect"
import { Bus } from "../bus.ts"
import { BookmarkNotFound } from "../http/schema.ts"
import { sqliteLayer } from "./db.ts"
import { bookmarkTags, bookmarks } from "./schema.ts"

const make = Effect.fn("Tags.make")(function* () {
  const db = yield* SQLiteNodeDrizzle.makeWithDefaults()
  const bus = yield* Bus
  const requireBookmark = Effect.fn("Tags.requireBookmark")(function* (id: string) {
    const rows = yield* db.select({ id: bookmarks.id }).from(bookmarks).where(eq(bookmarks.id, id))
    if (rows[0] === undefined) return yield* new BookmarkNotFound({ id })
  })
  const linksFor = Effect.fn("Tags.linksFor")(function* (bookmarkId: string) {
    return yield* db
      .select({ tag: bookmarkTags.tag })
      .from(bookmarkTags)
      .where(eq(bookmarkTags.bookmarkId, bookmarkId))
  })
  const wrap = (query: string, params: ReadonlyArray<string>, cause: unknown) =>
    new EffectDrizzleQueryError({ query, params: [...params], cause })
  return {
    list: Effect.fn("Tags.list")(function* () {
      const rows = yield* db
        .select({ tag: bookmarkTags.tag, count: sql<number>`count(*)` })
        .from(bookmarkTags)
        .groupBy(bookmarkTags.tag)
        .orderBy(bookmarkTags.tag)
      return rows
    }),
    tagsFor: Effect.fn("Tags.tagsFor")(function* (bookmarkId: string) {
      const rows = yield* db
        .select({ tag: bookmarkTags.tag })
        .from(bookmarkTags)
        .where(eq(bookmarkTags.bookmarkId, bookmarkId))
        .orderBy(bookmarkTags.tag)
      return rows.map((row) => row.tag)
    }),
    replaceBookmarkTags: Effect.fn("Tags.replaceBookmarkTags")(function* (
      bookmarkId: string,
      tags: ReadonlyArray<string>,
    ) {
      yield* requireBookmark(bookmarkId)
      const before = yield* linksFor(bookmarkId)
      yield* db
        .transaction((tx) =>
          Effect.gen(function* () {
            yield* tx.delete(bookmarkTags).where(eq(bookmarkTags.bookmarkId, bookmarkId))
            if (tags.length === 0) return
            yield* tx.insert(bookmarkTags).values(tags.map((tag) => ({ bookmarkId, tag })))
          }),
        )
        .pipe(
          Effect.catchTag("SqlError", (cause) =>
            wrap("Tags.replaceBookmarkTags", [bookmarkId], cause),
          ),
        )
      const after = new Set(tags)
      const beforeSet = new Set(before.map((row) => row.tag))
      for (const row of before) {
        if (!after.has(row.tag)) {
          yield* bus.publish({ event: "bookmark.untagged", data: { id: bookmarkId, tag: row.tag } })
        }
      }
      for (const tag of tags) {
        if (!beforeSet.has(tag)) {
          yield* bus.publish({ event: "bookmark.tagged", data: { id: bookmarkId, tag } })
        }
      }
    }),
    addBookmarkTag: Effect.fn("Tags.addBookmarkTag")(function* (bookmarkId: string, tag: string) {
      yield* requireBookmark(bookmarkId)
      const inserted = yield* db
        .insert(bookmarkTags)
        .values({ bookmarkId, tag })
        .onConflictDoNothing()
        .returning({ bookmarkId: bookmarkTags.bookmarkId })
      if (inserted.length > 0) {
        yield* bus.publish({ event: "bookmark.tagged", data: { id: bookmarkId, tag } })
      }
    }),
    removeBookmarkTag: Effect.fn("Tags.removeBookmarkTag")(function* (
      bookmarkId: string,
      tag: string,
    ) {
      yield* requireBookmark(bookmarkId)
      const existing = yield* db
        .select({ tag: bookmarkTags.tag })
        .from(bookmarkTags)
        .where(and(eq(bookmarkTags.bookmarkId, bookmarkId), eq(bookmarkTags.tag, tag)))
      if (existing[0] === undefined) return
      yield* db
        .delete(bookmarkTags)
        .where(and(eq(bookmarkTags.bookmarkId, bookmarkId), eq(bookmarkTags.tag, tag)))
      yield* bus.publish({ event: "bookmark.untagged", data: { id: bookmarkId, tag } })
    }),
    applyToMembers: Effect.fn("Tags.applyToMembers")(function* (
      memberIds: ReadonlyArray<string>,
      tag: string,
    ) {
      if (memberIds.length === 0) return { tagged: 0 }
      const members = yield* db
        .select({ id: bookmarks.id })
        .from(bookmarks)
        .where(inArray(bookmarks.id, [...memberIds]))
      const found = new Set(members.map((row) => row.id))
      const missing = memberIds.find((id) => !found.has(id))
      if (missing !== undefined) return yield* new BookmarkNotFound({ id: missing })
      const existing = yield* db
        .select({ bookmarkId: bookmarkTags.bookmarkId })
        .from(bookmarkTags)
        .where(and(eq(bookmarkTags.tag, tag), inArray(bookmarkTags.bookmarkId, [...memberIds])))
      const hasTag = new Set(existing.map((row) => row.bookmarkId))
      const fresh = [...memberIds].filter((id) => !hasTag.has(id))
      if (fresh.length === 0) return { tagged: 0 }
      yield* db.insert(bookmarkTags).values(fresh.map((bookmarkId) => ({ bookmarkId, tag })))
      for (const bookmarkId of fresh) {
        yield* bus.publish({ event: "bookmark.tagged", data: { id: bookmarkId, tag } })
      }
      return { tagged: fresh.length }
    }),
    renameTag: Effect.fn("Tags.renameTag")(function* (from: string, to: string) {
      const affected = yield* db
        .select({ bookmarkId: bookmarkTags.bookmarkId })
        .from(bookmarkTags)
        .where(eq(bookmarkTags.tag, from))
      if (affected.length === 0 || from === to) return { tag: to, count: 0 }
      const ids = affected.map((row) => row.bookmarkId)
      yield* db
        .transaction((tx) =>
          Effect.gen(function* () {
            yield* tx
              .delete(bookmarkTags)
              .where(and(eq(bookmarkTags.tag, to), inArray(bookmarkTags.bookmarkId, ids)))
            yield* tx.update(bookmarkTags).set({ tag: to }).where(eq(bookmarkTags.tag, from))
          }),
        )
        .pipe(Effect.catchTag("SqlError", (cause) => wrap("Tags.renameTag", [from, to], cause)))
      for (const bookmarkId of ids) {
        yield* bus.publish({ event: "bookmark.untagged", data: { id: bookmarkId, tag: from } })
        yield* bus.publish({ event: "bookmark.tagged", data: { id: bookmarkId, tag: to } })
      }
      return { tag: to, count: ids.length }
    }),
  }
})

export class Tags extends Context.Service<Tags>()("Tags", { make }) {
  static layer = Layer.effect(this, this.make()).pipe(Layer.provide(sqliteLayer))
}

export const layer = Tags.layer
