import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { NodeFileSystem } from "@effect/platform-node"
import { describe, expect, it } from "vitest"
import { Effect, Layer } from "effect"
import { AppConfig } from "../src/config.ts"
import { layer as loggerLayer } from "../src/log.ts"

describe("file logger", () => {
  it("writes JSON lines to logFile", async () => {
    const dir = mkdtempSync(join(tmpdir(), "xkeep-log-"))
    try {
      await Effect.runPromise(
        Effect.scoped(
          Effect.log("file-logger-canary").pipe(
            Effect.provide(
              loggerLayer.pipe(
                Layer.provideMerge(
                  AppConfig.layer({
                    logDir: dir,
                    dataDir: dir,
                    cacheDir: dir,
                    configPath: join(dir, "missing.json"),
                  }).pipe(Layer.provideMerge(NodeFileSystem.layer)),
                ),
              ),
            ),
          ),
        ) as Effect.Effect<void>,
      )
      const text = readFileSync(join(dir, "xkeep.log"), "utf8")
      expect(text).toContain("file-logger-canary")
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
