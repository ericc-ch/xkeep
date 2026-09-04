import { delimiter } from "node:path"
import { platform } from "node:process"
import {
  Cause,
  Context,
  Data,
  Effect,
  FileSystem,
  Layer,
  Path,
  Ref,
  Schema,
  Semaphore,
  Stream,
} from "effect"
import { HttpClient, HttpClientRequest, HttpClientResponse } from "effect/unstable/http"
import { ChildProcess } from "effect/unstable/process"
import {
  AppConfig,
  DOC_SYSTEM,
  EMBED_DIMS,
  IMAGE_MAX_TOKENS,
  MEDIA_MARKER,
  MMPROJ_GGUF_URL,
  QUERY_SYSTEM,
  TEXT_GGUF_URL,
  llamaReleaseUrl,
  llamaTarballName,
} from "../config.ts"

type Config = Context.Service.Shape<typeof AppConfig>

const MIN_TEXT_GGUF_BYTES = 800_000_000
const MIN_MMPROJ_GGUF_BYTES = 200_000_000

export type LlamaState = Data.TaggedEnum<{
  starting: {}
  ready: {}
  unavailable: { readonly reason: string }
}>

export const LlamaState = Data.taggedEnum<LlamaState>()

export type EmbedKind = "query" | "document"

export class LlamaSetupError extends Data.TaggedError("LlamaSetupError")<{
  readonly reason: string
}> {}

export class LlamaUnavailable extends Data.TaggedError("LlamaUnavailable")<{
  readonly reason: string
}> {}

export class LlamaEmbedError extends Data.TaggedError("LlamaEmbedError")<{
  readonly reason: string
}> {}

export class Llama extends Context.Service<
  Llama,
  {
    readonly state: () => Effect.Effect<LlamaState>
    readonly embed: (
      items: ReadonlyArray<{ readonly text: string; readonly stillPath: string | undefined }>,
      kind: EmbedKind,
    ) => Effect.Effect<
      ReadonlyArray<Float32Array>,
      LlamaUnavailable | LlamaEmbedError,
      FileSystem.FileSystem | HttpClient.HttpClient
    >
  }
>()("Llama") {}

const vectorFromText = (text: string): Float32Array => {
  const vec = new Float32Array(EMBED_DIMS)
  let h = 1
  for (let i = 0; i < text.length; i++) {
    h = (h * 33 + text.charCodeAt(i)) % 1_000_000_007
    const index = h % EMBED_DIMS
    const current = vec[index]
    if (current === undefined) continue
    vec[index] = current + 1
  }
  let sum = 0
  for (let i = 0; i < EMBED_DIMS; i++) {
    const n = vec[i]
    if (n === undefined) continue
    sum += n * n
  }
  const norm = Math.sqrt(sum)
  if (norm === 0) {
    vec[0] = 1
    return vec
  }
  for (let i = 0; i < EMBED_DIMS; i++) {
    const n = vec[i]
    if (n === undefined) continue
    vec[i] = n / norm
  }
  return vec
}

export const layerTest = Layer.succeed(
  Llama,
  Llama.of({
    state: Effect.fnUntraced(function* () {
      return yield* Effect.succeed(LlamaState.ready())
    }),
    embed: Effect.fnUntraced(function* (items, _kind) {
      return yield* Effect.succeed(items.map((item) => vectorFromText(item.text)))
    }),
  }),
)

const wrap = (system: string, user: string): string =>
  `<|im_start|>system\n${system}<|im_end|>\n<|im_start|>user\n${user}<|im_end|>\n<|im_start|>assistant\n`

const stdio = {
  stdin: "ignore" as const,
  stdout: "inherit" as const,
  stderr: "inherit" as const,
}

const ensureSizedFile = Effect.fn("ensureSizedFile")(function* (
  url: string,
  dest: string,
  minBytes: number,
) {
  const fs = yield* FileSystem.FileSystem
  if (yield* fs.exists(dest)) {
    const stat = yield* fs.stat(dest)
    if (stat.size >= BigInt(minBytes)) return
    yield* Effect.log(`removing undersized file ${dest} (${String(stat.size)} bytes)`)
    yield* fs.remove(dest)
  }
  yield* Effect.log(`downloading ${url} to ${dest}`)
  const raw = yield* HttpClient.HttpClient
  const client = HttpClient.followRedirects(10)(raw)
  const tmp = `${dest}.part`
  const response = yield* client.execute(HttpClientRequest.get(url))
  yield* HttpClientResponse.filterStatusOk(response)
  yield* Stream.run(response.stream, fs.sink(tmp))
  yield* fs.rename(tmp, dest)
  const after = yield* fs.stat(dest)
  if (after.size < BigInt(minBytes)) {
    yield* fs.remove(dest)
    return yield* new LlamaSetupError({
      reason: `${dest} is ${String(after.size)} bytes, expected at least ${String(minBytes)}`,
    })
  }
})

