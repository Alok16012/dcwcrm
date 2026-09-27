/**
 * End-to-end conversations against the pure engine — no WhatsApp, no database.
 * Each test is a scenario straight out of the two DCW briefs.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { handle, newConversation } from '../src/engine.mjs'
import { checkReply } from '../src/guard.mjs'

const OFF = { enabled: () => false, classify: async () => null, extractField: async () => null, answerQuestion: async () => null }
const config = { counselorPhone: '+91 90000 00000' }

/** Play a list of messages; return the final state plus everything said. */
async function chat(messages, { ai = OFF, start = newConversation() } = {}) {
  let conv = start
  const transcript = []
  const events = []
  for (const m of messages) {
    const input = typeof m === 'string' ? { text: m } : m
    const r = await handle(conv, input, { ai, config, now: Date.now() })
    conv = r.conv
    transcript.push({ in: input.text ?? `[${input.media}]`, out: r.replies })
    events.push(...r.events)
  }
  return { conv, transcript, events, last: transcript.at(-1)?.out.join('\n') ?? '' }
}

test('college: full happy path ends in a hot, correctly routed lead', async () => {
  const { conv, events } = await chat([
    'Hi', '2', 'PG', 'MBA', 'graduation pass hai', '62%', 'online',
    '1', 'promotion ke liye', 'job karta hoon', 'Patna', '7 din me', 'haan',
  ])
  assert.equal(conv.flow, 'college')
  assert.equal(conv.status, 'handoff')
  assert.deepEqual(
    { level: conv.answers.level, course: conv.answers.course, pct: conv.answers.percent, mode: conv.answers.mode, uni: conv.answers.university },
    { level: 'PG', course: 'MBA', pct: '62%', mode: 'Online', uni: 'Manglayatan' },
  )
  const handoff = events.find(e => e.type === 'lead.handoff')
  assert.ok(handoff, 'handoff event fired')
  assert.equal(handoff.fields['Lead Temperature'], 'Hot')
  assert.equal(handoff.fields['CRM Status'], 'Counselor Required')
  assert.equal(handoff.department, 'Online')
  assert.match(handoff.fields['Bot Summary'], /PG \| MBA/)
})

test('college: an ad opener fills level, course and mode without asking', async () => {
  const { conv, last } = await chat(['mujhe MBA online karna hai'])
  assert.equal(conv.answers.level, 'PG')
  assert.equal(conv.answers.course, 'MBA')
  assert.equal(conv.answers.mode, 'Online')
  assert.match(last, /graduation ka status/i, 'jumps straight to qualification')
})

test('school: fail flow collects board, year, subjects and hands off', async () => {
  const { conv, events } = await chat([
    '12th me fail ho gaya, open schooling chahiye',
    'bihar board', '2025', '2 subject', 'Physics aur Maths', 'patna', 'haan',
  ])
  assert.equal(conv.flow, 'school')
  assert.equal(conv.answers.klass, '12th')
  assert.equal(conv.answers.situation, 'Fail')
  assert.equal(conv.answers.previousBoard, 'Bihar Board')
  assert.equal(conv.answers.examYear, 2025)
  assert.equal(conv.answers.subjectCount, '2 subjects')
  assert.equal(conv.status, 'handoff')
  const summary = events.find(e => e.type === 'lead.handoff').fields['Bot Summary']
  assert.match(summary, /12th \| Bihar Board \| Exam 2025 \| 2 subjects fail/)
  assert.equal(events.find(e => e.type === 'lead.handoff').department, 'Open School')
})

test('school: JEE/IIT case is escalated and asks for PCM', async () => {
  const { conv, transcript } = await chat(['IIT ke liye 12th me 75% chahiye', 'CBSE', '2025', '62%', '1', 'haan'])
  assert.equal(conv.answers.situation, 'JEE/IIT 75%')
  assert.equal(conv.escalated, 'JEE/IIT eligibility')
  assert.ok(transcript.some(t => t.out.join(' ').includes('PCM')), 'asked about PCM')
})

test('a failed student is asked about failed subjects, not about improving marks', async () => {
  const { transcript } = await chat(['12th me fail ho gaya', 'cbse', '2025'])
  const asked = transcript.at(-1).out.join(' ')
  assert.match(asked, /fail\/compartment/)
  assert.doesNotMatch(asked, /improve/)
})

