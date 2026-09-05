import { spawnSync } from "node:child_process"
import { Data, Effect, FileSystem, Path } from "effect"

export const STILL_RUNGS = [32, 64, 128, 256] as const

export class ThumbError extends Data.TaggedError("ThumbError")<{
  readonly reason: string
}> {}

export const rungPath = (stillPath: string, rung: number, join: Path.Path): string => {
  const dir = join.dirname(stillPath)
  const file = join.basename(stillPath)
  const dot = file.lastIndexOf(".")
  const base = dot < 0 ? file : file.slice(0, dot)
  return join.join(dir, `${base}.${String(rung)}.webp`)
}

const writeRung = Effect.fn("writeRung")(function* (stillPath: string, dest: string, rung: number) {
  const result = yield* Effect.sync(() =>
    spawnSync(
      "magick",
      [stillPath, "-auto-orient", "-resize", `${String(rung)}x${String(rung)}>`, dest],
      { encoding: "utf8" },
    ),
  )
  if (result.error !== undefined || result.status !== 0) {
    return yield* new ThumbError({
      reason: result.error?.message ?? (result.stderr.trim() || `status ${String(result.status)}`),
    })
  }
})

export const ensureStillRungs = Effect.fn("ensureStillRungs")(function* (stillPath: string) {
  const fs = yield* FileSystem.FileSystem
  const pathMod = yield* Path.Path
  if (!(yield* fs.exists(stillPath))) return
  for (const rung of STILL_RUNGS) {
    const dest = rungPath(stillPath, rung, pathMod)
    if (yield* fs.exists(dest)) continue
    yield* writeRung(stillPath, dest, rung).pipe(
      Effect.catchTag("ThumbError", (error) =>
        Effect.logWarning(`thumb skip ${dest}: ${error.reason}`),
      ),
    )
  }
})
