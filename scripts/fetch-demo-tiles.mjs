#!/usr/bin/env node
/**
 * Replaces the orbit gallery's placeholder tiles with real imagery from Pexels.
 *
 *   PEXELS_API_KEY=xxxx node scripts/fetch-demo-tiles.mjs
 *
 * Flags:
 *   --photos        use the photo library instead of frames pulled from video
 *   --count <n>     number of tiles to produce (default 20)
 *   --width <px>    tile width; height follows 16:9 (default 640)
 *   --queries a,b   comma-separated search terms
 *   --no-grade      skip the shared colour grade
 *   --quality <n>   webp quality, 1-100 (default 76)
 *
 * Video mode is the default: it pulls one still out of an actual clip, which
 * is what the tiles are meant to represent. Photo mode is faster and lighter.
 *
 * Pexels licenses its content for commercial use without attribution, but the
 * script still writes credits.json so the provenance of every tile is on
 * record.
 *
 * Requires ffmpeg on PATH. Needs a free key from https://www.pexels.com/api/ —
 * pass it in the environment; never commit it.
 */

import { spawn } from "node:child_process"
import { mkdir, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const OUT_DIR = path.join(ROOT, "public", "images", "demo", "shared")
const TMP_DIR = path.join(ROOT, ".tmp", "pexels")

const DEFAULT_QUERIES = [
  "esports tournament",
  "video game streamer",
  "podcast studio microphone",
  "concert crowd stage",
  "skateboarder trick",
  "football match stadium",
  "basketball dunk",
  "cooking kitchen closeup",
  "city night neon",
  "desk setup rgb lighting",
]

function parseArgs(argv) {
  const args = {
    photos: false,
    count: 20,
    width: 640,
    grade: true,
    quality: 76,
    queries: DEFAULT_QUERIES,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index]
    const value = argv[index + 1]
    if (flag === "--photos") args.photos = true
    else if (flag === "--no-grade") args.grade = false
    else if (flag === "--count") (args.count = Number(value)), (index += 1)
    else if (flag === "--width") (args.width = Number(value)), (index += 1)
    else if (flag === "--quality") (args.quality = Number(value)), (index += 1)
    else if (flag === "--queries") (args.queries = value.split(",").map((q) => q.trim())), (index += 1)
  }

  if (!Number.isInteger(args.count) || args.count < 1) throw new Error("--count must be a positive integer")
  if (!Number.isInteger(args.width) || args.width < 160) throw new Error("--width must be at least 160")
  return args
}

function run(command, commandArgs) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, { stdio: ["ignore", "ignore", "pipe"] })
    let stderr = ""
    child.stderr.on("data", (chunk) => {
      stderr += chunk
    })
    child.on("error", (error) =>
      reject(new Error(error.code === "ENOENT" ? `${command} is not installed or not on PATH` : error.message)),
    )
    child.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`${command} exited ${code}: ${stderr.trim().split("\n").slice(-3).join(" ")}`)),
    )
  })
}

async function pexels(url, apiKey) {
  const response = await fetch(url, { headers: { Authorization: apiKey } })

  if (response.status === 401) throw new Error("Pexels rejected the API key (401)")
  if (response.status === 429) throw new Error("Pexels rate limit reached (429) — wait an hour or lower --count")
  if (!response.ok) throw new Error(`Pexels responded ${response.status} for ${url}`)

  return response.json()
}

