import { Application, Assets, Container, FederatedPointerEvent, Graphics, Sprite, Texture } from "pixi.js"
import type { PileItem } from "./api.ts"

export const SPREAD_DEFAULT = 72
export const SPREAD_MIN = 16
export const SPREAD_MAX = 240
const MARK_LONG = 72
const PAD = 1
const RUNGS = [32, 64, 128, 256] as const
const ZOOM_MIN = 0.2
const ZOOM_MAX = 64
const GRID_WORLD = 24
const GRID_DIV = 8

type Placed = {
  readonly item: PileItem
  readonly x: number
  readonly y: number
}

export const hasCoords = (item: PileItem): item is PileItem & { readonly x: number; readonly y: number } =>
  "x" in item && "y" in item

const place = (items: ReadonlyArray<PileItem>, spread: number): ReadonlyArray<Placed> =>
  items.filter(hasCoords).map((item) => ({
    item,
    x: item.x * spread,
    y: -item.y * spread,
  }))

const rungUrl = (still: string, rung: number) => {
  const name = still.split("/").pop() ?? still
  const dot = name.lastIndexOf(".")
  const base = dot < 0 ? name : name.slice(0, dot)
  return `/api/media/${base}.${String(rung)}.webp`
}

const pickRung = (screenLong: number) => {
  for (const rung of RUNGS) {
    if (rung >= screenLong) return rung
  }
  return 256
}

const sizeSprite = (sprite: Sprite, texture: Texture) => {
  const tw = Math.max(texture.width, 1)
  const th = Math.max(texture.height, 1)
  if (tw >= th) {
    sprite.width = MARK_LONG
    sprite.height = MARK_LONG * (th / tw)
  } else {
    sprite.height = MARK_LONG
    sprite.width = MARK_LONG * (tw / th)
  }
}

const plate = (w: number, h: number) => {
  const g = new Graphics()
  g.rect(0, 0, w, h)
  g.fill({ color: 0x16171c })
  g.stroke({ color: 0x2a2c31, width: 1 })
  return g
}

const drawGrid = (g: Graphics, spread: number) => {
  g.clear()
  const step = Math.max(spread / GRID_DIV, 1)
  const hi = GRID_WORLD * spread
  const lines = Math.round((hi * 2) / step)
  for (let i = -lines / 2; i <= lines / 2; i++) {
    const p = i * step
    const axis = i === 0
    const major = i % GRID_DIV === 0
    g.moveTo(-hi, p)
    g.lineTo(hi, p)
    g.moveTo(p, -hi)
    g.lineTo(p, hi)
    g.stroke({
      color: axis ? 0x3a3d44 : major ? 0x23262c : 0x16181c,
      width: axis ? 1.5 : 1,
      alpha: axis ? 0.55 : major ? 0.4 : 0.28,
    })
  }
  g.rect(-3, -3, 6, 6)
  g.fill({ color: 0x8a8680, alpha: 0.7 })
}

type Mark = {
  item: PileItem
  worldX: number
  worldY: number
  root: Container
  backing: Graphics
  sprite: Sprite | undefined
  rung: number | undefined
}

export type MapHandle = {
  readonly sync: (items: ReadonlyArray<PileItem>) => void
  readonly setSpread: (spread: number) => void
  readonly destroy: () => void
  readonly screenOfId: (id: string) => { x: number; y: number } | undefined
}

