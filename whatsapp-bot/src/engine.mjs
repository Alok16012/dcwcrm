/**
 * The conversation engine.
 *
 * A pure function of (conversation state, one incoming message) → (new state,
 * replies to send, CRM events to fire). It knows nothing about WhatsApp or the
 * database, which is what lets every conversation path be tested end to end
 * on a laptop — see test/engine.test.mjs.
 *
 * Order of precedence for each message, and why:
 *   1. opt-out            — "stop" must always work, whatever else is going on
 *   2. voice notes        — nothing to parse; say so instead of guessing
 *   3. upset              — an angry person gets an apology, not the next menu
 *   4. restart / human    — explicit requests beat the script
 *   5. after handoff      — answer questions, otherwise stay out of the way
 *   6. choose a flow      — from the ad's prefilled text if possible
 *   7. answer the step    — local parsing first, AI only if that fails
 */

import {
  normalize, pickOption, parsePercent, parseYear, parseSubjectCount, findPlace,
  looksLikeQuestion, wantsHuman, wantsRestart, isGreeting,
} from './nlu.mjs'
import { detectPersona, say } from './tone.mjs'
import { matchFaq, renderFaq, KNOWLEDGE } from './faq.mjs'
import { FLOWS, INTENT, detectFlow, pickIntent } from './flows/index.mjs'
import { leadFields, temperature } from './lead.mjs'

/** Options vague enough that they may only answer the question actually asked. */
const GENERIC = new Set(['Not Sure', 'Other', 'Not Decided', 'Both', 'Available', 'Not Available', 'Later', 'Yes', 'No'])

