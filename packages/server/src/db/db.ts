import { fileURLToPath } from "node:url"
import { layer as sqliteClientLayer } from "@effect/sql-sqlite-node/SqliteClient"
import * as SQLiteNodeDrizzle from "drizzle-orm/effect-sqlite-node"
import { migrate } from "drizzle-orm/effect-sqlite-node/migrator"
import { Effect, FileSystem, Layer } from "effect"
import { AppConfig } from "../config.ts"

const migrationsFolder = fileURLToPath(new URL("../../drizzle", import.meta.url))

const clientLayer = Layer.unwrap(
  Effect.gen(function* () {
    const config = yield* AppConfig
    const fs = yield* FileSystem.FileSystem
    yield* fs.makeDirectory(config.dataDir, { recursive: true })
    yield* fs.makeDirectory(config.mediaDir, { recursive: true })
    return sqliteClientLayer({ filename: config.sqlitePath })
  }),
)

const migrateLayer = Layer.effectDiscard(
  Effect.gen(function* () {
    const db = yield* SQLiteNodeDrizzle.makeWithDefaults()
    yield* migrate(db, { migrationsFolder })
  }),
).pipe(Layer.provide(clientLayer))

export const sqliteLayer = Layer.merge(clientLayer, migrateLayer)
