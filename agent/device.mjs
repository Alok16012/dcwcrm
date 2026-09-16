/**
 * Dahua device transport — shared by the bridge agent and the setup checker.
 *
 * The controller speaks plain CGI over HTTP with Digest auth, and streams
 * events as multipart parts that arrive split across arbitrary chunk
 * boundaries. Both of those are fiddly enough to be worth having in exactly
 * one place.
 *
 * Dependencies: none. Node 18+.
 */

import http from 'node:http'
import https from 'node:https'
import { createHash, randomBytes } from 'node:crypto'
import fs from 'node:fs'

// ------------------------------------------------------------------ config ---

/** Minimal .env reader — keeps the agent dependency-free on old Node builds. */
export function loadEnvFile(file) {
  if (!fs.existsSync(file)) return
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 1) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = value
  }
}

// ------------------------------------------------------------ digest auth ---

const md5 = s => createHash('md5').update(s).digest('hex')

function buildDigestHeader(challenge, { username, password }, method, uri) {
  const field = name => {
    const quoted = new RegExp(`${name}="([^"]*)"`, 'i').exec(challenge)
    if (quoted) return quoted[1]
    const bare = new RegExp(`${name}=([^,\\s]+)`, 'i').exec(challenge)
    return bare ? bare[1] : ''
  }

  const realm = field('realm')
  const nonce = field('nonce')
  const qop = field('qop')
  const opaque = field('opaque')
  const algorithm = field('algorithm') || 'MD5'

  const ha1 = md5(`${username}:${realm}:${password}`)
  const ha2 = md5(`${method}:${uri}`)

  const parts = [
    `username="${username}"`,
    `realm="${realm}"`,
    `nonce="${nonce}"`,
    `uri="${uri}"`,
    `algorithm=${algorithm}`,
  ]

  let response
  if (qop) {
    const cnonce = randomBytes(8).toString('hex')
    const nc = '00000001'
    response = md5(`${ha1}:${nonce}:${nc}:${cnonce}:auth:${ha2}`)
    parts.push('qop=auth', `nc=${nc}`, `cnonce="${cnonce}"`)
  } else {
    response = md5(`${ha1}:${nonce}:${ha2}`)
  }
  parts.push(`response="${response}"`)
  if (opaque) parts.push(`opaque="${opaque}"`)

  return `Digest ${parts.join(', ')}`
}

// ----------------------------------------------------------------- client ---

/**
 * A connection to one controller.
 *
 * `get` is a one-shot CGI call; `stream` opens a long-lived response (the event
 * subscription) and hands back the live stream once authenticated.
 */
export function createDeviceClient({ host, username, password, protocol = 'http' }) {
  const agent = protocol === 'https' ? https : http

  const options = (uri, authHeader) => {
    const [hostname, port] = host.split(':')
    return {
      host: hostname,
      port: port ? Number(port) : protocol === 'https' ? 443 : 80,
      path: uri,
      method: 'GET',
      headers: authHeader ? { Authorization: authHeader } : {},
      ...(protocol === 'https' ? { rejectUnauthorized: false } : {}),
    }
  }

  const basicHeader = () =>
    `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`

  function get(uri, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
      const attempt = authHeader => {
        const req = agent.request(options(uri, authHeader), res => {
          let body = ''
          res.setEncoding('utf8')
          res.on('data', c => (body += c))
          res.on('end', () => {
            if (res.statusCode === 401 && !authHeader) {
              const challenge = res.headers['www-authenticate'] || ''
              if (!/digest/i.test(challenge)) return attempt(basicHeader())
              return attempt(
                buildDigestHeader(challenge, { username, password }, 'GET', uri)
              )
            }
            if (res.statusCode !== 200) {
              const err = new Error(`device ${uri} -> HTTP ${res.statusCode}`)
              err.statusCode = res.statusCode
              return reject(err)
            }
            resolve(body)
          })
        })
        req.setTimeout(timeoutMs, () => req.destroy(new Error(`device ${uri} timed out`)))
        req.on('error', reject)
        req.end()
      }
      attempt(null)
    })
  }

  function stream(uri) {
    return new Promise((resolve, reject) => {
      const attempt = authHeader => {
        const req = agent.request(options(uri, authHeader), res => {
          if (res.statusCode === 401 && !authHeader) {
            const challenge = res.headers['www-authenticate'] || ''
            res.resume()
            if (!/digest/i.test(challenge)) return attempt(basicHeader())
            return attempt(buildDigestHeader(challenge, { username, password }, 'GET', uri))
          }
          if (res.statusCode !== 200) {
            res.resume()
            return reject(new Error(`event stream -> HTTP ${res.statusCode}`))
          }
          resolve({ res, req })
        })
        req.on('error', reject)
        req.end()
      }
      attempt(null)
    })
  }

  return { get, stream, host, protocol }
}

