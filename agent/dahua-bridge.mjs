#!/usr/bin/env node
/**
 * DCW CRM — Dahua biometric bridge agent
 *
 * The DHI-ASI3204E-W controller only speaks to whoever can reach its LAN
 * address, and the CRM runs on Railway. This agent is the piece in between: it
 * runs on any always-on machine in the office (a mini PC, a Raspberry Pi, the
 * reception desktop), holds a long-lived event subscription to the controller,
 * and forwards every punch to the CRM over signed HTTPS.
 *
 * Three independent paths make sure no punch is ever lost:
 *   1. live stream   — events arrive within a second of the face being read
 *   2. catch-up poll — re-reads the controller's own log on a timer, so an
 *                      agent that was asleep or a stream that silently died
 *                      still gets reconciled
 *   3. disk queue    — anything the CRM couldn't accept is retried from disk
 *
 * Dependencies: none. Node 18+.
 *
 * Usage:  node agent/dahua-bridge.mjs
 *         (reads agent/.env, or plain environment variables)
 */

import { createHmac } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  createDeviceClient,
  drainEvents,
  findAccessRecords,
  loadEnvFile,
  parseDahuaKv,
} from './device.mjs'

const AGENT_VERSION = '1.0.0'
const HERE = path.dirname(fileURLToPath(import.meta.url))

loadEnvFile(path.join(HERE, '.env'))

const CFG = {
  deviceHost: process.env.DAHUA_HOST || '192.168.1.108',
  deviceUser: process.env.DAHUA_USERNAME || 'admin',
  devicePass: process.env.DAHUA_PASSWORD || '',
  deviceProtocol: process.env.DAHUA_PROTOCOL || 'http',
  deviceName: process.env.DAHUA_DEVICE_NAME || 'Reception Gate',

  crmUrl: (process.env.CRM_BASE_URL || '').replace(/\/+$/, ''),
  secret: process.env.BIOMETRIC_WEBHOOK_SECRET || '',

  pollMinutes: Number(process.env.BIOMETRIC_POLL_MINUTES || 10),
  pollLookbackHours: Number(process.env.BIOMETRIC_POLL_LOOKBACK_HOURS || 12),
  heartbeatSeconds: Number(process.env.BIOMETRIC_HEARTBEAT_SECONDS || 60),
  queueFile: process.env.BIOMETRIC_QUEUE_FILE || path.join(HERE, 'queue.jsonl'),
}

if (!CFG.crmUrl || !CFG.secret || !CFG.devicePass) {
  console.error(
    'Missing config. Set CRM_BASE_URL, BIOMETRIC_WEBHOOK_SECRET and DAHUA_PASSWORD ' +
      '(see agent/.env.example). Run `node agent/check-device.mjs` to test the device first.'
  )
  process.exit(1)
}

const log = (...args) => console.log(new Date().toISOString(), ...args)
const logErr = (...args) => console.error(new Date().toISOString(), ...args)

const device = createDeviceClient({
  host: CFG.deviceHost,
  username: CFG.deviceUser,
  password: CFG.devicePass,
  protocol: CFG.deviceProtocol,
})

// ----------------------------------------------------------- CRM transport ---

