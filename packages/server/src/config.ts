import envPaths from "env-paths"
import { Context, Data, Effect, Layer } from "effect"

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
  raw: number | string | undefined,
  fallback: number,
): Effect.Effect<number, ConfigError> => {
  if (raw === undefined || raw === "") return Effect.succeed(fallback)
  const n = typeof raw === "number" ? raw : Number(raw)
  if (!Number.isInteger(n) || n < 1 || n > 65535) {
    return Effect.fail(new ConfigError({ reason: `invalid port: ${String(raw)}` }))
  }
  return Effect.succeed(n)
}

export type AppConfigOverrides = {
  readonly host?: string | undefined
  readonly port?: number | undefined
  readonly dataDir?: string | undefined
  readonly cacheDir?: string | undefined
  readonly llamaPort?: number | undefined
}

export class AppConfig extends Context.Service<AppConfig>()("AppConfig", {
  make: Effect.fn("AppConfig.make")(function* (overrides: AppConfigOverrides) {
    const paths = envPaths(APP_NAME, { suffix: "" })
    const port = yield* decodePort(overrides.port ?? process.env.X_BOOKMARKS_PORT, HTTP_PORT_DEFAULT)
    const llamaPort = yield* decodePort(
      overrides.llamaPort ?? process.env.X_BOOKMARKS_LLAMA_PORT,
      LLAMA_PORT_DEFAULT,
    )
    const host = overrides.host ?? process.env.X_BOOKMARKS_HOST ?? HTTP_HOST_DEFAULT
    const dataDir = overrides.dataDir ?? process.env.X_BOOKMARKS_DATA_DIR ?? paths.data
    const cacheDir = overrides.cacheDir ?? process.env.X_BOOKMARKS_CACHE_DIR ?? paths.cache
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
  static layer = (overrides: AppConfigOverrides) => Layer.effect(this, this.make(overrides))
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
