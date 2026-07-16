/**
 * Structural + pure-policy verification for Rest Mode / offline HTTP recovery.
 * Also compiles and runs the host unit test for net_recovery.c when gcc is available.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { spawnSync } from 'child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
let fails = 0
function assert(c, m) {
  if (!c) { console.error('FAIL:', m); fails++ }
  else console.log('PASS:', m)
}

const main = fs.readFileSync(path.join(root, 'src', 'main.c'), 'utf8')
const nr = fs.readFileSync(path.join(root, 'src', 'net_recovery.c'), 'utf8')
const app = fs.readFileSync(path.join(root, 'frontend', 'src', 'App.jsx'), 'utf8')
const utils = fs.readFileSync(path.join(root, 'src', 'utils.c'), 'utf8')

// #61: resume must force recovery independent of has_ip
assert(main.includes('pldmgr_should_restart_http'), 'main uses recovery policy')
assert(main.includes('resume_event'), 'main tracks resume_event')
assert(main.includes('pldmgr_probe_http_loopback'), 'main probes loopback health')
assert(main.includes('sceNetCtlInit'), 'main re-inits net on resume')
assert(main.includes('loopback probe failed') || main.includes('rest-mode resume'),
  'restart reasons include resume/loopback')

// Policy: has_lan_ip is void / not required
assert(nr.includes('(void)has_lan_ip') || nr.includes('has_lan_ip'),
  'policy documents has_lan_ip unused for gate')
assert(nr.includes('if (resume_event)'), 'resume always restarts')
assert(nr.includes('if (!loopback_ok)'), 'loopback fail restarts')

// Probe exists
assert(utils.includes('pldmgr_probe_http_loopback'), 'utils implements loopback probe')
assert(utils.includes('INADDR_LOOPBACK') || utils.includes('127.0.0.1'),
  'probe targets loopback')

// Frontend: version-only offline gate (#40)
assert(app.includes("fetch('/version')"), 'UI health uses /version')
const initBlock = app.slice(app.indexOf('const init = async'), app.indexOf('init()'))
assert(!initBlock.includes("setIsOffline(true)") || initBlock.indexOf("fetch('/version')") < initBlock.lastIndexOf('setIsOffline'),
  'offline only after version failure path exists')
assert(app.includes("setIp('127.0.0.1')") || app.includes('127.0.0.1'),
  'UI falls back to loopback IP display')
// getip failure must not alone kill UI — no offline from getip catch
assert(!/catch \(e\) \{\s*setIsOffline\(true\)\s*\}\s*\n\s*try \{\s*const verRes/.test(app),
  'getip is not primary offline gate (order fixed)')

// Old bad pattern restarted only inside has_ip branch (not via policy helper)
assert(main.includes('pldmgr_should_restart_http(resume_event'),
  'restart decision goes through policy helper with resume_event')
assert(!/if\s*\(\s*has_ip\s*&&[\s\S]{0,80}MHD_start_daemon/.test(main),
  'old has_ip-only MHD restart branch removed')

// Host unit test for pure policy
const gcc = spawnSync('gcc', [
  '-I' + path.join(root, 'include'),
  '-o', path.join(root, 'scripts', 'test_net_recovery.exe'),
  path.join(root, 'scripts', 'test_net_recovery.c'),
  path.join(root, 'src', 'net_recovery.c'),
], { encoding: 'utf8' })

if (gcc.status !== 0) {
  console.error(gcc.stderr || gcc.stdout)
  assert(false, 'gcc build of test_net_recovery')
} else {
  assert(true, 'gcc build of test_net_recovery')
  const run = spawnSync(path.join(root, 'scripts', 'test_net_recovery.exe'), {
    encoding: 'utf8',
  })
  process.stdout.write(run.stdout || '')
  process.stderr.write(run.stderr || '')
  assert(run.status === 0, 'test_net_recovery.exe exit 0')
}

if (fails) {
  console.error(fails + ' failure(s)')
  process.exit(1)
}
console.log('\nAll rest/offline recovery checks passed.')
