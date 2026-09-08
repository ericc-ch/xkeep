const fs = await importModule("node:fs")
const path = await importModule("node:path")

const current = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), ".audit", "verify-xkeep", "current.json"), "utf8"),
)
const verifyUrl = current.url
const evidenceDir = current.evidenceDir
if (!verifyUrl || !evidenceDir) throw new Error("launch the verification server first")

fs.mkdirSync(evidenceDir, { recursive: true })
const fixtureFile = (name) => ({
  name,
  mimeType: "application/json",
  buffer: fs.readFileSync(
    path.join(process.cwd(), ".agents", "skills", "verify-xkeep", "fixtures", name),
  ),
})
const alphaId = "1990000000000000123"
const alphaText = "Verification bookmark for the semantic canvas"
const featureName = "all browser mutations"
const expectedApiPaths = [
  "/api/imports",
  "/api/search",
  `/api/bookmarks/${alphaId}`,
  "/api/clusters",
  `/api/bookmarks/${alphaId}/tags/solo`,
  "/api/bookmarks/tags",
  "/api/bookmark-deletions",
]

let page

const readJson = async (url) =>
  page.evaluate(async (resource) => {
    const response = await fetch(resource)
    if (!response.ok) throw new Error(`${response.status} ${resource}`)
    return response.json()
  }, url)

const poll = async (label, read, accept) => {
  let value
  for (let attempt = 0; attempt < 250; attempt += 1) {
    value = await read()
    if (accept(value)) return value
    await page.waitForTimeout(100)
  }
  throw new Error(`${label} timed out: ${JSON.stringify(value)}`)
}

