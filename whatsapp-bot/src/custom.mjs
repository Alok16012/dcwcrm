/**
 * Flows admin builds in the CRM (WhatsApp Bot → Control Centre → Flows).
 *
 * A flow is a start point — the trigger words that open it — and a tree of
 * nodes under it:
 *
 *   message   send text, then carry on to `next`
 *   question  send text with numbered options; the student's choice picks
 *             the branch. Waits for the reply.
 *   handoff   send text and hand the chat to a counsellor
 *   builtin   continue in the built-in admission script ('menu' asks
 *             10th/12th vs college; 'school' / 'college' start that flow)
 *
 * Stored in wa_flows.root as nested JSON, exactly as the builder edits it.
 * This module is pure, like the engine: no database, no WhatsApp.
 */

import { normalize } from './nlu.mjs'
import { greetingName } from './control.mjs'

const KEYCAPS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣']
/** A runaway chain of message nodes must not flood a student. */
const MAX_SENDS = 8

/** Rows from wa_flows → what the engine walks. Broken rows are dropped. */
export function compileFlows(rows) {
  const out = []
  for (const r of rows ?? []) {
    if (!r?.is_active || !r.root) continue
    const nodes = new Map()
    const walk = n => {
      if (!n || typeof n !== 'object' || !n.id || nodes.has(n.id)) return
      nodes.set(n.id, n)
      if (n.type === 'message') walk(n.next)
      if (n.type === 'question') for (const o of n.options ?? []) walk(o.next)
    }
    walk(r.root)
    out.push({
      id: r.id,
      name: r.name,
      triggers: (r.triggers ?? []).map(normalize).filter(Boolean),
      match: r.match_mode === 'contains' ? 'contains' : 'exact',
      onFirstMessage: Boolean(r.on_first_message),
      root: r.root,
      nodes,
    })
  }
  return out
}

function hasPhrase(t, phrase) {
  return ` ${t} `.includes(` ${phrase} `)
}

/** The flow this message opens, if any. Exact matches beat "contains". */
export function matchTrigger(text, flows, { firstMessage = false } = {}) {
  const t = normalize(text)
  if (t) {
    const exact = flows.find(f => f.triggers.includes(t))
    if (exact) return exact
    const contains = flows.find(f => f.match === 'contains' && f.triggers.some(k => hasPhrase(t, k)))
    if (contains) return contains
  }
  return firstMessage ? flows.find(f => f.onFirstMessage) ?? null : null
}

/** Which option a reply picks: its number, its exact label, or a label it contains. */
export function pickBranch(text, options) {
  const t = normalize(text)
  if (!t) return null
  const num = t.match(/^(\d{1,2})[.)]?$/)
  if (num) return options[Number(num[1]) - 1] ?? null
  const labels = options.map(o => normalize(o.label))
  const exact = labels.indexOf(t)
  if (exact >= 0) return options[exact]
  const hits = options.filter((_, i) => labels[i] && hasPhrase(t, labels[i]))
  return hits.length === 1 ? hits[0] : null
}

export function fill(text, name) {
  const first = greetingName(name)
  return String(text ?? '')
    .replace(/\{name\}/g, first)
    .replace(/[ \t]+([,!?.])/g, '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

function questionText(node, name) {
  const list = (node.options ?? []).map((o, i) => `${KEYCAPS[i] ?? `${i + 1}.`} ${o.label}`).join('\n')
  const q = fill(node.text, name)
  return list ? `${q}\n\n${list}` : q
}

/**
 * Walk from `node`, sending as it goes, until the flow waits for a reply or
 * ends. Returns what the engine has to do next:
 *   { wait: nodeId }                 a question was asked
 *   { end: 'done' }                  nothing more
 *   { end: 'handoff' }               hand the chat to a counsellor
 *   { end: 'builtin', target }       carry on in the built-in script
 */
export function walk(node, { replies, name }) {
  let n = node
  for (let sent = 0; n && sent < MAX_SENDS; sent++) {
    if (n.type === 'message') {
      if (n.text?.trim()) replies.push(fill(n.text, name))
      n = n.next
      continue
    }
    if (n.type === 'question') {
      replies.push(questionText(n, name))
      return { wait: n.id }
    }
    if (n.type === 'handoff') {
      if (n.text?.trim()) replies.push(fill(n.text, name))
      return { end: 'handoff' }
    }
    if (n.type === 'builtin') return { end: 'builtin', target: n.target ?? 'menu' }
    break
  }
  return { end: 'done' }
}

export { questionText }
