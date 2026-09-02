import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import envPaths from "env-paths"
import { describe, expect, it } from "vitest"
import { Effect } from "effect"
import { AppConfig, type AppConfigOverrides } from "../src/config.ts"

const paths = envPaths("x-bookmarks", { suffix: "" })

const CONFIG_ENV_KEYS = [
  "X_BOOKMARKS_HOST",
  "X_BOOKMARKS_PORT",
  "X_BOOKMARKS_DATA_DIR",
  "X_BOOKMARKS_CACHE_DIR",
  "X_BOOKMARKS_LLAMA_PORT",
] as const

const makeConfigDir = (): string => mkdtempSync(join(tmpdir(), "x-bookmarks-config-"))

const writeConfig = (dir: string, content: unknown): string => {
  const configPath = join(dir, "config.json")
  writeFileSync(configPath, JSON.stringify(content))
  return configPath
}

const load = (overrides: AppConfigOverrides): Promise<{
  host: string
  port: number
  llamaPort: number
  dataDir: string
  cacheDir: string
}> =>
  Effect.runPromise(
    Effect.gen(function* () {
      const config = yield* AppConfig
      return {
        host: config.host,
        port: config.port,
        llamaPort: config.llamaPort,
        dataDir: config.dataDir,
        cacheDir: config.cacheDir,
      }
    }).pipe(Effect.provide(AppConfig.layer(overrides))),
  )

const failureReason = async (overrides: AppConfigOverrides): Promise<string> => {
  try {
    await load(overrides)
  } catch (error) {
    expect((error as { _tag: string })._tag).toBe("ConfigError")
    return (error as { readonly reason: string }).reason
  }
  throw new Error("expected config load to fail")
}

const withEnv = async (
  env: Record<string, string | undefined>,
  body: () => Promise<void>,
): Promise<void> => {
  const merged: Record<string, string | undefined> = {
    ...Object.fromEntries(CONFIG_ENV_KEYS.map((key) => [key, undefined])),
    ...env,
  }
  const saved = Object.fromEntries(Object.keys(merged).map((key) => [key, process.env[key]]))
  const setEnv = (key: string, value: string | undefined) => {
    if (value === undefined) Reflect.deleteProperty(process.env, key)
    else process.env[key] = value
  }
  for (const [key, value] of Object.entries(merged)) setEnv(key, value)
  try {
    await body()
  } finally {
    for (const [key, value] of Object.entries(saved)) setEnv(key, value)
  }
}

