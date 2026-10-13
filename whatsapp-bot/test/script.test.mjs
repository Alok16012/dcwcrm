/**
 * The admission script from the Flow Builder.
 *
 * The seeded script must run exactly like the built-in questions it came
 * from — same words, same branches, same lead — and admin's edits to it must
 * reach the student.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { handle, newConversation } from '../src/engine.mjs'
import { compileScript, applyScript } from '../src/script.mjs'
import { compileFlows } from '../src/custom.mjs'
import { admissionScript } from '../src/flows/seed.mjs'

const OFF = { enabled: () => false, classify: async () => null, extractField: async () => null, answerQuestion: async () => null }
const config = { counselorPhone: '+91 90000 00000' }

/** The seed as it comes back from wa_flows.root. */
const seed = () => JSON.parse(JSON.stringify(admissionScript()))

async function chat(messages, { flows = [] } = {}) {
  let conv = newConversation()
  const said = []
  const events = []
  for (const m of messages) {
    const input = typeof m === 'string' ? { text: m } : m
    const r = await handle(conv, input, { ai: OFF, config: { ...config, customFlows: compileFlows(flows) }, now: 0, name: 'priya sharma' })
    conv = r.conv
    said.push(r.replies)
    events.push(...r.events)
  }
  return { conv, said, events }
}

async function withScript(root, fn) {
  applyScript(compileScript(root))
  try { return await fn() } finally { applyScript(null) }
}

const SCENARIOS = {
  'school fail': ['Hi', '1', '12th', '1', 'bihar board', '2025', '2 subject', 'Physics aur Maths', 'patna', 'haan'],
  'school compartment': ['12th me compartment aaya hai', 'cbse', '2024', '1', 'maths', 'ranchi', '2'],
  'school improvement': ['hello', '1', '10th', '3', 'icse', '2023', '2', 'english, hindi', '58%', '2', 'delhi', '1'],
  'school new admission': ['Hi', '1', '10th', '4', 'other', 'gaya', 'nahi'],
  'school JEE 12th': ['IIT ke liye 12th me 75% chahiye', 'CBSE', '2025', '62%', '1', 'haan', '2027', 'kota', '1'],
  'school JEE 10th': ['Hi', '1', '10th', '5', '1', '2025', '70%', '1', '2028', 'pune', '3'],
  'school parent': ['mera beta 12th me fail ho gaya', 'bihar board', '2025', '1', 'physics', 'patna', 'photo bhejta hu'],
  'college PG': ['Hi', '2', 'PG', 'MBA', 'graduation pass hai', '62%', 'online', '1', 'promotion ke liye', 'job karta hoon', 'Patna', '7 din me', 'haan'],
  'college UG': ['Hi', '2', '1', '2', '1', '72%', '2', '4', '3', '4', 'lucknow', '5', '4'],
  'college not sure': ['Hi', '2', '3', '12th pass', '6.8 cgpa', 'dono', 'mats', 'business', 'business', 'jaipur', 'is mahine', 'baad me'],
  'college ad opener': ['mujhe MBA online karna hai', '4', '55%', '1', '2', '1', 'noida', '1', '1'],
  'questions mid-flow': ['Hi', '2', 'UG', 'fees kitni hai?', 'BBA', 'kya ye UGC approved hai?', '12th pass', '60%'],
  'misses and restart': ['Hi', '2', 'asdf qwerty', 'zxcv', 'restart', '1', '12th'],
  'counselor mid-flow': ['Hi', '1', '12th', 'counselor se baat karni hai', 'ok thanks'],
  'document photo': ['Hi', '1', '12th', '1', 'cbse', '2025', '1', 'maths', 'patna', { media: 'image' }],
}

for (const [name, messages] of Object.entries(SCENARIOS)) {
  test(`seeded script talks exactly like the built-in questions: ${name}`, async () => {
    const before = await chat(messages)
    const after = await withScript(seed(), () => chat(messages))
    assert.deepEqual(after.said, before.said)
    assert.deepEqual(after.events, before.events)
    assert.deepEqual(after.conv, before.conv)
  })
}

test('the seed covers every built-in question', () => {
  const s = compileScript(seed())
  const slots = id => new Set(s[id].steps.map(x => x.slot))
  for (const slot of ['klass', 'situation', 'previousBoard', 'examYear', 'subjectCount', 'subjects', 'currentPercent', 'targetPercent', 'pcm', 'deadline', 'city', 'documents']) {
    assert.ok(slots('school').has(slot), `school asks ${slot}`)
  }
  for (const slot of ['level', 'course', 'qualification', 'percent', 'mode', 'university', 'purpose', 'workStatus', 'city', 'timeline', 'documents']) {
    assert.ok(slots('college').has(slot), `college asks ${slot}`)
  }
})

