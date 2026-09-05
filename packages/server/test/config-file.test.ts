import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import envPaths from "env-paths"
import { NodeFileSystem } from "@effect/platform-node"
import { describe, expect, it } from "vitest"
import { Effect, Layer } from "effect"
import { AppConfig, type AppConfigOverrides } from "../src/config.ts"

const paths = envPaths("xkeep", { suffix: "" })

const writeConfig = (dir: string, content: unknown) => {
  const configPath = join(dir, "config.json")
  writeFileSync(configPath, JSON.stringify(content))
  return configPath
}

const load = (overrides: AppConfigOverrides) =>
  Effect.runPromise(
    AppConfig.pipe(
      Effect.provide(AppConfig.layer(overrides).pipe(Layer.provide(NodeFileSystem.layer))),
    ),
  )

const failureReason = async (overrides: AppConfigOverrides) => {
  try {
    await load(overrides)
  } catch (error) {
    expect((error as { _tag: string })._tag).toBe("ConfigError")
    return (error as { readonly reason: string }).reason
  }
  throw new Error("expected config load to fail")
}

const withDir = async (body: (dir: string) => Promise<void>) => {
  const dir = mkdtempSync(join(tmpdir(), "xkeep-config-"))
  try {
    await body(dir)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

describe("AppConfig config file", () => {
  it("uses built-in defaults when the file is missing", async () => {
    await withDir(async (dir) => {
      const config = await load({ configPath: join(dir, "missing.json") })
      expect(config).toMatchObject({
        host: "127.0.0.1",
        port: 5337,
        llamaPort: 8913,
        dataDir: paths.data,
        cacheDir: paths.cache,
        logDir: paths.log,
        logFile: `${paths.log}/xkeep.log`,
      })
    })
  })

  it("treats an empty object file as defaults", async () => {
    await withDir(async (dir) => {
      const config = await load({ configPath: writeConfig(dir, {}) })
      expect(config).toMatchObject({
        host: "127.0.0.1",
        port: 5337,
        llamaPort: 8913,
        dataDir: paths.data,
        cacheDir: paths.cache,
        logDir: paths.log,
        logFile: `${paths.log}/xkeep.log`,
      })
    })
  })

  it("takes values from the file and derives paths", async () => {
    await withDir(async (dir) => {
      const configPath = writeConfig(dir, {
        listen: { host: "127.0.0.2", port: 9000 },
        paths: { data: "/tmp/cfg-data", cache: "/tmp/cfg-cache", log: "/tmp/cfg-log" },
        llama: { port: 9001 },
      })
      const config = await load({ configPath })
      expect(config).toMatchObject({
        host: "127.0.0.2",
        port: 9000,
        llamaPort: 9001,
        dataDir: "/tmp/cfg-data",
        cacheDir: "/tmp/cfg-cache",
        logDir: "/tmp/cfg-log",
      })
      expect(config.logFile).toBe("/tmp/cfg-log/xkeep.log")
      expect(config.sqlitePath).toBe("/tmp/cfg-data/xkeep.sqlite")
      expect(config.mediaDir).toBe("/tmp/cfg-data/media")
      expect(config.ggufDir).toBe("/tmp/cfg-cache/gguf")
      expect(config.llamaBaseUrl).toBe("http://127.0.0.1:9001")
    })
  })

  it("flags beat the file", async () => {
    await withDir(async (dir) => {
      const configPath = writeConfig(dir, {
        listen: { host: "127.0.0.2", port: 9000 },
        paths: { data: "/tmp/cfg-data" },
      })
      const config = await load({
        configPath,
        host: "127.0.0.3",
        port: 9200,
        dataDir: "/tmp/flag-data",
        logDir: "/tmp/flag-log",
      })
      expect(config.host).toBe("127.0.0.3")
      expect(config.port).toBe(9200)
      expect(config.dataDir).toBe("/tmp/flag-data")
      expect(config.logDir).toBe("/tmp/flag-log")
      expect(config.logFile).toBe("/tmp/flag-log/xkeep.log")
    })
  })

  it("fails naming an unknown top-level key", async () => {
    await withDir(async (dir) => {
      const reason = await failureReason({ configPath: writeConfig(dir, { bogus: true }) })
      expect(reason).toContain("bogus")
    })
  })

  it("fails with a dotted path for an unknown nested key", async () => {
    await withDir(async (dir) => {
      const reason = await failureReason({
        configPath: writeConfig(dir, { listen: { prot: 8787 } }),
      })
      expect(reason).toContain("listen.prot")
    })
  })

  it("fails on invalid json", async () => {
    await withDir(async (dir) => {
      const configPath = join(dir, "config.json")
      writeFileSync(configPath, "{not json")
      const reason = await failureReason({ configPath })
      expect(reason).toContain("not valid json")
    })
  })

  it("fails on an out-of-range port from the file", async () => {
    await withDir(async (dir) => {
      const reason = await failureReason({
        configPath: writeConfig(dir, { listen: { port: 70000 } }),
      })
      expect(reason).toContain("listen.port")
      expect(reason).toContain("70000")
    })
  })

  it("fails with a dotted path for a mistyped port from the file", async () => {
    await withDir(async (dir) => {
      const reason = await failureReason({
        configPath: writeConfig(dir, { listen: { port: "8787" } }),
      })
      expect(reason).toContain("listen.port")
    })
  })

  it("fails on a non-integer port from the file", async () => {
    await withDir(async (dir) => {
      const reason = await failureReason({
        configPath: writeConfig(dir, { listen: { port: 8787.5 } }),
      })
      expect(reason).toContain("listen.port")
    })
  })

  it("fails naming the key for an invalid flag port", async () => {
    await withDir(async (dir) => {
      for (const port of [0, 70000]) {
        const reason = await failureReason({ configPath: join(dir, "missing.json"), port })
        expect(reason).toContain("listen.port")
        expect(reason).toContain(String(port))
      }
    })
  })

  it("fails naming the key for an invalid llama port", async () => {
    await withDir(async (dir) => {
      const reason = await failureReason({
        configPath: writeConfig(dir, { llama: { port: 0 } }),
      })
      expect(reason).toContain("llama.port")
    })
  })

  it("fails on a blank host from the file", async () => {
    await withDir(async (dir) => {
      for (const host of ["", "   "]) {
        const reason = await failureReason({
          configPath: writeConfig(dir, { listen: { host } }),
        })
        expect(reason).toContain("listen.host")
      }
    })
  })

  it("fails on a blank log dir from the file", async () => {
    await withDir(async (dir) => {
      const reason = await failureReason({
        configPath: writeConfig(dir, { paths: { log: "" } }),
      })
      expect(reason).toContain("paths.log")
    })
  })

  it("fails on a blank data dir from the file", async () => {
    await withDir(async (dir) => {
      const reason = await failureReason({
        configPath: writeConfig(dir, { paths: { data: "" } }),
      })
      expect(reason).toContain("paths.data")
    })
  })

  it("fails on a blank cache dir from a flag", async () => {
    await withDir(async (dir) => {
      const reason = await failureReason({
        configPath: join(dir, "missing.json"),
        cacheDir: "  ",
      })
      expect(reason).toContain("paths.cache")
    })
  })

  it("fails when the config path is not readable", async () => {
    await withDir(async (dir) => {
      const reason = await failureReason({ configPath: dir })
      expect(reason).toContain("not readable")
    })
  })
})
