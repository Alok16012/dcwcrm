/**
 * Conversation state and transcript, in Supabase.
 *
 * State is saved after every message, so a restart or redeploy resumes each
 * chat exactly where it stopped. The transcript's unique WhatsApp message id
 * doubles as the idempotency guard: a message redelivered after a reconnect
 * fails to insert, and so is never answered twice.
 */

import { newConversation } from './engine.mjs'

export function makeStore(db) {
  async function load(jid) {
    const { data, error } = await db.from('wa_conversations').select('*').eq('chat_jid', jid).maybeSingle()
    if (error) throw new Error(`load conversation: ${error.message}`)
    return data
  }

  async function create({ jid, phone, pushName }) {
    const { data, error } = await db
      .from('wa_conversations')
      .insert({ chat_jid: jid, phone, push_name: pushName, state: newConversation() })
      .select('*')
      .single()
    if (!error) return data
    // Two messages from a new chat raced; the other one won — use its row.
    if (error.code === '23505') return load(jid)
    throw new Error(`create conversation: ${error.message}`)
  }

  async function loadOrCreate(args) {
    return (await load(args.jid)) ?? (await create(args))
  }

  async function save(id, patch) {
    const row = { ...patch, updated_at: new Date().toISOString() }
    if (patch.state) {
      row.status = patch.state.status
      row.flow = patch.state.flow
    }
    const { error } = await db.from('wa_conversations').update(row).eq('id', id)
    if (error) throw new Error(`save conversation: ${error.message}`)
  }

  /** Returns false when this WhatsApp message was already recorded. */
  async function record({ conversationId, waMessageId, direction, author, body, media, aiUsed = false }) {
    const { error } = await db.from('wa_messages').insert({
      conversation_id: conversationId,
      wa_message_id: waMessageId ?? null,
      direction, author,
      body: body ? String(body).slice(0, 4000) : null,
      media: media ?? null,
      ai_used: aiUsed,
    })
    if (!error) return true
    if (error.code === '23505') return false
    throw new Error(`record message: ${error.message}`)
  }

  return { load, loadOrCreate, save, record }
}
