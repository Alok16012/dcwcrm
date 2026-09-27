/**
 * Local understanding — everything the bot can work out without calling AI.
 *
 * The brief is "as little AI as possible". Students mostly answer with a
 * number from the menu, a course name, a percentage, a year or a city, and all
 * of those are cheaper and more reliable to read with a pattern than with a
 * model. AI is only asked when these come back empty.
 */

/** Lowercase, strip punctuation noise, collapse whitespace. Keeps % and digits. */
export function normalize(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/[“”"'`’]/g, '')
    .replace(/[^\p{L}\p{N}%.+/\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Pick one option from a menu.
 *
 * Accepts the menu number ("2"), the letter ("B"), or any of the option's
 * keyword patterns ("mba karna hai"). Returns the option's value, or null when
 * nothing matched confidently — a wrong guess here puts a student on the
 * wrong path, so no fuzzy matching.
 */
export function pickOption(text, options, { numbers = true } = {}) {
  const t = normalize(text)
  if (!t) return null

  // A bare number is a menu choice — but only if it is a valid one. "12" on
  // a two-option "10th or 12th?" menu is the answer "12th", not option twelve,
  // so an out-of-range number falls through to keyword matching below.
  const num = numbers ? t.match(/^(\d{1,2})[.)]?$/) : null
  if (num) {
    const i = Number(num[1]) - 1
    if (options[i]) return options[i].value
  }
  const letter = numbers ? t.match(/^([a-h])[.)]?$/) : null
  if (letter) {
    const i = letter[1].charCodeAt(0) - 97
    return options[i]?.value ?? null
  }

  const hits = options.filter(o => (o.match ?? []).some(re => re.test(t)))
  // Two different options both matching ("ug or pg?") is not an answer.
  return hits.length === 1 ? hits[0].value : null
}

/** "58%", "58 percent", "58.5", "7.2 cgpa" → { value, unit } or null. */
export function parsePercent(text) {
  const t = normalize(text)
  const cgpa = t.match(/(\d{1,2}(?:\.\d{1,2})?)\s*(?:cgpa|gpa|sgpa|pointer)/)
  if (cgpa) {
    const v = Number(cgpa[1])
    if (v > 0 && v <= 10) return { value: v, unit: 'CGPA', label: `${v} CGPA` }
  }
  const pct = t.match(/(\d{1,3}(?:\.\d{1,2})?)\s*(?:%|percent|pratishat|perc|marks)/)
  const bare = t.match(/^(\d{1,3}(?:\.\d{1,2})?)$/)
  // "7.2" on its own is a CGPA; nobody reports 7.2 percent.
  if (!pct && bare && bare[1].includes('.') && Number(bare[1]) <= 10) {
    const v = Number(bare[1])
    return { value: v, unit: 'CGPA', label: `${v} CGPA` }
  }
  const m = pct ?? bare
  if (m) {
    const v = Number(m[1])
    if (v > 0 && v <= 100) return { value: v, unit: '%', label: `${v}%` }
  }
  return null
}

/** A 4-digit year between 1990 and next year. */
export function parseYear(text) {
  const m = normalize(text).match(/\b(19[9]\d|20[0-4]\d)\b/)
  if (!m) return null
  const y = Number(m[1])
  return y <= new Date().getFullYear() + 2 ? y : null
}

/** Count of subjects: "2 subject", "do subject", "sab me", "all". */
export function parseSubjectCount(text) {
  const t = normalize(text)
  if (/\b(all|sab|sabhi|saare|sare)\b/.test(t)) return 'All subjects'
  const words = { ek: 1, one: 1, do: 2, two: 2, teen: 3, three: 3, char: 4, chaar: 4, four: 4, panch: 5, five: 5 }
  for (const [w, n] of Object.entries(words)) {
    if (new RegExp(`\\b${w}\\b`).test(t) && /subject|sub|paper|vishay/.test(t)) {
      return n >= 4 ? '4+ subjects' : `${n} subject${n > 1 ? 's' : ''}`
    }
  }
  const m = t.match(/\b(\d)\s*(?:subject|sub|paper|vishay)/)
  if (m) {
    const n = Number(m[1])
    return n >= 4 ? '4+ subjects' : `${n} subject${n > 1 ? 's' : ''}`
  }
  return null
}

/**
 * Cities and states DCW actually hears from — weighted toward Bihar and the
 * Hindi belt. Unmatched text on a city step is still kept as typed; this list
 * only lets a city be picked out of a longer sentence.
 */
const PLACES = [
  ['patna', 'Patna', 'Bihar'], ['gaya', 'Gaya', 'Bihar'], ['muzaffarpur', 'Muzaffarpur', 'Bihar'],
  ['bhagalpur', 'Bhagalpur', 'Bihar'], ['darbhanga', 'Darbhanga', 'Bihar'], ['purnia', 'Purnia', 'Bihar'],
  ['ara', 'Ara', 'Bihar'], ['arrah', 'Ara', 'Bihar'], ['begusarai', 'Begusarai', 'Bihar'],
  ['katihar', 'Katihar', 'Bihar'], ['munger', 'Munger', 'Bihar'], ['chapra', 'Chapra', 'Bihar'],
  ['samastipur', 'Samastipur', 'Bihar'], ['sasaram', 'Sasaram', 'Bihar'], ['hajipur', 'Hajipur', 'Bihar'],
  ['siwan', 'Siwan', 'Bihar'], ['motihari', 'Motihari', 'Bihar'], ['nalanda', 'Nalanda', 'Bihar'],
  ['biharsharif', 'Bihar Sharif', 'Bihar'], ['bettiah', 'Bettiah', 'Bihar'], ['saharsa', 'Saharsa', 'Bihar'],
  ['ranchi', 'Ranchi', 'Jharkhand'], ['jamshedpur', 'Jamshedpur', 'Jharkhand'], ['dhanbad', 'Dhanbad', 'Jharkhand'],
  ['bokaro', 'Bokaro', 'Jharkhand'], ['hazaribagh', 'Hazaribagh', 'Jharkhand'], ['deoghar', 'Deoghar', 'Jharkhand'],
  ['lucknow', 'Lucknow', 'Uttar Pradesh'], ['kanpur', 'Kanpur', 'Uttar Pradesh'], ['varanasi', 'Varanasi', 'Uttar Pradesh'],
  ['banaras', 'Varanasi', 'Uttar Pradesh'], ['prayagraj', 'Prayagraj', 'Uttar Pradesh'], ['allahabad', 'Prayagraj', 'Uttar Pradesh'],
  ['gorakhpur', 'Gorakhpur', 'Uttar Pradesh'], ['noida', 'Noida', 'Uttar Pradesh'], ['ghaziabad', 'Ghaziabad', 'Uttar Pradesh'],
  ['agra', 'Agra', 'Uttar Pradesh'], ['meerut', 'Meerut', 'Uttar Pradesh'], ['bareilly', 'Bareilly', 'Uttar Pradesh'],
  ['delhi', 'Delhi', 'Delhi'], ['new delhi', 'New Delhi', 'Delhi'], ['gurgaon', 'Gurugram', 'Haryana'],
  ['gurugram', 'Gurugram', 'Haryana'], ['faridabad', 'Faridabad', 'Haryana'],
  ['kolkata', 'Kolkata', 'West Bengal'], ['calcutta', 'Kolkata', 'West Bengal'], ['siliguri', 'Siliguri', 'West Bengal'],
  ['mumbai', 'Mumbai', 'Maharashtra'], ['pune', 'Pune', 'Maharashtra'], ['nagpur', 'Nagpur', 'Maharashtra'],
  ['bangalore', 'Bengaluru', 'Karnataka'], ['bengaluru', 'Bengaluru', 'Karnataka'], ['hyderabad', 'Hyderabad', 'Telangana'],
  ['chennai', 'Chennai', 'Tamil Nadu'], ['bhopal', 'Bhopal', 'Madhya Pradesh'], ['indore', 'Indore', 'Madhya Pradesh'],
  ['jaipur', 'Jaipur', 'Rajasthan'], ['kota', 'Kota', 'Rajasthan'], ['raipur', 'Raipur', 'Chhattisgarh'],
  ['bhubaneswar', 'Bhubaneswar', 'Odisha'], ['cuttack', 'Cuttack', 'Odisha'], ['guwahati', 'Guwahati', 'Assam'],
  ['dehradun', 'Dehradun', 'Uttarakhand'], ['chandigarh', 'Chandigarh', 'Chandigarh'], ['ahmedabad', 'Ahmedabad', 'Gujarat'],
  ['surat', 'Surat', 'Gujarat'],
]
const STATES = [
  'bihar', 'jharkhand', 'uttar pradesh', 'up', 'delhi', 'haryana', 'west bengal', 'bengal', 'maharashtra',
  'karnataka', 'telangana', 'tamil nadu', 'madhya pradesh', 'mp', 'rajasthan', 'chhattisgarh', 'odisha',
  'orissa', 'assam', 'uttarakhand', 'gujarat', 'punjab', 'himachal', 'kerala', 'andhra',
]

/** Pull a known city/state out of free text. */
export function findPlace(text) {
  const t = ` ${normalize(text)} `
  for (const [key, city, state] of PLACES) {
    if (t.includes(` ${key} `)) return { city, state }
  }
  for (const s of STATES) {
    if (t.includes(` ${s} `)) {
      const state = s === 'up' ? 'Uttar Pradesh' : s === 'mp' ? 'Madhya Pradesh'
        : s === 'bengal' ? 'West Bengal' : s === 'orissa' ? 'Odisha'
        : s.replace(/\b\w/g, c => c.toUpperCase())
      return { city: null, state }
    }
  }
  return null
}

/**
 * Is this message a question rather than an answer?
 *
 * Matters because "fees kitni hai" typed while the bot is asking about the
 * course is not a course. Getting it wrong either stores a question as an
 * answer, or answers a question the student never asked.
 */
export function looksLikeQuestion(text) {
  if (String(text).includes('?')) return true
  // Only words that ask. "chahiye", "sakta", "hoga" are left out on purpose:
  // "mujhe admission chahiye" and "main kar sakta hoon" are statements, and
  // reading them as questions made the bot ignore everything else in them.
  return /\b(kya|kyu|kyun|kyon|kaise|kaisa|kaisi|kab|kitna|kitni|kitne|kaun|kaunsa|kaunsi|konsa|konsi|kon|kahan|kaha|what|how|when|which|where|why|is it|can i|do you|does)\b/.test(normalize(text))
}

/** Explicit request for a human. Checked before anything else, every message. */
export function wantsHuman(text) {
  const t = normalize(text)
  return /\b(counsell?or|counsell?ing|call (me|karo|kijiye|kare|karein)|call back|callback|baat (karni|karna|karao|karwa)|number (do|dijiye|bhejo)|contact number|phone number do|insaan|human|agent|real person|sir se baat|madam se baat)\b/.test(t)
}

/** Student wants to start over. */
export function wantsRestart(text) {
  return /^(menu|restart|start|start again|shuru|reset|home|main menu|dobara)$/.test(normalize(text))
}

/**
 * Greeting-only messages carry no answer.
 *
 * Deliberately excludes "haan", "yes", "ok" and friends: those are real
 * answers to a yes/no step ("documents available hain?" → "haan"), and
 * swallowing them as a greeting would make the bot ask the same thing twice.
 */
export function isGreeting(text) {
  return /^(hi+|hello+|helo|hey+|namaste|namaskar|hlo|hy|hyy|good (morning|afternoon|evening)|gm)$/.test(normalize(text))
}
