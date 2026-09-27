/**
 * The AI fallback — called only when local parsing could not make sense of a
 * message, and never trusted with anything it does not need.
 *
 * Two jobs, both small:
 *   classify  — "is this an answer to the question I asked, or a question of
 *               their own?" and if an answer, which option.
 *   answer    — reply to an off-script question, inside the DCW rules.
 *
 * Provider is pluggable. Default is Gemini on the free tier, which lets Google
 * use prompts to improve its models, so what leaves here is scrubbed: the
 * student's message text only — no name, no phone, no email, no numbers that
 * look like either.
 *
 * AI_PROVIDER=none turns the whole thing off and the bot runs on script alone.
 */

import { checkReply } from './guard.mjs'

const PROVIDER = (process.env.AI_PROVIDER ?? 'gemini').toLowerCase()
const MODEL = process.env.AI_MODEL ?? 'gemini-2.5-flash-lite'
const KEY = process.env.GEMINI_API_KEY ?? ''
const DAILY_LIMIT = Number(process.env.AI_DAILY_LIMIT ?? 800)
const TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS ?? 8000)

// ---------------------------------------------------------------- budget ---

// Free tiers cap requests per day. Counting here means the bot stops asking
// before Google starts refusing, rather than discovering the limit mid-chat.
let budgetDay = ''
let usedToday = 0

// A provider that keeps failing (quota, outage, bad key) is left alone for a
// while instead of adding seconds of latency to every message.
let failures = 0
let coolUntil = 0

function istDay() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())
}

export function aiEnabled() {
  if (PROVIDER === 'none' || !KEY) return false
  if (Date.now() < coolUntil) return false
  const day = istDay()
  if (day !== budgetDay) {
    budgetDay = day
    usedToday = 0
  }
  return usedToday < DAILY_LIMIT
}

export function aiStats() {
  return { provider: PROVIDER, model: MODEL, usedToday, dailyLimit: DAILY_LIMIT, coolingDown: Date.now() < coolUntil }
}

/** Remove anything that identifies a person before text leaves the server. */
export function scrub(text) {
  return String(text ?? '')
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[email]')
    .replace(/(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}\b/g, '[phone]')
    .replace(/\b\d{12}\b/g, '[id]')
    .slice(0, 500)
}

// ------------------------------------------------------------- transport ---

async function callGemini(system, user, { json }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      // Header, not query string, so the key never lands in an access log.
      'x-goog-api-key': KEY,
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig: {
        temperature: json ? 0 : 0.4,
        maxOutputTokens: json ? 120 : 260,
        ...(json ? { responseMimeType: 'application/json' } : {}),
      },
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Gemini ${res.status}: ${body.slice(0, 200)}`)
  }
  const data = await res.json()
  return data?.candidates?.[0]?.content?.parts?.map(p => p.text ?? '').join('') ?? ''
}

async function call(system, user, opts) {
  if (!aiEnabled()) return null
  usedToday++
  try {
    const out = await callGemini(system, user, opts)
    failures = 0
    return out
  } catch (e) {
    failures++
    console.error(`[ai] ${e.message}`)
    // Three in a row usually means quota or a bad key: back off for a while
    // and let the script carry the conversation.
    if (failures >= 3) {
      coolUntil = Date.now() + 15 * 60 * 1000
      failures = 0
      console.error('[ai] cooling down for 15 min — running on script only')
    }
    return null
  }
}

// -------------------------------------------------------------- classify ---

const CLASSIFY_SYSTEM = `You read one WhatsApp message from an Indian student or parent enquiring about admission (Hinglish or English).
The bot just asked them a question with fixed options. Decide:
- "answer": the message answers that question. Return the matching option value EXACTLY as given, or null if it answers but matches none.
- "question": the message is their own question (about fees, validity, process, board, dates, anything).
- "other": greeting, thanks, noise, or unrelated.
Also say who is writing: "parent" if they refer to their son/daughter/child, else "student".
Reply with JSON only: {"kind":"answer|question|other","value":string|null,"who":"student|parent"}`

/**
 * Map free text onto one of a step's options.
 * Returns { kind, value, who } or null when AI is off or failed.
 */
export async function classify({ question, options, text }) {
  const optionList = options.map(o => `- ${o.value}${o.label && o.label !== o.value ? ` (${o.label})` : ''}`).join('\n')
  const user = `Bot asked: ${question}\nOptions:\n${optionList}\n\nMessage: ${scrub(text)}`
  const raw = await call(CLASSIFY_SYSTEM, user, { json: true })
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    const kind = ['answer', 'question', 'other'].includes(parsed.kind) ? parsed.kind : 'other'
    // Only accept a value that is really one of ours — a model inventing a
    // new option would silently corrupt the lead.
    const value = options.some(o => o.value === parsed.value) ? parsed.value : null
    const who = parsed.who === 'parent' ? 'parent' : 'student'
    return { kind, value, who }
  } catch {
    return null
  }
}

/**
 * Pull a free-text value (a board name, subjects, a university) out of a
 * sentence. Only used for steps with no fixed options.
 */
export async function extractField({ question, text }) {
  const system = `Extract the answer to the bot's question from the student's WhatsApp message. Reply with JSON only: {"value": string|null}. Keep it short (a name, a list of subjects, a number). null if the message does not answer the question.`
  const raw = await call(system, `Bot asked: ${question}\nMessage: ${scrub(text)}`, { json: true })
  if (!raw) return null
  try {
    const v = JSON.parse(raw).value
    return typeof v === 'string' && v.trim() ? v.trim().slice(0, 120) : null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------- answer ---

const ANSWER_RULES = `You are the WhatsApp admission assistant for DCW (Distance Courses Wala), Patna.
Reply in the same language style as the student (Hinglish if they write Hinglish), warm and short: 2-4 sentences, no lists longer than 4 items.

HARD RULES — never break these:
- Never promise or guarantee: no "100%", no guaranteed admission, passing, result, recognition, validity, government job, or IIT/JEE eligibility. Say it depends on current official rules and will be verified by a counselor.
- Never state a fee amount, and never state a specific date or deadline. Say the counselor will share current, verified details.
- Never call any board or university "the best". Suitability depends on the student's situation.
- If you are unsure, say a counselor will verify — do not guess.
- Do not ask for passwords, OTPs, Aadhaar numbers or bank details.
End by gently steering back to the question the bot was asking.`

/**
 * Answer an off-script question. Returns null when AI is off, failed, or its
 * reply broke a rule — the caller then uses a safe scripted line instead.
 */
export async function answerQuestion({ knowledge, text, pendingQuestion, persona }) {
  const who = persona?.who === 'parent' ? 'The writer is a parent asking about their child.' : ''
  const system = `${ANSWER_RULES}\n\n${who}\n\nWhat DCW knows (use only this; do not add facts):\n${knowledge}`
  const user = `Student asked: ${scrub(text)}\n\nThe bot's pending question to return to: ${pendingQuestion ?? 'none'}`
  const out = await call(system, user, { json: false })
  if (!out) return null

  const verdict = checkReply(out)
  if (!verdict.ok) {
    console.error(`[ai] reply rejected (${verdict.reason}): ${out.slice(0, 120)}`)
    return null
  }
  return out.trim()
}
