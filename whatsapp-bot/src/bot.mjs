/**
 * The message pipeline: WhatsApp in → engine → WhatsApp out, with the
 * conversation saved and the CRM kept current.
 *
 * Two things here exist because people do not type like forms:
 *   - debounce: "hi" / "mujhe" / "12th fail hua" arrive as three messages a
 *     second apart. They are gathered and answered once, not three times.
 *   - one chat at a time: messages in the same chat are processed in order,
 *     never concurrently, so the saved state never forks.
 */

import { isJidGroup, isJidBroadcast, isJidStatusBroadcast } from '@whiskeysockets/baileys'
import { handle, newConversation } from './engine.mjs'
import { resolvePhone } from './phone.mjs'
import * as realAi from './ai.mjs'

const DEBOUNCE_MS = Number(process.env.DEBOUNCE_MS ?? 2500)
const HUMAN_PAUSE_HOURS = Number(process.env.HUMAN_PAUSE_HOURS ?? 12)
/** Messages that sat unanswered longer than this (bot was down) are skipped. */
const MAX_AGE_MS = Number(process.env.MAX_MESSAGE_AGE_HOURS ?? 6) * 3600 * 1000
/** A phone-typed message older than this is history, not a takeover. */
const TAKEOVER_WINDOW_MS = 10 * 60 * 1000

/** Unwrap WhatsApp's envelopes and pull out what a person actually sent. */
export function extract(m) {
  let msg = m.message
  if (!msg) return null
  msg = msg.ephemeralMessage?.message ?? msg.viewOnceMessage?.message ?? msg.viewOnceMessageV2?.message
    ?? msg.documentWithCaptionMessage?.message ?? msg

  // Reactions, deletes, edits, key exchanges: not something to answer.
  if (msg.reactionMessage || msg.protocolMessage || msg.pollUpdateMessage) return null

  const text = msg.conversation
    ?? msg.extendedTextMessage?.text
    ?? msg.imageMessage?.caption
    ?? msg.videoMessage?.caption
    ?? msg.documentMessage?.caption
    ?? msg.buttonsResponseMessage?.selectedDisplayText
    ?? msg.listResponseMessage?.title
    ?? msg.templateButtonReplyMessage?.selectedDisplayText
    ?? ''

  let media = null
  if (msg.imageMessage) media = 'image'
  else if (msg.documentMessage) media = 'document'
  else if (msg.audioMessage) media = 'audio'
  else if (msg.videoMessage) media = 'video'
  else if (msg.stickerMessage) media = 'sticker'

  // A sticker or a captionless video carries nothing to act on.
  if (!text && (media === 'sticker' || media === 'video')) return null
  if (!text && !media) return null
  return { text: text.trim(), media }
}

function sentAt(m) {
  const ts = Number(m.messageTimestamp?.low ?? m.messageTimestamp ?? 0)
  return ts ? ts * 1000 : Date.now()
}

