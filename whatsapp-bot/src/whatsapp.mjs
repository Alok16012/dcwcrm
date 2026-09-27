/**
 * The WhatsApp connection — Baileys, kept deliberately thin.
 *
 * Owns the socket and nothing about conversations: connect, pair, reconnect,
 * and send with a human-looking typing pause. Every inbound message is handed
 * to `onMessage` untouched.
 */

import makeWASocket, {
  useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, Browsers, generateMessageIDV2,
} from '@whiskeysockets/baileys'
import pino from 'pino'
import qrcode from 'qrcode-terminal'

const sleep = ms => new Promise(r => setTimeout(r, ms))

export function makeWhatsApp({ authDir, phoneNumber, log, onMessage }) {
  let sock = null
  let status = 'starting'
  let backoff = 2000
  let pairingRequested = false

  // Ids of messages this process sent. A message from our own account that is
  // NOT in here was typed by a person on the phone — that is how a
  // counsellor taking over is noticed. Bounded so it cannot grow forever.
  const sentIds = new Set()
  function remember(id) {
    sentIds.add(id)
    if (sentIds.size > 5000) sentIds.delete(sentIds.values().next().value)
  }

  async function connect() {
    const { state, saveCreds } = await useMultiFileAuthState(authDir)
    const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: undefined }))

    sock = makeWASocket({
      version,
      auth: state,
      browser: Browsers.macOS('Chrome'),
      logger: pino({ level: 'warn' }),
      markOnlineOnConnect: false,
      syncFullHistory: false,
      // History sync is left ON. Turning it off looked tidy — history is not
      // ours to answer — but it is also where Baileys learns LID→phone
      // mappings, and without those a LID chat never resolves to a number and
      // never becomes a lead. Old messages are ignored downstream instead:
      // they arrive as 'append', and only 'notify' is answered.
    })

    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
      if (qr) {
        status = 'awaiting_pairing'
        // A pairing code is far easier than scanning a QR out of a server log.
        if (phoneNumber && !pairingRequested && !state.creds.registered) {
          pairingRequested = true
          try {
            const code = await sock.requestPairingCode(phoneNumber.replace(/\D/g, ''))
            log.info('')
            log.info('════════════════════════════════════════════')
            log.info(`  WhatsApp pairing code:  ${code.match(/.{1,4}/g).join('-')}`)
            log.info('  On the bot phone: WhatsApp → Settings → Linked devices')
            log.info('  → Link a device → "Link with phone number instead"')
            log.info('════════════════════════════════════════════')
            log.info('')
          } catch (e) {
            log.error(`pairing code request failed: ${e.message} — falling back to QR`)
            qrcode.generate(qr, { small: true })
          }
        } else if (!phoneNumber) {
          log.info('Scan this QR with the bot phone (WhatsApp → Linked devices):')
          qrcode.generate(qr, { small: true })
        }
      }

      if (connection === 'open') {
        status = 'connected'
        backoff = 2000
        log.info(`WhatsApp connected as ${sock.user?.id ?? 'unknown'}`)
      }

      if (connection === 'close') {
        const code = lastDisconnect?.error?.output?.statusCode
        status = 'disconnected'

        if (code === DisconnectReason.loggedOut) {
          // The phone removed this device. Reconnecting cannot fix that;
          // the session has to be paired again.
          status = 'logged_out'
          log.error('WhatsApp logged out — delete the auth folder and pair again. Not reconnecting.')
          return
        }
        if (code === DisconnectReason.connectionReplaced) {
          // Another copy of the bot is using this session. Reconnecting at
          // once would have the two knock each other off in a loop.
          log.error('Connection replaced by another session — waiting 60s before retrying')
          await sleep(60000)
        }
        const wait = code === DisconnectReason.restartRequired ? 500 : backoff
        log.warn(`WhatsApp closed (${code ?? 'unknown'}) — reconnecting in ${Math.round(wait / 1000)}s`)
        await sleep(wait)
        backoff = Math.min(backoff * 2, 60000)
        pairingRequested = false
        connect().catch(e => log.error(`reconnect failed: ${e.message}`))
      }
    })

    sock.ev.on('messages.upsert', ({ messages, type }) => {
      for (const m of messages) {
        const own = Boolean(m.key?.fromMe)
        if (own) {
          if (sentIds.has(m.key.id)) continue // our own echo
          // Typed by a person on the phone. Whether WhatsApp delivers that as
          // 'notify' or 'append' is not up to us, so both count — the handler
          // ignores anything too old to be a live takeover.
          onMessage(m, { fromHuman: true }).catch(e => log.error(`message handler: ${e.stack ?? e.message}`))
          continue
        }
        // From a student: only live traffic is answered; 'append' is history.
        if (type !== 'notify') continue
        onMessage(m, { fromHuman: false }).catch(e => log.error(`message handler: ${e.stack ?? e.message}`))
      }
    })
  }

  /**
   * Send text the way a person would: seen, typing, then the message.
   * The pause scales with length and is capped — long enough to not look like
   * a machine firing replies, short enough to not keep a student waiting.
   */
  async function send(jid, text, { quoted } = {}) {
    if (!sock || status !== 'connected') throw new Error(`not connected (${status})`)
    try {
      await sock.sendPresenceUpdate('composing', jid)
    } catch { /* presence is cosmetic */ }
    await sleep(Math.min(1200 + text.length * 18, 4500))

    // Choose the id first and remember it before sending, so our own echo can
    // never be mistaken for a counsellor typing.
    const messageId = generateMessageIDV2(sock.user?.id)
    remember(messageId)
    const sent = await sock.sendMessage(jid, { text }, { messageId, ...(quoted ? { quoted } : {}) })
    try {
      await sock.sendPresenceUpdate('paused', jid)
    } catch { /* cosmetic */ }
    return sent?.key?.id ?? messageId
  }

  async function markRead(keys) {
    try {
      await sock?.readMessages(keys)
    } catch { /* read receipts are cosmetic */ }
  }

  return {
    connect,
    send,
    markRead,
    get sock() { return sock },
    get status() { return status },
  }
}