export const createMap = (
  host: HTMLElement,
  input: {
    readonly onPick: (item: PileItem) => void
    readonly onView: () => void
    readonly spread?: number
  },
): MapHandle => {
  const app = new Application()
  const world = new Container()
  world.eventMode = "static"
  const grid = new Graphics()
  const marks = new Map<string, Mark>()
  const textures = new Map<string, Texture>()
  let destroyed = false
  let ready = false
  let framed = false
  let spread = Math.min(SPREAD_MAX, Math.max(SPREAD_MIN, input.spread ?? SPREAD_DEFAULT))
  let lastItems: ReadonlyArray<PileItem> = []
  let drag: { readonly x: number; readonly y: number; moved: boolean } | undefined

  const screenOf = (worldX: number, worldY: number) => ({
    x: world.x + worldX * world.scale.x,
    y: world.y + worldY * world.scale.y,
  })

  const markScale = () => Math.min(1, 1 / Math.max(world.scale.x, 1e-6))

  const applySizes = () => {
    const local = markScale()
    for (const mark of marks.values()) mark.root.scale.set(local)
  }

  const loadTexture = async (url: string): Promise<Texture | undefined> => {
    const hit = textures.get(url)
    if (hit !== undefined) return hit
    const response = await fetch(url)
    if (!response.ok) return undefined
    const blob = new Blob([await response.arrayBuffer()], { type: "image/webp" })
    const objectUrl = URL.createObjectURL(blob)
    try {
      const texture = (await Assets.load({ src: objectUrl, parser: "loadTextures" })) as Texture
      textures.set(url, texture)
      return texture
    } finally {
      URL.revokeObjectURL(objectUrl)
    }
  }

  const paintMark = async (mark: Mark) => {
    if (!("still" in mark.item)) return
    const rung = pickRung(MARK_LONG * (window.devicePixelRatio || 1))
    if (mark.rung === rung && mark.sprite !== undefined) return
    const texture = await loadTexture(rungUrl(mark.item.still, rung))
    if (destroyed || texture === undefined) return
    mark.rung = rung
    if (mark.sprite === undefined) {
      mark.sprite = new Sprite(texture)
      mark.root.addChild(mark.sprite)
    } else {
      mark.sprite.texture = texture
    }
    sizeSprite(mark.sprite, texture)
    mark.sprite.x = PAD
    mark.sprite.y = PAD
    const w = mark.sprite.width + PAD * 2
    const h = mark.sprite.height + PAD * 2
    mark.backing.clear()
    mark.backing.rect(0, 0, w, h)
    mark.backing.fill({ color: 0x16171c })
    mark.backing.stroke({ color: 0x2a2c31, width: 1 })
    mark.root.pivot.set(w / 2, h / 2)
    mark.root.scale.set(markScale())
  }

  const addMark = (placed: Placed) => {
    const root = new Container()
    root.eventMode = "static"
    root.cursor = "pointer"
    root.x = placed.x
    root.y = placed.y
    root.scale.set(markScale())
    const backing = plate(MARK_LONG + PAD * 2, MARK_LONG * 0.62 + PAD * 2)
    root.addChild(backing)
    const mark: Mark = {
      item: placed.item,
      worldX: placed.x,
      worldY: placed.y,
      root,
      backing,
      sprite: undefined,
      rung: undefined,
    }
    root.on("pointertap", () => {
      if (drag?.moved === true) return
      input.onPick(mark.item)
    })
    world.addChild(root)
    marks.set(placed.item.id, mark)
    void paintMark(mark)
  }

  const frameOnce = () => {
    if (framed || !ready || marks.size === 0) return
    framed = true
    let sx = 0
    let sy = 0
    for (const mark of marks.values()) {
      sx += mark.worldX
      sy += mark.worldY
    }
    world.scale.set(1)
    world.x = host.clientWidth / 2 - sx / marks.size
    world.y = host.clientHeight / 2 - sy / marks.size
    applySizes()
    input.onView()
  }

  const sync = (items: ReadonlyArray<PileItem>) => {
    lastItems = items
    const placed = place(items, spread)
    const seen = new Set<string>()
    for (const node of placed) {
      seen.add(node.item.id)
      const existing = marks.get(node.item.id)
      if (existing === undefined) {
        addMark(node)
        continue
      }
      existing.item = node.item
      if (existing.worldX !== node.x || existing.worldY !== node.y) {
        existing.worldX = node.x
        existing.worldY = node.y
        existing.root.x = node.x
        existing.root.y = node.y
      }
      if (existing.sprite === undefined) void paintMark(existing)
    }
    for (const [id, mark] of marks) {
      if (seen.has(id)) continue
      world.removeChild(mark.root)
      mark.root.destroy({ children: true })
      marks.delete(id)
    }
    frameOnce()
  }

  const onMove = (event: FederatedPointerEvent) => {
    if (drag === undefined) return
    const nx = event.global.x - drag.x
    const ny = event.global.y - drag.y
    if (Math.abs(nx - world.x) > 3 || Math.abs(ny - world.y) > 3) drag.moved = true
    world.x = nx
    world.y = ny
    input.onView()
  }

  const start = async () => {
    await app.init({
      resizeTo: host,
      background: 0x0c0d10,
      antialias: true,
      autoDensity: true,
      resolution: window.devicePixelRatio,
    })
    if (destroyed) {
      app.destroy(true)
      return
    }
    ready = true
    drawGrid(grid, spread)
    world.addChildAt(grid, 0)
    host.appendChild(app.canvas)
    app.stage.addChild(world)
    world.x = host.clientWidth / 2
    world.y = host.clientHeight / 2
    frameOnce()
    app.stage.eventMode = "static"
    app.stage.hitArea = app.screen
    app.stage.on("pointerdown", (event: FederatedPointerEvent) => {
      drag = { x: event.global.x - world.x, y: event.global.y - world.y, moved: false }
    })
    app.stage.on("pointerup", () => {
      drag = undefined
    })
    app.stage.on("pointerupoutside", () => {
      drag = undefined
    })
    app.stage.on("pointermove", onMove)
    app.canvas.addEventListener(
      "wheel",
      (event) => {
        event.preventDefault()
        const next = Math.min(
          ZOOM_MAX,
          Math.max(ZOOM_MIN, world.scale.x * (event.deltaY < 0 ? 1.1 : 0.91)),
        )
        const cursor = { x: event.offsetX, y: event.offsetY }
        const before = {
          x: (cursor.x - world.x) / world.scale.x,
          y: (cursor.y - world.y) / world.scale.y,
        }
        world.scale.set(next)
        world.x = cursor.x - before.x * next
        world.y = cursor.y - before.y * next
        applySizes()
        input.onView()
      },
      { passive: false },
    )
  }
  void start()

  return {
    sync: (items) => {
      if (destroyed) return
      sync(items)
    },
    setSpread: (next) => {
      if (destroyed) return
      const clamped = Math.min(SPREAD_MAX, Math.max(SPREAD_MIN, next))
      if (clamped === spread) return
      spread = clamped
      drawGrid(grid, spread)
      sync(lastItems)
      input.onView()
    },
    destroy: () => {
      destroyed = true
      marks.clear()
      textures.clear()
      if (ready) app.destroy(true, { children: true, texture: true, textureSource: true })
    },
    screenOfId: (id) => {
      const mark = marks.get(id)
      if (mark === undefined) return undefined
      return screenOf(mark.worldX, mark.worldY)
    },
  }
}
