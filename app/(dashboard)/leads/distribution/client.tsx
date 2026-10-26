'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  Plus, Pencil, Trash2, ArrowUp, ArrowDown, Users, FileText, Radio, Star, Loader2,
  AlertTriangle, ChevronLeft, Building2, Inbox,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { createClient } from '@/lib/supabase/client'
import { LEAD_SOURCE_LABELS, type LeadSource } from '@/types/app.types'

/* eslint-disable @typescript-eslint/no-explicit-any */

// Lead distribution (migration 123): each team owns forms/campaigns and
// sources; lib/leads/ingest.ts hands a new lead to the first team that
// claims it and round-robins it among that team's members only.

interface Team {
  id: string
  name: string
  department_id: string | null
  member_ids: string[]
  forms: string[]
  sources: string[]
  is_default: boolean
  is_active: boolean
  sort_order: number
}
type Draft = Omit<Team, 'id' | 'sort_order'> & { id?: string }
interface Person { id: string; full_name: string; role: string }
interface Dept { id: string; name: string }

const db = () => createClient() as any
const norm = (v: string) => v.trim().toLowerCase()

// IVR calls always go to the counsellor who took the call, so a team can't claim them.
const ROUTABLE_SOURCES = (Object.keys(LEAD_SOURCE_LABELS) as LeadSource[]).filter(s => s !== 'ivr')

const emptyDraft = (): Draft => ({
  name: '', department_id: null, member_ids: [], forms: [], sources: [], is_default: false, is_active: true,
})

function startOfTodayIst() {
  const nowIst = new Date(Date.now() + 5.5 * 3600 * 1000)
  return new Date(Date.UTC(nowIst.getUTCFullYear(), nowIst.getUTCMonth(), nowIst.getUTCDate()) - 5.5 * 3600 * 1000)
}
function startOfMonthIst() {
  const nowIst = new Date(Date.now() + 5.5 * 3600 * 1000)
  return new Date(Date.UTC(nowIst.getUTCFullYear(), nowIst.getUTCMonth(), 1) - 5.5 * 3600 * 1000)
}