describe("AppConfig config file", () => {
  it("uses built-in defaults when the file is missing", async () => {
    await withEnv({}, async () => {
      const dir = makeConfigDir()
      try {
        const config = await load({ configPath: join(dir, "missing.json") })
        expect(config).toEqual({
          host: "127.0.0.1",
          port: 8787,
          llamaPort: 8913,
          dataDir: paths.data,
          cacheDir: paths.cache,
        })
      } finally {
        rmSync(dir, { recursive: true, force: true })
      }
    })
  })

  it("takes values from the file", async () => {
    await withEnv({}, async () => {
      const dir = makeConfigDir()
      try {
        const configPath = writeConfig(dir, {
          listen: { host: "127.0.0.2", port: 9000 },
          paths: { data: "/tmp/cfg-data", cache: "/tmp/cfg-cache" },
          llama: { port: 9001 },
        })
        const config = await load({ configPath })
        expect(config).toEqual({
          host: "127.0.0.2",
          port: 9000,
          llamaPort: 9001,
          dataDir: "/tmp/cfg-data",
          cacheDir: "/tmp/cfg-cache",
        })
      } finally {
        rmSync(dir, { recursive: true, force: true })
      }
    })
  })

  it("env vars beat the file", async () => {
    await withEnv(
      { X_BOOKMARKS_DATA_DIR: "/tmp/env-data", X_BOOKMARKS_PORT: "9100" },
      async () => {
        const dir = makeConfigDir()
        try {
          const configPath = writeConfig(dir, {
            listen: { port: 9000 },
            paths: { data: "/tmp/cfg-data" },
          })
          const config = await load({ configPath })
          expect(config.port).toBe(9100)
          expect(config.dataDir).toBe("/tmp/env-data")
        } finally {
          rmSync(dir, { recursive: true, force: true })
        }
      },
    )
  })

  it("flags beat env and the file", async () => {
    await withEnv({ X_BOOKMARKS_DATA_DIR: "/tmp/env-data" }, async () => {
      const dir = makeConfigDir()
      try {
        const configPath = writeConfig(dir, {
          listen: { port: 9000 },
          paths: { data: "/tmp/cfg-data" },
        })
        const config = await load({ configPath, port: 9200, dataDir: "/tmp/flag-data" })
        expect(config.port).toBe(9200)
        expect(config.dataDir).toBe("/tmp/flag-data")
      } finally {
        rmSync(dir, { recursive: true, force: true })
      }
    })
  })

  it("empty-string env vars count as unset", async () => {
    await withEnv(
      { X_BOOKMARKS_DATA_DIR: "", X_BOOKMARKS_PORT: "" },
      async () => {
        const dir = makeConfigDir()
        try {
          const configPath = writeConfig(dir, {
            listen: { port: 9000 },
            paths: { data: "/tmp/cfg-data" },
          })
          const config = await load({ configPath })
          expect(config.port).toBe(9000)
          expect(config.dataDir).toBe("/tmp/cfg-data")
        } finally {
          rmSync(dir, { recursive: true, force: true })
        }
      },
    )
  })

  it("fails naming an unknown top-level key", async () => {
    await withEnv({}, async () => {
      const dir = makeConfigDir()
      try {
        const configPath = writeConfig(dir, { bogus: true })
        const reason = await failureReason({ configPath })
        expect(reason).toContain("bogus")
      } finally {
        rmSync(dir, { recursive: true, force: true })
      }
    })
  })

  it("fails naming an unknown nested key", async () => {
    await withEnv({}, async () => {
      const dir = makeConfigDir()
      try {
        const configPath = writeConfig(dir, { listen: { prot: 8787 } })
        const reason = await failureReason({ configPath })
        expect(reason).toContain("prot")
      } finally {
        rmSync(dir, { recursive: true, force: true })
      }
    })
  })

  it("fails on invalid json", async () => {
    await withEnv({}, async () => {
      const dir = makeConfigDir()
      try {
        const configPath = join(dir, "config.json")
        writeFileSync(configPath, "{not json")
        const reason = await failureReason({ configPath })
        expect(reason).toContain("not valid json")
      } finally {
        rmSync(dir, { recursive: true, force: true })
      }
    })
  })

  it("fails on an out-of-range port from the file", async () => {
    await withEnv({}, async () => {
      const dir = makeConfigDir()
      try {
        const configPath = writeConfig(dir, { listen: { port: 70000 } })
        const reason = await failureReason({ configPath })
        expect(reason).toContain("listen.port")
        expect(reason).toContain("70000")
      } finally {
        rmSync(dir, { recursive: true, force: true })
      }
    })
  })

  it("fails on a string port from the file", async () => {
    await withEnv({}, async () => {
      const dir = makeConfigDir()
      try {
        const configPath = writeConfig(dir, { listen: { port: "8787" } })
        const reason = await failureReason({ configPath })
        expect(reason).toContain('["listen"]["port"]')
      } finally {
        rmSync(dir, { recursive: true, force: true })
      }
    })
  })

  it("fails naming the key for an invalid env port", async () => {
    await withEnv({ X_BOOKMARKS_PORT: "abc" }, async () => {
      const dir = makeConfigDir()
      try {
        const reason = await failureReason({ configPath: join(dir, "missing.json") })
        expect(reason).toContain("listen.port")
        expect(reason).toContain("abc")
      } finally {
        rmSync(dir, { recursive: true, force: true })
      }
    })
  })

  it("fails on a blank host from the file", async () => {
    await withEnv({}, async () => {
      const dir = makeConfigDir()
      try {
        for (const host of ["", "   "]) {
          const configPath = writeConfig(dir, { listen: { host } })
          const reason = await failureReason({ configPath })
          expect(reason).toContain("listen.host")
        }
      } finally {
        rmSync(dir, { recursive: true, force: true })
      }
    })
  })

  it("fails on a blank data dir from the file", async () => {
    await withEnv({}, async () => {
      const dir = makeConfigDir()
      try {
        const configPath = writeConfig(dir, { paths: { data: "" } })
        const reason = await failureReason({ configPath })
        expect(reason).toContain("paths.data")
      } finally {
        rmSync(dir, { recursive: true, force: true })
      }
    })
  })

  it("fails on a blank cache dir from a flag", async () => {
    await withEnv({}, async () => {
      const dir = makeConfigDir()
      try {
        const reason = await failureReason({
          configPath: join(dir, "missing.json"),
          cacheDir: "  ",
        })
        expect(reason).toContain("paths.cache")
      } finally {
        rmSync(dir, { recursive: true, force: true })
      }
    })
  })

  it("fails when the config path is not readable", async () => {
    await withEnv({}, async () => {
      const dir = makeConfigDir()
      try {
        const reason = await failureReason({ configPath: dir })
        expect(reason).toContain("not readable")
      } finally {
        rmSync(dir, { recursive: true, force: true })
      }
    })
  })
})