try {
  page = await context.newPage()
  state.page = page
  await page.setViewportSize({ width: 1440, height: 960 })
  await page.goto(verifyUrl)
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await waitForPageLoad({ page, timeout: 10_000 })

  const canvas = page.getByRole("application", { name: "Bookmark canvas" })
  const input = page.getByLabel("Import bookmarks JSON")
  await canvas.waitFor({ state: "visible" })
  await page.getByText("Your canvas is empty.").waitFor({ state: "visible" })
  await input.setInputFiles(fixtureFile("bookmarks.json"))
  await page
    .getByText("Imported 1, updated 0, kept 0 deleted.")
    .waitFor({ state: "visible", timeout: 15_000 })

  const firstImport = await poll(
    "first bookmark embedding and projection",
    async () => ({
      health: await readJson("/api/health"),
      bookmarks: await readJson("/api/bookmarks"),
    }),
    (value) => {
      const bookmark = value.bookmarks.bookmarks[0]
      return (
        value.health.embedded === 1 &&
        bookmark?.id === alphaId &&
        typeof bookmark.x === "number" &&
        typeof bookmark.y === "number"
      )
    },
  )

  await page.getByText("1 ready · 0 embedding").waitFor({ state: "visible", timeout: 10_000 })
  const box = await canvas.boundingBox()
  if (!box) throw new Error("bookmark canvas has no bounding box")
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  await page.getByRole("heading", { name: "Bookmark" }).waitFor({ state: "visible" })
  await page.getByText(alphaText).waitFor({ state: "visible" })

  const tagInput = page.getByLabel("Add tag")
  await tagInput.fill("solo")
  await tagInput.press("Enter")
  await poll(
    "single tag addition",
    () => readJson(`/api/bookmarks/${alphaId}`),
    (bookmark) => bookmark.tags.includes("solo"),
  )
  await page.getByRole("button", { name: "Remove solo" }).click()
  await poll(
    "single tag removal",
    () => readJson(`/api/bookmarks/${alphaId}`),
    (bookmark) => !bookmark.tags.includes("solo"),
  )

  const search = page.getByLabel("Search the canvas")
  await search.fill(alphaText)
  await search.press("Enter")
  const result = page.getByRole("button").filter({ hasText: alphaText })
  await result.waitFor({ state: "visible", timeout: 10_000 })
  await result.click()
  await page.getByRole("heading", { name: "Bookmark" }).waitFor({ state: "visible" })
  await page.getByText(alphaText).waitFor({ state: "visible" })

  const clusterResponse = page.waitForResponse(
    (response) => new URL(response.url()).pathname === "/api/clusters" && response.ok(),
  )
  await page.getByRole("button", { name: "Clusters" }).click()
  const cluster = await (await clusterResponse).json()
  if (cluster.members.length !== 1 || cluster.members[0]?.id !== alphaId) {
    throw new Error(`unexpected cluster response: ${JSON.stringify(cluster)}`)
  }
  await page.getByRole("button", { name: "Clusters" }).click()

  await input.setInputFiles(fixtureFile("bookmarks-more.json"))
  await page
    .getByText("Imported 2, updated 0, kept 0 deleted.")
    .waitFor({ state: "visible", timeout: 15_000 })
  const allImported = await poll(
    "three bookmark embedding and projection",
    async () => ({
      health: await readJson("/api/health"),
      bookmarks: await readJson("/api/bookmarks"),
    }),
    (value) =>
      value.health.embedded === 3 &&
      value.bookmarks.bookmarks.length === 3 &&
      value.bookmarks.bookmarks.every(
        (bookmark) => typeof bookmark.x === "number" && typeof bookmark.y === "number",
      ),
  )

  await page.getByText("3 ready · 0 embedding").waitFor({ state: "visible", timeout: 10_000 })
  await canvas.focus()
  await canvas.press("Escape")
  await page.getByRole("heading", { name: "Bookmark" }).waitFor({ state: "hidden" })
  await page.getByRole("button", { name: "Fit" }).click()
  await page.mouse.move(box.x + box.width - 8, box.y + box.height - 90)
  await page.mouse.down()
  await page.mouse.move(box.x + 8, box.y + 90, { steps: 20 })
  await page.mouse.up()
  await page.getByText("3 bookmarks", { exact: true }).waitFor({ state: "visible" })

  await page.getByLabel("Add tag").fill("bulk")
  await page.getByLabel("Add tag").press("Enter")
  await poll(
    "bulk tag addition",
    async () =>
      Promise.all(
        allImported.bookmarks.bookmarks.map((bookmark) =>
          readJson(`/api/bookmarks/${bookmark.id}`),
        ),
      ),
    (bookmarks) => bookmarks.every((bookmark) => bookmark.tags.includes("bulk")),
  )

  await page.screenshot({
    path: path.join(evidenceDir, "all-mutations-selected.png"),
    scale: "css",
  })

  await page.getByRole("button", { name: "Delete", exact: true }).click()
  await page.getByRole("dialog", { name: "Remove bookmark 1 of 3" }).waitFor({ state: "visible" })
  for (let remaining = 3; remaining > 0; remaining -= 1) {
    await page.getByRole("button", { name: "Removed on X" }).click()
    await poll(
      "bookmark deletion",
      () => readJson("/api/bookmarks"),
      (listed) => listed.bookmarks.length === remaining - 1,
    )
  }
  await page.getByText("3 bookmarks removed.").waitFor({ state: "visible" })

  await input.setInputFiles(fixtureFile("bookmarks.json"))
  await page
    .getByText("Imported 0, updated 0, kept 1 deleted.")
    .waitFor({ state: "visible", timeout: 15_000 })
  const finalState = await poll(
    "tombstoned bookmark rejection",
    async () => ({
      health: await readJson("/api/health"),
      bookmarks: await readJson("/api/bookmarks"),
    }),
    (value) => value.health.bookmarks === 0 && value.bookmarks.bookmarks.length === 0,
  )

  const requests = await page.evaluate(() =>
    performance
      .getEntriesByType("resource")
      .map((entry) => new URL(entry.name).pathname)
      .filter((pathname) => pathname.startsWith("/api/")),
  )
  const missingPaths = expectedApiPaths.filter((expected) => !requests.includes(expected))
  if (missingPaths.length > 0) {
    throw new Error(`browser did not request: ${missingPaths.join(", ")}`)
  }

  const logs = await getLatestLogs({ page, count: 200 })
  await page.screenshot({
    path: path.join(evidenceDir, "all-mutations-complete.png"),
    scale: "css",
  })
  fs.writeFileSync(
    path.join(evidenceDir, "all-mutations.json"),
    JSON.stringify(
      {
        feature: featureName,
        url: verifyUrl,
        requests,
        firstImport,
        cluster,
        allImported,
        finalState,
      },
      null,
      2,
    ),
  )
  fs.writeFileSync(path.join(evidenceDir, "browser-logs.json"), JSON.stringify(logs, null, 2))
  console.log(
    JSON.stringify(
      {
        passed: true,
        evidenceDir,
        mutations: [
          "import",
          "search",
          "detail",
          "cluster",
          "add tag",
          "remove tag",
          "bulk tag",
          "delete",
        ],
      },
      null,
      2,
    ),
  )
} catch (error) {
  const logs =
    page === undefined
      ? []
      : await getLatestLogs({ page, count: 200 }).catch((logError) => [
          { level: "error", message: `could not read browser logs: ${String(logError)}` },
        ])
  if (page !== undefined) {
    await page
      .screenshot({
        path: path.join(evidenceDir, "failure.png"),
        scale: "css",
      })
      .catch(() => undefined)
  }
  fs.writeFileSync(path.join(evidenceDir, "failure-logs.json"), JSON.stringify(logs, null, 2))
  fs.writeFileSync(
    path.join(evidenceDir, "failure.json"),
    JSON.stringify(
      {
        feature: featureName,
        url: verifyUrl,
        error: error instanceof Error ? error.stack : String(error),
      },
      null,
      2,
    ),
  )
  throw error
} finally {
  if (page !== undefined) await page.close().catch(() => undefined)
}
