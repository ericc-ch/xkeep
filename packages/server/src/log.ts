import { Effect, FileSystem, Layer, Logger } from "effect"
import { AppConfig } from "./config.ts"

export const layer = Layer.unwrap(
  Effect.gen(function* () {
    const config = yield* AppConfig
    const fs = yield* FileSystem.FileSystem
    yield* fs.makeDirectory(config.logDir, { recursive: true })
    return Logger.layer([Logger.toFile(Logger.formatJson, config.logFile)], {
      mergeWithExisting: true,
    })
  }),
)
