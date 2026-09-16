/**
 * Minimal client for the Dahua HTTP CGI API, as spoken by the
 * DHI-ASI3204E-W face recognition access controller.
 *
 * Only what attendance needs: HTTP Digest auth, device identity, and the
 * AccessControlCardRec record set (the controller's own 100,000-entry punch
 * log). Live events are handled by the LAN bridge agent in agent/, which keeps
 * a long-lived multipart connection the serverless runtime cannot hold open.
 *
 * Everything here is fetch-based so it runs unchanged on Railway.
 */

import { createHash, randomBytes } from 'crypto'

export interface DahuaConfig {
  /** Host or host:port of the controller, e.g. "192.168.1.108" or "dcw.ddns.net:8085". */
  host: string
  username: string
  password: string
  /** The controller ships with http; https only if the installer enabled it. */
  protocol?: 'http' | 'https'
  timeoutMs?: number
}

/**
 * Dahua's Method field on an access-control record — the credential that opened
 * the door.
 *
 * Only codes confirmed against real hardware are named here. 6 = fingerprint
 * and 15 = face are verified on the ASI3204E-W (firmware 3.002); the rest are
 * the well-established Dahua values. Anything unlisted deliberately renders as
 * `method_<n>` rather than guessing — a wrong label in an attendance audit
 * trail is worse than an opaque one, and `raw_method` always keeps the number.
 */
export const METHOD_LABELS: Record<number, string> = {
  0: 'unknown',
  1: 'password',
  2: 'card',
  3: 'card_password',
  4: 'remote',
  5: 'button',
  6: 'fingerprint',
  15: 'face',
  16: 'face_card',
}

export function methodLabel(raw: number | null | undefined): string {
  if (raw == null) return 'unknown'
  return METHOD_LABELS[raw] ?? `method_${raw}`
}

function md5(s: string): string {
  return createHash('md5').update(s).digest('hex')
}

