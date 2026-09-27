/**
 * The one rule both DCW briefs repeat on every page: never promise.
 *
 * No 100% passing, no guaranteed admission, no guaranteed recognition, no
 * guaranteed IIT/JEE eligibility. And because the bot does not know current
 * fees or dates, it must not state them either.
 *
 * Scripted replies are written to this rule. AI replies are not trusted to
 * follow it, so every one passes through here before it is sent — a check in
 * code, not a line in a prompt the model may ignore.
 */

const PROMISE = [
  /\b100\s*%/i,
  /\bguarantee[d]?\b/i,
  /\bguaranteed\b/i,
  /\bpakka\b/i,
  /\bdefinitely\b/i,
  /\bconfirm(?:ed)?\s+(?:hai|hoga|hogi|milega|milegi)\b/i,
  /\bzaroor\s+(?:milega|milegi|hoga|hogi|pass)\b/i,
  /\bsure(?:ly)?\s+(?:pass|admission|valid|milega|milegi)\b/i,
  /\b(?:pass|admission|result|seat)\s+(?:pakka|fix|guaranteed)\b/i,
]

/** Negations that turn a promise word into the disclaimer we *want*. */
const NEGATED = /\b(?:nahi|nahin|nhi|not|no|cannot|can't|na)\b/i

/** Money and dates are live facts the bot does not have. */
const MONEY = /(?:₹|rs\.?|inr)\s*\d|\b\d[\d,]{2,}\s*(?:rupees|rupaye|rs|\/-)/i
const DATE = /\b\d{1,2}\s*(?:st|nd|rd|th)?\s*(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\b/i

/**
 * Check a candidate reply.
 * Returns { ok: true } or { ok: false, reason } so the caller can fall back.
 */
export function checkReply(text) {
  const t = String(text ?? '')
  if (!t.trim()) return { ok: false, reason: 'empty' }

  // Judge sentence by sentence, so one disclaimer elsewhere cannot launder
  // a promise in the next line.
  const sentences = t.split(/(?<=[.!?।\n])\s+/)
  for (const s of sentences) {
    for (const re of PROMISE) {
      if (re.test(s) && !NEGATED.test(s)) return { ok: false, reason: `promise: ${re}` }
    }
  }
  if (MONEY.test(t)) return { ok: false, reason: 'states a fee amount' }
  if (DATE.test(t)) return { ok: false, reason: 'states a specific date' }
  if (t.length > 700) return { ok: false, reason: 'too long for WhatsApp' }
  return { ok: true }
}