// ------------------------------------------------------- admin's edits ---

function find(root, id) {
  const stack = [root]
  while (stack.length) {
    const n = stack.pop()
    if (!n) continue
    if (n.id === id) return n
    stack.push(n.next, ...(n.options ?? []).map(o => o.next))
  }
  return null
}

test('a reworded question and option reach the student, and typed answers still work', async () => {
  const root = seed()
  const klass = find(root, 's_class')
  klass.text = 'Kaunsi class ka admission chahiye?'
  klass.options[0].label = 'Class 10'
  const { said, conv } = await withScript(root, () => chat(['Hi', '1', 'dasvi']))
  assert.match(said[1].at(-1), /^Kaunsi class ka admission chahiye\?\n\n1️⃣ Class 10\n2️⃣ 12th$/)
  assert.equal(conv.answers.klass, '10th', '"dasvi" still means 10th')
  const byLabel = await withScript(root, () => chat(['Hi', '1', 'class 10']))
  assert.equal(byLabel.conv.answers.klass, '10th', 'the new label is an answer too')
})

test('a question admin adds is asked on its path and saved on the lead', async () => {
  const root = seed()
  const city = find(root, 'c_city')
  city.next = {
    id: 'pin', type: 'ask', answer: 'text', saveAs: 'Pincode', text: 'Area ka pincode bata dijiye?',
    next: { id: 'm_thanks', type: 'message', text: 'Shukriya {name}!', next: city.next },
  }
  const { said, events } = await withScript(root, () => chat(['Hi', '2', 'PG', 'MBA', '1', '60%', '1', '1', '1', '1', 'patna', '110092', '1', '1']))
  assert.match(said[10].join('\n'), /Area ka pincode bata dijiye\?/)
  assert.match(said[11].join('\n'), /Shukriya!\n\nAdmission kab tak/, 'the message comes before the next question')
  const handoff = events.find(e => e.type === 'lead.handoff')
  assert.equal(handoff.fields.Pincode, '110092')
})

test('a branch admin adds is followed, and its own closing text is used', async () => {
  const root = seed()
  const level = find(root, 'c_level')
  level.options.push({
    id: 'diploma', label: 'Diploma course', next: {
      id: 'd_mode', type: 'ask', field: 'mode', saveAs: 'Mode Preference', answer: 'choice', text: 'Diploma online chahiye ya distance?',
      options: [{ id: 'd1', label: 'Online', value: 'Online' }, { id: 'd2', label: 'Distance', value: 'Distance' }],
      next: { id: 'd_end', type: 'handoff', text: 'Diploma counselor aapko call karenge 🙏' },
    },
  })
  const { said, conv, events } = await withScript(root, () => chat(['Hi', '2', '4', 'distance']))
  assert.equal(conv.answers.level, 'Diploma course')
  assert.match(said[2].join('\n'), /Diploma online chahiye ya distance\?/)
  assert.deepEqual(said[3], ['Diploma counselor aapko call karenge 🙏'])
  assert.equal(conv.status, 'handoff')
  assert.equal(events.find(e => e.type === 'lead.handoff').department, 'Distance')
})

test('the first menu and welcome come from the script', async () => {
  const root = seed()
  root.text = 'Namaste {name} 🙏 DCW me swagat hai.'
  root.next.text = 'Kis admission ke liye aaye hain?'
  root.next.options.reverse()
  const { said, conv } = await withScript(root, () => chat(['hello', '1']))
  assert.match(said[0][0], /^Namaste Priya 🙏 DCW me swagat hai\.\n\nKis admission ke liye aaye hain\?\n\n1️⃣ Graduation/)
  assert.equal(conv.flow, 'college', 'option 1 is now college')
})

test('a script that cannot run is refused, so the built-in questions stay', () => {
  const loop = seed()
  find(loop, 'c_documents').next = { id: 'back', type: 'goto', target: 'c_mode' }
  assert.throws(() => compileScript(loop), /goes back/)

  const noCollege = seed()
  noCollege.next.options = noCollege.next.options.filter(o => o.value !== 'college')
  assert.throws(() => compileScript(noCollege), /college branch is missing/)

  assert.throws(() => compileScript({ id: 'x', type: 'message', text: 'hi', next: null }), /first question/)
})

test('migration 120 carries the current seed', async t => {
  const { readFile } = await import('node:fs/promises')
  const sql = await readFile(new URL('../../supabase/migrations/120_whatsapp_admission_script.sql', import.meta.url), 'utf8').catch(() => null)
  if (!sql) return t.skip('migrations folder not here')
  const json = sql.match(/\$seed\$(.*)\$seed\$/s)?.[1]
  assert.deepEqual(JSON.parse(json), seed(), 'run: node scripts/script-sql.mjs > ../supabase/migrations/120_whatsapp_admission_script.sql')
})
