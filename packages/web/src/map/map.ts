import {
  Application,
  Assets,
  Container,
  FederatedPointerEvent,
  Graphics,
  Rectangle,
  Sprite,
  Text,
  Texture,
} from "pixi.js"
import type { PileItem } from "../api.ts"

const SPREAD_DEFAULT = 72
const CARD_WIDTH = 168
const MEDIA_HEIGHT = 104
const TEXT_CARD_HEIGHT = 92
const PAD = 10
const RUNGS = [32, 64, 128, 256] as const
const ZOOM_MIN = 0.2
const ZOOM_MAX = 64
const GRID_WORLD = 24
const GRID_DIV = 8
const CAMERA_KEY = "xkeep.camera.v1"
const MINIMAP_WIDTH = 184
const MINIMAP_HEIGHT = 132
const MINIMAP_PAD = 14
const MINIMAP_POINTS_MAX = 4_000
const OVERVIEW_MARKS_MAX = 4_000
const VIEW_MARGIN = 240
const OVERVIEW_ZOOM = 0.34
const BUCKET_SIZE = 512

const PLATE_FILL = 0x050607
const PLATE_LINE = 0x2f3336
const INK = 0xe7e9ea
const MUTE = 0x71767b
const SELECTED = 0x1d9bf0
const DIM_ALPHA = 0.1

const hsl = (h: number, s: number, l: number): number => {
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const v = l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)))
    return Math.round(255 * v)
  }
  return f(0) * 65536 + f(8) * 256 + f(4)
}

const groupColor = (group: number): number => hsl((group * 137.508) % 360, 0.45, 0.4)

const tagColor = (tag: string): number => {
  let hash = 0
  for (let i = 0; i < tag.length; i++) hash = Math.imul(hash, 31) + tag.charCodeAt(i)
  return hsl(Math.abs(hash) % 360, 0.48, 0.38)
}

const overlayTag = (tags: ReadonlyArray<string>) => {
  if (tags.length === 0) return undefined
  return [...tags].sort().join("\0")
}

const readCamera = () => {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(CAMERA_KEY) ?? "null")
    if (typeof value !== "object" || value === null) return undefined
    if (!("x" in value) || !("y" in value) || !("zoom" in value)) return undefined
    if (
      typeof value.x !== "number" ||
      typeof value.y !== "number" ||
      typeof value.zoom !== "number" ||
      !Number.isFinite(value.x) ||
      !Number.isFinite(value.y) ||
      !Number.isFinite(value.zoom)
    ) {
      return undefined
    }
    return {
      x: value.x,
      y: value.y,
      zoom: Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, value.zoom)),
    }
  } catch {
    return undefined
  }
}

type Placed = {
  readonly item: PileItem
  readonly x: number
  readonly y: number
}

type MinimapBounds = {
  readonly minX: number
  readonly minY: number
  readonly scale: number
  readonly offsetX: number
  readonly offsetY: number
}

type ScreenRect = {
  readonly left: number
  readonly top: number
  readonly right: number
  readonly bottom: number
}

export const hasCoords = (
  item: PileItem,
): item is PileItem & { readonly x: number; readonly y: number } => "x" in item && "y" in item

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
  const sourceRatio = Math.max(texture.width, 1) / Math.max(texture.height, 1)
  const targetRatio = (CARD_WIDTH - 2) / MEDIA_HEIGHT
  if (sourceRatio >= targetRatio) {
    sprite.width = CARD_WIDTH - 2
    sprite.height = sprite.width / sourceRatio
  } else {
    sprite.height = MEDIA_HEIGHT
    sprite.width = sprite.height * sourceRatio
  }
}

const snippet = (text: string, max: number) =>
  text.length <= max ? text : `${text.slice(0, max - 1)}…`

