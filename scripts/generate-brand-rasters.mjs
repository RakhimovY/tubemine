#!/usr/bin/env node
import { createRequire } from "node:module"
import fs from "node:fs"
import path from "node:path"
import { Buffer } from "node:buffer"
import { fileURLToPath } from "node:url"

const require = createRequire(import.meta.url)

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
)

const pnpmStore = path.join(ROOT, "node_modules", ".pnpm")
const sharpDir = fs
  .readdirSync(pnpmStore)
  .find((d) => /^sharp@\d/.test(d))
if (!sharpDir) {
  console.error(
    "sharp not found in node_modules/.pnpm. Run `pnpm install` first.",
  )
  process.exit(1)
}
const sharp = require(path.join(pnpmStore, sharpDir, "node_modules/sharp"))

const SVG_SRC = path.join(ROOT, "public/brand/brand-mark.svg")
if (!fs.existsSync(SVG_SRC)) {
  console.error(`brand-mark.svg not found at ${SVG_SRC}`)
  process.exit(1)
}
const svgBuffer = fs.readFileSync(SVG_SRC)

const DARK_BG = { r: 0x18, g: 0x18, b: 0x1b, alpha: 1 }
const RENDER_DENSITY = 2400

async function renderTransparent(size) {
  return sharp(svgBuffer, { density: RENDER_DENSITY })
    .resize(size, size, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer()
}

async function renderOpaque(size, paddingPct = 0) {
  const inner = Math.round(size * (1 - 2 * paddingPct))
  const innerBuf = await sharp(svgBuffer, { density: RENDER_DENSITY })
    .resize(inner, inner, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer()
  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: DARK_BG,
    },
  })
    .composite([{ input: innerBuf, gravity: "center" }])
    .png()
    .toBuffer()
}

function buildIcoFromPngs(sizes, pngs) {
  const count = sizes.length
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(count, 4)

  const entries = Buffer.alloc(16 * count)
  let dataOffset = 6 + 16 * count
  const datas = []

  for (let i = 0; i < count; i++) {
    const size = sizes[i]
    const png = pngs[i]
    const off = i * 16
    entries.writeUInt8(size >= 256 ? 0 : size, off)
    entries.writeUInt8(size >= 256 ? 0 : size, off + 1)
    entries.writeUInt8(0, off + 2)
    entries.writeUInt8(0, off + 3)
    entries.writeUInt16LE(1, off + 4)
    entries.writeUInt16LE(32, off + 6)
    entries.writeUInt32LE(png.length, off + 8)
    entries.writeUInt32LE(dataOffset, off + 12)
    datas.push(png)
    dataOffset += png.length
  }

  return Buffer.concat([header, entries, ...datas])
}

const pngTargets = [
  { out: "src/app/icon.png", size: 32, mode: "transparent" },
  { out: "src/app/apple-icon.png", size: 180, mode: "opaque" },
  { out: "public/icon-192.png", size: 192, mode: "opaque-padded" },
  { out: "public/icon-512.png", size: 512, mode: "opaque-padded" },
]

console.log(`Using sharp at ${path.join(pnpmStore, sharpDir)}`)
console.log(`Source: ${SVG_SRC} (${svgBuffer.length} bytes)`)

for (const t of pngTargets) {
  const buf =
    t.mode === "transparent"
      ? await renderTransparent(t.size)
      : t.mode === "opaque"
        ? await renderOpaque(t.size, 0)
        : await renderOpaque(t.size, 0.1)
  const outPath = path.join(ROOT, t.out)
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, buf)
  console.log(
    `wrote ${t.out} (${t.size}x${t.size}, ${t.mode}, ${buf.length} bytes)`,
  )
}

const icoSizes = [16, 32, 48]
const icoPngs = await Promise.all(icoSizes.map((s) => renderTransparent(s)))
const ico = buildIcoFromPngs(icoSizes, icoPngs)
const icoOutputs = ["src/app/favicon.ico", "public/favicon.ico"]
for (const out of icoOutputs) {
  fs.writeFileSync(path.join(ROOT, out), ico)
  console.log(
    `wrote ${out} (multi-res ${icoSizes.join("/")}, ${ico.length} bytes)`,
  )
}

console.log("done.")
