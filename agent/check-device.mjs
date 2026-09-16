#!/usr/bin/env node
/**
 * Setup checker for the Dahua controller.
 *
 * Run this before the bridge agent. It walks the same path the agent will —
 * reach the box, authenticate, read the clock, list enrolled users, pull
 * records, open the event stream — and says which setup step is still missing
 * rather than failing with one opaque error at 9 AM on a Monday.
 *
 * Usage:
 *   node agent/check-device.mjs                 # uses agent/.env
 *   node agent/check-device.mjs 192.168.1.50    # override the host
 *   node agent/check-device.mjs --watch         # also wait for a live punch
 */

import net from 'node:net'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  createDeviceClient,
  drainEvents,
  findAccessRecords,
  getEnrolledUsers,
  loadEnvFile,
  parseDahuaKv,
} from './device.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
loadEnvFile(path.join(HERE, '.env'))

const args = process.argv.slice(2)
const watch = args.includes('--watch')
const hostArg = args.find(a => !a.startsWith('--'))

const CFG = {
  host: hostArg || process.env.DAHUA_HOST || '192.168.1.108',
  username: process.env.DAHUA_USERNAME || 'admin',
  password: process.env.DAHUA_PASSWORD || '',
  protocol: process.env.DAHUA_PROTOCOL || 'http',
}

const PASS = '\x1b[32m  OK  \x1b[0m'
const FAIL = '\x1b[31m FAIL \x1b[0m'
const WARN = '\x1b[33m WARN \x1b[0m'
const INFO = '\x1b[36m INFO \x1b[0m'

let failures = 0
let warnings = 0

function line(badge, label, detail = '') {
  if (badge === FAIL) failures++
  if (badge === WARN) warnings++
  console.log(`[${badge}] ${label}${detail ? '  —  ' + detail : ''}`)
}

const device = createDeviceClient(CFG)

// 1 -------------------------------------------------------- reachability ---

function tcpProbe(host, port, timeoutMs = 5000) {
  return new Promise(resolve => {
    const socket = net.connect({ host, port })
    const done = ok => {
      socket.destroy()
      resolve(ok)
    }
    socket.setTimeout(timeoutMs, () => done(false))
    socket.on('connect', () => done(true))
    socket.on('error', () => done(false))
  })
}

async function checkReachable() {
  const [host, port] = CFG.host.split(':')
  const p = port ? Number(port) : CFG.protocol === 'https' ? 443 : 80
  const ok = await tcpProbe(host, p)
  if (ok) {
    line(PASS, `Reachable on the network`, `${CFG.protocol}://${CFG.host}`)
    return true
  }
  line(
    FAIL,
    'Cannot reach the controller',
    `nothing answering on ${host}:${p}. Same LAN/VLAN? IP correct?`
  )
  return false
}

// 2 ---------------------------------------------------------------- auth ---

async function checkAuth() {
  if (!CFG.password) {
    line(FAIL, 'Login', 'DAHUA_PASSWORD is empty in agent/.env')
    return null
  }
  try {
    const parsed = parseDahuaKv(await device.get('/cgi-bin/magicBox.cgi?action=getSerialNo'))
    const serial = (parsed.sn || parsed.serialNumber || '').trim()
    line(PASS, 'Login accepted', `serial ${serial || 'unknown'}`)
    return serial
  } catch (e) {
    if (e.statusCode === 401) {
      line(FAIL, 'Login rejected', 'wrong DAHUA_USERNAME / DAHUA_PASSWORD')
    } else {
      line(FAIL, 'Login failed', e.message)
    }
    return null
  }
}

// 3 -------------------------------------------------------------- model ---

async function checkModel() {
  try {
    const type = parseDahuaKv(await device.get('/cgi-bin/magicBox.cgi?action=getDeviceType'))
    const sw = parseDahuaKv(
      await device.get('/cgi-bin/magicBox.cgi?action=getSoftwareVersion').catch(() => '')
    )
    line(
      INFO,
      'Model',
      `${type.type ?? 'unknown'}${sw.version ? `, firmware ${sw.version}` : ''}`
    )
  } catch {
    line(WARN, 'Model', 'could not read device type (harmless)')
  }
}

// 4 --------------------------------------------------------------- clock ---

/**
 * The device clock stamps every punch. A drifting or wrongly-zoned clock
 * silently produces wrong attendance, which is far worse than a loud failure.
 */
