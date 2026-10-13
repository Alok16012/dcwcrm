'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  Play, MessageSquare, HelpCircle, Headset, Workflow, Plus, Trash2, Save, X, GitBranch, RotateCcw, Zap,
  ClipboardList, CornerDownRight, Link2, Lock, Send, ChevronDown, ChevronUp,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'

/* eslint-disable @typescript-eslint/no-explicit-any */

// The bot runs these from whatsapp-bot/src/custom.mjs (trigger flows) and
// whatsapp-bot/src/script.mjs (the admission script); keep the node shapes
// here and there in step.
//
// `field` and option `value`s link a step of the admission script to one of
// the bot's built-in answers (class, board, percentage…), which is what lets
// the bot keep reading typed answers like "dasvi" or "12th fail". They are
// not shown or edited here, only carried along.

type Answer = 'choice' | 'text' | 'percent' | 'year' | 'place' | 'subjects'
type Option = { id: string; label: string; value?: string; next: FlowNode | null }
type Choice = { id: string; label: string; value?: string }
type FlowNode =
  | { id: string; type: 'message'; text: string; textParent?: string; next: FlowNode | null }
  | { id: string; type: 'question'; text: string; textParent?: string; saveAs?: string; field?: string; options: Option[] }
  | { id: string; type: 'ask'; text: string; textParent?: string; saveAs?: string; field?: string; answer: Answer; options?: Choice[]; next: FlowNode | null }
  | { id: string; type: 'handoff'; text: string }
  | { id: string; type: 'builtin'; target: 'menu' | 'school' | 'college' }
  | { id: string; type: 'goto'; target: string }

interface Flow {
  id?: string
  name: string
  kind?: 'custom' | 'script'
  triggers: string[]
  match_mode: 'exact' | 'contains'
  on_first_message: boolean
  root: FlowNode | null
  is_active: boolean
}

const MAX_OPTIONS = 9
const KEYCAPS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣']

const NODE_STYLE = {
  message: { label: 'Send message', icon: MessageSquare, head: 'bg-blue-500' },
  question: { label: 'Ask question (branches)', icon: HelpCircle, head: 'bg-amber-500' },
  ask: { label: 'Ask & save answer', icon: ClipboardList, head: 'bg-cyan-600' },
  goto: { label: 'Jump to a step', icon: CornerDownRight, head: 'bg-slate-500' },
  handoff: { label: 'Hand to counsellor', icon: Headset, head: 'bg-emerald-600' },
  builtin: { label: 'Continue admission script', icon: Workflow, head: 'bg-violet-600' },
} as const

/** Steps that end a path: nothing can come after them. */
const TERMINAL: FlowNode['type'][] = ['goto', 'handoff', 'builtin']

const ANSWER_LABEL: Record<Answer, string> = {
  choice: 'Pick from options',
  text: 'Any text',
  percent: 'Percentage / CGPA',
  year: 'Year (e.g. 2025)',
  place: 'City / State',
  subjects: 'Number of subjects',
}

const BUILTIN_LABEL = {
  menu: 'Ask: 10th/12th or College?',
  school: 'Open Schooling (10th / 12th) questions',
  college: 'College (UG / PG) questions',
} as const

const STANDARD_THANKS = 'Thank you! 🙏 Aapki details note ho gayi hain. Humare counselor jald hi aapse contact karenge.'

const uid = () => Math.random().toString(36).slice(2, 10)

function makeNode(type: FlowNode['type'], next: FlowNode | null, script: boolean): FlowNode {
  switch (type) {
    case 'message': return { id: uid(), type, text: '', next }
    case 'question': return {
      id: uid(), type, text: '', saveAs: '',
      options: [{ id: uid(), label: '', next }, { id: uid(), label: '', next: null }],
    }
    case 'ask': return {
      id: uid(), type, text: '', saveAs: '', answer: 'text',
      options: [{ id: uid(), label: '' }, { id: uid(), label: '' }], next,
    }
    case 'goto': return { id: uid(), type, target: '' }
    // In the script an empty hand-off sends the standard thank-you with the
    // counsellor's number.
    case 'handoff': return { id: uid(), type, text: script ? '' : 'Thank you! 🙏 Humare counselor jald hi aapse contact karenge.' }
    case 'builtin': return { id: uid(), type, target: 'menu' }
  }
}

