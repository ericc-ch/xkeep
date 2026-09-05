import { randomUUID } from "node:crypto"
import { and, eq } from "drizzle-orm"
import { EffectDrizzleQueryError } from "drizzle-orm/effect-core/errors"
import * as SQLiteNodeDrizzle from "drizzle-orm/effect-sqlite-node"
import { Context, Effect, Layer } from "effect"
import { Bus } from "../bus.ts"
import { BookmarkNotFound, TagConflict, TagNotFound } from "../http/schema.ts"
import { sqliteLayer } from "./db.ts"
import { bookmarkTags, bookmarks, tags } from "./schema.ts"

const rootParent = ""

const asParentColumn = (parentId: string | undefined): string => parentId ?? rootParent

const tagRow = (id: string, name: string, parentId: string) =>
  parentId === rootParent ? { id, name } : { id, name, parentId }

const isUniqueFail = (error: unknown): boolean => {
  const text = error instanceof Error ? `${error.message} ${String((error as { cause?: unknown }).cause)}` : String(error)
  return text.toLowerCase().includes("unique")
}

const make = Effect.fn("Tags.make")(function* () {
  const db = yield* SQLiteNodeDrizzle.makeWithDefaults()
  const bus = yield* Bus
  const requireTag = Effect.fn("Tags.requireTag")(function* (id: string) {
    const rows = yield* db
      .select({ id: tags.id, name: tags.name, parentId: tags.parentId })
      .from(tags)
      .where(eq(tags.id, id))
    const row = rows[0]
    if (row === undefined) return yield* new TagNotFound({ id })
    return row
  })
  const requireBookmark = Effect.fn("Tags.requireBookmark")(function* (id: string) {
    const rows = yield* db.select({ id: bookmarks.id }).from(bookmarks).where(eq(bookmarks.id, id))
    if (rows[0] === undefined) return yield* new BookmarkNotFound({ id })
  })
  const assertSiblingFree = Effect.fn("Tags.assertSiblingFree")(function* (input: {
    readonly name: string
    readonly parentId: string
    readonly exceptId?: string | undefined
  }) {
    const rows = yield* db
      .select({ id: tags.id })
      .from(tags)
      .where(and(eq(tags.parentId, input.parentId), eq(tags.name, input.name)))
    const clash = rows.find((row) => row.id !== input.exceptId)
    if (clash !== undefined) {
      return yield* new TagConflict({ reason: "sibling name already exists" })
    }
  })
  const wouldCycle = Effect.fn("Tags.wouldCycle")(function* (id: string, parentId: string) {
    let current: string | undefined = parentId
    const seen = new Set<string>()
    while (current !== undefined && current !== rootParent) {
      if (current === id) return true
      if (seen.has(current)) return true
      seen.add(current)
      const rows: ReadonlyArray<{ readonly parentId: string }> = yield* db
        .select({ parentId: tags.parentId })
        .from(tags)
        .where(eq(tags.id, current))
      current = rows[0]?.parentId
    }
    return false
  })
  return {
    list: Effect.fn("Tags.list")(function* () {
      const rows = yield* db.select().from(tags)
      return rows.map((row) => tagRow(row.id, row.name, row.parentId))
    }),
    create: Effect.fn("Tags.create")(function* (input: {
      readonly name: string
      readonly parentId?: string | undefined
    }) {
      const parentId = asParentColumn(input.parentId)
      if (input.parentId !== undefined) yield* requireTag(input.parentId)
      yield* assertSiblingFree({ name: input.name, parentId })
      const id = randomUUID()
      yield* db
        .insert(tags)
        .values({ id, name: input.name, parentId })
        .pipe(Effect.catchIf(isUniqueFail, () => new TagConflict({ reason: "sibling name already exists" })))
      const created = tagRow(id, input.name, parentId)
      yield* bus.publish({ event: "tag.created", data: { id: created.id } })
      return created
    }),
    update: Effect.fn("Tags.update")(function* (
      id: string,
      patch: { readonly name?: string | undefined; readonly parentId?: string | null | undefined },
    ) {
      const current = yield* requireTag(id)
      const name = patch.name ?? current.name
      const parentId =
        patch.parentId === undefined ? current.parentId : asParentColumn(patch.parentId ?? undefined)
      if (parentId === id) return yield* new TagConflict({ reason: "tag cannot parent itself" })
      if (parentId !== rootParent) yield* requireTag(parentId)
      if (parentId !== rootParent && (yield* wouldCycle(id, parentId))) {
        return yield* new TagConflict({ reason: "tag cannot parent a descendant" })
      }
      yield* assertSiblingFree({ name, parentId, exceptId: id })
      yield* db
        .update(tags)
        .set({ name, parentId })
        .where(eq(tags.id, id))
        .pipe(Effect.catchIf(isUniqueFail, () => new TagConflict({ reason: "sibling name already exists" })))
      const updated = tagRow(id, name, parentId)
      yield* bus.publish({ event: "tag.updated", data: { id: updated.id } })
      return updated
    }),
    remove: Effect.fn("Tags.remove")(function* (id: string) {
      const current = yield* requireTag(id)
      yield* db
        .transaction((tx) =>
          Effect.gen(function* () {
            yield* tx.update(tags).set({ parentId: current.parentId }).where(eq(tags.parentId, id))
            yield* tx.delete(bookmarkTags).where(eq(bookmarkTags.tagId, id))
            yield* tx.delete(tags).where(eq(tags.id, id))
          }),
        )
        .pipe(
          Effect.catchTag(
            "SqlError",
            (cause) => new EffectDrizzleQueryError({ query: "Tags.remove", params: [id], cause }),
          ),
        )
      yield* bus.publish({ event: "tag.deleted", data: { id } })
    }),
    tagsFor: Effect.fn("Tags.tagsFor")(function* (bookmarkId: string) {
      const rows = yield* db
        .select({ tagId: bookmarkTags.tagId })
        .from(bookmarkTags)
        .where(eq(bookmarkTags.bookmarkId, bookmarkId))
      return rows.map((row) => row.tagId)
    }),
    replaceBookmarkTags: Effect.fn("Tags.replaceBookmarkTags")(function* (
      bookmarkId: string,
      tagIds: ReadonlyArray<string>,
    ) {
      yield* requireBookmark(bookmarkId)
      for (const tagId of tagIds) yield* requireTag(tagId)
      const before = yield* db
        .select({ tagId: bookmarkTags.tagId })
        .from(bookmarkTags)
        .where(eq(bookmarkTags.bookmarkId, bookmarkId))
      yield* db
        .transaction((tx) =>
          Effect.gen(function* () {
            yield* tx.delete(bookmarkTags).where(eq(bookmarkTags.bookmarkId, bookmarkId))
            if (tagIds.length === 0) return
            yield* tx.insert(bookmarkTags).values(tagIds.map((tagId) => ({ bookmarkId, tagId })))
          }),
        )
        .pipe(
          Effect.catchTag(
            "SqlError",
            (cause) =>
              new EffectDrizzleQueryError({ query: "Tags.replaceBookmarkTags", params: [bookmarkId], cause }),
          ),
        )
      const after = new Set(tagIds)
      for (const row of before) {
        if (!after.has(row.tagId)) {
          yield* bus.publish({ event: "bookmark.untagged", data: { id: bookmarkId, tagId: row.tagId } })
        }
      }
      const beforeSet = new Set(before.map((row) => row.tagId))
      for (const tagId of tagIds) {
        if (!beforeSet.has(tagId)) {
          yield* bus.publish({ event: "bookmark.tagged", data: { id: bookmarkId, tagId } })
        }
      }
    }),
    addBookmarkTag: Effect.fn("Tags.addBookmarkTag")(function* (bookmarkId: string, tagId: string) {
      yield* requireBookmark(bookmarkId)
      yield* requireTag(tagId)
      const existing = yield* db
        .select({ tagId: bookmarkTags.tagId })
        .from(bookmarkTags)
        .where(and(eq(bookmarkTags.bookmarkId, bookmarkId), eq(bookmarkTags.tagId, tagId)))
      if (existing[0] !== undefined) return
      const added = yield* db.insert(bookmarkTags).values({ bookmarkId, tagId }).pipe(
        Effect.as(true),
        Effect.catchIf(isUniqueFail, () => Effect.succeed(false)),
      )
      if (added) {
        yield* bus.publish({ event: "bookmark.tagged", data: { id: bookmarkId, tagId } })
      }
    }),
    removeBookmarkTag: Effect.fn("Tags.removeBookmarkTag")(function* (bookmarkId: string, tagId: string) {
      yield* requireBookmark(bookmarkId)
      yield* requireTag(tagId)
      const existing = yield* db
        .select({ tagId: bookmarkTags.tagId })
        .from(bookmarkTags)
        .where(and(eq(bookmarkTags.bookmarkId, bookmarkId), eq(bookmarkTags.tagId, tagId)))
      if (existing[0] === undefined) return
      yield* db
        .delete(bookmarkTags)
        .where(and(eq(bookmarkTags.bookmarkId, bookmarkId), eq(bookmarkTags.tagId, tagId)))
      yield* bus.publish({ event: "bookmark.untagged", data: { id: bookmarkId, tagId } })
    }),
  }
})

export class Tags extends Context.Service<Tags>()("Tags", { make }) {
  static layer = Layer.effect(this, this.make()).pipe(Layer.provide(sqliteLayer))
}

export const layer = Tags.layer