async function checkClock() {
  try {
    const body = await device.get('/cgi-bin/global.cgi?action=getCurrentTime')
    const parsed = parseDahuaKv(body)
    const raw = (parsed.result || '').trim()
    if (!raw) {
      line(WARN, 'Device clock', 'no time returned')
      return
    }

    // "2026-09-16 18:45:09" is device-local time, so compare it against our
    // own local time rendered in IST.
    const deviceLocal = raw.replace(/-/g, '/')
    const deviceMs = new Date(deviceLocal).getTime()
    const istNow = new Date(
      new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
      })
        .format(new Date())
        .replace(',', '')
    ).getTime()

    const driftMin = Math.round(Math.abs(deviceMs - istNow) / 60000)

    if (!Number.isFinite(deviceMs)) {
      line(WARN, 'Device clock', `unparsable: ${raw}`)
    } else if (driftMin <= 2) {
      line(PASS, 'Device clock matches IST', raw)
    } else if (driftMin > 240) {
      line(
        FAIL,
        'Device clock is in the wrong timezone',
        `device says ${raw}, IST is ${new Date(istNow).toISOString().slice(0, 19).replace('T', ' ')} ` +
          `(${driftMin} min off). Set GMT+05:30 in the web UI.`
      )
    } else {
      line(FAIL, 'Device clock has drifted', `${driftMin} min off IST. Turn on NTP.`)
    }
  } catch (e) {
    line(WARN, 'Device clock', `could not read (${e.message})`)
  }

  try {
    const ntp = parseDahuaKv(
      await device.get('/cgi-bin/configManager.cgi?action=getConfig&name=NTP')
    )
    const cfg = ntp.table?.NTP ?? {}
    if (String(cfg.Enable).toLowerCase() === 'true') {
      line(PASS, 'NTP enabled', `${cfg.Address ?? '?'} every ${cfg.UpdatePeriod ?? '?'} min`)
    } else {
      line(WARN, 'NTP disabled', 'clock will drift over months — enable it in the web UI')
    }
  } catch {
    line(INFO, 'NTP', 'status not readable on this firmware')
  }
}

// 5 ------------------------------------------------------------ static IP ---

async function checkStaticIp() {
  try {
    const net = parseDahuaKv(
      await device.get('/cgi-bin/configManager.cgi?action=getConfig&name=Network')
    )
    const table = net.table?.Network ?? {}
    const iface = table.eth0 ?? table.eth2 ?? {}
    const dhcp = String(iface.DhcpEnable ?? '').toLowerCase()
    if (dhcp === 'true') {
      line(
        WARN,
        'Address is DHCP',
        'the IP can change and break the agent. Set a static IP, or reserve it on the router.'
      )
    } else if (dhcp === 'false') {
      line(PASS, 'Static IP configured', iface.IPAddress ?? CFG.host)
    } else {
      line(INFO, 'IP mode', 'not readable on this firmware — confirm in the web UI')
    }
  } catch {
    line(INFO, 'IP mode', 'not readable on this firmware — confirm in the web UI')
  }
}

// 6 ---------------------------------------------------- enrolled users -----

/**
 * The User IDs enrolled here are the mapping keys in the CRM, so printing them
 * turns "map the unknown identities" into a copy-paste job.
 */
async function checkUsers() {
  const result = await getEnrolledUsers(device)

  if (!result) {
    line(WARN, 'Enrolled users', 'this firmware does not expose the user list')
    return
  }

  if (result.total === 0) {
    line(
      WARN,
      'Nobody is enrolled on the device yet',
      'add staff under Person Management — the User ID you type there is the CRM mapping key'
    )
    return
  }

  line(PASS, 'Enrolled users', `${result.total} on the device`)

  if (result.users.length === 0) {
    console.log(
      '\n        This firmware reports only the count, not the list.\n' +
        '        Read the User IDs from the web UI under Person Management.\n'
    )
    return
  }

  console.log('\n        User ID    Name                  Card')
  console.log('        ---------  --------------------  ------------')
  for (const u of result.users.slice(0, 25)) {
    console.log(
      `        ${String(u.userId ?? '?').padEnd(9)}  ${String(u.name ?? '—').slice(0, 20).padEnd(20)}  ${u.cardNo ?? '—'}`
    )
  }
  if (result.users.length > 25) console.log(`        … and ${result.users.length - 25} more`)
  console.log('\n        These User IDs are what you map to employees in HRMS → Biometric.\n')
}