/** Build the Digest Authorization header for one request from a 401 challenge. */
function buildDigestHeader(
  challenge: string,
  { username, password }: { username: string; password: string },
  method: string,
  uri: string
): string {
  const field = (name: string) => {
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

  let response: string
  const parts = [
    `username="${username}"`,
    `realm="${realm}"`,
    `nonce="${nonce}"`,
    `uri="${uri}"`,
    `algorithm=${algorithm}`,
  ]

  if (qop) {
    // The controller always offers qop="auth"; a fresh cnonce per request is
    // fine because we never reuse a nonce count.
    const cnonce = randomBytes(8).toString('hex')
    const nc = '00000001'
    response = md5(`${ha1}:${nonce}:${nc}:${cnonce}:auth:${ha2}`)
    parts.push(`qop=auth`, `nc=${nc}`, `cnonce="${cnonce}"`)
  } else {
    response = md5(`${ha1}:${nonce}:${ha2}`)
  }

  parts.push(`response="${response}"`)
  if (opaque) parts.push(`opaque="${opaque}"`)

  return `Digest ${parts.join(', ')}`
}

/**
 * GET a CGI path with Digest auth: one unauthenticated probe to collect the
 * challenge, then the real request. Basic auth is accepted as a fallback for
 * controllers configured in compatibility mode.
 */
export async function dahuaGet(cfg: DahuaConfig, path: string): Promise<string> {
  const base = `${cfg.protocol ?? 'http'}://${cfg.host}`
  const url = `${base}${path}`
  const timeoutMs = cfg.timeoutMs ?? 15000

  const run = (headers: Record<string, string>) =>
    fetch(url, { headers, signal: AbortSignal.timeout(timeoutMs), cache: 'no-store' })

  let res = await run({})

  if (res.status === 401) {
    const challenge = res.headers.get('www-authenticate') ?? ''
    if (/digest/i.test(challenge)) {
      res = await run({
        Authorization: buildDigestHeader(
          challenge,
          { username: cfg.username, password: cfg.password },
          'GET',
          path
        ),
      })
    } else {
      const basic = Buffer.from(`${cfg.username}:${cfg.password}`).toString('base64')
      res = await run({ Authorization: `Basic ${basic}` })
    }
  }

  if (!res.ok) {
    throw new Error(`Dahua ${path} -> HTTP ${res.status} ${res.statusText}`)
  }
  return res.text()
}

/**
 * Dahua CGI answers in flat `a.b[0].c=value` lines. Expand them into a nested
 * object so callers can read `records[0].CardNo` naturally.
 */
export function parseDahuaKv(body: string): Record<string, unknown> {
  const root: Record<string, unknown> = {}

  for (const line of body.split(/\r?\n/)) {
    const eq = line.indexOf('=')
    if (eq < 1) continue
    const rawKey = line.slice(0, eq).trim()
    const value = line.slice(eq + 1)
    if (!rawKey) continue

    // "records[0].CardNo" -> ["records", "0", "CardNo"]
    const segments = rawKey
      .replace(/\[(\d+)\]/g, '.$1')
      .split('.')
      .filter(Boolean)

    let cursor: Record<string, unknown> = root
    segments.forEach((seg, i) => {
      if (i === segments.length - 1) {
        cursor[seg] = value
        return
      }
      if (typeof cursor[seg] !== 'object' || cursor[seg] === null) cursor[seg] = {}
      cursor = cursor[seg] as Record<string, unknown>
    })
  }

  return root
}

export interface DahuaAccessRecord {
  recNo: number | null
  userId: string | null
  cardNo: string | null
  cardName: string | null
  /** Seconds since the Unix epoch, as the controller's clock reports it. */
  createTime: number
  method: number | null
  status: number | null
  errorCode: number | null
  door: number | null
  direction: string | null
  raw: Record<string, string>
}

function num(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function str(v: unknown): string | null {
  if (v == null) return null
  const s = String(v).trim()
  return s === '' ? null : s
}

/** Device identity — used to bind a row in biometric_devices to real hardware. */
export async function getDeviceInfo(cfg: DahuaConfig): Promise<{
  serialNumber: string | null
  deviceType: string | null
  deviceClass: string | null
}> {
  const [serialBody, typeBody] = await Promise.all([
    dahuaGet(cfg, '/cgi-bin/magicBox.cgi?action=getSerialNo').catch(() => ''),
    dahuaGet(cfg, '/cgi-bin/magicBox.cgi?action=getDeviceType').catch(() => ''),
  ])
  const serial = parseDahuaKv(serialBody)
  const type = parseDahuaKv(typeBody)
  return {
    serialNumber: str(serial.sn) ?? str((serial as Record<string, unknown>).serialNumber),
    deviceType: str(type.type),
    deviceClass: str(type.deviceClass),
  }
}

/**
 * Read the controller's own access-control log between two instants.
 *
 * This is the catch-up path: if the bridge agent was offline, or a punch was
 * missed, the controller still has it (100,000 record capacity) and this
 * replays it.
 *
 * Firmware disagrees about how to ask. Newer builds (3.x on the ASI3204E-W)
 * answer a single `action=find` and take the window as bare `StartTime` /
 * `EndTime` — the `condition.`-prefixed form documented for older devices is
 * accepted and then silently ignored, which would hand back the whole log. The
 * older `factory.create` / `startFind` / `doFind` session returns 501 there but
 * is the only thing 2.x firmware understands. So: try modern, fall back.
 *
 * The record set comes back oldest-first with no offset parameter, so a working
 * time window is what keeps this correct once the log grows — never widen the
 * window beyond what `maxRecords` can hold.
 */
export async function findAccessRecords(
  cfg: DahuaConfig,
  opts: { start: Date; end: Date; maxRecords?: number }
): Promise<DahuaAccessRecord[]> {
  const startTs = Math.floor(opts.start.getTime() / 1000)
  const endTs = Math.floor(opts.end.getTime() / 1000)
  const maxRecords = opts.maxRecords ?? 2000

  const collect = (parsed: Record<string, unknown>): DahuaAccessRecord[] => {
    const records = (parsed.records ?? {}) as Record<string, Record<string, string>>
    return Object.keys(records)
      .sort((a, b) => Number(a) - Number(b))
      .map(key => {
        const r = records[key]
        // CreateTimeRealUTC is unambiguous; CreateTime is whatever the device's
        // own notion of "now" is, so prefer the former when it is sent.
        const createTime = num(r.CreateTimeRealUTC) ?? num(r.CreateTime)
        if (createTime == null) return null
        return {
          recNo: num(r.RecNo),
          userId: str(r.UserID),
          cardNo: str(r.CardNo),
          cardName: str(r.CardName),
          createTime,
          method: num(r.Method),
          status: num(r.Status),
          errorCode: num(r.ErrorCode),
          door: num(r.Door),
          direction: str(r.Type) ?? str(r.Direction),
          raw: r,
        } satisfies DahuaAccessRecord
      })
      .filter((r): r is DahuaAccessRecord => r !== null)
  }

  // --- modern: one-shot find, window as bare StartTime/EndTime -------------
  try {
    const body = await dahuaGet(
      cfg,
      '/cgi-bin/recordFinder.cgi?action=find&name=AccessControlCardRec' +
        `&StartTime=${startTs}&EndTime=${endTs}&count=${maxRecords}`
    )
    return collect(parseDahuaKv(body))
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    if (!/HTTP (400|501)/.test(message)) throw e
  }

  // --- legacy: stateful finder session ------------------------------------
  const PAGE = 100
  const createBody = await dahuaGet(
    cfg,
    '/cgi-bin/recordFinder.cgi?action=factory.create&name=AccessControlCardRec'
  )
  const objectId = createBody.split('=')[1]?.trim()
  if (!objectId) throw new Error('Dahua recordFinder: could not create finder object')

  const out: DahuaAccessRecord[] = []

  try {
    await dahuaGet(
      cfg,
      `/cgi-bin/recordFinder.cgi?action=startFind&object=${objectId}` +
        `&condition.StartTime=${startTs}&condition.EndTime=${endTs}`
    )

    while (out.length < maxRecords) {
      const parsed = parseDahuaKv(
        await dahuaGet(
          cfg,
          `/cgi-bin/recordFinder.cgi?action=doFind&object=${objectId}&count=${PAGE}`
        )
      )
      if ((num(parsed.found) ?? 0) <= 0) break
      const page = collect(parsed)
      if (page.length === 0) break
      out.push(...page)
      if (page.length < PAGE) break
    }
  } finally {
    await dahuaGet(cfg, `/cgi-bin/recordFinder.cgi?action=destroy&object=${objectId}`).catch(
      () => undefined
    )
  }

  return out
}

/** Build a DahuaConfig from env, or null when direct-pull mode isn't configured. */
export function dahuaConfigFromEnv(): DahuaConfig | null {
  const host = process.env.DAHUA_HOST
  const username = process.env.DAHUA_USERNAME
  const password = process.env.DAHUA_PASSWORD
  if (!host || !username || !password) return null
  return {
    host,
    username,
    password,
    protocol: (process.env.DAHUA_PROTOCOL as 'http' | 'https') ?? 'http',
    timeoutMs: Number(process.env.DAHUA_TIMEOUT_MS ?? 15000),
  }
}
