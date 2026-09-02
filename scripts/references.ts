#!/usr/bin/env nub

import { spawnSync } from "node:child_process"
import { existsSync, mkdirSync, readdirSync } from "node:fs"
import { join } from "node:path"

type ReferenceRepository = {
  readonly name: string
  readonly directory: string
  readonly url: string
  readonly branch?: string
}

const repositories = [
  {
    name: "Effect",
    directory: "effect",
    url: "https://github.com/Effect-TS/effect.git",
  },
  {
    name: "Drizzle ORM",
    directory: "drizzle-orm",
    url: "https://github.com/drizzle-team/drizzle-orm.git",
    branch: "v1.0.0-rc.4",
  },
] satisfies ReadonlyArray<ReferenceRepository>

const referencesDir = "/tmp/references"

const git = (args: ReadonlyArray<string>, cwd: string) => {
  const result = spawnSync("git", args, { cwd, stdio: "inherit" })
  if (result.error !== undefined) {
    throw result.error
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

const syncRepository = (repository: ReferenceRepository) => {
  const repositoryPath = join(referencesDir, repository.directory)
  if (existsSync(repositoryPath)) {
    console.log(`Pulling ${repository.name} updates...`)
    if (repository.branch !== undefined) {
      git(["fetch", "--depth", "1", "origin", repository.branch], repositoryPath)
      git(["checkout", "--force", "FETCH_HEAD"], repositoryPath)
      return
    }
    git(["pull", "--ff-only"], repositoryPath)
    return
  }

  console.log(`Cloning ${repository.name}...`)
  const cloneArgs = ["clone", "--depth", "1"]
  if (repository.branch !== undefined) {
    cloneArgs.push("--branch", repository.branch)
  }
  cloneArgs.push(repository.url, repository.directory)
  git(cloneArgs, referencesDir)
}

console.log("Setting up /tmp/references/ directory...")
mkdirSync(referencesDir, { recursive: true })
for (const repository of repositories) {
  syncRepository(repository)
}

console.log("")
console.log("All reference repositories are up to date!")
console.log("")
console.log("Repositories:")
for (const entry of readdirSync(referencesDir).sort()) {
  console.log(entry)
}