// ---------------------------------------------------------------- parsing ---

/** Expand Dahua's flat `records[0].CardNo=x` lines into nested objects. */
export function parseDahuaKv(body) {
  const root = {}
  for (const line of body.split(/\r?\n/)) {
    const eq = line.indexOf('=')
    if (eq < 1) continue
    const segments = line
      .slice(0, eq)
      .trim()
      .replace(/\[(\d+)\]/g, '.$1')
      .split('.')
      .filter(Boolean)
    if (segments.length === 0) continue
    const value = line.slice(eq + 1)
    let cursor = root
    segments.forEach((seg, i) => {
      if (i === segments.length - 1) cursor[seg] = value
      else {
        if (typeof cursor[seg] !== 'object' || cursor[seg] === null) cursor[seg] = {}
        cursor = cursor[seg]
      }
    })
  }
  return root
}

/** Index of the '}' closing the '{' at `from`, or -1 while still incomplete. */
export function matchBrace(buf, from) {
  let depth = 0
  let inString = false
  let escaped = false
  for (let i = from; i < buf.length; i++) {
    const ch = buf[i]
    if (escaped) {
      escaped = false
      continue
    }
    if (ch === '\\') {
      escaped = true
      continue
    }
    if (ch === '"') inString = !inString
    if (inString) continue
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

/**
 * Pull complete events out of the multipart stream buffer.
 *
 * Parts look like `Code=AccessControl;action=Pulse;index=0;data={...json...}`
 * split across arbitrary chunk boundaries, so anything half-arrived is handed
 * back as `rest` and reconsidered when more bytes land.
 */
export function drainEvents(buf) {
  const events = []
  let cursor = 0

  for (;;) {
    const start = buf.indexOf('Code=', cursor)
    if (start === -1) {
      // No event header in flight; keep a small tail in case one is split.
      cursor = Math.max(cursor, buf.length - 512)
      break
    }

    const nextCode = buf.indexOf('Code=', start + 5)
    const dataIdx = buf.indexOf('data=', start)
    const hasData = dataIdx !== -1 && (nextCode === -1 || dataIdx < nextCode)

    if (hasData) {
      const braceStart = buf.indexOf('{', dataIdx)
      const end = braceStart === -1 ? -1 : matchBrace(buf, braceStart)
      if (end === -1) {
        cursor = start // incomplete JSON — wait for the rest
        break
      }
      events.push({ header: buf.slice(start, dataIdx), json: buf.slice(braceStart, end + 1) })
      cursor = end + 1
      continue
    }

    if (nextCode === -1) {
      cursor = start
      break
    }
    events.push({ header: buf.slice(start, nextCode), json: null })
    cursor = nextCode
  }

  return { events, rest: buf.slice(cursor) }
}

// ----------------------------------------------------- access-control log ---

/**
 * Read the controller's punch log for a time window.
 *
 * Firmware disagrees about how to ask. Newer builds (3.x on the ASI3204E-W)
 * answer a single `action=find` and take the window as bare `StartTime` /
 * `EndTime` — the `condition.`-prefixed form documented for older devices is
 * accepted and then silently ignored, which would hand back the whole log. The
 * older `factory.create` / `startFind` / `doFind` session returns 501 there but
 * is the only thing 2.x firmware understands. So: try modern, fall back.
 *
 * Note the record set is returned oldest-first with no offset parameter, so a
 * working time window is what keeps the catch-up poll correct once the log
 * grows — never widen the window beyond what `count` can hold.
 */
export async function findAccessRecords(device, { start, end, max = 2000 } = {}) {
  const startTs = Math.floor((start instanceof Date ? start.getTime() : start) / 1000)
  const endTs = Math.floor((end instanceof Date ? end.getTime() : end) / 1000)

  const normalize = r => {
    // CreateTimeRealUTC is unambiguous; CreateTime is whatever the device's
    // own notion of "now" is, so prefer the former when the firmware sends it.
    const seconds = Number(r.CreateTimeRealUTC) || Number(r.CreateTime)
    if (!Number.isFinite(seconds) || seconds <= 0) return null
    return {
      userId: r.UserID || null,
      cardNo: r.CardNo || null,
      cardName: r.CardName || null,
      timestamp: seconds,
      method: r.Method != null && r.Method !== '' ? Number(r.Method) : null,
      direction: r.Type || null,
      door: r.Door != null && r.Door !== '' ? Number(r.Door) : null,
      status: r.Status != null && r.Status !== '' ? r.Status : 1,
      errorCode: r.ErrorCode != null && r.ErrorCode !== '' ? Number(r.ErrorCode) : null,
      recNo: r.RecNo != null && r.RecNo !== '' ? Number(r.RecNo) : null,
      raw: r,
    }
  }

  const collect = parsed => {
    const records = parsed.records ?? {}
    return Object.keys(records)
      .sort((a, b) => Number(a) - Number(b))
      .map(k => normalize(records[k]))
      .filter(Boolean)
  }

  // --- modern: one-shot find, window as bare StartTime/EndTime -------------
  try {
    const parsed = parseDahuaKv(
      await device.get(
        '/cgi-bin/recordFinder.cgi?action=find&name=AccessControlCardRec' +
          `&StartTime=${startTs}&EndTime=${endTs}&count=${max}`
      )
    )
    return { mode: 'find', records: collect(parsed) }
  } catch (e) {
    if (e.statusCode !== 400 && e.statusCode !== 501) throw e
  }

  // --- legacy: stateful finder session ------------------------------------
  const createBody = await device.get(
    '/cgi-bin/recordFinder.cgi?action=factory.create&name=AccessControlCardRec'
  )
  const objectId = createBody.split('=')[1]?.trim()
  if (!objectId) throw new Error('recordFinder: no finder object')

  const out = []
  try {
    await device.get(
      `/cgi-bin/recordFinder.cgi?action=startFind&object=${objectId}` +
        `&condition.StartTime=${startTs}&condition.EndTime=${endTs}`
    )
    while (out.length < max) {
      const parsed = parseDahuaKv(
        await device.get(`/cgi-bin/recordFinder.cgi?action=doFind&object=${objectId}&count=100`)
      )
      if (Number(parsed.found || 0) <= 0) break
      const page = collect(parsed)
      if (page.length === 0) break
      out.push(...page)
      if (page.length < 100) break
    }
  } finally {
    await device.get(`/cgi-bin/recordFinder.cgi?action=destroy&object=${objectId}`).catch(() => {})
  }

  return { mode: 'factory', records: out }
}

/**
 * How many people are enrolled on the controller.
 *
 * Newer firmware answers AccessUser.cgi in JSON; older builds answer the flat
 * key=value form. Returns null when neither shape is available.
 */
export async function getEnrolledUsers(device) {
  try {
    const body = await device.get('/cgi-bin/AccessUser.cgi?action=startFind&count=100')
    const json = JSON.parse(body)
    return { total: Number(json.Total ?? 0), token: json.Token ?? null, users: [] }
  } catch {
    // fall through to the flat form
  }

  try {
    const parsed = parseDahuaKv(await device.get('/cgi-bin/AccessUser.cgi?action=list&count=100'))
    const rows = parsed.records ?? {}
    const users = Object.keys(rows)
      .filter(k => /^\d+$/.test(k))
      .map(k => ({
        userId: rows[k].UserID ?? rows[k].UserId ?? null,
        name: rows[k].UserName ?? rows[k].CardName ?? null,
        cardNo: rows[k].CardNo ?? null,
      }))
    return { total: Number(parsed.found ?? users.length), token: null, users }
  } catch {
    return null
  }
}
