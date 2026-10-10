'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  Play, MessageSquare, HelpCircle, Headset, Workflow, Plus, Trash2, Save, X, GitBranch, RotateCcw, Zap,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'

/* eslint-disable @typescript-eslint/no-explicit-any */

// The bot runs these from whatsapp-bot/src/custom.mjs; keep the node shapes
// here and there in step.

type Option = { id: string; label: string; next: FlowNode | null }
type FlowNode =
  | { id: string; type: 'message'; text: string; next: FlowNode | null }
  | { id: string; type: 'question'; text: string; saveAs?: string; options: Option[] }
  | { id: string; type: 'handoff'; text: string }
  | { id: string; type: 'builtin'; target: 'menu' | 'school' | 'college' }

interface Flow {
  id?: string
  name: string
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
  question: { label: 'Ask question', icon: HelpCircle, head: 'bg-amber-500' },
  handoff: { label: 'Hand to counsellor', icon: Headset, head: 'bg-emerald-600' },
  builtin: { label: 'Continue admission script', icon: Workflow, head: 'bg-violet-600' },
} as const

const BUILTIN_LABEL = {
  menu: 'Ask: 10th/12th or College?',
  school: 'Open Schooling (10th / 12th) questions',
  college: 'College (UG / PG) questions',
} as const

const uid = () => Math.random().toString(36).slice(2, 10)