const ensureBinary = Effect.fn("ensureBinary")(function* (config: Config) {
  const fs = yield* FileSystem.FileSystem
  const pathMod = yield* Path.Path
  const name = platform === "win32" ? "llama-server.exe" : "llama-server"
  for (const dir of (process.env.PATH ?? "").split(delimiter)) {
    if (dir.length === 0) continue
    const candidate = pathMod.join(dir, name)
    if (yield* fs.exists(candidate)) return candidate
  }
  const bin = pathMod.join(config.llamaDir, name)
  if (yield* fs.exists(bin)) return bin
  const url = llamaReleaseUrl(platform)
  const tarName = llamaTarballName(platform)
  if (url === undefined || tarName === undefined) {
    return yield* new LlamaSetupError({ reason: `no llama.cpp vulkan build for ${platform}` })
  }
  yield* fs.makeDirectory(config.cacheDir, { recursive: true })
  const archive = pathMod.join(config.cacheDir, tarName)
  yield* ensureSizedFile(url, archive, 1_000_000)
  yield* fs.makeDirectory(config.llamaDir, { recursive: true })
  if (platform !== "linux" && platform !== "darwin") {
    return yield* new LlamaSetupError({ reason: `no llama.cpp vulkan extract for ${platform}` })
  }
  const tar = yield* ChildProcess.make("tar", ["-xzf", archive, "-C", config.llamaDir], stdio)
  const code = yield* tar.exitCode
  if (code !== 0) {
    return yield* new LlamaSetupError({ reason: `tar extract failed with ${String(code)}` })
  }
  if (!(yield* fs.exists(bin))) {
    return yield* new LlamaSetupError({ reason: `llama-server missing after extract at ${bin}` })
  }
  return bin
})

const parseEmbedding = (raw: unknown): Effect.Effect<Float32Array, LlamaEmbedError> => {
  if (!raw || typeof raw !== "object") {
    return Effect.fail(new LlamaEmbedError({ reason: "embedding response is not an object" }))
  }
  let vec: unknown
  if ("embedding" in raw) vec = raw.embedding
  if (vec === undefined && "data" in raw && Array.isArray(raw.data)) {
    const first = raw.data[0]
    if (first && typeof first === "object" && "embedding" in first) vec = first.embedding
  }
  let cursor: unknown = vec
  while (Array.isArray(cursor) && cursor.length > 0) {
    const last = cursor[cursor.length - 1]
    if (typeof last === "number") {
      if (cursor.every((item) => typeof item === "number")) {
        return Effect.succeed(Float32Array.from(cursor))
      }
      break
    }
    cursor = last
  }
  return Effect.fail(new LlamaEmbedError({ reason: "embedding vector missing" }))
}

const EmbedRow = Schema.Struct({
  index: Schema.optional(Schema.Number),
})

const embedBatch = Effect.fn("embedBatch")(function* (
  config: Config,
  items: ReadonlyArray<{ readonly text: string; readonly stillPath: string | undefined }>,
  kind: EmbedKind,
) {
  const fs = yield* FileSystem.FileSystem
  const content: Array<Record<string, unknown>> = []
  for (const item of items) {
    if (item.stillPath !== undefined && (yield* fs.exists(item.stillPath))) {
      const bytes = yield* fs.readFile(item.stillPath)
      const b64 = Buffer.from(bytes).toString("base64")
      const user = `<|vision_start|>${MEDIA_MARKER}<|vision_end|>${item.text}`
      content.push({
        prompt_string: wrap(DOC_SYSTEM, user),
        multimodal_data: [b64],
      })
    } else {
      content.push({
        prompt_string: wrap(kind === "query" ? QUERY_SYSTEM : DOC_SYSTEM, item.text),
      })
    }
  }
  const request = HttpClientRequest.post(`${config.llamaBaseUrl}/embeddings`).pipe(
    HttpClientRequest.bodyJsonUnsafe({ content }),
  )
  const raw = yield* HttpClient.HttpClient
  const response = yield* raw.execute(request)
  yield* HttpClientResponse.filterStatusOk(response)
  const json = yield* response.json
  if (Array.isArray(json)) {
    const decoded = yield* Schema.decodeUnknownEffect(Schema.Array(EmbedRow))(json).pipe(
      Effect.mapError(() => new LlamaEmbedError({ reason: "embedding array is malformed" })),
    )
    const sorted = decoded
      .map((row, i) => ({ index: row.index ?? i, value: json[i] }))
      .sort((a, b) => a.index - b.index)
    const out: Array<Float32Array> = []
    for (const item of sorted) {
      out.push(yield* parseEmbedding(item.value))
    }
    return out
  }
  if (json && typeof json === "object" && "data" in json && Array.isArray(json.data)) {
    const out: Array<Float32Array> = []
    for (const item of json.data) {
      out.push(yield* parseEmbedding(item))
    }
    return out
  }
  return yield* new LlamaEmbedError({ reason: "unexpected embeddings response" })
})