function postToCrm(pathname, payload) {
  const body = JSON.stringify(payload)
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const signature = createHmac('sha256', CFG.secret).update(`${timestamp}.${body}`).digest('hex')

  return fetch(`${CFG.crmUrl}${pathname}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-dcw-timestamp': timestamp,
      'x-dcw-signature': `sha256=${signature}`,
    },
    body,
    signal: AbortSignal.timeout(20000),
  }).then(async res => {
    const text = await res.text()
    if (!res.ok) throw new Error(`CRM ${pathname} -> HTTP ${res.status}: ${text.slice(0, 300)}`)
    try {
      return JSON.parse(text)
    } catch {
      return {}
    }
  })
}

/** Park a failed delivery on disk so a CRM outage costs nothing. */
function enqueue(payload) {
  try {
    fs.appendFileSync(CFG.queueFile, JSON.stringify(payload) + '\n')
  } catch (e) {
    logErr('could not write queue file:', e.message)
  }
}

async function flushQueue() {
  if (!fs.existsSync(CFG.queueFile)) return
  const lines = fs.readFileSync(CFG.queueFile, 'utf8').split('\n').filter(Boolean)
  if (lines.length === 0) return

  let delivered = 0
  for (const line of lines) {
    try {
      await postToCrm('/api/biometric/punch', JSON.parse(line))
      delivered++
    } catch (e) {
      logErr('queue flush failed, will retry:', e.message)
      break // CRM is still down — stop hammering it
    }
  }

  // Anything after the first failure stays queued, in original order.
  const remaining = lines.slice(delivered)
  fs.writeFileSync(CFG.queueFile, remaining.length ? remaining.join('\n') + '\n' : '')
  if (delivered > 0) log(`queue: delivered ${delivered}, ${remaining.length} pending`)
}

async function sendPunches(punches, source) {
  if (punches.length === 0) return
  const payload = {
    device_serial: STATE.serial,
    device_name: CFG.deviceName,
    device_ip: CFG.deviceHost,
    source,
    punches,
  }
  try {
    const result = await postToCrm('/api/biometric/punch', payload)
    log(
      `sent ${punches.length} ${source} punch(es) ->`,
      `stored ${result.stored ?? '?'}, dup ${result.duplicates ?? '?'}, unmapped ${result.unmapped ?? '?'}`
    )
  } catch (e) {
    logErr('send failed, queuing:', e.message)
    enqueue(payload)
  }
}

// ------------------------------------------------------------------- state ---

const STATE = {
  serial: null,
  streamAlive: false,
  lastEventAt: null,
  backoffMs: 2000,
}

async function readSerial() {
  try {
    const parsed = parseDahuaKv(await device.get('/cgi-bin/magicBox.cgi?action=getSerialNo'))
    STATE.serial = (parsed.sn || parsed.serialNumber || '').trim() || CFG.deviceHost
  } catch (e) {
    logErr('could not read device serial:', e.message)
    STATE.serial = STATE.serial || CFG.deviceHost
  }
  return STATE.serial
}

// ------------------------------------------------------------ live events ---

/** Map one AccessControl event payload onto the CRM's punch shape. */
function eventToPunch(data, code) {
  const seconds =
    Number(data.UTC) ||
    Number(data.CreateTime) ||
    (data.LocaleTime
      ? Math.floor(new Date(data.LocaleTime.replace(/-/g, '/')).getTime() / 1000)
      : 0) ||
    Math.floor(Date.now() / 1000)

  return {
    userId: data.UserID != null ? String(data.UserID) : null,
    cardNo: data.CardNo != null ? String(data.CardNo) : null,
    cardName: data.CardName != null ? String(data.CardName) : null,
    timestamp: seconds,
    method: data.Method != null ? Number(data.Method) : null,
    direction: data.Type || data.Direction || null,
    door: data.Door != null ? Number(data.Door) : null,
    status: data.Status != null ? data.Status : 1,
    errorCode: data.ErrorCode != null ? Number(data.ErrorCode) : null,
    eventCode: code,
    recNo: data.RecNo != null ? Number(data.RecNo) : null,
    raw: data,
  }
}

async function runEventStream() {
  const uri =
    '/cgi-bin/eventManager.cgi?action=attach' +
    '&codes=[AccessControl,FaceRecognition,AccessControlCardUnvalid]' +
    '&heartbeat=5'

  const { res, req } = await device.stream(uri)
  STATE.streamAlive = true
  STATE.backoffMs = 2000
  log('event stream connected')

  let buffer = ''

  // The controller sends a heartbeat every 5s; silence means the link is gone
  // even though the socket still looks open.
  let watchdog = setTimeout(() => req.destroy(new Error('no heartbeat')), 30000)
  const kick = () => {
    clearTimeout(watchdog)
    watchdog = setTimeout(() => req.destroy(new Error('no heartbeat')), 30000)
  }

  res.setEncoding('utf8')

  await new Promise((resolve, reject) => {
    res.on('data', chunk => {
      kick()
      buffer += chunk
      const { events, rest } = drainEvents(buffer)
      buffer = rest

      for (const ev of events) {
        const code = /Code=([^;]+)/.exec(ev.header)?.[1] ?? 'Unknown'
        const action = /action=([^;]+)/.exec(ev.header)?.[1] ?? ''
        if (code === 'Heartbeat' || !ev.json) continue
        // A face controller fires Pulse on a completed verification; Start/Stop
        // pairs from other event types would double-count.
        if (action && action !== 'Pulse' && action !== 'Start') continue

        let payload
        try {
          payload = JSON.parse(ev.json)
        } catch {
          continue
        }
        const data = payload.Data ?? payload
        if (!data || (data.UserID == null && data.CardNo == null)) continue

        STATE.lastEventAt = new Date()
        const punch = eventToPunch(data, code)
        log(
          `punch: user=${punch.userId ?? punch.cardNo} method=${punch.method} status=${punch.status}`
        )
        sendPunches([punch], 'agent')
      }
    })

    res.on('end', () => {
      clearTimeout(watchdog)
      resolve()
    })
    res.on('error', err => {
      clearTimeout(watchdog)
      reject(err)
    })
    req.on('error', err => {
      clearTimeout(watchdog)
      reject(err)
    })
  })
}

async function eventLoop() {
  for (;;) {
    try {
      await runEventStream()
      log('event stream closed by device, reconnecting')
    } catch (e) {
      logErr('event stream error:', e.message)
    }
    STATE.streamAlive = false
    await new Promise(r => setTimeout(r, STATE.backoffMs))
    STATE.backoffMs = Math.min(STATE.backoffMs * 2, 60000)
  }
}

// ------------------------------------------------------------ catch-up poll --

/** Replay the controller's own log, so a missed stream costs nothing. */
async function pollRecords() {
  const end = new Date()
  const start = new Date(end.getTime() - CFG.pollLookbackHours * 3600 * 1000)

  const { mode, records } = await findAccessRecords(device, { start, end, max: 2000 })

  if (records.length === 0) {
    log(`poll (${mode}): no records in window`)
    return
  }

  // Batched so one CRM round trip covers the whole window.
  for (let i = 0; i < records.length; i += 200) {
    await sendPunches(records.slice(i, i + 200), 'poll')
  }
}

// -------------------------------------------------------------- heartbeat ---

async function heartbeat() {
  try {
    await postToCrm('/api/biometric/heartbeat', {
      device_serial: STATE.serial,
      device_name: CFG.deviceName,
      device_ip: CFG.deviceHost,
      agent_version: AGENT_VERSION,
      device_online: STATE.streamAlive,
    })
  } catch (e) {
    logErr('heartbeat failed:', e.message)
  }
}

// ------------------------------------------------------------------- main ---

async function main() {
  log(`DCW Dahua bridge v${AGENT_VERSION}`)
  log(`device ${CFG.deviceProtocol}://${CFG.deviceHost}  ->  CRM ${CFG.crmUrl}`)

  await readSerial()
  log('device serial:', STATE.serial)

  await heartbeat()
  await flushQueue()
  await pollRecords().catch(e => logErr('initial poll failed:', e.message))

  setInterval(() => heartbeat(), CFG.heartbeatSeconds * 1000)
  setInterval(() => flushQueue(), 60000)
  setInterval(
    () => pollRecords().catch(e => logErr('poll failed:', e.message)),
    CFG.pollMinutes * 60000
  )

  await eventLoop()
}

process.on('unhandledRejection', e => logErr('unhandled rejection:', e?.message ?? e))
process.on('SIGINT', () => {
  log('shutting down')
  process.exit(0)
})

main().catch(e => {
  logErr('fatal:', e)
  process.exit(1)
})
