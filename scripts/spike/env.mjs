// Throwaway. Minimal .env reader so the spikes need no dependencies.
//
// Reads .env then .env.local. A later file overrides an earlier one only
// when it actually has a value — an empty assignment never clobbers a set
// one, because the template ships with empty keys and would otherwise
// silently blank out real credentials.

import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = new URL('../../', import.meta.url).pathname

function parse(text) {
  const out = {}
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    const quoted = value.startsWith('"') && value.endsWith('"') && value.length > 1
    if (quoted || (value.startsWith("'") && value.endsWith("'") && value.length > 1)) {
      value = value.slice(1, -1)
    }
    // A double-quoted value gets its escapes expanded, matching dotenv.
    // A PEM is expanded whether or not it was quoted: an unquoted key with
    // literal \n is the overwhelmingly common way this is pasted, and left
    // alone it fails as "error:1E08010C:DECODER routines::unsupported",
    // which names nothing that would lead you back to the cause.
    if (quoted || value.startsWith('-----BEGIN')) value = value.replace(/\\n/g, '\n')
    out[key] = value
  }
  return out
}

const merged = {}
for (const file of ['.env', '.env.local']) {
  const path = join(ROOT, file)
  if (!existsSync(path)) continue
  for (const [k, v] of Object.entries(parse(readFileSync(path, 'utf8')))) {
    if (v.length > 0 || !(k in merged)) merged[k] = v
  }
}

// A real process.env value wins, so a run can be varied without editing .env.
for (const [k, v] of Object.entries(process.env)) {
  if (v) merged[k] = v
}

export const env = merged

export function require_(key) {
  const value = merged[key]
  if (!value) {
    console.error(`\nMissing ${key}. Add it to .env and re-run.`)
    process.exit(1)
  }
  return value
}