const setupLlama = Effect.fn("setupLlama")(function* (
  config: Config,
  state: Ref.Ref<LlamaState>,
) {
  const fs = yield* FileSystem.FileSystem
  yield* fs.makeDirectory(config.ggufDir, { recursive: true })
  yield* ensureSizedFile(TEXT_GGUF_URL, config.textGgufPath, MIN_TEXT_GGUF_BYTES)
  yield* ensureSizedFile(MMPROJ_GGUF_URL, config.mmprojGgufPath, MIN_MMPROJ_GGUF_BYTES)
  const bin = yield* ensureBinary(config)
  const pathMod = yield* Path.Path
  const dir = pathMod.dirname(bin)
  const libPath = `${dir}${delimiter}${process.env.LD_LIBRARY_PATH ?? ""}`
  const handle = yield* ChildProcess.make(
    bin,
    [
      "-m",
      config.textGgufPath,
      "--mmproj",
      config.mmprojGgufPath,
      "--embedding",
      "--pooling",
      "last",
      "--embd-normalize",
      "2",
      "--image-min-tokens",
      "4",
      "--image-max-tokens",
      String(IMAGE_MAX_TOKENS),
      "--no-cache-prompt",
      "--cache-ram",
      "0",
      "--host",
      "127.0.0.1",
      "--port",
      String(config.llamaPort),
      "-ngl",
      "99",
      "-np",
      "8",
      "-c",
      "8192",
    ],
    {
      ...stdio,
      detached: false,
      env: {
        ...process.env,
        LD_LIBRARY_PATH: libPath,
        LLAMA_MEDIA_MARKER: MEDIA_MARKER,
      },
    },
  )
  yield* handle.exitCode.pipe(
    Effect.andThen((code) =>
      Ref.set(state, LlamaState.unavailable({ reason: `llama-server exited ${String(code)}` })),
    ),
    Effect.forkScoped,
  )
  for (let i = 0; i < 60; i++) {
    const ok = yield* HttpClient.get(`${config.llamaBaseUrl}/health`).pipe(
      Effect.andThen(HttpClientResponse.filterStatusOk),
      Effect.as(true),
      Effect.catch(() => Effect.succeed(false)),
    )
    if (ok) break
    yield* Effect.sleep("500 millis")
    if (i === 59) {
      return yield* new LlamaSetupError({ reason: "llama-server did not become healthy" })
    }
  }
  const after = yield* Ref.get(state)
  if (LlamaState.$is("unavailable")(after)) {
    return yield* new LlamaSetupError({
      reason: `llama-server died before ready: ${after.reason}`,
    })
  }
  yield* Ref.set(state, LlamaState.ready())
})

export const layer = Layer.effect(
  Llama,
  Effect.gen(function* () {
    const config = yield* AppConfig
    const state = yield* Ref.make<LlamaState>(LlamaState.starting())
    const embedLock = yield* Semaphore.make(1)
    yield* setupLlama(config, state).pipe(
      Effect.catchCause((cause) =>
        Ref.set(state, LlamaState.unavailable({ reason: Cause.pretty(cause) })).pipe(
          Effect.andThen(Effect.logError(cause)),
        ),
      ),
      Effect.forkScoped,
    )
    return {
      state: Effect.fn("llama.state")(function* () {
        return yield* Ref.get(state)
      }),
      embed: Effect.fn("llama.embed")(function* (
        items: ReadonlyArray<{ readonly text: string; readonly stillPath: string | undefined }>,
        kind: EmbedKind,
      ) {
        const current = yield* Ref.get(state)
        return yield* LlamaState.$match(current, {
          starting: () => new LlamaUnavailable({ reason: "llama is starting" }),
          unavailable: (s) => new LlamaUnavailable({ reason: s.reason }),
          ready: () =>
            items.length === 0
              ? Effect.succeed([])
              : embedLock.withPermits(1)(
                  embedBatch(config, items, kind).pipe(
                    Effect.catchTag("LlamaEmbedError", (error) => error),
                    Effect.mapError(() => new LlamaEmbedError({ reason: "embed request failed" })),
                  ),
                ),
        })
      }),
    }
  }),
)