function makeNode(type: FlowNode['type'], next: FlowNode | null): FlowNode {
  switch (type) {
    case 'message': return { id: uid(), type, text: '', next }
    case 'question': return {
      id: uid(), type, text: '', saveAs: '',
      options: [{ id: uid(), label: '', next }, { id: uid(), label: '', next: null }],
    }
    case 'handoff': return { id: uid(), type, text: 'Thank you! 🙏 Humare counselor jald hi aapse contact karenge.' }
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

/** What would stop the bot running this flow sensibly. */
function problems(f: Flow): string[] {
  const out: string[] = []
  if (!f.name.trim()) out.push('Give the flow a name')
  if (!f.triggers.length && !f.on_first_message) out.push('Add at least one trigger word, or turn on "first message"')
  if (!f.root) out.push('Add at least one step under the start point')
  const walk = (n: FlowNode | null) => {
    if (!n) return
    if ((n.type === 'message' || n.type === 'question') && !n.text.trim()) out.push(`A "${NODE_STYLE[n.type].label}" step has no text`)
    if (n.type === 'message') walk(n.next)
    if (n.type === 'question') {
      if (n.options.length < 2) out.push('A question needs at least two options')
      if (n.options.some(o => !o.label.trim())) out.push('Every option needs a label')
      n.options.forEach(o => walk(o.next))
    }
  }
  walk(f.root)
  return [...new Set(out)]
}

function db() {
  return createClient() as any
}

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

  // Another flow already answering the same word would make one of them dead.
  const clash = draft
    ? flows.filter(f => f.id !== draft.id && f.is_active)
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
        <div className="grid gap-4 xl:grid-cols-[1fr,340px]">
          <Canvas flow={draft} onChange={setDraft} />
          <Simulator flow={draft} />
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-bold text-gray-900">Flow Builder</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Decide what the bot says when a student sends a trigger word — e.g. &quot;Hi&quot; — and where each answer leads.
            A trigger beats the built-in script.
          </p>
        </div>
        <div className="flex gap-2">
          {flows.length === 0 && (
            <Button variant="outline" onClick={() => setDraft(starterFlow())}><Zap className="w-4 h-4 mr-1" /> Start from a &quot;Hi&quot; flow</Button>
          )}
          <Button onClick={() => setDraft(emptyFlow())}><Plus className="w-4 h-4 mr-1" /> New flow</Button>
        </div>
      </div>

      {flows.length === 0 ? (
        <p className="text-sm text-gray-400 py-8 text-center">No flows yet — the bot uses its built-in admission script for every message.</p>
      ) : (
        <div className="divide-y divide-gray-100">
          {flows.map(f => (
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
  )
}

// ============================================================== canvas ===

function Canvas({ flow, onChange }: { flow: Flow; onChange: (f: Flow) => void }) {
  const set = (patch: Partial<Flow>) => onChange({ ...flow, ...patch })
  return (
    <div
      className="rounded-2xl border border-gray-200 bg-slate-50 p-4 sm:p-6 overflow-x-auto"
      style={{ backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', backgroundSize: '18px 18px' }}
    >
      <div className="flex flex-col items-center min-w-fit">
        <StartPoint flow={flow} set={set} />
        <Slot node={flow.root} onChange={root => set({ root })} />
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
  return (
    <div className="flex flex-col items-center">
      <Line />
      <AddButton terminalAllowed={!node} onAdd={type => onChange(makeNode(type, node))} />
      {node && <><Line /><NodeView node={node} onChange={onChange} /></>}
    </div>
  )
}

function AddButton({ terminalAllowed, onAdd }: { terminalAllowed: boolean; onAdd: (t: FlowNode['type']) => void }) {
  const [open, setOpen] = useState(false)
  const types = (Object.keys(NODE_STYLE) as FlowNode['type'][])
    .filter(t => terminalAllowed || t === 'message' || t === 'question')
  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)} title="Add a step"
        className="w-7 h-7 rounded-lg border border-slate-300 bg-white text-slate-500 hover:border-blue-500 hover:text-blue-600 flex items-center justify-center shadow-sm">
        <Plus className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute z-20 left-1/2 -translate-x-1/2 top-9 w-60 rounded-xl border border-gray-200 bg-white shadow-lg p-1">
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
          {!terminalAllowed && <p className="px-3 py-1.5 text-[11px] text-gray-400">Hand-off and script steps can only go at the end of a path.</p>}
        </div>
      )}
    </div>
  )
}

function NodeView({ node, onChange }: { node: FlowNode; onChange: (n: FlowNode | null) => void }) {
  const S = NODE_STYLE[node.type]
  // Removing a message keeps what came after it; removing anything else
  // removes its whole branch.
  const remove = () => onChange(node.type === 'message' ? node.next : null)

  const card = (
    <div className="w-72 max-w-[80vw] rounded-2xl bg-white shadow-md border border-gray-100 overflow-hidden">
      <div className={`${S.head} text-white px-4 py-2 flex items-center justify-between text-sm font-semibold`}>
        <span className="flex items-center gap-2"><S.icon className="w-4 h-4" /> {S.label}</span>
        <button onClick={remove} title="Remove step" className="opacity-80 hover:opacity-100"><Trash2 className="w-3.5 h-3.5" /></button>
      </div>
      <div className="p-3 space-y-2">
        {node.type === 'builtin' ? (
          <select value={node.target} onChange={e => onChange({ ...node, target: e.target.value as any })}
            className="w-full rounded-lg border border-gray-200 px-2 py-2 text-sm bg-white">
            {(Object.keys(BUILTIN_LABEL) as (keyof typeof BUILTIN_LABEL)[]).map(k => <option key={k} value={k}>{BUILTIN_LABEL[k]}</option>)}
          </select>
        ) : (
          <Textarea rows={3} className="text-sm" value={node.text}
            placeholder={node.type === 'question' ? 'Question to ask…' : 'Message… use {name} for the student\'s name'}
            onChange={e => onChange({ ...node, text: e.target.value })} />
        )}
        {node.type === 'question' && (
          <Input className="h-8 text-xs" placeholder="Save answer on the lead as… (optional)" value={node.saveAs ?? ''}
            onChange={e => onChange({ ...node, saveAs: e.target.value })} />
        )}
        {node.type === 'handoff' && <p className="text-[11px] text-gray-400">Marks the lead &quot;Counselor Required&quot; and the bot steps back.</p>}
        {node.type === 'builtin' && <p className="text-[11px] text-gray-400">The built-in admission questions take over from here.</p>}
      </div>
    </div>
  )

  if (node.type === 'message') {
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
          <div key={o.id} className="flex flex-col items-center">
            <Line />
            <div className="w-56 rounded-xl bg-white border border-amber-200 shadow-sm px-2.5 py-2 flex items-center gap-1.5">
              <span className="text-sm">{KEYCAPS[i]}</span>
              <input value={o.label} placeholder="Option label"
                onChange={e => setOption(i, { ...o, label: e.target.value })}
                className="flex-1 min-w-0 text-sm outline-none" />
              {node.options.length > 2 && (
                <button onClick={() => onChange({ ...node, options: node.options.filter((_, j) => j !== i) })}
                  title="Remove option" className="text-gray-300 hover:text-red-500"><X className="w-3.5 h-3.5" /></button>
              )}
            </div>
            <Slot node={o.next} onChange={next => setOption(i, { ...o, next })} />
          </div>
        ))}
        {node.options.length < MAX_OPTIONS && (
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

// =========================================================== simulator ===

type Bubble = { from: 'bot' | 'student'; text: string }

/** Plays the flow the way the bot will, so it can be checked before saving. */
function Simulator({ flow }: { flow: Flow }) {
  const [bubbles, setBubbles] = useState<Bubble[]>([])
  const [waiting, setWaiting] = useState<Extract<FlowNode, { type: 'question' }> | null>(null)
  const [ended, setEnded] = useState<string | null>(null)

  const fill = (t: string) => t.replace(/\{name\}/g, 'Rahul').trim()

  function run(start: FlowNode | null, acc: Bubble[]) {
    let n = start
    for (let i = 0; n && i < 8; i++) {
      if (n.type === 'message') { if (n.text.trim()) acc.push({ from: 'bot', text: fill(n.text) }); n = n.next; continue }
      if (n.type === 'question') {
        const list = n.options.map((o, j) => `${KEYCAPS[j]} ${o.label || '…'}`).join('\n')
        acc.push({ from: 'bot', text: `${fill(n.text)}\n\n${list}` })
        setBubbles([...acc]); setWaiting(n); setEnded(null)
        return
      }
      if (n.type === 'handoff') { if (n.text.trim()) acc.push({ from: 'bot', text: fill(n.text) }); setBubbles([...acc]); setWaiting(null); setEnded('Handed to a counsellor'); return }
      if (n.type === 'builtin') { setBubbles([...acc]); setWaiting(null); setEnded(`Built-in script: ${BUILTIN_LABEL[n.target]}`); return }
    }
    setBubbles([...acc]); setWaiting(null); setEnded('Flow ends here')
  }

  function begin() {
    run(flow.root, [{ from: 'student', text: flow.triggers[0] ?? 'Hi' }])
  }

  function choose(o: Option, i: number) {
    run(o.next, [...bubbles, { from: 'student', text: String(i + 1) }])
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden flex flex-col h-[560px] xl:sticky xl:top-4">
      <div className="bg-emerald-700 text-white px-4 py-2.5 flex items-center justify-between">
        <span className="text-sm font-semibold">Test chat</span>
        <button onClick={begin} className="inline-flex items-center gap-1 text-xs font-semibold bg-white/15 hover:bg-white/25 rounded-lg px-2.5 py-1">
          <RotateCcw className="w-3.5 h-3.5" /> {bubbles.length ? 'Restart' : 'Start'}
        </button>
      </div>
      <div className="flex-1 overflow-y-auto bg-[#efeae2] p-3 space-y-2">
        {bubbles.length === 0 && <p className="text-xs text-gray-500 text-center mt-8">Press Start to send &quot;{flow.triggers[0] ?? 'Hi'}&quot; and see the replies.</p>}
        {bubbles.map((b, i) => (
          <div key={i} className={`max-w-[85%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap shadow-sm ${
            b.from === 'bot' ? 'bg-white text-gray-800' : 'bg-[#d9fdd3] text-gray-800 ml-auto'
          }`}>{b.text}</div>
        ))}
        {ended && <p className="text-[11px] text-gray-500 text-center pt-1">— {ended} —</p>}
      </div>
      {waiting && (
        <div className="border-t border-gray-100 p-2 flex flex-wrap gap-1.5">
          {waiting.options.map((o, i) => (
            <button key={o.id} onClick={() => choose(o, i)}
              className="rounded-full border border-emerald-200 text-emerald-700 text-xs font-semibold px-3 py-1.5 hover:bg-emerald-50">
              {i + 1}. {o.label || '…'}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
