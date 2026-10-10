/**
 * The message pipeline against fake WhatsApp, storage and CRM: debounce,
 * redelivery, counsellor takeover, and the order CRM calls happen in.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

process.env.DEBOUNCE_MS = '40'
const { makeBot, extract } = await import('../src/bot.mjs')

const OFF = { aiEnabled: () => false, classify: async () => null, extractField: async () => null, answerQuestion: async () => null }
const JID = '919876543210@s.whatsapp.net'
const sleep = ms => new Promise(r => setTimeout(r, ms))

function rig({ config = {} } = {}) {
  const sent = []
  const crmCalls = []
  const rows = new Map()
  const msgIds = new Set()
  let n = 0

  const wa = {
    sock: { signalRepository: null },
    status: 'connected',
    send: async (jid, text) => { sent.push({ jid, text }); return `bot-${++n}` },
    markRead: async () => {},
  }
  const store = {
    async loadOrCreate({ jid, phone, pushName }) {
      if (!rows.has(jid)) rows.set(jid, { id: `c-${jid}`, chat_jid: jid, phone, push_name: pushName, state: {}, lead_id: null, human_until: null })
      return structuredClone(rows.get(jid))
    },
    async save(id, patch) {
      const row = [...rows.values()].find(r => r.id === id)
      Object.assign(row, structuredClone(patch))
    },
    async record({ waMessageId }) {
      if (waMessageId && msgIds.has(waMessageId)) return false
      if (waMessageId) msgIds.add(waMessageId)
      return true
    },
  }
  const crm = {
    ensure: async a => { crmCalls.push({ action: 'ensure', ...a }); return { lead_id: 'lead-1', duplicate: false } },
    update: async a => { crmCalls.push({ action: 'update', ...a }); return { ok: true } },
    handoff: async a => { crmCalls.push({ action: 'handoff', ...a }); return { ok: true } },
  }
  const log = { info() {}, warn() {}, error: (...a) => console.error(...a) }
  const bot = makeBot({ wa, store, crm, config: { counselorPhone: '+91 9', ...config }, log, ai: OFF })

  let seq = 0
  const msg = (text, { jid = JID, id, fromMe = false } = {}) => ({
    key: { remoteJid: jid, id: id ?? `in-${++seq}`, fromMe },
    message: { conversation: text },
    messageTimestamp: Math.floor(Date.now() / 1000),
    pushName: 'Ravi',
  })
  const say = (text, opts) => bot.onMessage(msg(text, opts), { fromHuman: Boolean(opts?.fromMe) })
  return { bot, sent, crmCalls, rows, say, msg }
}

test('three quick messages are answered once, together', async () => {
  const r = rig()
  await r.say('hi')
  await r.say('mujhe')
  await r.say('12th fail hua')
  await sleep(150)
  const state = r.rows.get(JID).state
  assert.equal(state.flow, 'school', 'the joined text chose the flow')
  assert.equal(state.answers.situation, 'Fail')
  assert.ok(r.sent.length <= 2, `one reply round, got ${r.sent.length} messages`)
})

test('a redelivered message is not answered twice', async () => {
  const r = rig()
  await r.say('12th fail hua', { id: 'dup-1' })
  await sleep(120)
  const before = r.sent.length
  await r.say('12th fail hua', { id: 'dup-1' })
  await sleep(120)
  assert.equal(r.sent.length, before)
})

test('a counsellor typing on the phone silences the bot in that chat', async () => {
  const r = rig()
  await r.say('12th fail hua')
  await sleep(120)
  await r.say('Main counselor hoon, call karta hoon', { fromMe: true })
  await sleep(30)
  assert.ok(r.rows.get(JID).human_until, 'takeover recorded')
  const before = r.sent.length
  await r.say('ok sir')
  await sleep(120)
  assert.equal(r.sent.length, before, 'bot stayed quiet')
})

test('groups and status updates are ignored', async () => {
  const r = rig()
  await r.say('12th fail', { jid: '1203630@g.us' })
  await r.say('12th fail', { jid: 'status@broadcast' })
  await sleep(120)
  assert.equal(r.sent.length, 0)
})

test('CRM: lead is created once, updated as answers come, handed off at the end', async () => {
  const r = rig()
  for (const t of ['12th fail hua', 'cbse', '2025', '2', 'maths physics', 'patna', 'haan']) {
    await r.say(t)
    await sleep(80)
  }
  const actions = r.crmCalls.map(c => c.action)
  assert.equal(actions.filter(a => a === 'ensure').length, 1, 'ensured exactly once')
  assert.equal(actions[0], 'ensure')
  assert.ok(actions.includes('update'))
  assert.equal(actions.at(-1), 'handoff')
  assert.equal(r.crmCalls[0].phone, '919876543210')
  assert.equal(r.crmCalls.at(-1).department, 'Open School')
  assert.equal(r.rows.get(JID).lead_id, 'lead-1')
})

test('CRM: a bare "Hi" is already a lead, before any flow is picked', async () => {
  const r = rig()
  await r.say('Hi')
  await sleep(80)
  assert.deepEqual(r.crmCalls.map(c => c.action), ['ensure'])
  assert.equal(r.crmCalls[0].fields['Chatbot Flow'], 'Not chosen yet')
  assert.equal(r.rows.get(JID).lead_id, 'lead-1')

  // Picking a flow later updates that lead rather than creating another
  await r.say('1')
  await sleep(80)
  assert.equal(r.crmCalls.filter(c => c.action === 'ensure').length, 1)
})

test('CRM: a chat the bot stays silent in still becomes a lead', async () => {
  const r = rig({ config: { paused: true } })
  await r.say('12th fail hua')
  await sleep(80)
  assert.equal(r.sent.length, 0, 'paused bot does not reply')
  assert.deepEqual(r.crmCalls.map(c => c.action), ['ensure'])
  assert.equal(r.rows.get(JID).lead_id, 'lead-1')

  await r.say('hello?')
  await sleep(80)
  assert.equal(r.crmCalls.length, 1, 'not ensured again once linked')
})

test('extract unwraps captions, ignores reactions and bare stickers', () => {
  assert.deepEqual(extract({ message: { imageMessage: { caption: 'marksheet' } } }), { text: 'marksheet', media: 'image' })
  assert.deepEqual(extract({ message: { extendedTextMessage: { text: 'hi' } } }), { text: 'hi', media: null })
  assert.equal(extract({ message: { reactionMessage: { text: '👍' } } }), null)
  assert.equal(extract({ message: { stickerMessage: {} } }), null)
  assert.deepEqual(extract({ message: { ephemeralMessage: { message: { conversation: '12th' } } } }), { text: '12th', media: null })
})
