#!/usr/bin/env node
import fs from "node:fs"
import path from "node:path"

const root = process.cwd()
const en = JSON.parse(
  fs.readFileSync(path.join(root, "messages/en.json"), "utf-8"),
)
const ru = JSON.parse(
  fs.readFileSync(path.join(root, "messages/ru.json"), "utf-8"),
)

function flatKeys(obj, prefix = "") {
  const out = new Set()
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === "object" && !Array.isArray(v)) {
      for (const child of flatKeys(v, key)) out.add(child)
    } else {
      out.add(key)
    }
  }
  return out
}

const enKeys = flatKeys(en)
const ruKeys = flatKeys(ru)

const missingInRu = [...enKeys].filter((k) => !ruKeys.has(k))
const missingInEn = [...ruKeys].filter((k) => !enKeys.has(k))

if (missingInRu.length || missingInEn.length) {
  if (missingInRu.length) {
    console.error("Missing in messages/ru.json:", missingInRu)
  }
  if (missingInEn.length) {
    console.error("Missing in messages/en.json:", missingInEn)
  }
  process.exit(1)
}

console.log("messages/en.json and messages/ru.json have key parity.")
