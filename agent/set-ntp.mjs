#!/usr/bin/env node
/**
 * Turn on NTP time sync on the controller.
 *
 * The device clock stamps every punch, so drift is not cosmetic — it quietly
 * shifts attendance. This flips NTP on and sets a sane sync interval, leaving
 * the timezone alone (the web UI's timezone picker is the right place for that,
 * and getting it wrong is far more damaging than leaving it).
 *
 * Usage:
 *   node agent/set-ntp.mjs                       # enable, keep current server
 *   node agent/set-ntp.mjs in.pool.ntp.org       # enable with a specific server
 */

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createDeviceClient, loadEnvFile, parseDahuaKv } from './device.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
loadEnvFile(path.join(HERE, '.env'))

const server = process.argv[2] || null
const UPDATE_PERIOD_MINUTES = 60

const device = createDeviceClient({
  host: process.env.DAHUA_HOST,
  username: process.env.DAHUA_USERNAME,
  password: process.env.DAHUA_PASSWORD,
  protocol: process.env.DAHUA_PROTOCOL || 'http',
})

async function readNtp() {
  const parsed = parseDahuaKv(
    await device.get('/cgi-bin/configManager.cgi?action=getConfig&name=NTP')
  )
  return parsed.table?.NTP ?? {}
}

function show(label, ntp) {
  console.log(
    `  ${label.padEnd(8)} enabled=${ntp.Enable}  server=${ntp.Address}  ` +
      `every=${ntp.UpdatePeriod}min  timezone=${ntp.TimeZoneDesc} (${ntp.TimeZone})`
  )
}

console.log(`\nNTP setup — ${process.env.DAHUA_HOST}\n`)

const before = await readNtp()
show('before', before)

if (String(before.Enable).toLowerCase() === 'true' && !server) {
  console.log('\nNTP is already on — nothing to change.\n')
  process.exit(0)
}

const params = [
  'NTP.Enable=true',
  `NTP.UpdatePeriod=${UPDATE_PERIOD_MINUTES}`,
  ...(server ? [`NTP.Address=${encodeURIComponent(server)}`] : []),
]

try {
  await device.get(`/cgi-bin/configManager.cgi?action=setConfig&${params.join('&')}`)
} catch (e) {
  console.error(`\nFailed to write config: ${e.message}`)
  console.error('The account may be read-only — use an admin login, or set it in the web UI.\n')
  process.exit(1)
}

const after = await readNtp()
show('after', after)

// Confirm the device took it, rather than trusting the 200.
if (String(after.Enable).toLowerCase() === 'true') {
  console.log('\nNTP is on. The clock now re-syncs on its own.\n')

  const time = parseDahuaKv(await device.get('/cgi-bin/global.cgi?action=getCurrentTime'))
  const istNow = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).format(new Date()).replace(',', '')
  console.log(`  device clock : ${(time.result || '').trim()}`)
  console.log(`  IST now      : ${istNow}\n`)
} else {
  console.log('\nThe device did not accept the change — set it in the web UI instead.\n')
  process.exit(1)
}
