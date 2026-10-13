/**
 * The admission script, as admin edits it in the Flow Builder.
 *
 * The bot's own questions (flows/school.mjs, flows/college.mjs) are the
 * default. The "Admission script" row in wa_flows (kind 'script', seeded from
 * flows/seed.mjs by migration 120) replaces their words, options and branches
 * while the engine that runs them stays the same — so typed answers ("dasvi",
 * "12th fail"), several answers in one message, AI, FAQ replies and lead
 * temperature keep working. A step linked to a built-in answer (`field`)
 * keeps that answer's patterns; a step admin adds is read by its number or
 * its label.
 *
 * Compiling turns the tree into what the engine already runs: per flow, a
 * list of steps, each active only on the paths that lead to it, and a `next`
 * that walks the path the student's answers take.
 *
 * Tree shape: welcome message(s) → a question with `field: 'flow'` whose
 * options are valued 'school' and 'college' → one branch per flow.
 */

import { FLOWS, INTENT } from './flows/index.mjs'
import { normalize } from './nlu.mjs'
import { say } from './tone.mjs'
import { fill } from './custom.mjs'

const DEFAULTS = {
  school: FLOWS.school,
  college: FLOWS.college,
  intent: { ...INTENT, options: [...INTENT.options] },
}

/** Where a question the student never answered carries on, if it has one. */
const UNSURE = ['Not Sure', 'Not Decided', 'Other']

const KIND = { choice: 'option', text: 'text', percent: 'percent', year: 'year', place: 'place', subjects: 'subjects' }
const FLOW_IDS = ['school', 'college']

let current = null

/** Use admin's script, or the built-in questions when `script` is null. */
export function applyScript(script) {
  current = script
  for (const id of FLOW_IDS) FLOWS[id] = script?.[id] ?? DEFAULTS[id]
  Object.assign(INTENT, script?.intent ?? DEFAULTS.intent)
}

export function scriptActive() {
  return Boolean(current)
}

/**
 * wa_flows.root → { school, college, intent }. Throws with a reason admin can
 * act on when the tree cannot run; the caller keeps the built-in questions.
 */
export function compileScript(root) {
  const nodes = new Map()
  index(root, nodes)

  const hello = []
  let n = root
  while (n?.type === 'message') { hello.push(n); n = n.next }
  if (n?.type !== 'question' || n.field !== 'flow') throw new Error('the first question must be the 10th/12th-or-college question')

  const out = {
    intent: {
      hello: hello.map(m => m.text?.trim()).filter(Boolean).join('\n\n') || DEFAULTS.intent.hello,
      ask: n.text?.trim() || DEFAULTS.intent.ask,
      options: [],
    },
  }
  for (const o of n.options ?? []) {
    if (!FLOW_IDS.includes(o.value)) continue
    out.intent.options.push({ value: o.value, label: o.label })
    out[o.value] = compileFlow(DEFAULTS[o.value], o.next, nodes)
  }
  for (const id of FLOW_IDS) if (!out[id]) throw new Error(`the ${id} branch is missing`)
  return out
}

function index(n, nodes) {
  if (!n || typeof n !== 'object' || !n.id || nodes.has(n.id)) return
  nodes.set(n.id, n)
  if (n.type === 'message' || n.type === 'ask') index(n.next, nodes)
  if (n.type === 'question') for (const o of n.options ?? []) index(o.next, nodes)
}

// ---------------------------------------------------------------- flow ---