/** A ready-made "Hi" flow, so the first one is an edit, not a blank page. */
function starterFlow(): Flow {
  return {
    name: 'Hi — welcome',
    triggers: ['hi', 'hii', 'hello', 'hey'],
    match_mode: 'exact',
    on_first_message: false,
    is_active: true,
    root: {
      id: uid(), type: 'message', text: 'Namaste {name} 🙏 Distance Courses Wala (DCW) me aapka swagat hai!',
      next: {
        id: uid(), type: 'question', text: 'Aap kis cheez ke baare me jaanna chahte hain?', saveAs: 'Interest',
        options: [
          { id: uid(), label: '10th / 12th (Open Schooling)', next: { id: uid(), type: 'builtin', target: 'school' } },
          { id: uid(), label: 'Graduation / PG', next: { id: uid(), type: 'builtin', target: 'college' } },
          { id: uid(), label: 'Counselor se baat karni hai', next: { id: uid(), type: 'handoff', text: 'Bilkul 🙏 Humare counselor jald hi aapko call karenge.' } },
        ],
      },
    },
  }
}

function emptyFlow(): Flow {
  return { name: '', triggers: [], match_mode: 'exact', on_first_message: false, is_active: true, root: null }
}

/** What follows a node in the tree (jumps not included). */
function children(n: FlowNode): (FlowNode | null)[] {
  if (n.type === 'message' || n.type === 'ask') return [n.next]
  if (n.type === 'question') return n.options.map(o => o.next)
  return []
}

/** Every node of the tree, top to bottom. */
function allNodes(root: FlowNode | null): FlowNode[] {
  const out: FlowNode[] = []
  const go = (n: FlowNode | null) => {
    if (!n) return
    out.push(n)
    children(n).forEach(go)
  }
  go(root)
  return out
}

function nodeTitle(n: FlowNode): string {
  const t = 'text' in n ? n.text.replace(/\s+/g, ' ').trim() : ''
  if (!t) return NODE_STYLE[n.type].label
  return t.length > 60 ? `${t.slice(0, 59)}…` : t
}

const isScript = (f: Flow) => f.kind === 'script'

/** What would stop the bot running this flow sensibly. */
function problems(f: Flow): string[] {
  const out: string[] = []
  const script = isScript(f)
  if (!f.name.trim()) out.push('Give the flow a name')
  if (!script && !f.triggers.length && !f.on_first_message) out.push('Add at least one trigger word, or turn on "first message"')
  if (!f.root) out.push('Add at least one step under the start point')

  const nodes = allNodes(f.root)
  const byId = new Map(nodes.map(n => [n.id, n]))
  for (const n of nodes) {
    if ((n.type === 'message' || n.type === 'question' || n.type === 'ask') && !n.text.trim()) out.push(`Every "${NODE_STYLE[n.type].label}" step needs text`)
    if (n.type === 'question') {
      if (n.options.length < 2) out.push('A question needs at least two options')
      if (n.options.some(o => !o.label.trim())) out.push('Every option needs a label')
    }
    if (n.type === 'ask' && n.answer === 'choice') {
      if ((n.options ?? []).length < 2) out.push('A "pick from options" step needs at least two options')
      if ((n.options ?? []).some(o => !o.label.trim())) out.push('Every option needs a label')
    }
    if (n.type === 'goto') {
      if (!n.target) out.push('Choose where each "Jump to" step goes')
      else if (!byId.has(n.target)) out.push('A "Jump to" step points to a step that was removed')
    }
  }

  // A jump back up the path would send the chat round in circles.
  const state = new Map<string, number>()
  let loop = false
  const visit = (n: FlowNode | null | undefined) => {
    if (!n || loop) return
    if (n.type === 'goto') return visit(byId.get(n.target))
    if (state.get(n.id) === 1) { loop = true; return }
    if (state.has(n.id)) return
    state.set(n.id, 1)
    children(n).forEach(visit)
    state.set(n.id, 2)
  }
  visit(f.root)
  if (loop) out.push('A "Jump to" step goes back to an earlier step — the chat would go round in circles')

  if (script) {
    let n = f.root
    while (n?.type === 'message') n = n.next
    const values = n?.type === 'question' && n.field === 'flow' ? n.options.map(o => o.value) : []
    if (!values.includes('school') || !values.includes('college')) {
      out.push('The "10th/12th or College" question must stay the first question, with both options')
    }
  }
  return [...new Set(out)]
}

function db() {
  return createClient() as any
}

/** What every step on the canvas needs to know about the flow it is in. */
const FlowCtx = createContext<{ script: boolean; steps: FlowNode[] }>({ script: false, steps: [] })

// =============================================================== panel ===

