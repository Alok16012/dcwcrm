/**
 * Flows admin builds in the CRM, run through the real engine.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { handle, newConversation } from '../src/engine.mjs'
import { compileFlows, matchTrigger, pickBranch } from '../src/custom.mjs'

const OFF = { enabled: () => false, classify: async () => null, extractField: async () => null, answerQuestion: async () => null }

const WELCOME = {
  id: 'f1', name: 'Welcome', is_active: true, triggers: ['Hi', 'hello'], match_mode: 'exact',
  root: {
    id: 'm1', type: 'message', text: 'Namaste {name} 🙏 DCW me swagat hai.',
    next: {
      id: 'q1', type: 'question', text: 'Aapko kya chahiye?', saveAs: 'Interest',
      options: [
        { id: 'o1', label: 'Fees jaanni hai', next: { id: 'm2', type: 'message', text: 'BOSSE 12th fee ₹15,000 hai.', next: null } },
        { id: 'o2', label: 'Counselor se baat', next: { id: 'h1', type: 'handoff', text: 'Counselor aapko call karenge.' } },
        { id: 'o3', label: 'Admission', next: { id: 'b1', type: 'builtin', target: 'school' } },
      ],
    },
  },
}
const FEES = {
  id: 'f2', name: 'Fees', is_active: true, triggers: ['fees'], match_mode: 'contains',
  root: { id: 'x1', type: 'message', text: 'Fee details: ₹15,000.', next: null },
}

async function chat(messages, flows, { start = newConversation(), name = 'rahul kumar' } = {}) {
  const config = { counselorPhone: '+91 9', customFlows: compileFlows(flows) }
  let conv = start
  const said = []
  const events = []
  for (const text of messages) {
    const r = await handle(conv, { text }, { ai: OFF, config, name })
    conv = r.conv
    said.push(r.replies)
    events.push(...r.events)
  }
  return { conv, said, events }
}

test('a "Hi" trigger gets admin\'s reply instead of the built-in menu', async () => {
  const { said, conv } = await chat(['hi'], [WELCOME])
  assert.equal(said[0][0], 'Namaste Rahul 🙏 DCW me swagat hai.')
  assert.match(said[0][1], /Aapko kya chahiye\?\n\n1️⃣ Fees jaanni hai\n2️⃣ Counselor se baat\n3️⃣ Admission/)
  assert.deepEqual(conv.custom, { flowId: 'f1', nodeId: 'q1' })
})

test('the reply picks the branch, by number or by label, and is saved on the lead', async () => {
  const a = await chat(['hi', '1'], [WELCOME])
  assert.deepEqual(a.said[1], ['BOSSE 12th fee ₹15,000 hai.'])
  assert.equal(a.conv.custom, null)
  assert.equal(a.events.at(-1).fields.Interest, 'Fees jaanni hai')

  const b = await chat(['hi', 'fees jaanni hai'], [WELCOME])
  assert.deepEqual(b.said[1], ['BOSSE 12th fee ₹15,000 hai.'])
})

test('a handoff branch hands the chat to a counsellor', async () => {
  const { said, conv, events } = await chat(['hello', '2'], [WELCOME])
  assert.deepEqual(said[1], ['Counselor aapko call karenge.'])
  assert.equal(conv.status, 'handoff')
  const h = events.find(e => e.type === 'lead.handoff')
  assert.equal(h.fields['CRM Status'], 'Counselor Required')
  assert.equal(h.fields['Custom Flow'], 'Welcome')
})

test('a builtin branch continues in the admission script', async () => {
  const { said, conv } = await chat(['hi', '3'], [WELCOME])
  assert.equal(conv.flow, 'school')
  assert.ok(said[1].length >= 2, 'welcome + first question')
})

test('a reply that fits no option is asked once more, then the script takes over', async () => {
  const { said, conv } = await chat(['hi', 'kuch aur', 'pata nahi'], [WELCOME])
  assert.match(said[1][0], /^Please number bhej dijiye/)
  assert.equal(conv.custom, null)
  assert.match(said[2].join('\n'), /10th \/ 12th/)
})

test('"contains" triggers fire inside a sentence; exact ones do not', async () => {
  const flows = compileFlows([WELCOME, FEES])
  assert.equal(matchTrigger('BOSSE ki fees kitni hai', flows)?.id, 'f2')
  assert.equal(matchTrigger('hi sir admission chahiye', flows), null)
  assert.equal(matchTrigger('Hi!', flows)?.id, 'f1')
})

test('first-message flows open on any first message, and only the first', async () => {
  const first = { ...FEES, id: 'f3', triggers: [], on_first_message: true }
  const a = await chat(['namaste ji'], [first])
  assert.deepEqual(a.said[0], ['Fee details: ₹15,000.'])
  const b = await chat(['namaste ji', 'aur batao'], [first])
  assert.notDeepEqual(b.said[1], ['Fee details: ₹15,000.'])
})

test('with no flows the built-in script is untouched', async () => {
  const { said } = await chat(['hi'], [])
  assert.match(said[0][0], /Welcome to Distance Courses Wala/)
})

test('inactive or empty flows are ignored', () => {
  assert.equal(compileFlows([{ ...WELCOME, is_active: false }]).length, 0)
  assert.equal(compileFlows([{ ...WELCOME, root: null }]).length, 0)
})

test('pickBranch will not guess between two options', () => {
  const opts = [{ label: 'Online' }, { label: 'Online Exam' }]
  assert.equal(pickBranch('2', opts)?.label, 'Online Exam')
  assert.equal(pickBranch('online exam', opts)?.label, 'Online Exam')
  assert.equal(pickBranch('online exam nahi online', opts), null)
})