const OPT_OUT = /^(stop|unsubscribe|mat bhejo|message mat karo|msg mat karo|band karo|dont message|don't message|no more messages|block)$|\b(mat bhejo|message mat|band karo messages?|unsubscribe)\b/

const KEYCAPS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣']

/** Short acknowledgements, rotated so the bot does not sound like a form. */
const ACKS = ['Great 👍', 'Samajh gaya.', 'Okay, noted.', 'Bilkul.', 'Thik hai 👍', 'Got it.', 'Nice.']

export function newConversation() {
  return {
    flow: null,
    status: 'bot',            // bot | handoff | opted_out
    answers: {},
    persona: { who: 'student', formal: false },
    attempts: {},
    signals: {},
    escalated: null,
    leadEnsured: false,
    turn: 0,
    lastNudgeAt: 0,
  }
}

// ------------------------------------------------------------- helpers ---

function activeSteps(flow, answers) {
  return flow.steps.filter(s => !s.when || s.when(answers))
}

export function nextStep(flow, answers) {
  return activeSteps(flow, answers).find(s => answers[s.slot] == null) ?? null
}

function question(step, persona, answers) {
  const q = step.ask(persona, answers)
  if (!step.options) return q
  const list = step.options.map((o, i) => `${KEYCAPS[i] ?? `${i + 1}.`} ${o.label}`).join('\n')
  return `${q}\n\n${list}`
}

function intentQuestion() {
  const list = INTENT.options.map((o, i) => `${KEYCAPS[i]} ${o.label}`).join('\n')
  return `${INTENT.ask}\n\n${list}`
}

function ack(conv) {
  return ACKS[conv.turn % ACKS.length]
}

/**
 * Parse a message as the answer to one step.
 * Returns the value to store, or null if it does not answer it.
 */
function parseStep(step, text) {
  const t = normalize(text)
  switch (step.kind) {
    case 'option':
      return pickOption(text, step.options)
    case 'percent':
      return parsePercent(text)?.label ?? null
    case 'year':
      return parseYear(text)
    case 'subjects': {
      const n = parseSubjectCount(text)
      if (n) return n
      const bare = t.match(/^(\d)$/)
      if (bare) return Number(bare[1]) >= 4 ? '4+ subjects' : `${bare[1]} subject${bare[1] === '1' ? '' : 's'}`
      return null
    }
    case 'place': {
      const pl = findPlace(text)
      if (pl) return [pl.city, pl.state].filter(Boolean).join(', ')
      // An unknown town is still an answer; a question or an essay is not.
      if (!looksLikeQuestion(text) && t.length >= 3 && t.split(' ').length <= 4) {
        return text.trim().replace(/\b\w/g, c => c.toUpperCase())
      }
      return null
    }
    case 'text':
      if (looksLikeQuestion(text) || t.length < 2) return null
      return text.trim().slice(0, 120)
    default:
      return null
  }
}

/**
 * Fill any later questions this message already answered.
 *
 * "Mujhe MBA online karna hai" answers level, course and mode in one go, and
 * asking all three anyway is what makes a bot feel like a form. Only steps
 * marked `fill` take part, and only with their specific options — a vague
 * "pata nahi" answers the current question and nothing else. Questions are
 * skipped entirely: "admission online hoga?" is not a mode preference.
 */
function fillSlots(flow, answers, text, currentStepId) {
  // A question still tells us who is asking — "12th fail hu, NIOS se ho
  // jayega?" is a 12th, failed student — but not what they prefer: "admission
  // online hoga?" is asking about online, not choosing it.
  const asking = looksLikeQuestion(text)
  const filled = {}
  for (const step of flow.steps) {
    if (!step.fill || step.id === currentStepId) continue
    if (asking && !step.fillFromQuestions) continue
    if (answers[step.slot] != null || filled[step.slot] != null) continue
    const merged = { ...answers, ...filled }
    if (step.when && !step.when(merged)) continue
    const specific = step.options.filter(o => !GENERIC.has(o.value))
    const v = pickOption(text, specific, { numbers: false })
    if (v) filled[step.slot] = v
  }

  // A city is only taken from a sentence that is about where they live —
  // "Bihar Board se tha" names a board, not a home town.
  if (answers.city == null && currentStepId !== 'city' && !asking) {
    const t = normalize(text)
    const aboutHome = /\b(se hu|se hoon|se hun|se hai|from|rehta|rehti|rehte|city|shahar|ghar)\b/.test(t)
    const pl = aboutHome && !/\bboard\b/.test(t) ? findPlace(text) : null
    if (pl) filled.city = [pl.city, pl.state].filter(Boolean).join(', ')
  }
  return filled
}

/** Escalation reasons the brief lists: send these to a human to verify. */
function escalationFor(flowId, a) {
  if (flowId === 'school') {
    if (a.situation === 'JEE/IIT 75%') return 'JEE/IIT eligibility'
    const year = Number(a.examYear)
    if (year && year < new Date().getFullYear() - 5) return 'Old passing year'
    if (a.previousBoard === 'Open Board') return 'Already on an open board'
  }
  return null
}

function handoffMessage(conv, config) {
  const p = conv.persona
  const call = config.counselorPhone ? `\n\n📞 Call Now: ${config.counselorPhone}` : ''
  const temp = temperature(conv.flow, conv.answers, conv.signals)
  const lead = temp === 'Cold'
    ? 'Main aapki requirement note kar leta hoon. Jab bhi aap ready hon, yahin message kar dijiye — ya counselor se baat karni ho to "counselor" likh dijiye.'
    : say(p,
        'Humare counselor jald hi aapse contact karenge aur aapka case verify karke eligibility, fee aur admission process explain karenge.',
        'Humare counselor jald hi aapse contact karenge aur bachche ka case verify karke eligibility, fee aur admission process explain karenge.')
  return `Thank you! 🙏 Aapki details note ho gayi hain.\n\n${lead}${call}`
}

// --------------------------------------------------------------- handle ---

/**
 * @param conv   conversation state (from newConversation or storage)
 * @param input  { text, media?: 'image'|'document'|'audio'|'video'|'sticker', pushName? }
 * @param deps   { ai: { enabled, classify, extractField, answerQuestion }, config, now }
 * @returns { conv, replies: string[], events: object[] }
 */
export async function handle(conv, input, deps) {
  const { ai, config = {}, now = Date.now() } = deps
  const text = String(input.text ?? '').trim()
  const replies = []
  const events = []
  const c = structuredClone(conv)
  c.turn = (c.turn ?? 0) + 1

  const answersBefore = JSON.stringify(c.answers)

  // 1 ── opt-out, and coming back after one
  if (c.status === 'opted_out') {
    if (isGreeting(text) || wantsRestart(text)) {
      Object.assign(c, newConversation(), { turn: c.turn })
    } else {
      return { conv: c, replies, events }
    }
  }
  if (text && OPT_OUT.test(normalize(text))) {
    c.status = 'opted_out'
    replies.push('Theek hai 🙏 Ab aapko is number se message nahi aayega. Kabhi bhi zaroorat ho to bas "Hi" likh dijiye.')
    return { conv: c, replies, events }
  }

  // 2 ── media
  if (input.media === 'audio') {
    replies.push('Maaf kijiye 🙏 main abhi voice note nahi sun sakta. Please type karke bhej dijiye.')
    return { conv: c, replies, events }
  }
  if (input.media === 'image' || input.media === 'document') {
    c.answers.documents = 'Photo shared'
    c.signals.sharedDocument = true
    replies.push('Document mil gaya, thank you! 👍 Counselor ise verify karega.')
    if (c.flow) events.push({ type: 'lead.update', fields: leadFields(c), department: FLOWS[c.flow].department(c.answers) })
    if (!text) {
      const flow = FLOWS[c.flow]
      const step = flow && c.status === 'bot' ? nextStep(flow, c.answers) : null
      if (step) replies.push(question(step, c.persona, c.answers))
      return { conv: c, replies, events }
    }
  }
  if (!text) return { conv: c, replies, events }

  c.persona = detectPersona(text, c.persona)

  // 3 ── upset
  if (c.persona.upset) {
    c.persona.upset = false
    replies.push('Sorry agar aapko koi pareshani hui 🙏 Aap chahein to main abhi aapko counselor se connect karwa deta hoon — bas "counselor" likh dijiye. Messages band karne ho to "stop" likh dijiye.')
    return { conv: c, replies, events }
  }

  // 4 ── restart / human
  if (wantsRestart(text)) {
    const keepPersona = c.persona
    Object.assign(c, newConversation(), { turn: c.turn, persona: keepPersona, leadEnsured: conv.leadEnsured })
    replies.push(`Chaliye, shuru se karte hain 😊\n\n${intentQuestion()}`)
    return { conv: c, replies, events }
  }

  if (wantsHuman(text)) {
    c.signals.wantsHuman = true
    if (c.flow && c.status !== 'handoff') {
      c.status = 'handoff'
      replies.push(handoffMessage(c, config))
      events.push({ type: 'lead.handoff', fields: leadFields(c), department: FLOWS[c.flow].department(c.answers) })
      return { conv: c, replies, events }
    }
    if (!c.flow) {
      // Nothing known yet: a counsellor calling blind is fine, but tell them
      // what helps first.
      const call = config.counselorPhone ? ` Aap seedha call bhi kar sakte hain: ${config.counselorPhone}` : ''
      replies.push(`Bilkul, counselor aapse baat karenge 🙏${call}\n\nTab tak bata dijiye taaki sahi counselor connect ho:\n\n${intentQuestion()}`)
      events.push({ type: 'lead.ensure', fields: { 'Chatbot Flow': 'Not chosen yet', 'CRM Status': 'Counselor Required' } })
      c.leadEnsured = true
      return { conv: c, replies, events }
    }
  }

  // 5 ── after handoff: helpful, not pushy
  if (c.status === 'handoff') {
    if (looksLikeQuestion(text)) {
      const faq = matchFaq(text, c.flow)
      if (faq) {
        replies.push(renderFaq(faq, c.persona))
      } else if (ai.enabled()) {
        const out = await ai.answerQuestion({ knowledge: KNOWLEDGE[c.flow], text, pendingQuestion: null, persona: c.persona })
        replies.push(out ?? 'Ye counselor verify karke batayega 🙏 Wo jald hi aapse contact karenge.')
      } else {
        replies.push('Ye counselor verify karke batayega 🙏 Wo jald hi aapse contact karenge.')
      }
      return { conv: c, replies, events }
    }
    // One reassurance every six hours at most; otherwise let the human work.
    if (now - (c.lastNudgeAt ?? 0) > 6 * 3600 * 1000) {
      c.lastNudgeAt = now
      replies.push('Aapki details counselor tak pahunch gayi hain 🙏 Wo jald hi aapse contact karenge.')
    }
    return { conv: c, replies, events }
  }

  // 6 ── choose a flow
  if (!c.flow) {
    const flowId = c.awaitingIntent ? pickIntent(text) : detectFlow(text)
    if (!flowId) {
      if (looksLikeQuestion(text)) {
        const faq = matchFaq(text, null)
        if (faq) replies.push(renderFaq(faq, c.persona))
      }
      const hello = c.awaitingIntent
        ? 'Please 1 ya 2 bhej dijiye 🙏'
        : 'Hi! 😊 Welcome to Distance Courses Wala (DCW). Main aapki admission me help karunga.'
      c.awaitingIntent = true
      replies.push(`${hello}\n\n${intentQuestion()}`)
      return { conv: c, replies, events }
    }

    c.flow = flowId
    c.awaitingIntent = false
    const flow = FLOWS[flowId]
    Object.assign(c.answers, fillSlots(flow, c.answers, text, null))
    events.push({ type: 'lead.ensure', fields: leadFields(c), department: flow.department(c.answers) })
    c.leadEnsured = true

    // An opening question ("12th fail hoon, NIOS se ho jayega?") deserves an
    // answer before the first menu, not instead of it.
    const faq = looksLikeQuestion(text) ? matchFaq(text, flowId) : null
    if (faq) applyFaq(c, faq)

    const step = nextStep(flow, c.answers)
    replies.push(flow.welcome(c.persona))
    if (faq) replies.push(renderFaq(faq, c.persona))
    if (step) replies.push(question(step, c.persona, c.answers))
    else finish(c, replies, events, config)
    return { conv: c, replies, events }
  }

  // 7 ── answer the current step
  const flow = FLOWS[c.flow]
  const step = nextStep(flow, c.answers)
  if (!step) {
    finish(c, replies, events, config)
    return { conv: c, replies, events }
  }

  if (isGreeting(text)) {
    replies.push(`Welcome back! 😊\n\n${question(step, c.persona, c.answers)}`)
    return { conv: c, replies, events }
  }

  let value = parseStep(step, text)
  const isQuestion = looksLikeQuestion(text)

  // A question is answered — and the pending step asked again — before any
  // attempt to read it as an answer.
  if (value == null && isQuestion) {
    const faq = matchFaq(text, c.flow)
    let answer = null
    if (faq) {
      applyFaq(c, faq)
      answer = renderFaq(faq, c.persona)
    } else if (ai.enabled()) {
      answer = await ai.answerQuestion({
        knowledge: KNOWLEDGE[c.flow], text, persona: c.persona,
        pendingQuestion: step.ask(c.persona, c.answers),
      })
    }
    replies.push(answer ?? 'Ye point counselor aapke case ke saath verify karke batayega 🙏')
    const again = nextStep(flow, c.answers)
    if (again) replies.push(`Ab bataiye —\n${question(again, c.persona, c.answers)}`)
    else finish(c, replies, events, config)
    pushUpdate(c, events, answersBefore)
    return { conv: c, replies, events }
  }

  // Still nothing — let the AI read it, if it is on.
  if (value == null && ai.enabled()) {
    if (step.options) {
      const r = await ai.classify({ question: step.ask(c.persona, c.answers), options: step.options, text })
      if (r?.who === 'parent') c.persona.who = 'parent'
      if (r?.kind === 'answer' && r.value) value = r.value
      else if (r?.kind === 'question') {
        const answer = await ai.answerQuestion({
          knowledge: KNOWLEDGE[c.flow], text, persona: c.persona,
          pendingQuestion: step.ask(c.persona, c.answers),
        })
        replies.push(answer ?? 'Ye point counselor aapke case ke saath verify karke batayega 🙏')
        replies.push(`Ab bataiye —\n${question(step, c.persona, c.answers)}`)
        return { conv: c, replies, events }
      }
    } else if (step.kind === 'text' || step.kind === 'place') {
      value = await ai.extractField({ question: step.ask(c.persona, c.answers), text })
    }
  }

  // Other answers the same message carried.
  Object.assign(c.answers, fillSlots(flow, c.answers, text, step.id))

  if (value == null) {
    c.attempts[step.id] = (c.attempts[step.id] ?? 0) + 1
    // Two misses and the question is skipped. A student stuck on a menu
    // leaves; a lead with one blank field does not.
    if (c.attempts[step.id] >= 2) {
      c.answers[step.slot] = 'Not answered'
    } else {
      const hint = step.options ? 'Please number bhej dijiye:' : 'Thoda aur clear bata dijiye:'
      replies.push(`Maaf kijiye, samajh nahi paaya 🙏 ${hint}\n\n${question(step, c.persona, c.answers)}`)
      pushUpdate(c, events, answersBefore)
      return { conv: c, replies, events }
    }
  } else {
    c.answers[step.slot] = value
  }

  const esc = escalationFor(c.flow, c.answers)
  if (esc && !c.escalated) c.escalated = esc

  const next = nextStep(flow, c.answers)
  if (next) {
    replies.push(`${ack(c)}\n\n${question(next, c.persona, c.answers)}`)
    pushUpdate(c, events, answersBefore)
  } else {
    finish(c, replies, events, config)
  }
  return { conv: c, replies, events }
}

// ------------------------------------------------------------ finishing ---

function applyFaq(c, faq) {
  for (const [k, v] of Object.entries(faq.sets ?? {})) {
    // A FAQ hint never overwrites something the student actually answered.
    if (c.answers[k] == null) c.answers[k] = v
  }
  if (faq.escalate && !c.escalated) c.escalated = faq.id.replace(/_/g, ' ')
}

function pushUpdate(c, events, answersBefore) {
  if (!c.flow) return
  if (JSON.stringify(c.answers) === answersBefore) return
  events.push({ type: 'lead.update', fields: leadFields(c), department: FLOWS[c.flow].department(c.answers) })
}

function finish(c, replies, events, config) {
  c.status = 'handoff'
  replies.push(handoffMessage(c, config))
  events.push({ type: 'lead.handoff', fields: leadFields(c), department: FLOWS[c.flow].department(c.answers) })
}