export default function FlowBuilder() {
  const [flows, setFlows] = useState<(Flow & { id: string })[]>([])
  const [draft, setDraft] = useState<Flow | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    db().from('wa_flows').select('*').order('created_at')
      .then(({ data, error }: any) => {
        if (error) toast.error(error.message)
        else setFlows(data ?? [])
      })
  }, [])
  useEffect(() => { load() }, [load])

  const script = flows.find(isScript)
  const custom = flows.filter(f => !isScript(f))

  // Another flow already answering the same word would make one of them dead.
  const clash = draft && !isScript(draft)
    ? custom.filter(f => f.id !== draft.id && f.is_active)
        .flatMap(f => f.triggers.filter(t => draft.triggers.includes(t)).map(t => `"${t}" (${f.name})`))
    : []

  async function save() {
    if (!draft) return
    const p = problems(draft)
    if (p.length) { toast.error(p[0]); return }
    setSaving(true)
    const { data: { user } } = await db().auth.getUser()
    const payload = {
      name: draft.name.trim(), triggers: draft.triggers, match_mode: draft.match_mode,
      on_first_message: draft.on_first_message, root: draft.root, is_active: draft.is_active,
      updated_at: new Date().toISOString(),
    }
    const { data, error } = draft.id
      ? await db().from('wa_flows').update(payload).eq('id', draft.id).select().single()
      : await db().from('wa_flows').insert({ ...payload, created_by: user?.id ?? null }).select().single()
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success('Flow saved — the bot picks it up within a minute')
    setDraft(data)
    load()
  }

  async function toggle(f: Flow & { id: string }) {
    const { error } = await db().from('wa_flows').update({ is_active: !f.is_active }).eq('id', f.id)
    if (error) toast.error(error.message)
    else load()
  }

  async function remove(f: Flow & { id: string }) {
    const { error } = await db().from('wa_flows').delete().eq('id', f.id)
    if (error) { toast.error(error.message); return }
    if (draft?.id === f.id) setDraft(null)
    load()
  }

  if (draft) {
    const p = problems(draft)
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button onClick={() => setDraft(null)} className="text-sm text-gray-500 hover:text-gray-800">← All flows</button>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setDraft(null)}><X className="w-4 h-4 mr-1" /> Close</Button>
            <Button onClick={save} disabled={saving}><Save className="w-4 h-4 mr-1" /> {saving ? 'Saving…' : 'Save flow'}</Button>
          </div>
        </div>
        {(p.length > 0 || clash.length > 0) && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800 space-y-0.5">
            {p.map(x => <p key={x}>• {x}</p>)}
            {clash.length > 0 && <p>• Already used by another active flow: {clash.join(', ')} — the older flow wins</p>}
          </div>
        )}
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <Canvas flow={draft} onChange={setDraft} />
          <Simulator flow={draft} />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {script && (
        <div className="rounded-2xl border border-violet-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-violet-600 text-white flex items-center justify-center shrink-0"><Workflow className="w-5 h-5" /></span>
            <button onClick={() => setDraft(script)} className="flex-1 min-w-0 text-left">
              <p className="font-bold text-gray-900">Admission script</p>
              <p className="text-xs text-gray-500 mt-0.5">
                The questions the bot asks to qualify a lead — 10th/12th and College. Runs on every chat no trigger flow catches,
                and wherever a flow says &quot;Continue admission script&quot;.
                {!script.is_active && <span className="text-amber-600 font-medium"> Off: the bot uses its original questions.</span>}
              </p>
            </button>
            <Switch checked={script.is_active} onCheckedChange={() => toggle(script)} />
            <Button variant="outline" size="sm" onClick={() => setDraft(script)}>Edit questions</Button>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-bold text-gray-900">Trigger flows</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Decide what the bot says when a student sends a trigger word — e.g. &quot;Hi&quot; — and where each answer leads.
              A trigger beats the admission script.
            </p>
          </div>
          <div className="flex gap-2">
            {custom.length === 0 && (
              <Button variant="outline" onClick={() => setDraft(starterFlow())}><Zap className="w-4 h-4 mr-1" /> Start from a &quot;Hi&quot; flow</Button>
            )}
            <Button onClick={() => setDraft(emptyFlow())}><Plus className="w-4 h-4 mr-1" /> New flow</Button>
          </div>
        </div>

        {custom.length === 0 ? (
          <p className="text-sm text-gray-400 py-8 text-center">No trigger flows yet — every chat goes through the admission script.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {custom.map(f => (
              <div key={f.id} className="py-3 flex flex-wrap items-center gap-3">
                <button onClick={() => setDraft(f)} className="flex-1 min-w-0 text-left">
                  <p className="font-semibold text-gray-900 truncate">{f.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">
                    {f.on_first_message && <span className="text-violet-600 font-medium">Any first message · </span>}
                    {f.triggers.length ? `${f.match_mode === 'contains' ? 'Contains' : 'Exactly'}: ${f.triggers.join(', ')}` : 'No trigger words'}
                  </p>
                </button>
                <Switch checked={f.is_active} onCheckedChange={() => toggle(f)} />
                <Button variant="outline" size="sm" onClick={() => setDraft(f)}>Edit</Button>
                <Button variant="ghost" size="sm" className="text-red-500 hover:bg-red-50" onClick={() => remove(f)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================== canvas ===

function Canvas({ flow, onChange }: { flow: Flow; onChange: (f: Flow) => void }) {
  const set = (patch: Partial<Flow>) => onChange({ ...flow, ...patch })
  const ctx = useMemo(() => ({ script: isScript(flow), steps: allNodes(flow.root) }), [flow])
  return (
    <FlowCtx.Provider value={ctx}>
      <div
        className="rounded-2xl border border-gray-200 bg-slate-50 p-4 sm:p-6 overflow-x-auto"
        style={{ backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', backgroundSize: '18px 18px' }}
      >
        <div className="flex flex-col items-center min-w-fit">
          {ctx.script ? <ScriptStart flow={flow} set={set} /> : <StartPoint flow={flow} set={set} />}
          <Slot node={flow.root} onChange={root => set({ root })} />
        </div>
      </div>
    </FlowCtx.Provider>
  )
}

function ScriptStart({ flow, set }: { flow: Flow; set: (p: Partial<Flow>) => void }) {
  return (
    <div className="w-96 max-w-[85vw] rounded-2xl bg-white shadow-md border border-violet-100 overflow-hidden">
      <div className="bg-violet-600 text-white px-4 py-2.5 flex items-center gap-2 font-semibold text-sm">
        <Workflow className="w-4 h-4" /> Admission script
      </div>
      <div className="p-4 space-y-2 text-xs text-gray-600">
        <p>Starts on any chat no trigger flow catches. Reword questions and options, add steps or branches.</p>
        <p className="flex gap-1.5"><Link2 className="w-3.5 h-3.5 shrink-0 mt-px text-violet-500" />
          Linked steps still understand typed answers (&quot;dasvi&quot;, &quot;12th fail&quot;, &quot;62%&quot;), and a question already
          answered in an earlier message is skipped.</p>
        <label className="flex items-center justify-between gap-2 pt-1 text-gray-700">
          Active <span className="text-gray-400">(off = the bot&apos;s original questions)</span>
          <Switch checked={flow.is_active} onCheckedChange={v => set({ is_active: Boolean(v) })} />
        </label>
      </div>
    </div>
  )
}

function StartPoint({ flow, set }: { flow: Flow; set: (p: Partial<Flow>) => void }) {
  const [word, setWord] = useState('')
  function add() {
    const w = word.trim().toLowerCase()
    if (w && !flow.triggers.includes(w)) set({ triggers: [...flow.triggers, w] })
    setWord('')
  }
  return (
    <div className="w-80 max-w-[85vw] rounded-2xl bg-white shadow-md border border-blue-100 overflow-hidden">
      <div className="bg-blue-600 text-white px-4 py-2.5 flex items-center gap-2 font-semibold text-sm">
        <Play className="w-4 h-4" /> Start point
      </div>
      <div className="p-4 space-y-3">
        <Input placeholder="Flow name, e.g. Hi — welcome" value={flow.name} onChange={e => set({ name: e.target.value })} />
        <div>
          <p className="text-xs text-gray-500 mb-1.5">Triggered when the student sends</p>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {flow.triggers.map(t => (
              <span key={t} className="inline-flex items-center gap-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold px-2.5 py-1">
                {t}
                <button onClick={() => set({ triggers: flow.triggers.filter(x => x !== t) })}><X className="w-3 h-3" /></button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <Input className="h-9" placeholder="Add a word, e.g. hi" value={word}
              onChange={e => setWord(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add() } }} />
            <Button size="sm" variant="outline" onClick={add}>Add</Button>
          </div>
          <div className="flex gap-1 mt-2 p-0.5 bg-gray-100 rounded-lg text-xs">
            {(['exact', 'contains'] as const).map(m => (
              <button key={m} onClick={() => set({ match_mode: m })}
                className={`flex-1 rounded-md py-1 font-semibold ${flow.match_mode === m ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>
                {m === 'exact' ? 'Whole message' : 'Anywhere in message'}
              </button>
            ))}
          </div>
        </div>
        <label className="flex items-center justify-between gap-2 text-xs text-gray-700">
          Also on a student&apos;s very first message
          <Switch checked={flow.on_first_message} onCheckedChange={v => set({ on_first_message: Boolean(v) })} />
        </label>
        <label className="flex items-center justify-between gap-2 text-xs text-gray-700">
          Active
          <Switch checked={flow.is_active} onCheckedChange={v => set({ is_active: Boolean(v) })} />
        </label>
      </div>
    </div>
  )
}

function Line() {
  return <div className="w-px h-6 bg-slate-300" />
}

/** A place a node can go: shows the node and what follows, or an add button. */
function Slot({ node, onChange }: { node: FlowNode | null; onChange: (n: FlowNode | null) => void }) {
  const { script } = useContext(FlowCtx)
  return (
    <div className="flex flex-col items-center">
      <Line />
      <AddButton terminalAllowed={!node} onAdd={type => onChange(makeNode(type, node, script))} />
      {node && <><Line /><NodeView node={node} onChange={onChange} /></>}
    </div>
  )
}

function AddButton({ terminalAllowed, onAdd }: { terminalAllowed: boolean; onAdd: (t: FlowNode['type']) => void }) {
  const { script } = useContext(FlowCtx)
  const [open, setOpen] = useState(false)
  const types = (Object.keys(NODE_STYLE) as FlowNode['type'][])
    .filter(t => terminalAllowed || !TERMINAL.includes(t))
    // The script is the admission questions; it has nothing to continue into.
    .filter(t => !(script && t === 'builtin'))
  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)} title="Add a step"
        className="w-7 h-7 rounded-lg border border-slate-300 bg-white text-slate-500 hover:border-blue-500 hover:text-blue-600 flex items-center justify-center shadow-sm">
        <Plus className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute z-20 left-1/2 -translate-x-1/2 top-9 w-64 rounded-xl border border-gray-200 bg-white shadow-lg p-1">
          {types.map(t => {
            const S = NODE_STYLE[t]
            return (
              <button key={t} onClick={() => { onAdd(t); setOpen(false) }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-50 text-left">
                <span className={`w-6 h-6 rounded-md ${S.head} text-white flex items-center justify-center`}><S.icon className="w-3.5 h-3.5" /></span>
                {S.label}
              </button>
            )
          })}
          {!terminalAllowed && <p className="px-3 py-1.5 text-[11px] text-gray-400">Jump, hand-off and script steps can only go at the end of a path.</p>}
        </div>
      )}
    </div>
  )
}

/** Optional wording for when a parent is writing in. */
function ParentText({ value, onChange }: { value?: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(Boolean(value))
  if (!open) {
    return <button onClick={() => setOpen(true)} className="text-[11px] text-gray-400 hover:text-gray-600">+ Different wording for parents</button>
  }
  return (
    <div>
      <p className="text-[11px] text-gray-400 mb-1">When a parent is writing (e.g. &quot;mera beta…&quot;)</p>
      <Textarea rows={2} className="text-sm" value={value ?? ''} placeholder="Leave empty to use the same text"
        onChange={e => onChange(e.target.value)} />
    </div>
  )
}

function NodeView({ node, onChange }: { node: FlowNode; onChange: (n: FlowNode | null) => void }) {
  const { script, steps } = useContext(FlowCtx)
  const S = NODE_STYLE[node.type]
  // The 10th/12th-or-college question is what the script hangs on.
  const anchor = node.type === 'question' && node.field === 'flow'
  // Removing a message or an "ask & save" keeps what came after it;
  // removing anything else removes its whole branch.
  const remove = () => onChange(node.type === 'message' || node.type === 'ask' ? node.next : null)

  const card = (
    <div className="w-72 max-w-[80vw] rounded-2xl bg-white shadow-md border border-gray-100 overflow-hidden">
      <div className={`${S.head} text-white px-4 py-2 flex items-center justify-between text-sm font-semibold`}>
        <span className="flex items-center gap-2"><S.icon className="w-4 h-4" /> {S.label}</span>
        {anchor
          ? <span title="The script starts here"><Lock className="w-3.5 h-3.5 opacity-80" /></span>
          : <button onClick={remove} title="Remove step" className="opacity-80 hover:opacity-100"><Trash2 className="w-3.5 h-3.5" /></button>}
      </div>
      <div className="p-3 space-y-2">
        {node.type === 'builtin' && (
          <select value={node.target} onChange={e => onChange({ ...node, target: e.target.value as any })}
            className="w-full rounded-lg border border-gray-200 px-2 py-2 text-sm bg-white">
            {(Object.keys(BUILTIN_LABEL) as (keyof typeof BUILTIN_LABEL)[]).map(k => <option key={k} value={k}>{BUILTIN_LABEL[k]}</option>)}
          </select>
        )}
        {node.type === 'goto' && (
          <select value={node.target} onChange={e => onChange({ ...node, target: e.target.value })}
            className="w-full rounded-lg border border-gray-200 px-2 py-2 text-sm bg-white">
            <option value="">Choose a step…</option>
            {steps.filter(n => n.type === 'message' || n.type === 'question' || n.type === 'ask').map(n => (
              <option key={n.id} value={n.id}>{nodeTitle(n)}</option>
            ))}
          </select>
        )}
        {(node.type === 'message' || node.type === 'question' || node.type === 'ask' || node.type === 'handoff') && (
          <Textarea rows={3} className="text-sm" value={node.text}
            placeholder={
              node.type === 'handoff' && script ? 'Leave empty for the standard thank-you with the counsellor\'s number'
                : node.type === 'question' || node.type === 'ask' ? 'Question to ask… {Class} puts in an earlier answer'
                : 'Message… use {name} for the student\'s name'
            }
            onChange={e => onChange({ ...node, text: e.target.value })} />
        )}
        {(node.type === 'message' || node.type === 'question' || node.type === 'ask') && (
          <ParentText value={node.textParent} onChange={v => onChange({ ...node, textParent: v })} />
        )}
        {node.type === 'ask' && (
          <select value={node.answer} disabled={Boolean(node.field)}
            title={node.field ? 'Linked to the bot\'s built-in answer' : undefined}
            onChange={e => onChange({ ...node, answer: e.target.value as Answer })}
            className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs bg-white disabled:bg-gray-50 disabled:text-gray-500">
            {(Object.keys(ANSWER_LABEL) as Answer[]).map(k => <option key={k} value={k}>Answer: {ANSWER_LABEL[k]}</option>)}
          </select>
        )}
        {node.type === 'ask' && node.answer === 'choice' && (
          <Choices node={node} onChange={onChange} />
        )}
        {(node.type === 'question' || node.type === 'ask') && !anchor && (
          <Input className="h-8 text-xs" placeholder="Save answer on the lead as… (optional)" value={node.saveAs ?? ''}
            onChange={e => onChange({ ...node, saveAs: e.target.value })} />
        )}
        {(node.type === 'question' || node.type === 'ask') && node.field && (
          <p className="flex items-center gap-1 text-[11px] text-violet-600"><Link2 className="w-3 h-3" /> Linked to the bot&apos;s built-in answer</p>
        )}
        {node.type === 'handoff' && <p className="text-[11px] text-gray-400">Marks the lead &quot;Counselor Required&quot; and the bot steps back.</p>}
        {node.type === 'builtin' && <p className="text-[11px] text-gray-400">The admission script takes over from here.</p>}
        {node.type === 'goto' && <p className="text-[11px] text-gray-400">The chat carries on from that step, so branches can share the questions after it.</p>}
      </div>
    </div>
  )

  if (node.type === 'message' || node.type === 'ask') {
    return <div className="flex flex-col items-center">{card}<Slot node={node.next} onChange={next => onChange({ ...node, next })} /></div>
  }
  if (node.type !== 'question') return card

  const setOption = (i: number, o: Option) => onChange({ ...node, options: node.options.map((x, j) => (j === i ? o : x)) })
  return (
    <div className="flex flex-col items-center">
      {card}
      <Line />
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400 text-white text-xs font-bold px-3 py-1 shadow-sm">
        <GitBranch className="w-3.5 h-3.5" /> Branching
      </span>
      <div className="flex gap-4 items-start">
        {node.options.map((o, i) => (
          <Branch key={o.id} option={o} index={i} onChange={x => setOption(i, x)}
            onRemove={node.options.length > 2 && !anchor ? () => onChange({ ...node, options: node.options.filter((_, j) => j !== i) }) : null} />
        ))}
        {node.options.length < MAX_OPTIONS && !anchor && (
          <div className="flex flex-col items-center">
            <Line />
            <button onClick={() => onChange({ ...node, options: [...node.options, { id: uid(), label: '', next: null }] })}
              className="rounded-xl border border-dashed border-amber-300 bg-white/70 text-amber-700 text-xs font-semibold px-3 py-2.5 hover:bg-amber-50">
              + Option
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * One option of a branching question and the path under it. The admission
 * script is long, so there its paths start folded: open the one to edit.
 */
function Branch({ option: o, index, onChange, onRemove }: {
  option: Option; index: number; onChange: (o: Option) => void; onRemove: (() => void) | null
}) {
  const { script } = useContext(FlowCtx)
  const [open, setOpen] = useState(!script)
  const count = allNodes(o.next).length
  return (
    <div className="flex flex-col items-center">
      <Line />
      <div className="w-56 rounded-xl bg-white border border-amber-200 shadow-sm px-2.5 py-2 flex items-center gap-1.5">
        <span className="text-sm">{KEYCAPS[index]}</span>
        <input value={o.label} placeholder="Option label"
          onChange={e => onChange({ ...o, label: e.target.value })}
          className="flex-1 min-w-0 text-sm outline-none" />
        {open && count > 0 && (
          <button onClick={() => setOpen(false)} title="Fold this path" className="text-gray-300 hover:text-gray-600"><ChevronUp className="w-3.5 h-3.5" /></button>
        )}
        {onRemove && (
          <button onClick={onRemove} title="Remove option" className="text-gray-300 hover:text-red-500"><X className="w-3.5 h-3.5" /></button>
        )}
      </div>
      {open || count === 0 ? (
        <Slot node={o.next} onChange={next => onChange({ ...o, next })} />
      ) : (
        <>
          <Line />
          <button onClick={() => setOpen(true)}
            className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white text-slate-600 text-xs font-semibold px-3 py-1.5 shadow-sm hover:border-blue-500 hover:text-blue-600">
            <ChevronDown className="w-3.5 h-3.5" /> {count} step{count === 1 ? '' : 's'} — show
          </button>
        </>
      )}
    </div>
  )
}

/** The options of an "ask & save" step: picked and saved, all going the same way. */
function Choices({ node, onChange }: { node: Extract<FlowNode, { type: 'ask' }>; onChange: (n: FlowNode) => void }) {
  const options = node.options ?? []
  const set = (list: Choice[]) => onChange({ ...node, options: list })
  return (
    <div className="space-y-1">
      {options.map((o, i) => (
        <div key={o.id} className="flex items-center gap-1.5 rounded-lg border border-cyan-100 bg-cyan-50/40 px-2 py-1">
          <span className="text-xs">{KEYCAPS[i]}</span>
          <input value={o.label} placeholder="Option label"
            onChange={e => set(options.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
            className="flex-1 min-w-0 text-xs bg-transparent outline-none" />
          {options.length > 2 && (
            <button onClick={() => set(options.filter((_, j) => j !== i))} title="Remove option"
              className="text-gray-300 hover:text-red-500"><X className="w-3 h-3" /></button>
          )}
        </div>
      ))}
      {options.length < MAX_OPTIONS && (
        <button onClick={() => set([...options, { id: uid(), label: '' }])}
          className="text-[11px] font-semibold text-cyan-700 hover:underline">+ Option</button>
      )}
    </div>
  )
}

// =========================================================== simulator ===

type Bubble = { from: 'bot' | 'student'; text: string }
type Waiting = Extract<FlowNode, { type: 'question' }> | Extract<FlowNode, { type: 'ask' }>

/** Plays the flow the way the bot will, so it can be checked before saving. */
function Simulator({ flow }: { flow: Flow }) {
  const [bubbles, setBubbles] = useState<Bubble[]>([])
  const [waiting, setWaiting] = useState<Waiting | null>(null)
  const [ended, setEnded] = useState<string | null>(null)
  const [saved, setSaved] = useState<Record<string, string>>({})
  const [typed, setTyped] = useState('')
  const script = isScript(flow)
  const byId = useMemo(() => new Map(allNodes(flow.root).map(n => [n.id, n])), [flow.root])

  // {name} is the student's name; {Class} (any "save as" name) an earlier answer.
  const fill = (t: string, vars: Record<string, string>) => t
    .replace(/\{name\}/g, 'Rahul')
    .replace(/\{([^{}]+)\}/g, (_, k: string) => vars[k.trim().toLowerCase()] ?? k.trim())
    .trim()

  function run(start: FlowNode | null, acc: Bubble[], vars: Record<string, string>) {
    let n = start
    setSaved(vars)
    // The bot stops a runaway chain of messages after eight sends.
    for (let i = 0; n && i < 8; i++) {
      if (n.type === 'message') { if (n.text.trim()) acc.push({ from: 'bot', text: fill(n.text, vars) }); n = n.next; continue }
      if (n.type === 'goto') { n = byId.get(n.target) ?? null; continue }
      if (n.type === 'question' || n.type === 'ask') {
        const choices = n.type === 'question' ? n.options : n.answer === 'choice' ? n.options ?? [] : []
        const list = choices.map((o, j) => `${KEYCAPS[j]} ${o.label || '…'}`).join('\n')
        acc.push({ from: 'bot', text: list ? `${fill(n.text, vars)}\n\n${list}` : fill(n.text, vars) })
        setBubbles([...acc]); setWaiting(n); setEnded(null)
        return
      }
      if (n.type === 'handoff') {
        const text = n.text.trim() || (script ? STANDARD_THANKS : '')
        if (text) acc.push({ from: 'bot', text: fill(text, vars) })
        setBubbles([...acc]); setWaiting(null); setEnded('Handed to a counsellor'); return
      }
      if (n.type === 'builtin') { setBubbles([...acc]); setWaiting(null); setEnded(`Admission script: ${BUILTIN_LABEL[n.target]}`); return }
    }
    setBubbles([...acc]); setWaiting(null); setEnded(n ? 'Stopped: too many messages in a row' : 'Flow ends here')
  }

  function begin() {
    run(flow.root, [{ from: 'student', text: script ? 'Hi' : flow.triggers[0] ?? 'Hi' }], {})
  }

  function answer(label: string, shown: string, next: FlowNode | null) {
    if (!waiting) return
    const key = waiting.saveAs?.trim().toLowerCase()
    run(next, [...bubbles, { from: 'student', text: shown }], key ? { ...saved, [key]: label } : saved)
  }

  const freeText = waiting?.type === 'ask' && waiting.answer !== 'choice'

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden flex flex-col h-[560px] xl:sticky xl:top-4">
      <div className="bg-emerald-700 text-white px-4 py-2.5 flex items-center justify-between">
        <span className="text-sm font-semibold">Test chat</span>
        <button onClick={begin} className="inline-flex items-center gap-1 text-xs font-semibold bg-white/15 hover:bg-white/25 rounded-lg px-2.5 py-1">
          <RotateCcw className="w-3.5 h-3.5" /> {bubbles.length ? 'Restart' : 'Start'}
        </button>
      </div>
      <div className="flex-1 overflow-y-auto bg-[#efeae2] p-3 space-y-2">
        {bubbles.length === 0 && (
          <p className="text-xs text-gray-500 text-center mt-8">
            Press Start to send &quot;{script ? 'Hi' : flow.triggers[0] ?? 'Hi'}&quot; and see the replies.
            {script && <><br />The real bot also reads typed answers and skips questions already answered.</>}
          </p>
        )}
        {bubbles.map((b, i) => (
          <div key={i} className={`max-w-[85%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap shadow-sm ${
            b.from === 'bot' ? 'bg-white text-gray-800' : 'bg-[#d9fdd3] text-gray-800 ml-auto'
          }`}>{b.text}</div>
        ))}
        {ended && <p className="text-[11px] text-gray-500 text-center pt-1">— {ended} —</p>}
      </div>
      {waiting && !freeText && (
        <div className="border-t border-gray-100 p-2 flex flex-wrap gap-1.5">
          {(waiting.type === 'question' ? waiting.options : waiting.options ?? []).map((o, i) => (
            <button key={o.id}
              onClick={() => answer(o.label, String(i + 1), waiting.type === 'question' ? (o as Option).next : waiting.next)}
              className="rounded-full border border-emerald-200 text-emerald-700 text-xs font-semibold px-3 py-1.5 hover:bg-emerald-50">
              {i + 1}. {o.label || '…'}
            </button>
          ))}
        </div>
      )}
      {waiting?.type === 'ask' && freeText && (
        <form className="border-t border-gray-100 p-2 flex gap-1.5"
          onSubmit={e => { e.preventDefault(); if (typed.trim()) { answer(typed.trim(), typed.trim(), waiting.next); setTyped('') } }}>
          <Input className="h-9 text-sm" placeholder={`Type an answer — ${ANSWER_LABEL[waiting.answer].toLowerCase()}`}
            value={typed} onChange={e => setTyped(e.target.value)} />
          <Button size="sm" type="submit"><Send className="w-4 h-4" /></Button>
        </form>
      )}
    </div>
  )
}