const addCopy = (root: Container, item: PileItem) => {
  const hasStill = "still" in item
  const top = hasStill ? MEDIA_HEIGHT + PAD : PAD
  const who = new Text({
    text: `@${item.handle} · ${new Date(item.timestamp).toLocaleDateString()}`,
    style: {
      fontFamily: "Arial, Helvetica, sans-serif",
      fontSize: 10,
      fontWeight: "600",
      fill: MUTE,
    },
  })
  who.x = PAD
  who.y = top
  root.addChild(who)
  const body = new Text({
    text: snippet(item.text, hasStill ? 46 : 72),
    style: {
      fontFamily: "Arial, Helvetica, sans-serif",
      fontSize: 11,
      fill: INK,
      lineHeight: 14,
      wordWrap: true,
      wordWrapWidth: CARD_WIDTH - PAD * 2,
      breakWords: true,
    },
  })
  body.x = PAD
  body.y = top + 17
  root.addChild(body)
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
  copyAdded: boolean
  generation: number
  readonly paintOrder: number
}

type Gesture =
  | { readonly kind: "idle" }
  | { readonly kind: "pan"; readonly offsetX: number; readonly offsetY: number }
  | {
      readonly kind: "press"
      readonly x: number
      readonly y: number
      readonly stack: ReadonlyArray<Mark>
      readonly additive: boolean
      readonly cycle: boolean
      moved: boolean
    }
  | {
      readonly kind: "marquee"
      readonly x: number
      readonly y: number
      readonly additive: boolean
      moved: boolean
    }

export type MapHandle = {
  readonly sync: (items: ReadonlyArray<PileItem>) => void
  readonly setHighlight: (ids: ReadonlySet<string> | undefined) => void
  readonly setGroups: (groups: ReadonlyMap<string, number> | undefined) => void
  readonly setTagOverlay: (enabled: boolean) => void
  readonly setSelection: (ids: ReadonlySet<string>) => void
  readonly focus: (id: string) => void
  readonly fitAll: () => void
  readonly zoomBy: (factor: number) => void
  readonly destroy: () => void
}