function compileFlow(base, start, nodes) {
  const follow = n => {
    for (let i = 0; n?.type === 'goto' && i < 50; i++) n = nodes.get(n.target)
    return n?.type === 'goto' ? null : n ?? null
  }
  const edges = n => {
    if (n.type === 'message' || n.type === 'ask') return [n.next]
    if (n.type === 'question') return (n.options ?? []).map(o => o.next)
    return []
  }
  const slotOf = n => n.field || `x_${n.id}`
  const valueOf = o => o.value ?? o.label?.trim()
  const chosen = (n, v) => {
    const opts = n.options ?? []
    return opts.find(o => valueOf(o) === v) ??
      (v === 'Not answered' ? opts.find(o => UNSURE.includes(valueOf(o))) : null)
  }

  // Steps in reverse post-order: every path meets them in the order asked,
  // which is what lets one message fill several of them (level, then course).
  const order = []
  const state = new Map()
  const visit = raw => {
    const n = follow(raw)
    if (!n) return
    if (state.get(n.id) === 1) throw new Error('a "jump to" step goes back to an earlier step')
    if (state.has(n.id)) return
    state.set(n.id, 1)
    for (const e of edges(n)) visit(e)
    state.set(n.id, 2)
    order.push(n)
  }
  visit(start)
  order.reverse()

  const stepNodes = order.filter(n => n.type === 'ask' || n.type === 'question')
  const labels = new Map()
  for (const n of stepNodes) if (n.saveAs?.trim()) labels.set(n.saveAs.trim().toLowerCase(), slotOf(n))

  /**
   * Walk the path the answers take: the first step still unanswered, the
   * messages since the step before it, and where the path ends if nothing
   * is left to ask.
   */
  function walk(a) {
    let n = follow(start)
    let before = []
    // The leading messages are the flow's welcome, not part of any step.
    while (n?.type === 'message') n = follow(n.next)
    for (let i = 0; n && i < 500; i++) {
      if (n.type === 'message') { before.push(n); n = follow(n.next); continue }
      if (n.type === 'ask' || n.type === 'question') {
        const v = a[slotOf(n)]
        if (v == null) return { step: n, before }
        before = []
        if (n.type === 'ask') { n = follow(n.next); continue }
        const opt = chosen(n, v)
        // No path for this answer (skipped, and no "Not Sure"): the
        // counsellor takes it from here.
        if (!opt) return { step: null, before, end: null }
        n = follow(opt.next)
        continue
      }
      return { step: null, before, end: n }
    }
    return { step: null, before, end: null }
  }

  /** Nodes a student with these answers can still reach. */
  function reachable(a) {
    const seen = new Set()
    const go = raw => {
      const n = follow(raw)
      if (!n || seen.has(n.id)) return
      seen.add(n.id)
      if (n.type === 'question') {
        const v = a[slotOf(n)]
        if (v == null) return
        const opt = chosen(n, v)
        if (opt) go(opt.next)
        return
      }
      for (const e of edges(n)) go(e)
    }
    go(start)
    return seen
  }

  const render = (n, p, a) => fill(say(p, n.text ?? '', n.textParent), '')
    .replace(/\{([^{}]+)\}/g, (_, key) => {
      const v = a[labels.get(key.trim().toLowerCase())]
      return v != null && v !== 'Not answered' ? String(v) : key.trim()
    })
  const joined = (list, p, a) => list.map(m => render(m, p, a)).filter(Boolean).join('\n\n')

  const byNode = new Map()
  const steps = stepNodes.map(n => {
    const b = builtin(n.field)
    const kind = n.type === 'question' ? 'option' : KIND[n.answer] ?? 'text'
    const step = {
      id: n.id,
      slot: slotOf(n),
      label: n.saveAs?.trim() || b?.label || clip(n.text),
      kind,
      fill: Boolean(b?.fill) && kind === 'option',
      fillFromQuestions: Boolean(b?.fillFromQuestions),
      ask: (p, a = {}) => render(n, p, a),
      when: a => reachable(a).has(n.id),
    }
    if (kind === 'option') step.options = (n.options ?? []).filter(o => valueOf(o)).map(o => option(o, valueOf(o), b))
    byNode.set(n.id, step)
    return step
  })

  const leading = []
  for (let n = follow(start); n?.type === 'message'; n = follow(n.next)) leading.push(n)

  return {
    ...base,
    welcome: (p, name) => leading.map(m => fill(say(p, m.text ?? '', m.textParent), name)).filter(Boolean).join('\n\n'),
    steps,
    next: a => byNode.get(walk(a).step?.id) ?? null,
    /** Messages admin put between the previous step and this one. */
    intro: (step, p, a) => {
      const w = walk(a)
      return w.step?.id === step.id ? joined(w.before, p, a) : ''
    },
    /** What to say at the end of the path, or '' for the standard thank-you. */
    end: (p, a) => {
      const w = walk(a)
      if (w.step) return ''
      const last = w.end?.type === 'handoff' && w.end.text?.trim() ? [w.end] : []
      return joined([...w.before, ...last], p, a)
    },
  }
}

/** The patterns and settings a built-in answer has, merged across flows. */
function builtin(slot) {
  if (!slot) return null
  const steps = FLOW_IDS.flatMap(id => DEFAULTS[id].steps).filter(s => s.slot === slot)
  if (!steps.length) return null
  const values = new Map()
  for (const s of steps) for (const o of s.options ?? []) if (!values.has(o.value)) values.set(o.value, o)
  return {
    label: steps[0].label,
    fill: steps.some(s => s.fill),
    fillFromQuestions: steps.some(s => s.fillFromQuestions),
    values,
  }
}

function option(o, value, b) {
  const known = b?.values.get(value)
  const match = [...(known?.match ?? [])]
  // A label admin wrote (or reworded) is an answer too: "Fail ho gaya".
  const label = normalize(o.label)
  if (label && (!known || normalize(known.label) !== label)) {
    match.push(new RegExp(`(^| )${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($| )`))
  }
  return { value, label: o.label?.trim() || value, match }
}

function clip(text) {
  const t = String(text ?? '').replace(/\s+/g, ' ').trim()
  return t.length > 40 ? `${t.slice(0, 39)}…` : t || 'Answer'
}
