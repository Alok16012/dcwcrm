/**
 * The CRM's control centre, as the bot sees it.
 *
 * Settings, the admin-taught knowledge base and the outreach queue live in
 * Supabase (wa_bot_settings, wa_knowledge, wa_outreach) so admin can steer the
 * bot from the CRM without a redeploy. This re-reads them every minute.
 *
 * Outreach — messaging existing leads first — is deliberately slow. Baileys
 * is an unofficial client, and a number that sends many first messages in a
 * burst gets banned. So: a daily cap, office hours only, a random gap of
 * minutes between sends, a rotating wording, and never a number that opted
 * out or is already mid-conversation.
 */

import { setCustomKnowledge, customKnowledgeCount } from './faq.mjs'
import { setAiSwitch } from './ai.mjs'
import { compileFlows } from './custom.mjs'

const REFRESH_MS = 60 * 1000
/** Someone who wrote in this recently is already talking — do not cold-open them. */
const ACTIVE_CHAT_DAYS = 7

const DEFAULTS = {
  paused: false,
  ai_enabled: true,
  outreach_enabled: false,
  outreach_daily_limit: 30,
  outreach_start_hour: 10,
  outreach_end_hour: 19,
  outreach_min_gap_sec: 120,
  outreach_max_gap_sec: 420,
  outreach_templates: [],
}

function istDay(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d)
}
function istHour(d = new Date()) {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', hourCycle: 'h23' }).format(d))
}

/** A usable first name, or '' — never "IVR Caller 98…" in a greeting. */
export function greetingName(name) {
  const n = String(name ?? '').trim()
  if (!n || /^(ivr caller|whatsapp lead|unknown|lead)\b/i.test(n) || /\d{5,}/.test(n)) return ''
  const first = n.split(/\s+/)[0]
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase()
}

export function fillTemplate(template, name) {
  const first = greetingName(name)
  return template
    .replace(/\{name\}/g, first)
    // With no name: "Hi ," → "Hi," and "Namaste  🙏" → "Namaste 🙏".
    .replace(/[ \t]+,/g, ',')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

export function makeControl({ db, wa, store, config, envPaused, log }) {
  let settings = { ...DEFAULTS }
  let nextSendAt = 0
  let busy = false

  async function refresh() {
    const [s, k, f] = await Promise.all([
      db.from('wa_bot_settings').select('*').maybeSingle(),
      db.from('wa_knowledge').select('id, title, body, keywords, flow, is_active').eq('is_active', true),
      db.from('wa_flows').select('id, name, triggers, match_mode, on_first_message, root, is_active').eq('is_active', true).order('created_at'),
    ])
    if (s.error) log.warn(`settings load failed: ${s.error.message}`)
    else if (s.data) settings = { ...DEFAULTS, ...s.data }
    if (k.error) log.warn(`knowledge load failed: ${k.error.message}`)
    else setCustomKnowledge(k.data)
    if (f.error) log.warn(`flows load failed: ${f.error.message}`)
    else config.customFlows = compileFlows(f.data)

    config.paused = envPaused || settings.paused
    setAiSwitch(settings.ai_enabled)
  }

  async function sentToday() {
    const since = new Date(`${istDay()}T00:00:00+05:30`).toISOString()
    const { count, error } = await db.from('wa_outreach')
      .select('id', { count: 'exact', head: true })
      .in('status', ['sent', 'replied'])
      .gte('sent_at', since)
    if (error) throw new Error(`outreach count: ${error.message}`)
    return count ?? 0
  }

  async function mark(id, patch) {
    const { error } = await db.from('wa_outreach').update(patch).eq('id', id)
    if (error) log.warn(`outreach update failed: ${error.message}`)
  }

  /** Why this number should not get a cold message, or null if it may. */
  async function reasonToSkip(phone12) {
    const { data } = await db.from('wa_conversations')
      .select('status, last_inbound_at')
      .eq('phone', phone12)
    for (const c of data ?? []) {
      if (c.status === 'opted_out') return 'Opted out of messages'
      if (c.last_inbound_at && Date.now() - new Date(c.last_inbound_at).getTime() < ACTIVE_CHAT_DAYS * 86400e3) {
        return 'Already chatting with the bot'
      }
    }
    return null
  }

  async function sendOne() {
    const s = settings
    if (!s.outreach_enabled || config.paused || wa.status !== 'connected') return
    const hour = istHour()
    if (hour < s.outreach_start_hour || hour >= s.outreach_end_hour) return
    if (Date.now() < nextSendAt) return
    if ((await sentToday()) >= s.outreach_daily_limit) return

    const templates = (s.outreach_templates ?? []).filter(t => t?.trim())
    if (templates.length === 0) return

    const { data: item, error } = await db.from('wa_outreach')
      .select('*').eq('status', 'queued').order('queued_at').limit(1).maybeSingle()
    if (error) throw new Error(`outreach pick: ${error.message}`)
    if (!item) return

    const phone12 = `91${String(item.phone).replace(/\D/g, '').slice(-10)}`
    const skip = await reasonToSkip(phone12)
    if (skip) {
      await mark(item.id, { status: 'skipped', error: skip })
      return
    }

    const [check] = await wa.sock.onWhatsApp(`${phone12}@s.whatsapp.net`).catch(() => [])
    if (!check?.exists) {
      await mark(item.id, { status: 'skipped', error: 'Number is not on WhatsApp' })
      // Lookups are traffic too; do not fire them back to back.
      nextSendAt = Date.now() + 20 * 1000
      return
    }

    const text = fillTemplate(templates[Math.floor(Math.random() * templates.length)], item.name)
    const jid = check.jid ?? `${phone12}@s.whatsapp.net`
    try {
      const messageId = await wa.send(jid, text)
      const conv = await store.loadOrCreate({ jid, phone: phone12, pushName: null })
      await store.record({ conversationId: conv.id, waMessageId: messageId, direction: 'out', author: 'bot', body: text })
      await store.save(conv.id, {
        last_outbound_at: new Date().toISOString(),
        ...(item.lead_id && !conv.lead_id ? { lead_id: item.lead_id } : {}),
      })
      await mark(item.id, { status: 'sent', message: text, sent_at: new Date().toISOString(), error: null })
      log.info(`[outreach] sent to ${phone12}`)
    } catch (e) {
      await mark(item.id, { status: 'failed', error: e.message.slice(0, 300) })
      log.error(`[outreach] ${phone12}: ${e.message}`)
    }
    const min = Math.max(30, s.outreach_min_gap_sec)
    const max = Math.max(min, s.outreach_max_gap_sec)
    nextSendAt = Date.now() + (min + Math.random() * (max - min)) * 1000
  }

  async function tick() {
    if (busy) return
    busy = true
    try {
      await refresh()
      await sendOne()
    } catch (e) {
      log.error(`control: ${e.message}`)
    } finally {
      busy = false
    }
  }

  /** A student wrote in: an outreach message to them has been answered. */
  async function noteReply(phone) {
    const last10 = String(phone ?? '').replace(/\D/g, '').slice(-10)
    if (last10.length !== 10) return
    const { error } = await db.from('wa_outreach')
      .update({ status: 'replied', replied_at: new Date().toISOString() })
      .eq('phone', last10).eq('status', 'sent')
    if (error) log.warn(`outreach reply mark failed: ${error.message}`)
  }

  return {
    start() {
      tick()
      setInterval(tick, REFRESH_MS)
    },
    refresh,
    noteReply,
    stats: () => ({ knowledge: customKnowledgeCount(), flows: config.customFlows?.length ?? 0, outreach: settings.outreach_enabled }),
  }
}
