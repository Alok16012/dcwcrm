'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { format, parseISO } from 'date-fns'
import {
  Settings2, BookOpen, Send, Plus, Trash2, Save, Pencil, X, AlertTriangle, RefreshCw, Workflow,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { LEAD_STATUS_LABELS, LEAD_SOURCE_LABELS } from '@/types/app.types'
import FlowBuilder from './FlowBuilder'

/* eslint-disable @typescript-eslint/no-explicit-any */

// The bot re-reads these tables every minute (whatsapp-bot/src/control.mjs).

interface Settings {
  paused: boolean
  ai_enabled: boolean
  outreach_enabled: boolean
  outreach_daily_limit: number
  outreach_start_hour: number
  outreach_end_hour: number
  outreach_min_gap_sec: number
  outreach_max_gap_sec: number
  outreach_templates: string[]
}

interface Knowledge {
  id: string
  title: string
  body: string
  keywords: string[]
  flow: 'any' | 'college' | 'school'
  is_active: boolean
}

interface OutreachRow {
  id: string
  phone: string
  name: string | null
  campaign: string | null
  status: 'queued' | 'sent' | 'replied' | 'failed' | 'skipped'
  error: string | null
  queued_at: string
  sent_at: string | null
  replied_at: string | null
}

const FLOW_LABEL = { any: 'Both', college: 'College', school: 'Open School' } as const

const OUTREACH_STYLE: Record<OutreachRow['status'], string> = {
  queued: 'bg-slate-100 text-slate-600',
  sent: 'bg-blue-100 text-blue-700',
  replied: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  skipped: 'bg-amber-100 text-amber-700',
}

/** Never message these again from a campaign: they are done, or said no. */
const NEVER_OUTREACH = ['converted']
/** A number messaged this recently is not queued again. */
const RECONTACT_DAYS = 30

function db() {
  return createClient() as any
}

// ================================================================ tabs ===

export default function ControlCentre({ aiProvider }: { aiProvider: string | null }) {
  const [tab, setTab] = useState<'settings' | 'flows' | 'knowledge' | 'outreach'>('settings')
  const tabs = [
    { key: 'settings', label: 'Settings', icon: Settings2 },
    { key: 'flows', label: 'Flow Builder', icon: Workflow },
    { key: 'knowledge', label: 'AI Knowledge', icon: BookOpen },
    { key: 'outreach', label: 'Outreach', icon: Send },
  ] as const

  return (
    <div className="space-y-4">
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit max-w-full overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${
              tab === t.key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'settings' && <SettingsPanel aiProvider={aiProvider} />}
      {tab === 'flows' && <FlowBuilder />}
      {tab === 'knowledge' && <KnowledgePanel />}
      {tab === 'outreach' && <OutreachPanel />}
    </div>
  )
}

function Card({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
      <div>
        <p className="font-bold text-gray-900">{title}</p>
        {hint && <p className="text-xs text-gray-500 mt-0.5">{hint}</p>}
      </div>
      {children}
    </div>
  )
}

function Toggle({ label, hint, checked, onChange }: {
  label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-sm font-semibold text-gray-800">{label}</p>
        {hint && <p className="text-xs text-gray-500 mt-0.5">{hint}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={v => onChange(Boolean(v))} />
    </div>
  )
}

// ============================================================ settings ===

function SettingsPanel({ aiProvider }: { aiProvider: string | null }) {
  const [s, setS] = useState<Settings | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    db().from('wa_bot_settings').select('*').maybeSingle()
      .then(({ data, error }: any) => {
        if (error) toast.error(error.message)
        else setS(data as Settings)
      })
  }, [])

  if (!s) return <p className="text-sm text-gray-400">Loading…</p>

  const set = (patch: Partial<Settings>) => setS(prev => (prev ? { ...prev, ...patch } : prev))

  async function save() {
    if (!s) return
    const templates = s.outreach_templates.map(t => t.trim()).filter(Boolean)
    if (s.outreach_min_gap_sec > s.outreach_max_gap_sec) return toast.error('Minimum gap cannot exceed maximum gap')
    if (s.outreach_start_hour >= s.outreach_end_hour) return toast.error('Start hour must be before end hour')
    setSaving(true)
    const { data: { user } } = await createClient().auth.getUser()
    const { error } = await db().from('wa_bot_settings').update({
      ...s,
      outreach_templates: templates,
      updated_at: new Date().toISOString(),
      updated_by: user?.id ?? null,
    }).eq('id', true)
    setSaving(false)
    if (error) return toast.error(error.message)
    set({ outreach_templates: templates })
    toast.success('Saved — the bot picks this up within a minute')
  }

  const noKey = aiProvider === 'none'
  const num = (v: string, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(Number(v) || 0)))

  return (
    <div className="space-y-4">
      <Card title="Bot">
        <Toggle
          label="Pause the bot everywhere"
          hint="Stays connected and keeps recording chats, but sends nothing — replies or outreach."
          checked={s.paused} onChange={v => set({ paused: v })}
        />
        <Toggle
          label="AI answers"
          hint={noKey
            ? 'No AI key on the bot yet (GEMINI_API_KEY on Railway), so it runs on script and your knowledge entries only.'
            : 'For questions the script and your knowledge entries do not cover. Replies that promise, quote fees or give dates are blocked.'}
          checked={s.ai_enabled} onChange={v => set({ ai_enabled: v })}
        />
      </Card>

      <Card
        title="Outreach to existing leads"
        hint="The bot messages leads you queue on the Outreach tab, slowly, and qualifies whoever replies."
      >
        <div className="flex gap-2 rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <p>
            WhatsApp bans numbers that send many first messages. Keep the daily limit low (20–40) for the first
            weeks and raise it slowly. A separate number for outreach is safer than the main bot number.
          </p>
        </div>
        <Toggle label="Send outreach messages" checked={s.outreach_enabled} onChange={v => set({ outreach_enabled: v })} />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <Label className="text-xs">Max per day</Label>
            <Input type="number" value={s.outreach_daily_limit}
              onChange={e => set({ outreach_daily_limit: num(e.target.value, 0, 200) })} />
          </div>
          <div>
            <Label className="text-xs">From (hour, IST)</Label>
            <Input type="number" value={s.outreach_start_hour}
              onChange={e => set({ outreach_start_hour: num(e.target.value, 0, 23) })} />
          </div>
          <div>
            <Label className="text-xs">Until (hour, IST)</Label>
            <Input type="number" value={s.outreach_end_hour}
              onChange={e => set({ outreach_end_hour: num(e.target.value, 1, 24) })} />
          </div>
          <div>
            <Label className="text-xs">Gap (minutes)</Label>
            <div className="flex items-center gap-1">
              <Input type="number" value={Math.round(s.outreach_min_gap_sec / 60)}
                onChange={e => set({ outreach_min_gap_sec: num(e.target.value, 1, 120) * 60 })} />
              <span className="text-gray-400">–</span>
              <Input type="number" value={Math.round(s.outreach_max_gap_sec / 60)}
                onChange={e => set({ outreach_max_gap_sec: num(e.target.value, 1, 240) * 60 })} />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Messages — one is picked at random each time. {'{name}'} becomes the lead&apos;s first name.</Label>
          {s.outreach_templates.map((t, i) => (
            <div key={i} className="flex gap-2">
              <Textarea value={t} rows={2}
                onChange={e => set({ outreach_templates: s.outreach_templates.map((x, j) => (j === i ? e.target.value : x)) })} />
              <Button variant="ghost" size="sm" title="Remove"
                onClick={() => set({ outreach_templates: s.outreach_templates.filter((_, j) => j !== i) })}>
                <Trash2 className="w-4 h-4 text-red-500" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => set({ outreach_templates: [...s.outreach_templates, ''] })}>
            <Plus className="w-4 h-4 mr-1" /> Add a message
          </Button>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          <Save className="w-4 h-4 mr-1" /> {saving ? 'Saving…' : 'Save settings'}
        </Button>
      </div>
    </div>
  )
}

// =========================================================== knowledge ===

const EMPTY_ENTRY = { title: '', body: '', keywords: '', flow: 'any' as Knowledge['flow'] }

function KnowledgePanel() {
  const [rows, setRows] = useState<Knowledge[]>([])
  const [form, setForm] = useState(EMPTY_ENTRY)
  const [editing, setEditing] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    db().from('wa_knowledge').select('*').order('created_at', { ascending: false })
      .then(({ data, error }: any) => {
        if (error) toast.error(error.message)
        else setRows(data as Knowledge[])
      })
  }, [])
  useEffect(load, [load])

  async function save() {
    if (!form.title.trim() || !form.body.trim()) return toast.error('Title and answer are required')
    setSaving(true)
    const payload = {
      title: form.title.trim(),
      body: form.body.trim(),
      keywords: form.keywords.split(',').map(k => k.trim().toLowerCase()).filter(Boolean),
      flow: form.flow,
      updated_at: new Date().toISOString(),
    }
    const { data: { user } } = await createClient().auth.getUser()
    const res = editing
      ? await db().from('wa_knowledge').update(payload).eq('id', editing)
      : await db().from('wa_knowledge').insert({ ...payload, created_by: user?.id ?? null })
    setSaving(false)
    if (res.error) return toast.error(res.error.message)
    toast.success(editing ? 'Updated' : 'Added — the bot uses it within a minute')
    setForm(EMPTY_ENTRY)
    setEditing(null)
    load()
  }

  async function toggle(k: Knowledge) {
    const { error } = await db().from('wa_knowledge').update({ is_active: !k.is_active }).eq('id', k.id)
    if (error) return toast.error(error.message)
    setRows(prev => prev.map(r => (r.id === k.id ? { ...r, is_active: !r.is_active } : r)))
  }

  async function remove(k: Knowledge) {
    if (!confirm(`Delete "${k.title}"?`)) return
    const { error } = await db().from('wa_knowledge').delete().eq('id', k.id)
    if (error) return toast.error(error.message)
    setRows(prev => prev.filter(r => r.id !== k.id))
  }

  return (
    <div className="space-y-4">
      <Card
        title={editing ? 'Edit entry' : 'Teach the bot'}
        hint="With keywords, the bot replies with this answer word for word whenever a student's message contains one — no AI needed. Every active entry is also given to the AI as facts it may use."
      >
        <div className="grid sm:grid-cols-[1fr_160px] gap-3">
          <div>
            <Label className="text-xs">Title</Label>
            <Input value={form.title} placeholder="e.g. NIOS On-Demand exam"
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          </div>
          <div>
            <Label className="text-xs">For</Label>
            <select value={form.flow} onChange={e => setForm(f => ({ ...f, flow: e.target.value as Knowledge['flow'] }))}
              className="w-full h-9 rounded-lg border border-input bg-transparent px-2 text-sm">
              <option value="any">Both flows</option>
              <option value="school">Open School (10th/12th)</option>
              <option value="college">College (UG/PG)</option>
            </select>
          </div>
        </div>
        <div>
          <Label className="text-xs">Answer the bot should give</Label>
          <Textarea rows={4} value={form.body}
            placeholder="Write it the way a counsellor would say it on WhatsApp. Avoid promises and exact fees or dates."
            onChange={e => setForm(f => ({ ...f, body: e.target.value }))} />
        </div>
        <div>
          <Label className="text-xs">Keywords (comma separated, optional)</Label>
          <Input value={form.keywords} placeholder="on demand, ode, on-demand exam"
            onChange={e => setForm(f => ({ ...f, keywords: e.target.value }))} />
        </div>
        <div className="flex justify-end gap-2">
          {editing && (
            <Button variant="outline" onClick={() => { setEditing(null); setForm(EMPTY_ENTRY) }}>
              <X className="w-4 h-4 mr-1" /> Cancel
            </Button>
          )}
          <Button onClick={save} disabled={saving}>
            <Save className="w-4 h-4 mr-1" /> {saving ? 'Saving…' : editing ? 'Update' : 'Add'}
          </Button>
        </div>
      </Card>

      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm divide-y">
        {rows.length === 0 && <p className="p-6 text-sm text-gray-400 text-center">Nothing taught yet.</p>}
        {rows.map(k => (
          <div key={k.id} className={`p-4 flex gap-3 ${k.is_active ? '' : 'opacity-50'}`}>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-gray-900">{k.title}</p>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{FLOW_LABEL[k.flow]}</span>
                {k.keywords.map(w => (
                  <span key={w} className="text-[10px] px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">{w}</span>
                ))}
              </div>
              <p className="text-sm text-gray-600 mt-1 whitespace-pre-line">{k.body}</p>
            </div>
            <div className="flex items-start gap-1 shrink-0">
              <Switch checked={k.is_active} onCheckedChange={() => toggle(k)} />
              <Button variant="ghost" size="sm" title="Edit"
                onClick={() => { setEditing(k.id); setForm({ title: k.title, body: k.body, keywords: k.keywords.join(', '), flow: k.flow }) }}>
                <Pencil className="w-4 h-4 text-blue-500" />
              </Button>
              <Button variant="ghost" size="sm" title="Delete" onClick={() => remove(k)}>
                <Trash2 className="w-4 h-4 text-red-500" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ============================================================ outreach ===

function OutreachPanel() {
  const [rows, setRows] = useState<OutreachRow[]>([])
  const [limit, setLimit] = useState<number | null>(null)
  const [statuses, setStatuses] = useState<string[]>(['dnp', 'not_reachable', 'switch_off', 'contacted', 'interested'])
  const [sources, setSources] = useState<string[]>([])
  const [olderThanDays, setOlderThanDays] = useState(7)
  const [maxCount, setMaxCount] = useState(50)
  const [campaign, setCampaign] = useState('')
  const [preview, setPreview] = useState<{ id: string; full_name: string; phone: string }[] | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const [q, s] = await Promise.all([
      db().from('wa_outreach').select('*').order('queued_at', { ascending: false }).limit(300),
      db().from('wa_bot_settings').select('outreach_daily_limit').maybeSingle(),
    ])
    if (q.error) toast.error(q.error.message)
    else setRows(q.data as OutreachRow[])
    setLimit(s.data?.outreach_daily_limit ?? null)
  }, [])
  useEffect(() => { load() }, [load])

  const counts = useMemo(() => {
    const c: Record<string, number> = { queued: 0, sent: 0, replied: 0, failed: 0, skipped: 0 }
    for (const r of rows) c[r.status]++
    return c
  }, [rows])
  const todayKey = format(new Date(), 'yyyy-MM-dd')
  const sentToday = rows.filter(r => r.sent_at && format(parseISO(r.sent_at), 'yyyy-MM-dd') === todayKey).length

  const toggleIn = (list: string[], v: string) => (list.includes(v) ? list.filter(x => x !== v) : [...list, v])

  /** Leads matching the filters, minus anyone who must not be messaged. */
  async function findLeads() {
    setBusy(true)
    try {
      const before = new Date(Date.now() - olderThanDays * 86400e3).toISOString()
      let q = db().from('leads')
        .select('id, full_name, phone, phone_last10, status')
        .not('phone_last10', 'is', null)
        .not('status', 'in', `(${NEVER_OUTREACH.join(',')})`)
        .lte('updated_at', before)
        .order('updated_at', { ascending: false })
        .limit(Math.min(maxCount * 3, 1000))
      if (statuses.length) q = q.in('status', statuses)
      if (sources.length) q = q.in('source', sources)
      const { data: leads, error } = await q
      if (error) throw error

      const phones = [...new Set((leads ?? []).map((l: any) => l.phone_last10))] as string[]
      const since = new Date(Date.now() - RECONTACT_DAYS * 86400e3).toISOString()
      const blocked = new Set<string>()
      for (let i = 0; i < phones.length; i += 200) {
        const chunk = phones.slice(i, i + 200)
        const [recent, queued, chats] = await Promise.all([
          db().from('wa_outreach').select('phone').in('phone', chunk).gte('queued_at', since),
          db().from('wa_outreach').select('phone').in('phone', chunk).eq('status', 'queued'),
          db().from('wa_conversations').select('phone').in('phone', chunk.map(p => `91${p}`)),
        ])
        for (const r of [...(recent.data ?? []), ...(queued.data ?? [])]) blocked.add(r.phone)
        // Anyone who has ever chatted with the bot is followed up by a person, not a cold opener.
        for (const r of chats.data ?? []) blocked.add(String(r.phone).slice(-10))
      }
      const seen = new Set<string>()
      const picked = (leads ?? []).filter((l: any) => {
        if (blocked.has(l.phone_last10) || seen.has(l.phone_last10)) return false
        seen.add(l.phone_last10)
        return true
      }).slice(0, maxCount).map((l: any) => ({ id: l.id, full_name: l.full_name, phone: l.phone_last10 }))
      setPreview(picked)
    } catch (e: any) {
      toast.error(e.message ?? 'Could not load leads')
    } finally {
      setBusy(false)
    }
  }

  async function queue() {
    if (!preview?.length) return
    setBusy(true)
    const { data: { user } } = await createClient().auth.getUser()
    const payload = preview.map(l => ({
      lead_id: l.id, phone: l.phone, name: l.full_name,
      campaign: campaign.trim() || null, queued_by: user?.id ?? null,
    }))
    const { error } = await db().from('wa_outreach').insert(payload)
    setBusy(false)
    if (error) return toast.error(error.message)
    toast.success(`${payload.length} leads queued`)
    setPreview(null)
    load()
  }

  async function clearQueue() {
    if (!confirm(`Remove all ${counts.queued} queued leads? Nothing already sent is affected.`)) return
    const { error } = await db().from('wa_outreach').delete().eq('status', 'queued')
    if (error) return toast.error(error.message)
    toast.success('Queue cleared')
    load()
  }

  const daysLeft = limit ? Math.ceil(counts.queued / limit) : null

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {([
          ['Sent today', `${sentToday}${limit != null ? ` / ${limit}` : ''}`],
          ['In queue', counts.queued],
          ['Replied', counts.replied],
          ['Sent', counts.sent + counts.replied],
          ['Skipped / failed', counts.skipped + counts.failed],
        ] as const).map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            <p className="text-xs text-gray-500">{label}</p>
          </div>
        ))}
      </div>

      <Card
        title="Add leads to the queue"
        hint={`Leaves out converted leads, anyone already queued or messaged in the last ${RECONTACT_DAYS} days, and anyone who has chatted with the bot. Turn sending on in Settings.`}
      >
        <div>
          <Label className="text-xs">Lead status</Label>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {Object.entries(LEAD_STATUS_LABELS).filter(([k]) => !NEVER_OUTREACH.includes(k)).map(([k, v]) => (
              <button key={k} onClick={() => setStatuses(s => toggleIn(s, k))}
                className={`text-xs px-2.5 py-1 rounded-full border ${statuses.includes(k) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200'}`}>
                {v}
              </button>
            ))}
          </div>
        </div>
        <div>
          <Label className="text-xs">Source (none selected = all)</Label>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {Object.entries(LEAD_SOURCE_LABELS).map(([k, v]) => (
              <button key={k} onClick={() => setSources(s => toggleIn(s, k))}
                className={`text-xs px-2.5 py-1 rounded-full border ${sources.includes(k) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200'}`}>
                {v}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">Not touched for at least (days)</Label>
            <Input type="number" value={olderThanDays} onChange={e => setOlderThanDays(Math.max(0, Number(e.target.value) || 0))} />
          </div>
          <div>
            <Label className="text-xs">How many leads</Label>
            <Input type="number" value={maxCount} onChange={e => setMaxCount(Math.min(500, Math.max(1, Number(e.target.value) || 1)))} />
          </div>
          <div>
            <Label className="text-xs">Campaign name (optional)</Label>
            <Input value={campaign} placeholder="e.g. NIOS Oct follow-up" onChange={e => setCampaign(e.target.value)} />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {preview && (
            <p className="text-sm text-gray-600 mr-auto">
              <b>{preview.length}</b> leads match{limit ? ` — about ${Math.ceil((preview.length + counts.queued) / limit)} days at ${limit}/day` : ''}.
            </p>
          )}
          <Button variant="outline" onClick={findLeads} disabled={busy}>Find leads</Button>
          <Button onClick={queue} disabled={busy || !preview?.length}>
            <Send className="w-4 h-4 mr-1" /> Queue {preview?.length ?? ''}
          </Button>
        </div>
        {preview && preview.length > 0 && (
          <div className="max-h-48 overflow-y-auto rounded-xl border text-xs divide-y">
            {preview.map(l => (
              <div key={l.id} className="px-3 py-1.5 flex justify-between">
                <span className="truncate">{l.full_name}</span>
                <span className="text-gray-400 font-mono">{l.phone}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between p-4 border-b">
          <p className="font-bold text-gray-900">
            Recent{daysLeft ? <span className="font-normal text-gray-500 text-sm"> · queue lasts ~{daysLeft} day{daysLeft > 1 ? 's' : ''}</span> : null}
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={load}><RefreshCw className="w-4 h-4" /></Button>
            {counts.queued > 0 && (
              <Button variant="outline" size="sm" onClick={clearQueue}>
                <Trash2 className="w-4 h-4 mr-1 text-red-500" /> Clear queue
              </Button>
            )}
          </div>
        </div>
        <div className="divide-y max-h-[480px] overflow-y-auto">
          {rows.length === 0 && <p className="p-6 text-sm text-gray-400 text-center">Nothing queued yet.</p>}
          {rows.map(r => (
            <div key={r.id} className="px-4 py-2.5 flex items-center gap-3 text-sm">
              <div className="flex-1 min-w-0">
                <p className="truncate text-gray-900">{r.name ?? r.phone}</p>
                <p className="text-[11px] text-gray-400">
                  {r.phone}{r.campaign ? ` · ${r.campaign}` : ''}{r.error ? ` · ${r.error}` : ''}
                </p>
              </div>
              <span className="text-[11px] text-gray-400 hidden sm:block">
                {format(parseISO(r.replied_at ?? r.sent_at ?? r.queued_at), 'dd MMM, h:mm a')}
              </span>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${OUTREACH_STYLE[r.status]}`}>{r.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