async function download(url, destination) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Download failed (${response.status}) for ${url}`)
  await writeFile(destination, Buffer.from(await response.arrayBuffer()))
}

/** Collects more candidates than needed so duplicates can be dropped. */
async function collect(args, apiKey) {
  const perQuery = Math.max(2, Math.ceil((args.count * 1.5) / args.queries.length))
  const candidates = []

  for (const query of args.queries) {
    const endpoint = args.photos
      ? `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${perQuery}&orientation=landscape`
      : `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=${perQuery}&orientation=landscape`

    const payload = await pexels(endpoint, apiKey)

    for (const item of payload.photos ?? payload.videos ?? []) {
      if (args.photos) {
        candidates.push({
          id: item.id,
          query,
          kind: "photo",
          downloadUrl: item.src?.large2x ?? item.src?.large ?? item.src?.original,
          credit: item.photographer,
          creditUrl: item.photographer_url,
          sourceUrl: item.url,
        })
        continue
      }

      // Prefer the smallest file at least 1280 wide: enough detail for a tile
      // without pulling a 4K master over the wire.
      const files = (item.video_files ?? []).filter((file) => file.link).sort((a, b) => (a.width ?? 0) - (b.width ?? 0))
      const chosen = files.find((file) => (file.width ?? 0) >= 1280) ?? files.at(-1)
      if (!chosen) continue

      candidates.push({
        id: item.id,
        query,
        kind: "video",
        downloadUrl: chosen.link,
        duration: item.duration ?? 0,
        credit: item.user?.name,
        creditUrl: item.user?.url,
        sourceUrl: item.url,
      })
    }
  }

  // Interleave queries so neighbouring tiles are not all the same subject —
  // the ring reads as varied only if adjacent tiles differ.
  const byQuery = new Map()
  for (const candidate of candidates) {
    if (!byQuery.has(candidate.query)) byQuery.set(candidate.query, [])
    byQuery.get(candidate.query).push(candidate)
  }

  const interleaved = []
  const seen = new Set()
  let exhausted = false
  while (!exhausted && interleaved.length < args.count) {
    exhausted = true
    for (const list of byQuery.values()) {
      const next = list.shift()
      if (!next) continue
      exhausted = false
      if (seen.has(next.id)) continue
      seen.add(next.id)
      interleaved.push(next)
      if (interleaved.length >= args.count) break
    }
  }

  return interleaved
}

function buildFilter(args) {
  const height = Math.round((args.width * 9) / 16)
  // Cover the frame, then crop to 16:9 — never letterbox a tile.
  const filters = [
    `scale=${args.width}:${height}:force_original_aspect_ratio=increase`,
    `crop=${args.width}:${height}`,
  ]
  // A shared grade is what makes twenty unrelated sources read as one set;
  // the lift in contrast also helps at the size tiles actually render.
  if (args.grade) filters.push("eq=contrast=1.08:saturation=1.12:brightness=-0.01", "vignette=PI/5")
  return filters.join(",")
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const apiKey = process.env.PEXELS_API_KEY

  if (!apiKey) {
    console.error("\nPEXELS_API_KEY is not set. Get a free key at https://www.pexels.com/api/ and run:")
    console.error("  PEXELS_API_KEY=xxxx node scripts/fetch-demo-tiles.mjs\n")
    process.exit(1)
  }

  await mkdir(OUT_DIR, { recursive: true })
  await mkdir(TMP_DIR, { recursive: true })

  console.log(`Searching Pexels (${args.photos ? "photos" : "video frames"}) across ${args.queries.length} queries...`)
  const chosen = await collect(args, apiKey)

  if (chosen.length < args.count) {
    console.warn(`Only ${chosen.length} of ${args.count} tiles found — broaden --queries or lower --count.`)
  }

  const filter = buildFilter(args)
  const credits = []

  for (const [index, item] of chosen.entries()) {
    const position = index + 1
    const sourcePath = path.join(TMP_DIR, `source-${position}${item.kind === "video" ? ".mp4" : ".jpg"}`)
    const outputPath = path.join(OUT_DIR, `${position}.webp`)

    process.stdout.write(`  [${position}/${chosen.length}] ${item.query} ... `)

    try {
      await download(item.downloadUrl, sourcePath)

      const ffmpegArgs = ["-hide_banner", "-loglevel", "error", "-y"]
      if (item.kind === "video") {
        // A third of the way in: past the establishing shot, before the outro.
        ffmpegArgs.push("-ss", String(Math.max(1, Math.floor((item.duration || 6) / 3))))
      }
      ffmpegArgs.push(
        "-i", sourcePath,
        "-frames:v", "1",
        "-vf", filter,
        "-c:v", "libwebp",
        "-quality", String(args.quality),
        "-compression_level", "6",
        outputPath,
      )

      await run("ffmpeg", ffmpegArgs)
      await rm(sourcePath, { force: true })

      credits.push({
        tile: `${position}.webp`,
        query: item.query,
        photographer: item.credit ?? null,
        photographerUrl: item.creditUrl ?? null,
        source: item.sourceUrl ?? null,
        license: "Pexels License — https://www.pexels.com/license/",
      })

      console.log("ok")
    } catch (error) {
      console.log(`skipped (${error.message})`)
    }
  }

  await writeFile(path.join(OUT_DIR, "credits.json"), `${JSON.stringify(credits, null, 2)}\n`)
  await rm(TMP_DIR, { recursive: true, force: true })

  console.log(`\nWrote ${credits.length} tiles to public/images/demo/shared/ plus credits.json`)
  console.log("Check the total size before committing:  du -sh public/images/demo/shared")
}

main().catch((error) => {
  console.error(`\n${error.message}\n`)
  process.exit(1)
})