export function makeBot({ wa, store, crm, config, log, ai = realAi, onStudentMessage = async () => {} }) {
  const buffers = new Map()
  const chains = new Map()

  /** Entry point for every message the connection sees. */
  async function onMessage(m, { fromHuman }) {
    const jid = m.key?.remoteJid
    if (!jid) return
    if (isJidGroup(jid) || isJidBroadcast(jid) || isJidStatusBroadcast(jid) || jid.endsWith('@newsletter')) return

    const content = extract(m)
    if (!content) return

    if (fromHuman) {
      if (Date.now() - sentAt(m) > TAKEOVER_WINDOW_MS) return
      return enqueueSerial(jid, () => noteHumanTakeover(jid, m, content))
    }

    const b = buffers.get(jid) ?? { items: [] }
    b.items.push({ m, content })
    clearTimeout(b.timer)
    b.timer = setTimeout(() => {
      buffers.delete(jid)
      enqueueSerial(jid, () => processBatch(jid, b.items))
    }, DEBOUNCE_MS)
    buffers.set(jid, b)
  }

  function enqueueSerial(jid, job) {
    const prev = chains.get(jid) ?? Promise.resolve()
    const next = prev.then(job).catch(e => log.error(`[${jid}] ${e.stack ?? e.message}`))
    chains.set(jid, next)
    // Drop the chain once idle so the map does not grow with every chat ever seen.
    next.finally(() => { if (chains.get(jid) === next) chains.delete(jid) })
    return next
  }

  /** A counsellor typed in this chat: record it and step aside. */
  async function noteHumanTakeover(jid, m, content) {
    const conv = await store.loadOrCreate({ jid, phone: await resolvePhone(wa.sock, m.key), pushName: null })
    await store.record({
      conversationId: conv.id, waMessageId: m.key.id, direction: 'out', author: 'human',
      body: content.text, media: content.media,
    })
    const until = new Date(Date.now() + HUMAN_PAUSE_HOURS * 3600 * 1000).toISOString()
    await store.save(conv.id, { human_until: until, last_outbound_at: new Date().toISOString() })
    log.info(`[${jid}] counsellor took over — bot silent until ${until}`)
  }

  /** Group consecutive texts into one message; keep media on its own. */
  function toInputs(items) {
    const inputs = []
    for (const { content } of items) {
      const prev = inputs.at(-1)
      if (!content.media && prev && !prev.media) prev.text = `${prev.text} ${content.text}`.trim()
      else inputs.push({ text: content.text, media: content.media })
    }
    return inputs
  }

  async function processBatch(jid, items) {
    const first = items[0].m
    const pushName = items.map(i => i.m.pushName).find(Boolean) ?? null
    const phone = await resolvePhone(wa.sock, first.key)

    const row = await store.loadOrCreate({ jid, phone, pushName })

    // Record everything first. A message already on file was answered by an
    // earlier run (redelivery after a reconnect) — drop it.
    const fresh = []
    for (const it of items) {
      const isNew = await store.record({
        conversationId: row.id, waMessageId: it.m.key.id, direction: 'in', author: 'student',
        body: it.content.text, media: it.content.media,
      })
      if (isNew) fresh.push(it)
    }
    if (fresh.length === 0) return
    // An outreach message to this number now counts as answered.
    await onStudentMessage(phone ?? row.phone).catch(e => log.warn(`reply hook: ${e.message}`))

    const now = Date.now()
    const patch = {
      last_inbound_at: new Date(now).toISOString(),
      ...(phone && !row.phone ? { phone } : {}),
      ...(pushName && !row.push_name ? { push_name: pushName } : {}),
    }

    const silent =
      config.paused ||
      (row.human_until && new Date(row.human_until).getTime() > now) ||
      fresh.every(it => now - sentAt(it.m) > MAX_AGE_MS)

    if (silent) {
      // Not answering this chat doesn't mean ignoring the student — they still
      // belong in the CRM's Leads table.
      const leadId = await runCrmEvents({ jid, events: [], leadId: row.lead_id, phone: phone ?? row.phone, pushName: pushName ?? row.push_name })
      await store.save(row.id, { ...patch, lead_id: leadId })
      return
    }

    await wa.markRead(fresh.map(it => it.m.key))

    // Wrap the AI so this turn knows whether it was used (kept on the
    // transcript, which is how AI spend can be audited later).
    let aiUsed = false
    const aiDeps = {
      enabled: ai.aiEnabled,
      classify: async a => { aiUsed = true; return ai.classify(a) },
      extractField: async a => { aiUsed = true; return ai.extractField(a) },
      answerQuestion: async a => { aiUsed = true; return ai.answerQuestion(a) },
    }

    let state = row.state && Object.keys(row.state).length ? row.state : newConversation()
    const replies = []
    const events = []
    for (const input of toInputs(fresh)) {
      const r = await handle(state, input, { ai: aiDeps, config, now, name: pushName ?? row.push_name })
      state = r.conv
      replies.push(...r.replies)
      events.push(...r.events)
    }

    for (const text of replies) {
      try {
        const id = await wa.send(jid, text)
        await store.record({ conversationId: row.id, waMessageId: id, direction: 'out', author: 'bot', body: text, aiUsed })
      } catch (e) {
        log.error(`[${jid}] send failed: ${e.message}`)
        break
      }
    }

    let leadId = row.lead_id
    const effectivePhone = phone ?? row.phone
    leadId = await runCrmEvents({ jid, events, leadId, phone: effectivePhone, pushName: pushName ?? row.push_name })

    const handoff = [...events].reverse().find(e => e.fields?.['Lead Temperature'])
    await store.save(row.id, {
      ...patch,
      state,
      lead_id: leadId,
      lead_temperature: handoff?.fields?.['Lead Temperature'] ?? row.lead_temperature,
      ...(replies.length ? { last_outbound_at: new Date().toISOString() } : {}),
    })
  }

  /**
   * Make sure the chat has a lead, then fire the engine's CRM events. Returns
   * the lead id.
   *
   * The lead is created on the student's very first message, not when the
   * engine first asks for it (after they pick a flow): students who only say
   * "Hi", or whose chat the bot stays silent in (paused, counsellor took
   * over, message too old), must still reach the Leads table. A chat whose
   * phone number isn't resolved yet is retried on its next message.
   *
   * Failures are logged, never thrown: a CRM hiccup must not stop the bot
   * answering the student — the next message retries.
   */
  async function runCrmEvents({ jid, events, leadId, phone, pushName }) {
    const last = events.at(-1)
    if (leadId && !last) return leadId

    // Every event carries the full current field set, so only the newest
    // matters — plus making sure the lead exists at all.
    try {
      if (!leadId) {
        if (!phone) {
          log.warn(`[${jid}] no phone number resolved yet — lead creation deferred`)
          return leadId
        }
        const fields = last?.fields ?? { 'Chatbot Flow': 'Not chosen yet' }
        const r = await crm.ensure({ phone, pushName, fields, department: last?.department })
        leadId = r.lead_id
        log.info(`[${jid}] lead ${r.duplicate ? 'matched' : 'created'} ${leadId}${r.assignee ? ` → ${r.assignee}` : ''}`)
      } else if (last.type !== 'lead.handoff') {
        await crm.update({ leadId, fields: last.fields, department: last.department })
      }
      if (leadId && events.some(e => e.type === 'lead.handoff')) {
        await crm.handoff({ leadId, fields: last.fields, department: last.department })
        log.info(`[${jid}] handed off (${last.fields?.['Lead Temperature'] ?? '?'})`)
      }
    } catch (e) {
      log.error(`[${jid}] CRM: ${e.message}`)
    }
    return leadId
  }

  return { onMessage }
}