export function LeadDistributionClient() {
  const [teams, setTeams] = useState<Team[]>([])
  const [people, setPeople] = useState<Person[]>([])
  const [depts, setDepts] = useState<Dept[]>([])
  const [knownForms, setKnownForms] = useState<string[]>([])
  // team id → member id → { today, month }
  const [stats, setStats] = useState<Record<string, Record<string, { today: number; month: number }>>>({})
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Team | null>(null)

  const load = useCallback(async () => {
    const monthStart = startOfMonthIst().toISOString()
    const todayStart = startOfTodayIst().getTime()
    const [teamsRes, peopleRes, deptRes, formsRes, leadFormsRes, routedRes] = await Promise.all([
      db().from('lead_teams').select('*').order('sort_order').order('created_at'),
      db().from('profiles').select('id, full_name, role').in('role', ['lead', 'telecaller', 'counselor']).eq('is_active', true).order('full_name'),
      db().from('departments').select('id, name').eq('is_active', true).order('name'),
      db().from('lead_capture_forms').select('title').order('title'),
      // Forms seen on recent leads too: WhatsApp Chatbot, older form titles…
      db().from('leads').select('form:metadata->>form').not('metadata->>form', 'is', null).order('created_at', { ascending: false }).limit(3000),
      db().from('leads').select('team:metadata->>lead_team_id, assigned_to, assigned_at').not('metadata->>lead_team_id', 'is', null).gte('assigned_at', monthStart).limit(20000),
    ])
    if (teamsRes.error) {
      toast.error(teamsRes.error.code === '42P01'
        ? 'Run migration 123_lead_teams.sql in Supabase first'
        : teamsRes.error.message)
    }
    setTeams((teamsRes.data ?? []) as Team[])
    setPeople((peopleRes.data ?? []) as Person[])
    setDepts((deptRes.data ?? []) as Dept[])

    const forms = new Map<string, string>()
    for (const r of [...(formsRes.data ?? []).map((x: any) => x.title), ...(leadFormsRes.data ?? []).map((x: any) => x.form)]) {
      if (typeof r === 'string' && r.trim() && !forms.has(norm(r))) forms.set(norm(r), r.trim())
    }
    setKnownForms([...forms.values()].sort((a, b) => a.localeCompare(b)))

    const s: Record<string, Record<string, { today: number; month: number }>> = {}
    for (const r of (routedRes.data ?? []) as { team: string; assigned_to: string | null; assigned_at: string }[]) {
      if (!r.team || !r.assigned_to) continue
      const t = (s[r.team] ??= {})
      const m = (t[r.assigned_to] ??= { today: 0, month: 0 })
      m.month++
      if (new Date(r.assigned_at).getTime() >= todayStart) m.today++
    }
    setStats(s)
    setLoading(false)
  }, [])
  useEffect(() => { void Promise.resolve().then(load) }, [load])

  const personName = (id: string) => people.find(p => p.id === id)?.full_name ?? 'Inactive user'
  const deptName = (id: string | null) => depts.find(d => d.id === id)?.name ?? null
  const defaultTeam = teams.find(t => t.is_default && t.is_active)

  // Which team each form and source currently goes to (first active match wins).
  const ownerOfForm = useCallback((form: string, except?: string) =>
    teams.find(t => t.is_active && t.id !== except && t.forms.some(f => norm(f) === norm(form))), [teams])
  const ownerOfSource = useCallback((src: string, except?: string) =>
    teams.find(t => t.is_active && t.id !== except && t.sources.includes(src)), [teams])

  const unclaimedForms = useMemo(() => knownForms.filter(f => !ownerOfForm(f)), [knownForms, ownerOfForm])

  async function save() {
    if (!draft) return
    const name = draft.name.trim()
    if (!name) return toast.error('Enter a team name')
    if (draft.member_ids.length === 0) return toast.error('Add at least one counsellor to the team')
    if (!draft.is_default && draft.forms.length === 0 && draft.sources.length === 0) {
      return toast.error('Choose at least one form/campaign or source — or make this the default team')
    }
    setSaving(true)
    try {
      // Only one default team: clear the old one first.
      if (draft.is_default) {
        const { error } = await db().from('lead_teams').update({ is_default: false }).eq('is_default', true).neq('id', draft.id ?? '00000000-0000-0000-0000-000000000000')
        if (error) throw error
      }
      const { data: { user } } = await db().auth.getUser()
      const payload = {
        name, department_id: draft.department_id, member_ids: draft.member_ids,
        forms: draft.forms, sources: draft.sources, is_default: draft.is_default, is_active: draft.is_active,
      }
      const { error } = draft.id
        ? await db().from('lead_teams').update(payload).eq('id', draft.id)
        : await db().from('lead_teams').insert({
            ...payload, created_by: user?.id ?? null,
            sort_order: teams.reduce((m, t) => Math.max(m, t.sort_order), 0) + 1,
          })
      if (error) throw error
      toast.success('Saved — new leads follow this right away')
      setDraft(null)
      load()
    } catch (e: any) {
      toast.error(e?.message ?? 'Could not save the team')
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(t: Team) {
    const { error } = await db().from('lead_teams').update({ is_active: !t.is_active }).eq('id', t.id)
    if (error) toast.error(error.message)
    else load()
  }

  async function move(t: Team, dir: -1 | 1) {
    const i = teams.findIndex(x => x.id === t.id)
    const other = teams[i + dir]
    if (!other) return
    // Renumber the whole list so equal sort_orders can't leave the swap a no-op.
    const order = [...teams]
    ;[order[i], order[i + dir]] = [order[i + dir], order[i]]
    const results = await Promise.all(order.map((x, idx) => db().from('lead_teams').update({ sort_order: idx + 1 }).eq('id', x.id)))
    const failed = results.find((r: any) => r.error)
    if (failed) toast.error(failed.error.message)
    load()
  }

  async function remove(t: Team) {
    const { error } = await db().from('lead_teams').delete().eq('id', t.id)
    setDeleteTarget(null)
    if (error) return toast.error(error.message)
    toast.success('Team deleted')
    load()
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/leads" className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 mb-1">
            <ChevronLeft className="w-3.5 h-3.5" /> Leads
          </Link>
          <h1 className="text-xl font-bold text-gray-900">Lead Distribution</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Send each form or campaign to its own team, so every department gets only its own leads.
          </p>
        </div>
        <Button size="sm" className="h-9 gap-1.5" onClick={() => setDraft(emptyDraft())}>
          <Plus className="w-4 h-4" /> New Team
        </Button>
      </div>

      {/* How it works */}
      <div className="grid gap-2 sm:grid-cols-3">
        {[
          { icon: FileText, title: 'A lead comes in', text: 'From a form, campaign, WhatsApp, walk-in or ads.' },
          { icon: Users, title: 'The first matching team claims it', text: 'Teams are checked from top to bottom by form/campaign or source.' },
          { icon: Radio, title: 'Shared equally inside the team', text: 'Round-robin among that team’s counsellors only.' },
        ].map(({ icon: Icon, title, text }, i) => (
          <div key={title} className="flex gap-3 rounded-xl border border-gray-200 bg-white p-3">
            <span className="w-7 h-7 shrink-0 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center text-xs font-bold">{i + 1}</span>
            <div>
              <p className="text-sm font-semibold text-gray-900 flex items-center gap-1.5"><Icon className="w-3.5 h-3.5 text-gray-400" /> {title}</p>
              <p className="text-xs text-gray-500 mt-0.5">{text}</p>
            </div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
      ) : (
        <>
          {teams.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white py-14 text-center">
              <div className="mx-auto w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center mb-3">
                <Users className="w-7 h-7 text-blue-600" />
              </div>
              <p className="font-semibold text-gray-900">No teams yet</p>
              <p className="text-sm text-gray-500 mt-1 mb-5">Right now every new lead is shared among all active counsellors.</p>
              <Button onClick={() => setDraft(emptyDraft())}><Plus className="w-4 h-4 mr-1" /> Create the first team</Button>
            </div>
          ) : (
            <div className="space-y-3">
              {teams.map((t, i) => {
                const teamStats = stats[t.id] ?? {}
                const today = Object.values(teamStats).reduce((n, x) => n + x.today, 0)
                const month = Object.values(teamStats).reduce((n, x) => n + x.month, 0)
                return (
                  <div key={t.id} className={`rounded-2xl border bg-white p-4 shadow-sm ${t.is_active ? 'border-gray-200' : 'border-gray-200 opacity-60'}`}>
                    <div className="flex flex-wrap items-start gap-3">
                      <div className="flex flex-col gap-0.5 pt-0.5">
                        <button disabled={i === 0} onClick={() => move(t, -1)} className="p-0.5 text-gray-400 hover:text-gray-800 disabled:opacity-30" title="Check earlier">
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button disabled={i === teams.length - 1} onClick={() => move(t, 1)} className="p-0.5 text-gray-400 hover:text-gray-800 disabled:opacity-30" title="Check later">
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-bold text-gray-900">{t.name}</p>
                          {t.is_default && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold rounded-full px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200">
                              <Star className="w-3 h-3" /> Default
                            </span>
                          )}
                          {deptName(t.department_id) && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold rounded-full px-2 py-0.5 bg-slate-50 text-slate-600 border border-slate-200">
                              <Building2 className="w-3 h-3" /> {deptName(t.department_id)}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {today} lead{today === 1 ? '' : 's'} today · {month} this month
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Switch checked={t.is_active} onCheckedChange={() => toggleActive(t)} />
                        <Button size="sm" variant="ghost" onClick={() => setDraft({ ...t })}><Pencil className="w-3.5 h-3.5" /></Button>
                        <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-600" onClick={() => setDeleteTarget(t)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>

                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5">Gets leads from</p>
                        <div className="flex flex-wrap gap-1.5">
                          {t.is_default && <Chip tone="amber">Every lead no other team claims</Chip>}
                          {t.forms.map(f => <Chip key={f} tone="blue"><FileText className="w-3 h-3" /> {f}</Chip>)}
                          {t.sources.map(s => <Chip key={s} tone="violet"><Radio className="w-3 h-3" /> {LEAD_SOURCE_LABELS[s as LeadSource] ?? s}</Chip>)}
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5">Counsellors · today / this month</p>
                        <div className="flex flex-wrap gap-1.5">
                          {t.member_ids.map(id => {
                            const st = teamStats[id] ?? { today: 0, month: 0 }
                            const active = people.some(p => p.id === id)
                            return (
                              <Chip key={id} tone={active ? 'gray' : 'red'}>
                                {personName(id)}
                                <span className="tabular-nums text-gray-400">{st.today}/{st.month}</span>
                              </Chip>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}

              {/* Where unclaimed leads go */}
              <div className="flex items-start gap-3 rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-4">
                <Inbox className="w-4 h-4 text-gray-400 mt-0.5" />
                <p className="text-xs text-gray-600">
                  <b className="text-gray-800">Leads no team claims</b> go to{' '}
                  {defaultTeam ? <>the <b>{defaultTeam.name}</b> team (default).</> : <>all active counsellors, shared equally. Mark a team as <b>Default</b> to change this.</>}
                  {' '}IVR calls always stay with the counsellor who took the call.
                </p>
              </div>
            </div>
          )}

          {teams.length > 0 && unclaimedForms.length > 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-amber-900">
                <AlertTriangle className="w-4 h-4" /> {unclaimedForms.length} form{unclaimedForms.length === 1 ? '' : 's'} not in any team
              </p>
              <p className="text-xs text-amber-800 mt-0.5 mb-2">
                Leads from these go to {defaultTeam ? `the ${defaultTeam.name} team` : 'all counsellors'}.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {unclaimedForms.map(f => <Chip key={f} tone="amber">{f}</Chip>)}
              </div>
            </div>
          )}
        </>
      )}

      <Dialog open={!!draft} onOpenChange={o => { if (!o) setDraft(null) }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          {draft && (
            <TeamEditor
              draft={draft} setDraft={setDraft} people={people} depts={depts} knownForms={knownForms}
              ownerOfForm={ownerOfForm} ownerOfSource={ownerOfSource} saving={saving} onSave={save}
              onCancel={() => setDraft(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete this team?"
        description={`New leads for "${deleteTarget?.name}" will go to ${defaultTeam && defaultTeam.id !== deleteTarget?.id ? `the ${defaultTeam.name} team` : 'all counsellors'}. Leads already assigned keep their counsellor.`}
        confirmLabel="Delete"
        destructive
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && remove(deleteTarget)}
      />
    </div>
  )
}

function Chip({ tone, children }: { tone: 'blue' | 'violet' | 'gray' | 'amber' | 'red'; children: React.ReactNode }) {
  const cls = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    violet: 'bg-violet-50 text-violet-700 border-violet-200',
    gray: 'bg-white text-gray-700 border-gray-200',
    amber: 'bg-amber-50 text-amber-800 border-amber-200',
    red: 'bg-red-50 text-red-700 border-red-200',
  }[tone]
  return <span className={`inline-flex items-center gap-1 text-[11px] font-medium rounded-full border px-2 py-0.5 ${cls}`}>{children}</span>
}

function TeamEditor({ draft, setDraft, people, depts, knownForms, ownerOfForm, ownerOfSource, saving, onSave, onCancel }: {
  draft: Draft; setDraft: (d: Draft) => void; people: Person[]; depts: Dept[]; knownForms: string[]
  ownerOfForm: (f: string, except?: string) => Team | undefined
  ownerOfSource: (s: string, except?: string) => Team | undefined
  saving: boolean; onSave: () => void; onCancel: () => void
}) {
  const set = (p: Partial<Draft>) => setDraft({ ...draft, ...p })
  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter(x => x !== v) : [...list, v])
  const [customForm, setCustomForm] = useState('')
  // Forms already saved on this team but no longer seen anywhere still show.
  const formOptions = [...knownForms, ...draft.forms.filter(f => !knownForms.some(k => norm(k) === norm(f)))]

  return (
    <div>
      <DialogHeader>
        <DialogTitle>{draft.id ? 'Edit team' : 'New team'}</DialogTitle>
      </DialogHeader>

      <div className="mt-4 space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Team name *</Label>
            <Input value={draft.name} onChange={e => set({ name: e.target.value })} placeholder="e.g. Open Schooling" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Department (optional)</Label>
            <select
              value={draft.department_id ?? ''}
              onChange={e => set({ department_id: e.target.value || null })}
              className="w-full h-9 rounded-lg border border-input bg-background px-3 text-sm"
            >
              <option value="">None</option>
              {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <p className="text-[11px] text-gray-400">New leads routed here get this department filled in.</p>
          </div>
        </div>

        <Section icon={Users} title="Counsellors" hint="New leads are shared equally among them.">
          {people.length === 0 ? (
            <p className="text-xs text-gray-400">No active counsellors found.</p>
          ) : (
            <div className="grid gap-1.5 sm:grid-cols-2">
              {people.map(p => (
                <CheckRow key={p.id} checked={draft.member_ids.includes(p.id)} onChange={() => set({ member_ids: toggle(draft.member_ids, p.id) })}>
                  {p.full_name}
                </CheckRow>
              ))}
            </div>
          )}
        </Section>

        <Section icon={FileText} title="Forms & campaigns" hint="Leads from these forms go to this team.">
          {formOptions.length === 0 ? (
            <p className="text-xs text-gray-400">No forms seen yet. Add one by name below.</p>
          ) : (
            <div className="grid gap-1.5 sm:grid-cols-2">
              {formOptions.map(f => {
                const owner = ownerOfForm(f, draft.id)
                return (
                  <CheckRow key={f} checked={draft.forms.some(x => norm(x) === norm(f))}
                    onChange={() => set({ forms: draft.forms.some(x => norm(x) === norm(f)) ? draft.forms.filter(x => norm(x) !== norm(f)) : [...draft.forms, f] })}
                    note={owner ? `In ${owner.name}` : undefined}>
                    {f}
                  </CheckRow>
                )
              })}
            </div>
          )}
          <div className="mt-2 flex gap-2">
            <Input value={customForm} onChange={e => setCustomForm(e.target.value)} placeholder="Another form or campaign name, exactly as it appears" className="h-8 text-xs" />
            <Button size="sm" variant="outline" className="h-8" disabled={!customForm.trim()}
              onClick={() => { if (!draft.forms.some(x => norm(x) === norm(customForm))) set({ forms: [...draft.forms, customForm.trim()] }); setCustomForm('') }}>
              Add
            </Button>
          </div>
        </Section>

        <Section icon={Radio} title="Sources (optional)" hint="Claim every lead from a source, e.g. all Google Ads leads. A form match is checked the same way.">
          <div className="grid gap-1.5 sm:grid-cols-3">
            {ROUTABLE_SOURCES.map(s => {
              const owner = ownerOfSource(s, draft.id)
              return (
                <CheckRow key={s} checked={draft.sources.includes(s)} onChange={() => set({ sources: toggle(draft.sources, s) })}
                  note={owner ? `In ${owner.name}` : undefined}>
                  {LEAD_SOURCE_LABELS[s]}
                </CheckRow>
              )
            })}
          </div>
        </Section>

        <div className="space-y-3 rounded-xl border border-gray-200 p-3">
          <label className="flex items-start justify-between gap-3">
            <span>
              <span className="block text-sm font-medium text-gray-800">Default team</span>
              <span className="block text-xs text-gray-500">Also gets every lead that no other team claims. Only one team can be default.</span>
            </span>
            <Switch checked={draft.is_default} onCheckedChange={v => set({ is_default: Boolean(v) })} />
          </label>
          <label className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-gray-800">Active</span>
            <Switch checked={draft.is_active} onCheckedChange={v => set({ is_active: Boolean(v) })} />
          </label>
        </div>

        <p className="text-[11px] text-gray-400">
          If a form is in two teams, the team higher in the list gets it. Changes apply to new leads only; leads already assigned keep their counsellor.
        </p>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={onSave} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Save team
          </Button>
        </div>
      </div>
    </div>
  )
}

function Section({ icon: Icon, title, hint, children }: { icon: React.ElementType; title: string; hint: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-900"><Icon className="w-4 h-4 text-gray-400" /> {title}</p>
      <p className="text-xs text-gray-500 mb-2">{hint}</p>
      {children}
    </div>
  )
}

function CheckRow({ checked, onChange, note, children }: { checked: boolean; onChange: () => void; note?: string; children: React.ReactNode }) {
  return (
    <label className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm cursor-pointer transition ${checked ? 'border-blue-300 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}>
      <input type="checkbox" checked={checked} onChange={onChange} className="h-4 w-4 accent-blue-600" />
      <span className="min-w-0 flex-1 truncate text-gray-800">{children}</span>
      {note && <span className="shrink-0 text-[10px] text-amber-700">{note}</span>}
    </label>
  )
}
