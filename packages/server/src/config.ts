import envPaths from "env-paths"
import { Context, Data, Effect, FileSystem, Layer, Predicate, Schema, SchemaIssue } from "effect"

const APP_NAME = "xkeep"

export const LLAMA_BUILD = "b10752"
export const LLAMA_PORT_DEFAULT = 8913
export const HTTP_PORT_DEFAULT = 5337
export const HTTP_HOST_DEFAULT = "127.0.0.1"
export const IMAGE_MAX_TOKENS = 256
export const LLAMA_PARALLEL = 4
export const LLAMA_SLOT_CTX = 8192
export const LLAMA_CACHE_RAM = 8192
export const EMBED_DIMS = 2048
export const MEDIA_MARKER = "<__media__>"
export const DOC_SYSTEM = "Represent the user's input."
export const QUERY_SYSTEM =
  "Given a social media post bookmarked by the user, retrieve posts relevant to the query."

export class ConfigError extends Data.TaggedError("ConfigError")<{
  readonly reason: string
}> {}

const NonBlankString = Schema.String.check(
  Schema.makeFilter((value: string) => value.trim() !== "", { expected: "a non-blank string" }),
)

const Port = Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 65535 })).pipe(
  Schema.annotate({
    title: "Port",
    description: "TCP port from 1 to 65535.",
  }),
)

const decodeField = Effect.fn("decodeField")(function* <S extends Schema.Constraint>(input: {
  readonly key: string
  readonly schema: S
  readonly raw: unknown
  readonly fallback: S["Type"]
}) {
  if (input.raw === undefined) return input.fallback
  return yield* Schema.decodeUnknownEffect(input.schema)(input.raw).pipe(
    Effect.mapError(
      (error) =>
        new ConfigError({
          reason: `invalid value for ${input.key}: ${error.message}, got ${JSON.stringify(input.raw)}`,
        }),
    ),
  )
})

const ConfigFileSchema = Schema.Struct({
  listen: Schema.optional(
    Schema.Struct({
      host: Schema.optional(
        Schema.Unknown.pipe(
          Schema.annotateKey({ description: "HTTP bind host. Omitted uses 127.0.0.1." }),
        ),
      ),
      port: Schema.optional(
        Schema.Unknown.pipe(
          Schema.annotateKey({ description: "HTTP listen port. Omitted uses 5337." }),
        ),
      ),
    }).pipe(
      Schema.annotate({
        title: "Listen",
        description: "HTTP bind address for the daemon.",
      }),
    ),
  ),
  paths: Schema.optional(
    Schema.Struct({
      data: Schema.optional(
        Schema.Unknown.pipe(
          Schema.annotateKey({
            description: "Directory for sqlite and media. Omitted uses env-paths data.",
          }),
        ),
      ),
      cache: Schema.optional(
        Schema.Unknown.pipe(
          Schema.annotateKey({
            description: "Directory for llama binaries and GGUF files. Omitted uses env-paths cache.",
          }),
        ),
      ),
      log: Schema.optional(
        Schema.Unknown.pipe(
          Schema.annotateKey({
            description: "Directory for the daemon log file. Omitted uses env-paths log.",
          }),
        ),
      ),
    }).pipe(
      Schema.annotate({
        title: "Paths",
        description: "On-disk directories for sqlite, media, download cache, and logs.",
      }),
    ),
  ),
  llama: Schema.optional(
    Schema.Struct({
      port: Schema.optional(
        Schema.Unknown.pipe(
          Schema.annotateKey({ description: "llama-server port. Omitted uses 8913." }),
        ),
      ),
    }).pipe(
      Schema.annotate({
        title: "Llama",
        description: "Local llama.cpp embed worker.",
      }),
    ),
  ),
}).pipe(
  Schema.annotate({
    identifier: "ConfigFile",
    title: "Config file",
    description:
      "Optional JSON at the env-paths config dir. Nested keys only. Unknown keys fail boot.",
  }),
)

const ResolvedConfigSchema = Schema.Struct({
  host: NonBlankString.pipe(
    Schema.annotateKey({ description: "HTTP bind host after flags, file, and defaults." }),
  ),
  port: Port.pipe(Schema.annotateKey({ description: "HTTP listen port after merge." })),
  dataDir: NonBlankString.pipe(
    Schema.annotateKey({ description: "Data directory after merge." }),
  ),
  cacheDir: NonBlankString.pipe(
    Schema.annotateKey({ description: "Download cache directory after merge." }),
  ),
  logDir: NonBlankString.pipe(
    Schema.annotateKey({ description: "Daemon log directory after merge." }),
  ),
  llamaPort: Port.pipe(Schema.annotateKey({ description: "llama-server port after merge." })),
  sqlitePath: NonBlankString.pipe(
    Schema.annotateKey({ description: "SQLite file derived from dataDir." }),
  ),
  mediaDir: NonBlankString.pipe(
    Schema.annotateKey({ description: "Still-image directory derived from dataDir." }),
  ),
  llamaDir: NonBlankString.pipe(
    Schema.annotateKey({ description: "Pinned llama.cpp extract directory derived from cacheDir." }),
  ),
  ggufDir: NonBlankString.pipe(
    Schema.annotateKey({ description: "GGUF download directory derived from cacheDir." }),
  ),
  textGgufPath: NonBlankString.pipe(
    Schema.annotateKey({ description: "Text embedding GGUF path under ggufDir." }),
  ),
  mmprojGgufPath: NonBlankString.pipe(
    Schema.annotateKey({ description: "mmproj GGUF path under ggufDir." }),
  ),
  llamaBaseUrl: NonBlankString.pipe(
    Schema.annotateKey({ description: "http://127.0.0.1:{llamaPort} for the embed worker." }),
  ),
  logFile: NonBlankString.pipe(
    Schema.annotateKey({ description: "JSON log file derived from logDir." }),
  ),
}).pipe(
  Schema.annotate({
    identifier: "ResolvedConfig",
    title: "Resolved config",
    description:
      "Runtime config after flags, file, and defaults. Derived paths are included. Module constants are not.",
  }),
)