test('an improvement student is asked about improving', async () => {
  const { transcript } = await chat(['12th me marks improve karne hain', 'cbse', '2024'])
  assert.match(transcript.at(-1).out.join(' '), /improve/)
})

test('parent is spoken to about their child', async () => {
  const { conv, last } = await chat(['mera beta 12th me fail ho gaya'])
  assert.equal(conv.persona.who, 'parent')
  assert.match(last, /bachch/i)
})

test('a fee question mid-flow is answered without a number, and the step is asked again', async () => {
  const { conv, last } = await chat(['Hi', '2', 'UG', 'fees kitni hai?'])
  assert.equal(conv.answers.course, undefined, 'course not set from a question')
  assert.match(last, /fee/i)
  assert.match(last, /Graduation me kis course/i, 'pending question repeated')
  assert.ok(checkReply(last).ok, 'no fee amount leaked')
})

test('"stop" silences the bot, and "hi" brings it back', async () => {
  const { conv: stopped } = await chat(['Hi', 'stop'])
  assert.equal(stopped.status, 'opted_out')
  const ignored = await chat(['kya hua'], { start: stopped })
  assert.equal(ignored.transcript[0].out.length, 0, 'silent after opt-out')
  const back = await chat(['hi'], { start: stopped })
  assert.equal(back.conv.status, 'bot')
})

test('asking for a counselor hands off at once, with the call number', async () => {
  const { conv, last } = await chat(['Hi', '1', '12th', 'counselor se baat karni hai'])
  assert.equal(conv.status, 'handoff')
  assert.match(last, /\+91 90000 00000/)
})

test('two unreadable answers skip the question instead of trapping the student', async () => {
  const { conv } = await chat(['Hi', '2', 'asdf qwerty', 'zxcv'])
  assert.equal(conv.answers.level, 'Not answered')
})

test('a voice note gets a polite request to type', async () => {
  const { last } = await chat(['Hi', { media: 'audio' }])
  assert.match(last, /voice note/i)
})

test('"haan" answers a yes/no step — it is not a greeting', async () => {
  const { conv } = await chat(['12th me fail hu', 'cbse', '2024', '1', 'maths', 'patna', 'haan'])
  assert.equal(conv.answers.documents, 'Available')
})

test('a question about online admission does not set the mode', async () => {
  const { conv } = await chat(['mba karna hai', 'admission online ho jayega?'])
  assert.equal(conv.answers.mode, undefined)
})

test('a board name is not mistaken for a home town', async () => {
  const { conv } = await chat(['12th fail', 'bihar board se tha'])
  assert.equal(conv.answers.previousBoard, 'Bihar Board')
  assert.equal(conv.answers.city, undefined)
})

test('AI fallback maps free text to an option when patterns cannot', async () => {
  const ai = {
    enabled: () => true,
    classify: async ({ options }) => ({ kind: 'answer', value: options[1].value, who: 'student' }),
    extractField: async () => null,
    answerQuestion: async () => null,
  }
  const { conv } = await chat(['Hi', '2', 'mujhe masters wali degree chahiye bhai'], { ai })
  assert.equal(conv.answers.level, 'PG')
})

test('after handoff the bot nudges once, then stays out of the way', async () => {
  const done = await chat(['Hi', '1', '12th', 'counselor chahiye'])
  const r1 = await chat(['ok thanks'], { start: done.conv })
  assert.equal(r1.transcript[0].out.length, 1, 'one reassurance')
  const r2 = await chat(['ok'], { start: r1.conv })
  assert.equal(r2.transcript[0].out.length, 0, 'then silent')
})

test('guard rejects promises, fees and dates — and allows disclaimers', () => {
  assert.equal(checkReply('Admission 100% pakka ho jayega.').ok, false)
  assert.equal(checkReply('Guaranteed pass!').ok, false)
  assert.equal(checkReply('Fee ₹15,000 hai.').ok, false)
  assert.equal(checkReply('Last date 15 March hai.').ok, false)
  assert.equal(checkReply('100% guarantee nahi di ja sakti, counselor verify karega.').ok, true)
  assert.equal(checkReply('Counselor aapko current fee batayega.').ok, true)
})
