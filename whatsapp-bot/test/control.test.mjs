import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fillTemplate, greetingName } from '../src/control.mjs'
import { setCustomKnowledge, matchFaq, KNOWLEDGE } from '../src/faq.mjs'

test('outreach greets by first name, never by a placeholder', () => {
  assert.equal(greetingName('aastha SINHA'), 'Aastha')
  assert.equal(greetingName('IVR Caller 9472606914'), '')
  assert.equal(greetingName('WhatsApp Lead'), '')
  assert.equal(fillTemplate('Hi {name}, DCW se.', 'Rahul Kumar'), 'Hi Rahul, DCW se.')
  assert.equal(fillTemplate('Hi {name}, DCW se.', null), 'Hi, DCW se.')
  assert.equal(fillTemplate('Namaste {name} 🙏 DCW', ''), 'Namaste 🙏 DCW')
})

test('admin-taught answers win, match whole words, and reach the AI', () => {
  setCustomKnowledge([
    { id: 'a', title: 'Hostel', body: 'DCW hostel facility nahi deta.', keywords: ['hostel'], flow: 'any', is_active: true },
    { id: 'b', title: 'Fee offer', body: 'Is mahine registration free hai.', keywords: ['fees'], flow: 'school', is_active: true },
    { id: 'c', title: 'Old', body: 'Purani baat', keywords: ['purana'], flow: 'any', is_active: false },
  ])
  assert.equal(matchFaq('kya hostel milega', 'college').answer(), 'DCW hostel facility nahi deta.')
  assert.equal(matchFaq('fees kitni hai', 'school').id, 'kb_b')      // beats the built-in fee answer
  assert.equal(matchFaq('fees kitni hai', 'college').id, 'fees')     // flow-scoped
  assert.equal(matchFaq('purana wala', null), null)                  // inactive entries ignored
  assert.equal(matchFaq('hostels', null)?.id ?? null, null)          // whole words only
  assert.match(KNOWLEDGE.school, /registration free/)
  assert.doesNotMatch(KNOWLEDGE.college, /registration free/)
  setCustomKnowledge([])
})