const readConfigFile = Effect.fn("readConfigFile")(function* (configPath: string) {
  const fs = yield* FileSystem.FileSystem
  const exists = yield* fs.exists(configPath).pipe(
    Effect.mapError(() => new ConfigError({ reason: `config file is not readable: ${configPath}` })),
  )
  if (!exists) return undefined
  const raw = yield* fs.readFileString(configPath).pipe(
    Effect.mapError(() => new ConfigError({ reason: `config file is not readable: ${configPath}` })),
  )
  const json = yield* Effect.try({
    try: (): unknown => JSON.parse(raw),
    catch: () => new ConfigError({ reason: `config file is not valid json: ${configPath}` }),
  })
  return yield* Schema.decodeUnknownEffect(ConfigFileSchema, { onExcessProperty: "error" })(json).pipe(
    Effect.mapError((error) => {
      const keys: Array<string> = []
      let node: SchemaIssue.Issue | undefined = error.issue
      while (node !== undefined) {
        if (Predicate.isTagged(node, "Pointer")) {
          for (const key of node.path) keys.push(String(key))
          node = node.issue
          continue
        }
        if (Predicate.isTagged(node, "Filter") || Predicate.isTagged(node, "Encoding")) {
          node = node.issue
          continue
        }
        if (Predicate.isTagged(node, "Composite") || Predicate.isTagged(node, "AnyOf")) {
          node = node.issues[0]
          continue
        }
        break
      }
      const path = keys.join(".")
      return new ConfigError({
        reason:
          path === ""
            ? `config file ${configPath}: ${error.message}`
            : `config file ${configPath}: ${path}`,
      })
    }),
  )
})

export type AppConfigOverrides = {
  readonly host?: string | undefined
  readonly port?: number | undefined
  readonly dataDir?: string | undefined
  readonly cacheDir?: string | undefined
  readonly logDir?: string | undefined
  readonly llamaPort?: number | undefined
  readonly configPath?: string | undefined
}

export class AppConfig extends Context.Service<AppConfig>()("AppConfig", {
  make: Effect.fn("AppConfig.make")(function* (overrides: AppConfigOverrides) {
    const paths = envPaths(APP_NAME, { suffix: "" })
    const configPath = overrides.configPath ?? `${paths.config}/config.json`
    const file = yield* readConfigFile(configPath)
    const port = yield* decodeField({
      key: "listen.port",
      schema: Port,
      raw: overrides.port ?? file?.listen?.port,
      fallback: HTTP_PORT_DEFAULT,
    })
    const llamaPort = yield* decodeField({
      key: "llama.port",
      schema: Port,
      raw: overrides.llamaPort ?? file?.llama?.port,
      fallback: LLAMA_PORT_DEFAULT,
    })
    const host = yield* decodeField({
      key: "listen.host",
      schema: NonBlankString,
      raw: overrides.host ?? file?.listen?.host,
      fallback: HTTP_HOST_DEFAULT,
    })
    const dataDir = yield* decodeField({
      key: "paths.data",
      schema: NonBlankString,
      raw: overrides.dataDir ?? file?.paths?.data,
      fallback: paths.data,
    })
    const cacheDir = yield* decodeField({
      key: "paths.cache",
      schema: NonBlankString,
      raw: overrides.cacheDir ?? file?.paths?.cache,
      fallback: paths.cache,
    })
    const logDir = yield* decodeField({
      key: "paths.log",
      schema: NonBlankString,
      raw: overrides.logDir ?? file?.paths?.log,
      fallback: paths.log,
    })
    const ggufDir = `${cacheDir}/gguf`
    return yield* Schema.decodeUnknownEffect(ResolvedConfigSchema, { onExcessProperty: "error" })({
      host,
      port,
      dataDir,
      cacheDir,
      logDir,
      llamaPort,
      sqlitePath: `${dataDir}/xkeep.sqlite`,
      mediaDir: `${dataDir}/media`,
      llamaDir: `${cacheDir}/llama-${LLAMA_BUILD}`,
      ggufDir,
      textGgufPath: `${ggufDir}/Qwen3-VL-Embedding-2B.Q4_K_M.gguf`,
      mmprojGgufPath: `${ggufDir}/Qwen3-VL-Embedding-2B.mmproj-Q8_0.gguf`,
      llamaBaseUrl: `http://127.0.0.1:${String(llamaPort)}`,
      logFile: `${logDir}/xkeep.log`,
    }).pipe(
      Effect.mapError(
        (error) => new ConfigError({ reason: `resolved config invalid: ${error.message}` }),
      ),
    )
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
  "https://huggingface.co/mradermacher/Qwen3-VL-Embedding-2B-GGUF/resolve/main/Qwen3-VL-Embedding-2B.Q4_K_M.gguf"
export const MMPROJ_GGUF_URL =
  "https://huggingface.co/mradermacher/Qwen3-VL-Embedding-2B-GGUF/resolve/main/Qwen3-VL-Embedding-2B.mmproj-Q8_0.gguf"
