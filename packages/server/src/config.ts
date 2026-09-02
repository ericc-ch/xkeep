import envPaths from "env-paths"
import { NodeFileSystem } from "@effect/platform-node"
import { Context, Data, Effect, FileSystem, Layer, Schema } from "effect"

const APP_NAME = "x-bookmarks"

export const LLAMA_BUILD = "b10752"
export const LLAMA_PORT_DEFAULT = 8913
export const HTTP_PORT_DEFAULT = 8787
export const HTTP_HOST_DEFAULT = "127.0.0.1"
export const IMAGE_MAX_TOKENS = 256
export const EMBED_DIMS = 2048
export const MEDIA_MARKER = "<__media__>"
export const DOC_SYSTEM = "Represent the user's input."
export const QUERY_SYSTEM =
  "Given a social media post bookmarked by the user, retrieve posts relevant to the query."

export class ConfigError extends Data.TaggedError("ConfigError")<{
  readonly reason: string
}> {}

const decodePort = (
  key: string,
  raw: number | string | undefined,
  fallback: number,
): Effect.Effect<number, ConfigError> => {
  if (raw === undefined || raw === "") return Effect.succeed(fallback)
  const n = typeof raw === "number" ? raw : Number(raw)
  if (!Number.isInteger(n) || n < 1 || n > 65535) {
    return Effect.fail(new ConfigError({ reason: `invalid port for ${key}: ${String(raw)}` }))
  }
  return Effect.succeed(n)
}

const envValue = (key: string): string | undefined => {
  const value = process.env[key]
  return value === "" ? undefined : value
}

const ConfigFileSchema = Schema.Struct({
  listen: Schema.optional(
    Schema.Struct({
      host: Schema.optional(Schema.String),
      port: Schema.optional(Schema.Number),
    }),
  ),
  paths: Schema.optional(
    Schema.Struct({
      data: Schema.optional(Schema.String),
      cache: Schema.optional(Schema.String),
    }),
  ),
  llama: Schema.optional(
    Schema.Struct({
      port: Schema.optional(Schema.Number),
    }),
  ),
})

const readConfigFile = Effect.fn("readConfigFile")(function* (configPath: string) {
  const fs = yield* FileSystem.FileSystem
  const exists = yield* fs.exists(configPath).pipe(
    Effect.mapError(() => new ConfigError({ reason: `config file is not readable: ${configPath}` })),
  )
  if (!exists) return undefined
  const raw = yield* fs.readFileString(configPath).pipe(
    Effect.mapError(() => new ConfigError({ reason: `config file is not readable: ${configPath}` })),
  )
  const json: unknown = yield* Effect.try({
    try: () => JSON.parse(raw),
    catch: () => new ConfigError({ reason: `config file is not valid json: ${configPath}` }),
  })
  return yield* Schema.decodeUnknownEffect(ConfigFileSchema, { onExcessProperty: "error" })(json).pipe(
    Effect.mapError(
      (error) => new ConfigError({ reason: `config file ${configPath}: ${error.message}` }),
    ),
  )
})

export type AppConfigOverrides = {
  readonly host?: string | undefined
  readonly port?: number | undefined
  readonly dataDir?: string | undefined
  readonly cacheDir?: string | undefined
  readonly llamaPort?: number | undefined
  readonly configPath?: string | undefined
}

export class AppConfig extends Context.Service<AppConfig>()("AppConfig", {
  make: Effect.fn("AppConfig.make")(function* (overrides: AppConfigOverrides) {
    const paths = envPaths(APP_NAME, { suffix: "" })
    const configPath = overrides.configPath ?? `${paths.config}/config.json`
    const file = yield* readConfigFile(configPath)
    const port = yield* decodePort(
      "listen.port",
      overrides.port ?? envValue("X_BOOKMARKS_PORT") ?? file?.listen?.port,
      HTTP_PORT_DEFAULT,
    )
    const llamaPort = yield* decodePort(
      "llama.port",
      overrides.llamaPort ?? envValue("X_BOOKMARKS_LLAMA_PORT") ?? file?.llama?.port,
      LLAMA_PORT_DEFAULT,
    )
    const host =
      overrides.host ?? envValue("X_BOOKMARKS_HOST") ?? file?.listen?.host ?? HTTP_HOST_DEFAULT
    const dataDir =
      overrides.dataDir ?? envValue("X_BOOKMARKS_DATA_DIR") ?? file?.paths?.data ?? paths.data
    const cacheDir =
      overrides.cacheDir ?? envValue("X_BOOKMARKS_CACHE_DIR") ?? file?.paths?.cache ?? paths.cache
    const ggufDir = `${cacheDir}/gguf`
    return {
      host,
      port,
      dataDir,
      cacheDir,
      llamaPort,
      sqlitePath: `${dataDir}/library.sqlite`,
      mediaDir: `${dataDir}/media`,
      importsDir: `${dataDir}/imports`,
      llamaDir: `${cacheDir}/llama-${LLAMA_BUILD}`,
      ggufDir,
      textGgufPath: `${ggufDir}/qwen3-vl-embedding-2b-Q4_K_M.gguf`,
      mmprojGgufPath: `${ggufDir}/mmproj-Q8_0.gguf`,
      llamaBaseUrl: `http://127.0.0.1:${String(llamaPort)}`,
    } as const
  }),
}) {
  static layer = (overrides: AppConfigOverrides) =>
    Layer.effect(this, this.make(overrides)).pipe(Layer.provide(NodeFileSystem.layer))
}

export const llamaTarballName = (os: NodeJS.Platform): string | undefined => {
  const names: Partial<Record<NodeJS.Platform, string>> = {
    linux: `llama-${LLAMA_BUILD}-bin-ubuntu-vulkan-x64.tar.gz`,
    darwin: `llama-${LLAMA_BUILD}-bin-macos-arm64.tar.gz`,
  }
  return names[os]
}

export const llamaReleaseUrl = (os: NodeJS.Platform): string | undefined => {
  const name = llamaTarballName(os)
  if (name === undefined) return undefined
  return `https://github.com/ggml-org/llama.cpp/releases/download/${LLAMA_BUILD}/${name}`
}

export const TEXT_GGUF_URL =
  "https://huggingface.co/Rizwan313/Qwen3-VL-Embedding-2B-GGUF/resolve/main/qwen3-vl-embedding-2b-Q4_K_M.gguf"
export const MMPROJ_GGUF_URL =
  "https://huggingface.co/Rizwan313/Qwen3-VL-Embedding-2B-GGUF/resolve/main/mmproj-Q8_0.gguf"
