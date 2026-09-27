import { college } from './college.mjs'
import { school } from './school.mjs'
import { normalize } from '../nlu.mjs'

export const FLOWS = { college, school }

/** The two doors into the bot, shown when the first message does not say. */
export const INTENT = {
  ask: 'Aap kis ke liye admission dekh rahe hain?',
  options: [
    { value: 'school', label: '10th / 12th (Open Schooling)' },
    { value: 'college', label: 'Graduation / Post Graduation (College)' },
  ],
}

/**
 * Work out which flow a message belongs to without asking.
 *
 * Ads carry a prefilled first message ("Open schooling chahiye", "MBA
 * admission"), so most chats announce themselves. Returns null when the
 * message is genuinely ambiguous — asking is cheaper than guessing wrong.
 */
export function detectFlow(text) {
  const t = normalize(text)
  const schoolHit = /\b(10th|12th|10 th|12 th|dasvi|barahvi|matric|inter|nios|bbose|bosse|nwac|open school|open schooling|open board|fail|compartment|supplementary|marks improve|improvement|jee|iit|toc)\b/.test(t)
  const collegeHit = /\b(ug|pg|graduation|post graduation|bba|bca|mba|mca|b\.?com|m\.?com|degree|college|university|manglayatan|mats|shubharti|subharti|bachelor|masters?)\b/.test(t)
  if (schoolHit && !collegeHit) return 'school'
  if (collegeHit && !schoolHit) return 'college'
  // "12th ke baad BBA" names both: the course is what they want next.
  if (collegeHit && schoolHit && /\b(ke baad|after|baad)\b/.test(t)) return 'college'
  return null
}

export function pickIntent(text) {
  const t = normalize(text)
  if (/^1[.)]?$/.test(t)) return 'school'
  if (/^2[.)]?$/.test(t)) return 'college'
  return detectFlow(text)
}