// 7 -------------------------------------------------------- record log -----

async function checkRecords() {
  const end = new Date()
  const start = new Date(end.getTime() - 30 * 24 * 3600 * 1000)

  try {
    const { mode, records } = await findAccessRecords(device, { start, end, max: 500 })
    const granted = records.filter(r => String(r.status) === '1')

    line(PASS, 'Access-control log readable', `via ${mode}, ${records.length} record(s) in 30 days`)

    if (records.length > 0 && granted.length === 0) {
      line(
        INFO,
        'All of them were denied attempts',
        'unrecognised faces at the door — normal before anyone is enrolled'
      )
    }
    if (granted.length > 0) {
      const last = granted[granted.length - 1]
      const when = new Date(last.timestamp * 1000).toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
      })
      line(PASS, 'Successful punches present', `latest ${when}, user ${last.userId ?? '?'}`)
    }
  } catch (e) {
    line(FAIL, 'Access-control log', e.message)
  }
}

// 8 ------------------------------------------------------- event stream ----

async function checkEventStream(waitSeconds) {
  const uri =
    '/cgi-bin/eventManager.cgi?action=attach' +
    '&codes=[AccessControl,FaceRecognition,AccessControlCardUnvalid]&heartbeat=5'

  let stream
  try {
    stream = await device.stream(uri)
  } catch (e) {
    line(FAIL, 'Live event stream', `${e.message} — the account may lack event permissions`)
    return
  }

  line(PASS, 'Live event stream connected', watch ? `watching for ${waitSeconds}s…` : '')

  if (!watch) {
    stream.req.destroy()
    return
  }

  console.log('\n        Go scan a face on the device now.\n')

  let buffer = ''
  let punches = 0

  await new Promise(resolve => {
    const stop = setTimeout(() => {
      stream.req.destroy()
      resolve()
    }, waitSeconds * 1000)

    stream.res.setEncoding('utf8')
    stream.res.on('data', chunk => {
      buffer += chunk
      const { events, rest } = drainEvents(buffer)
      buffer = rest
      for (const ev of events) {
        if (!ev.json) continue
        let payload
        try {
          payload = JSON.parse(ev.json)
        } catch {
          continue
        }
        const d = payload.Data ?? payload
        if (!d || (d.UserID == null && d.CardNo == null)) continue
        punches++
        console.log(
          `        \x1b[32m● punch\x1b[0m  UserID=${d.UserID ?? '—'}  Card=${d.CardNo ?? '—'}  ` +
            `Name=${d.CardName ?? '—'}  Method=${d.Method ?? '?'}  Status=${d.Status ?? '?'}`
        )
      }
    })
    stream.res.on('end', () => {
      clearTimeout(stop)
      resolve()
    })
    stream.res.on('error', () => {
      clearTimeout(stop)
      resolve()
    })
    stream.req.on('error', () => {
      clearTimeout(stop)
      resolve()
    })
  })

  console.log('')
  if (punches > 0) line(PASS, `Received ${punches} live punch(es)`)
  else line(WARN, 'No punch seen', 'nobody scanned, or the event codes differ on this firmware')
}

// ------------------------------------------------------------------- main ---

console.log(`\nDahua controller check — ${CFG.protocol}://${CFG.host}\n`)

const reachable = await checkReachable()
if (!reachable) {
  console.log(
    '\nFind the controller first:\n' +
      '  • its IP is on the device screen, or in the router\'s DHCP client list\n' +
      '  • factory default is 192.168.1.108 (admin)\n' +
      '  • Dahua ConfigTool / SmartPSS discovers it on the LAN\n'
  )
  process.exit(1)
}

const serial = await checkAuth()
if (serial !== null) {
  await checkModel()
  await checkClock()
  await checkStaticIp()
  await checkUsers()
  await checkRecords()
  await checkEventStream(120)
}

console.log('')
if (failures === 0 && warnings === 0) {
  console.log('\x1b[32mAll checks passed — start the agent: node agent/dahua-bridge.mjs\x1b[0m\n')
} else if (failures === 0) {
  console.log(
    `\x1b[33m${warnings} warning(s), nothing blocking — the agent will run.\x1b[0m\n`
  )
} else {
  console.log(`\x1b[31m${failures} problem(s) to fix before the agent will work.\x1b[0m\n`)
}
process.exit(failures > 0 ? 1 : 0)