export const createMap = (
  host: HTMLElement,
  input: {
    readonly onSelectionChange?: (ids: ReadonlyArray<string>) => void
    readonly onDelete?: (ids: ReadonlyArray<string>) => void
  },
): MapHandle => {
  const app = new Application()
  const world = new Container()
  world.sortableChildren = true
  world.eventMode = "static"
  const grid = new Graphics()
  const overview = new Graphics()
  overview.visible = false
  const marquee = new Graphics()
  const minimap = new Container()
  const minimapBackground = new Graphics()
  const minimapPoints = new Graphics()
  const minimapViewport = new Graphics()
  const marks = new Map<string, Mark>()
  const buckets = new Map<string, Set<Mark>>()
  const visibleMarks = new Set<Mark>()
  const textures = new Map<string, Texture>()
  const selection = new Set<string>()
  let destroyed = false
  let ready = false
  let framed = false
  let spread = SPREAD_DEFAULT
  let gesture: Gesture = { kind: "idle" }
  let spaceHeld = false
  let highlight: ReadonlySet<string> | undefined
  let groups: ReadonlyMap<string, number> | undefined
  let tagOverlay = false
  let persistTimer: ReturnType<typeof setTimeout> | undefined
  let minimapFrame: number | undefined
  let updateVisible = () => undefined
  let drawOverview = () => undefined
  let cachedMinimapBounds: MinimapBounds | undefined
  let nextPaintOrder = 0
  let resizeObserver: ResizeObserver | undefined
  let pendingFocus: string | undefined

  minimap.addChild(minimapBackground, minimapPoints, minimapViewport)
  minimap.eventMode = "static"
  minimap.cursor = "crosshair"

  const screenOf = (worldX: number, worldY: number) => ({
    x: world.x + worldX * world.scale.x,
    y: world.y + worldY * world.scale.y,
  })

  const markScale = () => (world.scale.x < 1 ? 1 / Math.max(world.scale.x, 1e-6) : 1)

  const bucketKey = (x: number, y: number) =>
    `${String(Math.floor(x / BUCKET_SIZE))}:${String(Math.floor(y / BUCKET_SIZE))}`

  const indexMark = (mark: Mark) => {
    const key = bucketKey(mark.worldX, mark.worldY)
    const bucket = buckets.get(key)
    if (bucket === undefined) buckets.set(key, new Set([mark]))
    else bucket.add(mark)
  }

  const unindexMark = (mark: Mark) => {
    const key = bucketKey(mark.worldX, mark.worldY)
    const bucket = buckets.get(key)
    bucket?.delete(mark)
    if (bucket?.size === 0) buckets.delete(key)
  }

  const queryScreenRect = (rect: ScreenRect) => {
    const worldLeft = (rect.left - world.x) / world.scale.x
    const worldTop = (rect.top - world.y) / world.scale.y
    const worldRight = (rect.right - world.x) / world.scale.x
    const worldBottom = (rect.bottom - world.y) / world.scale.y
    const found = new Set<Mark>()
    for (
      let x = Math.floor(worldLeft / BUCKET_SIZE);
      x <= Math.floor(worldRight / BUCKET_SIZE);
      x++
    ) {
      for (
        let y = Math.floor(worldTop / BUCKET_SIZE);
        y <= Math.floor(worldBottom / BUCKET_SIZE);
        y++
      ) {
        const bucket = buckets.get(`${String(x)}:${String(y)}`)
        if (bucket === undefined) continue
        for (const mark of bucket) found.add(mark)
      }
    }
    return found
  }

  const minimapBounds = () => {
    if (cachedMinimapBounds !== undefined) return cachedMinimapBounds
    if (marks.size === 0) return undefined
    let minX = Number.POSITIVE_INFINITY
    let minY = Number.POSITIVE_INFINITY
    let maxX = Number.NEGATIVE_INFINITY
    let maxY = Number.NEGATIVE_INFINITY
    for (const mark of marks.values()) {
      minX = Math.min(minX, mark.worldX)
      minY = Math.min(minY, mark.worldY)
      maxX = Math.max(maxX, mark.worldX)
      maxY = Math.max(maxY, mark.worldY)
    }
    const width = Math.max(maxX - minX, 1)
    const height = Math.max(maxY - minY, 1)
    const scale = Math.min(
      (MINIMAP_WIDTH - MINIMAP_PAD * 2) / width,
      (MINIMAP_HEIGHT - MINIMAP_PAD * 2) / height,
    )
    cachedMinimapBounds = {
      minX,
      minY,
      scale,
      offsetX: (MINIMAP_WIDTH - width * scale) / 2,
      offsetY: (MINIMAP_HEIGHT - height * scale) / 2,
    }
    return cachedMinimapBounds
  }

  const drawMinimap = () => {
    if (!ready) return
    minimap.x = 16
    minimap.y = Math.max(16, host.clientHeight - MINIMAP_HEIGHT - 72)
    minimap.hitArea = new Rectangle(0, 0, MINIMAP_WIDTH, MINIMAP_HEIGHT)
    minimapBackground.clear()
    minimapBackground.roundRect(0, 0, MINIMAP_WIDTH, MINIMAP_HEIGHT, 12)
    minimapBackground.fill({ color: 0x080a0c, alpha: 0.94 })
    minimapBackground.stroke({ color: PLATE_LINE, width: 1 })
    minimapPoints.clear()
    minimapViewport.clear()
    const bounds = minimapBounds()
    if (bounds === undefined) return
    const stride = Math.max(1, Math.ceil(marks.size / MINIMAP_POINTS_MAX))
    let index = 0
    for (const mark of marks.values()) {
      if (index++ % stride !== 0) continue
      const x = bounds.offsetX + (mark.worldX - bounds.minX) * bounds.scale
      const y = bounds.offsetY + (mark.worldY - bounds.minY) * bounds.scale
      const group = groups?.get(mark.item.id)
      const tag = tagOverlay ? overlayTag(mark.item.tags) : undefined
      const color =
        group === undefined ? (tag === undefined ? MUTE : tagColor(tag)) : groupColor(group)
      minimapPoints.circle(x, y, group === undefined && tag === undefined ? 1.25 : 1.7)
      minimapPoints.fill({ color, alpha: 0.82 })
    }
    const worldLeft = -world.x / world.scale.x
    const worldTop = -world.y / world.scale.y
    minimapViewport.rect(
      bounds.offsetX + (worldLeft - bounds.minX) * bounds.scale,
      bounds.offsetY + (worldTop - bounds.minY) * bounds.scale,
      (host.clientWidth / world.scale.x) * bounds.scale,
      (host.clientHeight / world.scale.y) * bounds.scale,
    )
    minimapViewport.stroke({ color: SELECTED, width: 1.5 })
  }

  const markDimensions = (mark: Mark) => ({
    width: CARD_WIDTH,
    height: "still" in mark.item ? MEDIA_HEIGHT + 64 : TEXT_CARD_HEIGHT,
  })

  const hitsAt = (x: number, y: number) => {
    const scale = world.scale.x * markScale()
    return [
      ...queryScreenRect({
        left: x - CARD_WIDTH,
        top: y - CARD_WIDTH,
        right: x + CARD_WIDTH,
        bottom: y + CARD_WIDTH,
      }),
    ]
      .filter((mark) => {
        const center = screenOf(mark.worldX, mark.worldY)
        const size = markDimensions(mark)
        return (
          x >= center.x - (size.width * scale) / 2 &&
          x <= center.x + (size.width * scale) / 2 &&
          y >= center.y - (size.height * scale) / 2 &&
          y <= center.y + (size.height * scale) / 2
        )
      })
      .sort((a, b) => b.root.zIndex - a.root.zIndex || b.paintOrder - a.paintOrder)
  }

  const notifySelection = () => {
    for (const mark of marks.values()) {
      if (mark.root.visible) paintBacking(mark)
    }
    drawOverview()
    input.onSelectionChange?.([...selection])
  }

  const applySizes = () => {
    const local = markScale()
    for (const mark of visibleMarks) {
      mark.generation += 1
      mark.root.scale.set(local)
      void paintMark(mark)
    }
  }

  const scheduleMinimap = () => {
    if (minimapFrame !== undefined) return
    minimapFrame = requestAnimationFrame(() => {
      minimapFrame = undefined
      drawMinimap()
    })
  }

  const viewChanged = () => {
    updateVisible()
    scheduleMinimap()
    if (persistTimer !== undefined) clearTimeout(persistTimer)
    const snapshot = { x: world.x, y: world.y, zoom: world.scale.x }
    persistTimer = setTimeout(() => {
      localStorage.setItem(CAMERA_KEY, JSON.stringify(snapshot))
    }, 120)
  }

  const paintBacking = (mark: Mark) => {
    const hasStill = "still" in mark.item
    const w = CARD_WIDTH
    const h = hasStill ? MEDIA_HEIGHT + 64 : TEXT_CARD_HEIGHT
    const group = groups?.get(mark.item.id)
    const tag = tagOverlay ? overlayTag(mark.item.tags) : undefined
    const tint =
      group === undefined ? (tag === undefined ? PLATE_FILL : tagColor(tag)) : groupColor(group)
    mark.backing.clear()
    mark.backing.roundRect(0, 0, w, h, 12)
    mark.backing.fill({
      color: tint,
      alpha: group === undefined && tag === undefined ? 1 : 0.42,
    })
    mark.backing.stroke({
      color: selection.has(mark.item.id) ? SELECTED : PLATE_LINE,
      width: selection.has(mark.item.id) ? 2 : 1,
    })
    mark.root.pivot.set(w / 2, h / 2)
    mark.root.zIndex = selection.has(mark.item.id) ? 10 : 0
  }

  const applyMarkState = (mark: Mark) => {
    mark.root.alpha = highlight !== undefined && !highlight.has(mark.item.id) ? DIM_ALPHA : 1
  }

  drawOverview = () => {
    overview.clear()
    overview.visible = world.scale.x < OVERVIEW_ZOOM
    if (!overview.visible) return
    const stride = Math.max(1, Math.ceil(marks.size / OVERVIEW_MARKS_MAX))
    let index = 0
    for (const mark of marks.values()) {
      const selected = selection.has(mark.item.id)
      const keep = selected || index % stride === 0
      index += 1
      if (!keep) continue
      const group = groups?.get(mark.item.id)
      const tag = tagOverlay ? overlayTag(mark.item.tags) : undefined
      const color = selected
        ? SELECTED
        : group === undefined
          ? tag === undefined
            ? PLATE_FILL
            : tagColor(tag)
          : groupColor(group)
      const height = "still" in mark.item ? MEDIA_HEIGHT + 64 : TEXT_CARD_HEIGHT
      overview.roundRect(
        mark.worldX - CARD_WIDTH / 2,
        mark.worldY - height / 2,
        CARD_WIDTH,
        height,
        9,
      )
      overview.fill({
        color,
        alpha: highlight !== undefined && !highlight.has(mark.item.id) ? DIM_ALPHA : 0.8,
      })
      overview.stroke({
        color: selected ? SELECTED : PLATE_LINE,
        width: selected ? 4 : 1.5,
      })
    }
  }

  const loadTexture = async (url: string): Promise<Texture | undefined> => {
    const hit = textures.get(url)
    if (hit !== undefined) return hit
    try {
      const response = await fetch(url)
      if (!response.ok) return undefined
      const blob = new Blob([await response.arrayBuffer()], { type: "image/webp" })
      const objectUrl = URL.createObjectURL(blob)
      const texture = (await Assets.load({ src: objectUrl, parser: "loadTextures" }).finally(() =>
        URL.revokeObjectURL(objectUrl),
      )) as Texture
      textures.set(url, texture)
      return texture
    } catch {
      return undefined
    }
  }

  const paintMark = async (mark: Mark) => {
    if (!("still" in mark.item) || !mark.root.visible || world.scale.x < OVERVIEW_ZOOM) return
    const generation = mark.generation
    const rung = pickRung(CARD_WIDTH * world.scale.x * markScale() * (window.devicePixelRatio || 1))
    if (mark.rung === rung && mark.sprite !== undefined) return
    const url = rungUrl(mark.item.still, rung)
    const texture = await loadTexture(url)
    if (
      destroyed ||
      texture === undefined ||
      !mark.root.visible ||
      marks.get(mark.item.id) !== mark ||
      generation !== mark.generation
    ) {
      if (texture !== undefined && textures.get(url) === texture) {
        textures.delete(url)
        texture.destroy(true)
      }
      return
    }
    const oldRung = mark.rung
    const oldTexture = mark.sprite?.texture
    mark.rung = rung
    if (mark.sprite === undefined) {
      mark.sprite = new Sprite(texture)
      mark.root.addChildAt(mark.sprite, 1)
    } else {
      mark.sprite.texture = texture
    }
    if (oldTexture !== undefined && oldTexture !== texture && oldRung !== undefined) {
      textures.delete(rungUrl(mark.item.still, oldRung))
      oldTexture.destroy(true)
    }
    sizeSprite(mark.sprite, texture)
    mark.sprite.x = (CARD_WIDTH - mark.sprite.width) / 2
    mark.sprite.y = 1
    paintBacking(mark)
    mark.root.scale.set(markScale())
  }

  updateVisible = () => {
    if (!ready) return
    const isOverview = world.scale.x < OVERVIEW_ZOOM
    const overviewChanged = overview.visible !== isOverview
    overview.visible = isOverview
    const next = isOverview
      ? new Set<Mark>()
      : queryScreenRect({
          left: -VIEW_MARGIN - CARD_WIDTH,
          top: -VIEW_MARGIN - MEDIA_HEIGHT,
          right: host.clientWidth + VIEW_MARGIN + CARD_WIDTH,
          bottom: host.clientHeight + VIEW_MARGIN + MEDIA_HEIGHT,
        })
    for (const mark of visibleMarks) {
      if (next.has(mark)) continue
      mark.root.visible = false
      visibleMarks.delete(mark)
      mark.generation += 1
      if (mark.sprite !== undefined) {
        const url =
          "still" in mark.item && mark.rung !== undefined
            ? rungUrl(mark.item.still, mark.rung)
            : undefined
        const texture = mark.sprite.texture
        mark.root.removeChild(mark.sprite)
        mark.sprite.destroy()
        texture.destroy(true)
        if (url !== undefined) textures.delete(url)
        mark.sprite = undefined
        mark.rung = undefined
      }
      for (const child of mark.root.children.slice()) {
        if (child === mark.backing) continue
        mark.root.removeChild(child)
        child.destroy()
      }
      mark.copyAdded = false
    }
    for (const mark of next) {
      if (visibleMarks.has(mark)) continue
      mark.root.visible = true
      visibleMarks.add(mark)
      if (!mark.copyAdded) {
        addCopy(mark.root, mark.item)
        mark.copyAdded = true
      }
      mark.root.scale.set(markScale())
      paintBacking(mark)
      applyMarkState(mark)
      void paintMark(mark)
    }
    if (overviewChanged && isOverview) drawOverview()
  }

  const addMark = (placed: Placed) => {
    const root = new Container()
    root.eventMode = "none"
    root.x = placed.x
    root.y = placed.y
    root.scale.set(markScale())
    root.visible = false
    const backing = new Graphics()
    root.addChild(backing)
    const mark: Mark = {
      item: placed.item,
      worldX: placed.x,
      worldY: placed.y,
      root,
      backing,
      sprite: undefined,
      rung: undefined,
      copyAdded: false,
      generation: 0,
      paintOrder: nextPaintOrder++,
    }
    world.addChild(root)
    marks.set(placed.item.id, mark)
    indexMark(mark)
  }

  const frameOnce = () => {
    if (framed || !ready || marks.size === 0) return
    framed = true
    const saved = readCamera()
    if (saved !== undefined) {
      world.x = saved.x
      world.y = saved.y
      world.scale.set(saved.zoom)
      applySizes()
      viewChanged()
      return
    }
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
    viewChanged()
  }

  const sync = (items: ReadonlyArray<PileItem>) => {
    cachedMinimapBounds = undefined
    const placed = place(items, spread)
    const seen = new Set<string>()
    for (const node of placed) {
      seen.add(node.item.id)
      const existing = marks.get(node.item.id)
      if (existing === undefined) {
        addMark(node)
        continue
      }
      const presentationChanged =
        existing.item.text !== node.item.text ||
        existing.item.handle !== node.item.handle ||
        existing.item.timestamp !== node.item.timestamp ||
        "still" in existing.item !== "still" in node.item
      if (presentationChanged) {
        existing.generation += 1
        existing.copyAdded = false
        for (const child of existing.root.children.slice()) {
          if (child === existing.backing) continue
          existing.root.removeChild(child)
          child.destroy()
        }
        existing.sprite = undefined
        existing.rung = undefined
      }
      existing.item = node.item
      if (existing.worldX !== node.x || existing.worldY !== node.y) {
        unindexMark(existing)
        existing.worldX = node.x
        existing.worldY = node.y
        existing.root.x = node.x
        existing.root.y = node.y
        indexMark(existing)
      }
      applyMarkState(existing)
      if (existing.sprite === undefined && existing.root.visible) void paintMark(existing)
    }
    for (const [id, mark] of marks) {
      if (seen.has(id)) continue
      world.removeChild(mark.root)
      mark.root.destroy({ children: true })
      mark.generation += 1
      unindexMark(mark)
      visibleMarks.delete(mark)
      marks.delete(id)
      selection.delete(id)
    }
    frameOnce()
    flushFocus()
    updateVisible()
    drawOverview()
    drawMinimap()
  }

  const onMove = (event: FederatedPointerEvent) => {
    if (gesture.kind === "pan") {
      world.x = event.global.x - gesture.offsetX
      world.y = event.global.y - gesture.offsetY
      viewChanged()
      return
    }
    if (gesture.kind === "press") {
      if (Math.hypot(event.global.x - gesture.x, event.global.y - gesture.y) > 3) {
        gesture.moved = true
      }
      return
    }
    if (gesture.kind !== "marquee") return
    if (Math.hypot(event.global.x - gesture.x, event.global.y - gesture.y) > 3) {
      gesture.moved = true
    }
    marquee.clear()
    marquee.rect(
      Math.min(gesture.x, event.global.x),
      Math.min(gesture.y, event.global.y),
      Math.abs(event.global.x - gesture.x),
      Math.abs(event.global.y - gesture.y),
    )
    marquee.fill({ color: SELECTED, alpha: 0.09 })
    marquee.stroke({ color: SELECTED, width: 1 })
  }

  const completeGesture = (event: FederatedPointerEvent) => {
    const completed = gesture
    gesture = { kind: "idle" }
    marquee.clear()
    if (completed.kind === "press" && !completed.moved) {
      let picked = completed.stack[0]
      if (completed.cycle) {
        const cycle = [...completed.stack].sort((a, b) => b.paintOrder - a.paintOrder)
        const selectedIndex = cycle.findIndex((mark) => selection.has(mark.item.id))
        picked = cycle[(selectedIndex + 1) % cycle.length]
      }
      if (picked === undefined) return
      if (completed.additive) {
        if (selection.has(picked.item.id)) selection.delete(picked.item.id)
        else selection.add(picked.item.id)
      } else {
        selection.clear()
        selection.add(picked.item.id)
      }
      notifySelection()
      return
    }
    if (completed.kind !== "marquee") return
    if (!completed.moved) {
      if (!completed.additive && selection.size > 0) {
        selection.clear()
        notifySelection()
      }
      return
    }
    const left = Math.min(completed.x, event.global.x)
    const right = Math.max(completed.x, event.global.x)
    const top = Math.min(completed.y, event.global.y)
    const bottom = Math.max(completed.y, event.global.y)
    if (!completed.additive) selection.clear()
    const scale = world.scale.x * markScale()
    for (const mark of queryScreenRect({
      left: left - CARD_WIDTH,
      top: top - MEDIA_HEIGHT,
      right: right + CARD_WIDTH,
      bottom: bottom + MEDIA_HEIGHT,
    })) {
      const center = screenOf(mark.worldX, mark.worldY)
      const size = markDimensions(mark)
      const markLeft = center.x - (size.width * scale) / 2
      const markRight = center.x + (size.width * scale) / 2
      const markTop = center.y - (size.height * scale) / 2
      const markBottom = center.y + (size.height * scale) / 2
      if (markRight >= left && markLeft <= right && markBottom >= top && markTop <= bottom) {
        selection.add(mark.item.id)
      }
    }
    notifySelection()
  }

  const applyFocus = (id: string) => {
    const mark = marks.get(id)
    if (mark === undefined || !ready) return false
    const width = host.clientWidth
    const height = host.clientHeight
    if (width <= 0 || height <= 0) return false
    if (world.scale.x < 0.55) world.scale.set(0.55)
    world.x = width / 2 - mark.worldX * world.scale.x
    world.y = height / 2 - mark.worldY * world.scale.y
    applySizes()
    viewChanged()
    return true
  }

  const flushFocus = () => {
    if (pendingFocus === undefined) return
    if (applyFocus(pendingFocus)) pendingFocus = undefined
  }

  const focus = (id: string) => {
    pendingFocus = id
    flushFocus()
  }

  const zoomAt = (factor: number, x: number, y: number) => {
    const next = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, world.scale.x * factor))
    const before = {
      x: (x - world.x) / world.scale.x,
      y: (y - world.y) / world.scale.y,
    }
    world.scale.set(next)
    world.x = x - before.x * next
    world.y = y - before.y * next
    applySizes()
    viewChanged()
  }

  const fitAll = () => {
    flushFocus()
    if (marks.size === 0) return
    let minX = Number.POSITIVE_INFINITY
    let minY = Number.POSITIVE_INFINITY
    let maxX = Number.NEGATIVE_INFINITY
    let maxY = Number.NEGATIVE_INFINITY
    for (const mark of marks.values()) {
      minX = Math.min(minX, mark.worldX)
      minY = Math.min(minY, mark.worldY)
      maxX = Math.max(maxX, mark.worldX)
      maxY = Math.max(maxY, mark.worldY)
    }
    const width = Math.max(maxX - minX + CARD_WIDTH * 2, 1)
    const height = Math.max(maxY - minY + TEXT_CARD_HEIGHT * 2, 1)
    const next = Math.min(
      1,
      Math.max(
        ZOOM_MIN,
        Math.min((host.clientWidth - 80) / width, (host.clientHeight - 80) / height),
      ),
    )
    world.scale.set(next)
    world.x = host.clientWidth / 2 - ((minX + maxX) / 2) * next
    world.y = host.clientHeight / 2 - ((minY + maxY) / 2) * next
    applySizes()
    viewChanged()
  }

  const start = async () => {
    await app.init({
      resizeTo: host,
      background: 0x000000,
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
    world.addChildAt(overview, 1)
    host.appendChild(app.canvas)
    app.canvas.tabIndex = 0
    app.canvas.setAttribute("aria-label", "Bookmark canvas")
    app.canvas.setAttribute("role", "application")
    app.stage.addChild(world, marquee, minimap)
    world.x = host.clientWidth / 2
    world.y = host.clientHeight / 2
    minimap.on("pointerdown", (event: FederatedPointerEvent) => {
      event.stopPropagation()
      const bounds = minimapBounds()
      if (bounds === undefined) return
      const local = minimap.toLocal(event.global)
      const worldX = (local.x - bounds.offsetX) / bounds.scale + bounds.minX
      const worldY = (local.y - bounds.offsetY) / bounds.scale + bounds.minY
      world.x = host.clientWidth / 2 - worldX * world.scale.x
      world.y = host.clientHeight / 2 - worldY * world.scale.y
      applySizes()
      viewChanged()
    })
    frameOnce()
    flushFocus()
    app.stage.eventMode = "static"
    app.stage.hitArea = app.screen
    app.stage.on("pointerdown", (event: FederatedPointerEvent) => {
      app.canvas.focus()
      if (spaceHeld || event.button === 1) {
        gesture = {
          kind: "pan",
          offsetX: event.global.x - world.x,
          offsetY: event.global.y - world.y,
        }
        return
      }
      const stack = hitsAt(event.global.x, event.global.y)
      gesture =
        stack.length === 0
          ? {
              kind: "marquee",
              x: event.global.x,
              y: event.global.y,
              additive: event.shiftKey,
              moved: false,
            }
          : {
              kind: "press",
              x: event.global.x,
              y: event.global.y,
              stack,
              additive: event.shiftKey,
              cycle: event.metaKey || event.ctrlKey,
              moved: false,
            }
    })
    app.stage.on("pointerup", completeGesture)
    app.stage.on("pointerupoutside", completeGesture)
    app.stage.on("pointermove", onMove)
    app.canvas.addEventListener(
      "wheel",
      (event) => {
        event.preventDefault()
        zoomAt(event.deltaY < 0 ? 1.1 : 0.91, event.offsetX, event.offsetY)
      },
      { passive: false },
    )
    app.canvas.addEventListener("keydown", (event) => {
      if (event.code === "Space") {
        event.preventDefault()
        spaceHeld = true
      }
      if ((event.key === "Delete" || event.key === "Backspace") && selection.size > 0) {
        event.preventDefault()
        input.onDelete?.([...selection])
      }
      if (event.key === "Escape" && selection.size > 0) {
        selection.clear()
        notifySelection()
      }
    })
    app.canvas.addEventListener("keyup", (event) => {
      if (event.code === "Space") spaceHeld = false
    })
    resizeObserver = new ResizeObserver(() => {
      app.stage.hitArea = app.screen
      flushFocus()
      updateVisible()
      drawMinimap()
    })
    resizeObserver.observe(host)
  }
  void start()

  return {
    sync: (items) => {
      if (destroyed) return
      sync(items)
    },
    setHighlight: (ids) => {
      if (destroyed) return
      highlight = ids
      for (const mark of marks.values()) applyMarkState(mark)
      drawOverview()
    },
    setGroups: (map) => {
      if (destroyed) return
      groups = map
      for (const mark of marks.values()) {
        if (mark.root.visible) paintBacking(mark)
      }
      drawOverview()
      drawMinimap()
    },
    setTagOverlay: (enabled) => {
      if (destroyed || tagOverlay === enabled) return
      tagOverlay = enabled
      for (const mark of marks.values()) {
        if (mark.root.visible) paintBacking(mark)
      }
      drawOverview()
      drawMinimap()
    },
    setSelection: (ids) => {
      if (destroyed) return
      selection.clear()
      for (const id of ids) {
        if (marks.has(id)) selection.add(id)
      }
      notifySelection()
    },
    focus,
    fitAll,
    zoomBy: (factor) => {
      flushFocus()
      zoomAt(factor, host.clientWidth / 2, host.clientHeight / 2)
    },
    destroy: () => {
      destroyed = true
      if (persistTimer !== undefined) clearTimeout(persistTimer)
      if (minimapFrame !== undefined) cancelAnimationFrame(minimapFrame)
      resizeObserver?.disconnect()
      marks.clear()
      textures.clear()
      if (ready) app.destroy(true, { children: true, texture: true, textureSource: true })
    },
  }
}
