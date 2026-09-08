import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { expect, test } from "@playwright/test"
import { Schema } from "effect"
import { BookmarkList, ClusterResult, Health } from "../../packages/server/src/http/schema.ts"
import { BookmarkDump } from "../../packages/server/src/schema.ts"

const fixturePath = (name: string) =>
  fileURLToPath(new URL(`./fixtures/${encodeURIComponent(name)}`, import.meta.url))
const alphaId = "1990000000000000123"
const alphaText = "Verification bookmark for the semantic canvas"
const overlapText = "Shared overlap vector for deterministic selection"

test("the deterministic canvas workflow", async ({ context, page, request }) => {
  const browserErrors: Array<string> = []
  page.on("pageerror", (error) => browserErrors.push(error.message))
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().startsWith("Failed to load resource")) {
      browserErrors.push(message.text())
    }
  })
  page.on("response", (response) => {
    const path = new URL(response.url()).pathname
    if (response.status() >= 400 && path !== "/favicon.ico") {
      browserErrors.push(`${String(response.status())} ${path}`)
    }
  })
  await context.grantPermissions(["clipboard-read", "clipboard-write"])
  await page.addInitScript(() => {
    Date.now = () => Date.parse("2026-09-08T00:00:00.000Z")
  })
  await page.goto("/")

  const canvas = page.getByRole("application", { name: "Bookmark canvas" })
  const input = page.getByLabel("Import bookmarks JSON")
  await expect(canvas).toBeVisible()
  await expect(page.getByText("Your canvas is empty.")).toBeVisible()

  const firstFixture = await readFile(fixturePath("bookmarks.json"))
  const dataTransfer = await page.evaluateHandle((encoded) => {
    const bytes = Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0))
    const transfer = new DataTransfer()
    transfer.items.add(new File([bytes], "bookmarks.json", { type: "application/json" }))
    return transfer
  }, firstFixture.toString("base64"))
  await page.locator("main").dispatchEvent("drop", { dataTransfer })
  await expect(page.getByText("Imported 1, updated 0, kept 0 deleted.")).toBeVisible()
  await expect(page.getByText("1 ready · 0 embedding").last()).toBeVisible()

  await page.getByText("1 ready · 0 embedding").last().click()
  await expect(page.getByText("Canvas status")).toBeVisible()
  await expect(page.getByText("Import idle")).toBeVisible()
  await expect(page.getByText("Semantic model ready")).toBeVisible()
  await page.getByText("1 ready · 0 embedding").last().click()

  const box = await canvas.boundingBox()
  expect(box).not.toBeNull()
  if (box === null) return
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  await expect(page.getByRole("heading", { name: "Bookmark" })).toBeVisible()
  await expect(page.getByText(alphaText)).toBeVisible()

  const tagInput = page.getByLabel("Add tag")
  await tagInput.fill("solo")
  await tagInput.press("Enter")
  await expect(page.getByRole("button", { name: "Remove solo" })).toBeVisible()
  await page.getByRole("button", { name: "Remove solo" }).click()
  await expect(page.getByRole("button", { name: "Remove solo" })).toBeHidden()

  const search = page.getByLabel("Search the canvas")
  await search.fill(alphaText)
  await search.press("Enter")
  const alphaResult = page.getByRole("button").filter({ hasText: alphaText })
  await expect(alphaResult).toBeVisible()
  await alphaResult.click()
  await expect(page.getByText(alphaText)).toBeVisible()

  const firstClusterResponse = page.waitForResponse(
    (response) => new URL(response.url()).pathname === "/api/clusters" && response.ok(),
  )
  await page.getByRole("button", { name: "Clusters" }).click()
  const firstCluster = Schema.decodeUnknownSync(ClusterResult)(
    await (await firstClusterResponse).json(),
  )
  expect(firstCluster.members.map((member) => member.id)).toEqual([alphaId])
  await page.getByRole("button", { name: "Clusters" }).click()

  await input.setInputFiles(fixturePath("bookmarks-more.json"))
  await expect(page.getByText("Imported 2, updated 0, kept 0 deleted.")).toBeVisible()
  await expect(page.getByText("3 ready · 0 embedding").last()).toBeVisible()

  await page.getByRole("button", { name: "Fit" }).click()
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("xkeep.camera.v1")))
    .not.toBeNull()
  const fittedCamera = await page.evaluate(() => localStorage.getItem("xkeep.camera.v1"))
  await page.getByRole("button", { name: "Zoom in" }).click()
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("xkeep.camera.v1")))
    .not.toBe(fittedCamera)
  const zoomedCamera = await page.evaluate(() => localStorage.getItem("xkeep.camera.v1"))
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.wheel(0, -300)
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("xkeep.camera.v1")))
    .not.toBe(zoomedCamera)
  const wheeledCamera = await page.evaluate(() => localStorage.getItem("xkeep.camera.v1"))
  await canvas.focus()
  await page.keyboard.down("Space")
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2 + 80, { steps: 8 })
  await page.mouse.up()
  await page.keyboard.up("Space")
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("xkeep.camera.v1")))
    .not.toBe(wheeledCamera)
  const spacePannedCamera = await page.evaluate(() => localStorage.getItem("xkeep.camera.v1"))
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down({ button: "middle" })
  await page.mouse.move(box.x + box.width / 2 - 80, box.y + box.height / 2 + 40, { steps: 8 })
  await page.mouse.up({ button: "middle" })
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("xkeep.camera.v1")))
    .not.toBe(spacePannedCamera)
  const pannedCamera = await page.evaluate(() => localStorage.getItem("xkeep.camera.v1"))
  await page.mouse.click(box.x + 92, box.y + box.height - 138)
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("xkeep.camera.v1")))
    .not.toBe(pannedCamera)
  const persistedCamera = await page.evaluate(() => localStorage.getItem("xkeep.camera.v1"))
  await page.reload()
  await expect(canvas).toBeVisible()
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("xkeep.camera.v1")))
    .toBe(persistedCamera)

  await search.fill(overlapText)
  await search.press("Enter")
  const betaResult = page.getByRole("button").filter({ hasText: "@verify_beta" })
  await expect(betaResult).toBeVisible()
  await betaResult.click()
  await page.getByLabel("Add tag").fill("mixed")
  await page.getByLabel("Add tag").press("Enter")
  await expect(page.getByRole("button", { name: "Remove mixed" })).toBeVisible()
  await page.getByRole("button", { name: "Close inspector" }).click()
  for (let step = 0; step < 8; step++) {
    await page.getByRole("button", { name: "Zoom out" }).click()
  }
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  const firstOverlapDetail = await page.locator("aside").textContent()
  await page.keyboard.down("Control")
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  await page.keyboard.up("Control")
  const secondOverlapDetail = await page.locator("aside").textContent()
  expect(secondOverlapDetail).not.toBe(firstOverlapDetail)
  await page.keyboard.down("Control")
  await page.keyboard.down("Shift")
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  await page.keyboard.up("Shift")
  await page.keyboard.up("Control")
  await expect(page.getByText("2 bookmarks", { exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: "Apply mixed" })).toBeVisible()
  await page.getByRole("button", { name: "Apply mixed" }).click()
  await expect(page.getByRole("button", { name: "Remove mixed" })).toBeVisible()

  await page.getByRole("button", { name: "Copy links" }).click()
  await expect(page.getByText("Links copied.")).toBeVisible()
  expect((await page.evaluate(() => navigator.clipboard.readText())).split("\n")).toHaveLength(2)
  const downloadPromise = page.waitForEvent("download")
  await page.getByRole("button", { name: "Export selection" }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe("xkeep-selection.json")

  await canvas.focus()
  await canvas.press("Escape")
  await page.getByRole("button", { name: "Fit" }).click()
  await page.mouse.move(box.x + box.width - 8, box.y + box.height - 90)
  await page.mouse.down()
  await page.mouse.move(box.x + 8, box.y + 90, { steps: 20 })
  await page.mouse.up()
  await expect(page.getByText("3 bookmarks", { exact: true })).toBeVisible()

  await page.getByLabel("Add tag").fill("bulk")
  await page.getByLabel("Add tag").press("Enter")
  await expect
    .poll(async () => {
      const response = await request.get("/api/bookmarks")
      const listed = Schema.decodeUnknownSync(BookmarkList)(await response.json())
      return listed.bookmarks.filter((bookmark) => bookmark.tags.includes("bulk")).length
    })
    .toBe(3)

  await page.getByRole("button", { name: /^Filters/ }).click()
  await page.getByRole("button", { name: "link", exact: true }).click()
  await page.getByLabel("Tag", { exact: true }).selectOption("bulk")
  await page.getByLabel("Author").selectOption("verify_beta")
  await page.getByLabel("Saved").selectOption("30")
  await expect(page.getByRole("button", { name: "Filters · 4" })).toBeVisible()
  const filteredCanvas = await canvas.screenshot()
  await search.fill(alphaText)
  await search.press("Enter")
  await expect.poll(async () => (await canvas.screenshot()).equals(filteredCanvas)).toBe(false)
  await page.getByLabel("Clear search").click()
  await page.getByRole("button", { name: "Clear all" }).click()
  await page.getByRole("button", { name: "Done" }).click()

  const plainCanvas = await canvas.screenshot()
  await page.getByRole("button", { name: "Tags" }).click()
  await expect.poll(async () => (await canvas.screenshot()).equals(plainCanvas)).toBe(false)
  const clusterResponse = page.waitForResponse(
    (response) => new URL(response.url()).pathname === "/api/clusters" && response.ok(),
  )
  await page.getByRole("button", { name: "Clusters" }).click()
  const cluster = Schema.decodeUnknownSync(ClusterResult)(await (await clusterResponse).json())
  expect(cluster.members).toHaveLength(3)
  await page.getByRole("button", { name: /^Filters/ }).click()
  const clusterCount = page.getByLabel(/^Cluster count/)
  await expect(clusterCount).toBeVisible()
  await page.getByRole("button", { name: "Tags" }).click()
  await expect(clusterCount).toBeHidden()
  await page.getByRole("button", { name: "Done" }).click()

  await canvas.focus()
  await canvas.press("Delete")
  await expect(page.getByRole("dialog", { name: "Remove bookmark 1 of 3" })).toBeVisible()
  await page.getByRole("button", { name: "Cancel" }).click()
  await page.getByRole("button", { name: "Delete", exact: true }).click()
  for (let remaining = 3; remaining > 0; remaining -= 1) {
    await expect(
      page.getByRole("dialog", { name: `Remove bookmark ${String(4 - remaining)} of 3` }),
    ).toBeVisible()
    await page.getByRole("button", { name: "Removed on X" }).click()
  }
  await expect(page.getByText("3 bookmarks removed.")).toBeVisible()
  await expect(page.getByText("Your canvas is empty.")).toBeVisible()

  await input.setInputFiles(fixturePath("bookmarks.json"))
  await expect(page.getByText("Imported 0, updated 0, kept 1 deleted.")).toBeVisible()
  const finalHealthResponse = await request.get("/api/health")
  const finalHealth = Schema.decodeUnknownSync(Health)(await finalHealthResponse.json())
  expect(finalHealth.bookmarks).toBe(0)
  const deletedResponse = await request.get(`/api/bookmarks/${alphaId}`)
  expect(deletedResponse.status()).toBe(404)
  expect(browserErrors).toEqual([])

  const exportedPath = await download.path()
  expect(exportedPath).not.toBeNull()
  if (exportedPath !== null) {
    const exported = Schema.decodeUnknownSync(Schema.fromJsonString(BookmarkDump))(
      await readFile(exportedPath, "utf8"),
    )
    expect(exported.bookmarks).toHaveLength(2)
  }
})
