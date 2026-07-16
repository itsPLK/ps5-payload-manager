/**
 * Unit tests for resolvePayloadDisplay — real shipped module.
 * Run: node scripts/test_version_display.mjs
 */
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import fs from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const displayPath = path.join(root, 'frontend', 'src', 'utils', 'payloadDisplay.js')

const { resolvePayloadDisplay, parsePayloadName } = await import(
  pathToFileURL(displayPath).href
)

let failed = 0
function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg)
    failed++
  } else {
    console.log('PASS:', msg)
  }
}

// (a) filename with _v1.2 — meta must not override
{
  const r = resolvePayloadDisplay('/data/pldmgr/payloads/foo/ftpsrv_v1.2.elf', 'v9.9.9')
  assert(r.version === 'v1.2', `filename version wins: got ${r.version}`)
  assert(r.versionSource === 'filename', `source filename: got ${r.versionSource}`)
  assert(r.displayName.toLowerCase().includes('ftpsrv'), `display name: ${r.displayName}`)
}

// (b) Download Hub case: plain asset name + release tag meta
{
  const r = resolvePayloadDisplay('bfpilot.elf', 'v0.4.0')
  assert(r.version === 'v0.4.0', `meta version used: got ${r.version}`)
  assert(r.versionSource === 'meta', `source meta: got ${r.versionSource}`)
  assert(r.displayName === 'bfpilot', `display: ${r.displayName}`)
}

// (c) neither → no version badge
{
  const r = resolvePayloadDisplay('plain.elf', null)
  assert(r.version === null, `no version: got ${r.version}`)
  assert(r.versionSource === null, `source null: got ${r.versionSource}`)
}

// blank meta ignored
{
  const r = resolvePayloadDisplay('plain.elf', '   ')
  assert(r.version === null, `blank meta ignored: got ${r.version}`)
}

// parsePayloadName catalog style
{
  const r = parsePayloadName('kstuff-lite_v1.0.elf')
  assert(r.version === 'v1.0', `parsePayloadName version: ${r.version}`)
}

// structural: GH install writes version into sidecar JSON (C string with escapes)
const gh = fs.readFileSync(path.join(root, 'src', 'github_hub.c'), 'utf8')
assert(gh.includes('version') && gh.includes('pldmgr_json_escape(tag') &&
  (gh.includes('"version\\":\\"%s\\"') || gh.includes('\\\"version\\\":\\\"%s\\\"') ||
   gh.includes('"version":"%s"') || gh.includes('\\"version\\":\\"%s\\"')),
  'github_hub writes version field in sidecar')
assert(gh.includes('pldmgr_json_escape(tag'), 'github_hub uses release tag as version')

// structural: list_payloads meta includes version
const pm = fs.readFileSync(path.join(root, 'src', 'payload_mgr.c'), 'utf8')
assert(pm.includes('version') && (pm.includes('\\"version\\":\\"%s\\"') || pm.includes('"version":"%s"') || pm.includes('d_ver')),
  'payload_mgr list meta includes version')

// structural: UI wiring
const app = fs.readFileSync(path.join(root, 'frontend', 'src', 'App.jsx'), 'utf8')
assert(app.includes('metaVersion={meta.version'), 'dashboard passes metaVersion')
const sh = fs.readFileSync(path.join(root, 'frontend', 'src', 'components', 'views', 'StorageHub.jsx'), 'utf8')
assert(sh.includes('metaVersion={installedMetaVersion}'), 'StorageHub passes metaVersion')
const pn = fs.readFileSync(path.join(root, 'frontend', 'src', 'components', 'ui', 'PayloadName.jsx'), 'utf8')
assert(pn.includes('resolvePayloadDisplay'), 'PayloadName uses resolvePayloadDisplay')
assert(pn.includes('text-ps-blue'), 'blue version styling present')

if (failed) {
  console.error(`\n${failed} failure(s)`)
  process.exit(1)
}
console.log('\nAll version-display checks passed.')
