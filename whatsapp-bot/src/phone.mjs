/**
 * Who is this, as a phone number?
 *
 * WhatsApp now addresses many chats by LID — an opaque id with no phone number
 * in it — instead of the old number@s.whatsapp.net. The CRM needs the number
 * (it is how leads are deduplicated), so it is looked for in three places,
 * cheapest first. Replies are never sent to a reconstructed number: they go
 * back to the exact JID the message came from, which is always deliverable.
 */

import { isPnUser, isLidUser, jidDecode } from '@whiskeysockets/baileys'

export async function resolvePhone(sock, key) {
  const jid = key.remoteJid
  const fromJid = j => jidDecode(j)?.user ?? null

  if (jid && isPnUser(jid)) return fromJid(jid)
  if (key.remoteJidAlt && isPnUser(key.remoteJidAlt)) return fromJid(key.remoteJidAlt)
  if (jid && isLidUser(jid)) {
    try {
      const pn = await sock.signalRepository?.lidMapping?.getPNForLID(jid)
      if (pn) return fromJid(pn)
    } catch {
      // Unknown yet — the mapping often arrives a few messages later.
    }
  }
  return null
}
