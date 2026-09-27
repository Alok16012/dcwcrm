/**
 * Turning a conversation into what a counsellor needs to act on it.
 *
 * Lead temperature follows the briefs' indicators:
 *   Hot  — what they want is clear and they are ready: documents in hand,
 *          admission within a week, or they asked for a call / talked fees.
 *   Warm — what they want is clear, but not the when.
 *   Cold — exploring, or not clear yet what they want.
 */

import { FLOWS } from './flows/index.mjs'

const URGENT = ['Immediately', 'Within 7 days']
const HAS_DOCS = ['Available', 'Photo Available', 'Photo shared']

export function temperature(flowId, a, signals = {}) {
  const clear = flowId === 'college'
    ? Boolean(a.level && a.level !== 'Not Sure' && a.course && a.course !== 'Not Sure')
    : Boolean(a.klass && a.situation)

  if (a.timeline === 'Just exploring') return 'Cold'
  if (!clear) return signals.wantsHuman ? 'Warm' : 'Cold'

  const ready =
    HAS_DOCS.includes(a.documents) ||
    URGENT.includes(a.timeline) ||
    signals.wantsHuman ||
    a.feeInterest
  return ready ? 'Hot' : 'Warm'
}

/** The CRM status the briefs map each temperature to. */
export function crmStatus(temp, escalated) {
  if (escalated || temp === 'Hot') return 'Counselor Required'
  if (temp === 'Warm') return 'Follow-up'
  return 'Nurture'
}

/**
 * Flat, human-readable fields for leads.metadata.
 *
 * Flat on purpose: the lead page renders metadata key by key with String(),
 * so a nested object would show a counsellor "[object Object]". Keys are the
 * step labels from the brief's CRM field tables.
 */
export function leadFields(conv) {
  const flow = FLOWS[conv.flow]
  if (!flow) return {}
  const a = conv.answers ?? {}
  const out = {
    'Chatbot Flow': flow.id === 'college' ? 'Distance & Online College' : 'Open Schooling',
    'Student Type': conv.persona?.who === 'parent' ? 'Parent' : 'Student',
  }
  for (const step of flow.steps) {
    const v = a[step.slot]
    if (v != null && v !== '') out[step.label] = String(v)
  }
  if (a.feeInterest) out['Fee Interest'] = a.feeInterest
  if (a.preferredBoard) out['Board Asked About'] = a.preferredBoard

  const temp = temperature(conv.flow, a, conv.signals)
  out['Lead Temperature'] = temp
  out['CRM Status'] = crmStatus(temp, conv.escalated)
  const summary = flow.summary(a)
  if (summary) out['Bot Summary'] = `${summary} | Status: ${out['CRM Status']}`
  if (conv.escalated) out['Needs Counselor Check'] = conv.escalated
  return out
}
