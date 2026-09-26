import Link from 'next/link'
import { createServerClient } from '@/lib/supabase/server'
import { asLoose } from '@/lib/bb/db'
import { inr, inrShort, STAGE_STYLE, APPLICATION_STAGES, CANDIDATE_STATUS_STYLE } from '@/lib/bb/constants'
import {
  Building2, BriefcaseBusiness, Users, BadgeCheck,
  IndianRupee, AlertTriangle, PhoneCall, ArrowRight,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'

/* eslint-disable @typescript-eslint/no-explicit-any */

export const dynamic = 'force-dynamic'

function todayIST(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())
}

export default async function BbDashboard() {
  const supabase = await createServerClient()
  const db = asLoose(supabase)
  const today = todayIST()

  const count = (table: string, build?: (q: any) => any) => {
    const q = db.from(table).select('*', { count: 'exact', head: true })
    return build ? build(q) : q
  }

  const [
    companies, openJobs, candidates, activePlacements,
    invoices, followups, recentPlacements, stageRows,
  ] = await Promise.all([
    count('bb_companies', (q: any) => q.eq('status', 'active')),
    count('bb_jobs', (q: any) => q.eq('status', 'open')),
    count('bb_candidates'),
    count('bb_placements', (q: any) => q.eq('status', 'active')),
    db.from('bb_commission_invoices').select('amount, amount_received, status, due_date'),
    db.from('bb_candidates')
      .select('id, full_name, phone, status, next_followup_date')
      .lte('next_followup_date', today)
      .not('next_followup_date', 'is', null)
      .order('next_followup_date', { ascending: true })
      .limit(8),
    db.from('bb_placements')
      .select('id, joined_on, offered_salary, total_commission, bb_candidates(full_name), bb_companies(name)')
      .order('joined_on', { ascending: false })
      .limit(6),
    db.from('bb_applications').select('stage'),
  ])

  type Invoice = { amount: number; amount_received: number; status: string; due_date: string }
  const invoiceRows = (invoices.data ?? []) as Invoice[]

  // Booked is everything billable that exists; received is money actually in.
  // Overdue is the one that should make somebody pick up the phone.
  const booked = invoiceRows.reduce((s, i) => s + Number(i.amount), 0)
  const received = invoiceRows.reduce((s, i) => s + Number(i.amount_received), 0)
  const overdue = invoiceRows
    .filter(i => i.status !== 'paid' && i.status !== 'written_off' && i.due_date < today)
    .reduce((s, i) => s + (Number(i.amount) - Number(i.amount_received)), 0)

  const stageCounts = ((stageRows.data ?? []) as { stage: string }[]).reduce<Record<string, number>>(
    (acc, r) => ({ ...acc, [r.stage]: (acc[r.stage] ?? 0) + 1 }),
    {}
  )
  const pipelineMax = Math.max(1, ...APPLICATION_STAGES.map(s => stageCounts[s] ?? 0))

  const tiles = [
    { label: 'Active companies', value: companies.count ?? 0, icon: Building2, tone: 'text-blue-600 bg-blue-50', href: '/bb/companies' },
    { label: 'Open jobs', value: openJobs.count ?? 0, icon: BriefcaseBusiness, tone: 'text-violet-600 bg-violet-50', href: '/bb/jobs' },
    { label: 'Candidates', value: candidates.count ?? 0, icon: Users, tone: 'text-cyan-600 bg-cyan-50', href: '/bb/candidates' },
    { label: 'Active placements', value: activePlacements.count ?? 0, icon: BadgeCheck, tone: 'text-emerald-600 bg-emerald-50', href: '/bb/placements' },
  ]

  const placements = (recentPlacements.data ?? []) as any[]
  const dueList = (followups.data ?? []) as any[]

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">{format(parseISO(today), 'EEEE, dd MMMM yyyy')}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {tiles.map(t => (
          <Link
            key={t.label}
            href={t.href}
            className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md hover:border-gray-300 transition-all"
          >
            <span className={`inline-flex w-9 h-9 rounded-xl items-center justify-center ${t.tone}`}>
              <t.icon className="w-[18px] h-[18px]" />
            </span>
            <p className="text-2xl font-bold text-gray-900 mt-3 tabular-nums">{t.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{t.label}</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: 'Commission booked', value: booked, icon: IndianRupee, tone: 'text-gray-900', sub: 'All invoices raised or scheduled' },
          { label: 'Received', value: received, icon: BadgeCheck, tone: 'text-green-700', sub: `${booked > 0 ? Math.round((received / booked) * 100) : 0}% collected` },
          { label: 'Overdue', value: overdue, icon: AlertTriangle, tone: overdue > 0 ? 'text-red-600' : 'text-gray-400', sub: 'Past due date, still unpaid' },
        ].map(m => (
          <div key={m.label} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{m.label}</p>
              <m.icon className={`w-4 h-4 ${m.tone}`} />
            </div>
            <p className={`text-3xl font-bold mt-2 tabular-nums ${m.tone}`}>{inrShort(m.value)}</p>
            <p className="text-xs text-gray-500 mt-1">{m.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-gray-900">Pipeline</h2>
            <Link href="/bb/pipeline" className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 inline-flex items-center gap-1">
              Open board <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="mt-4 space-y-2.5">
            {APPLICATION_STAGES.map(stage => {
              const n = stageCounts[stage] ?? 0
              const style = STAGE_STYLE[stage]
              return (
                <div key={stage} className="flex items-center gap-3">
                  <span className="w-24 shrink-0 text-xs font-medium text-gray-600">{style.label}</span>
                  <div className="flex-1 h-6 rounded-lg bg-gray-100 overflow-hidden">
                    <div
                      className={`h-full ${style.dot} transition-all`}
                      style={{ width: `${Math.max(n > 0 ? 6 : 0, (n / pipelineMax) * 100)}%` }}
                    />
                  </div>
                  <span className="w-8 text-right text-sm font-bold text-gray-900 tabular-nums">{n}</span>
                </div>
              )
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-gray-900">Follow-ups due</h2>
            <Link href="/bb/candidates" className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 inline-flex items-center gap-1">
              All candidates <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {dueList.length === 0 ? (
            <p className="text-sm text-gray-500 py-8 text-center">Nothing due today. Clean slate.</p>
          ) : (
            <ul className="mt-3 divide-y divide-gray-100">
              {dueList.map(c => {
                const st = CANDIDATE_STATUS_STYLE[c.status] ?? CANDIDATE_STATUS_STYLE.new
                const late = c.next_followup_date < today
                return (
                  <li key={c.id} className="py-2.5 flex items-center gap-3">
                    <PhoneCall className={`w-4 h-4 shrink-0 ${late ? 'text-red-500' : 'text-gray-300'}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900 truncate">{c.full_name}</p>
                      <p className="text-xs text-gray-500">{c.phone}</p>
                    </div>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                    <span className={`text-xs tabular-nums ${late ? 'text-red-600 font-semibold' : 'text-gray-400'}`}>
                      {format(parseISO(c.next_followup_date), 'dd MMM')}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">Recent placements</h2>
          <Link href="/bb/placements" className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 inline-flex items-center gap-1">
            All placements <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {placements.length === 0 ? (
          <p className="p-8 text-center text-sm text-gray-500">
            No placements yet. They appear here the moment a candidate joins.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-5 py-2 font-semibold">Candidate</th>
                  <th className="px-5 py-2 font-semibold">Company</th>
                  <th className="px-5 py-2 font-semibold">Joined</th>
                  <th className="px-5 py-2 font-semibold text-right">Salary</th>
                  <th className="px-5 py-2 font-semibold text-right">Commission</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {placements.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-5 py-2.5 font-semibold text-gray-900">{p.bb_candidates?.full_name ?? '—'}</td>
                    <td className="px-5 py-2.5 text-gray-600">{p.bb_companies?.name ?? '—'}</td>
                    <td className="px-5 py-2.5 text-gray-600">{format(parseISO(p.joined_on), 'dd MMM yyyy')}</td>
                    <td className="px-5 py-2.5 text-right tabular-nums text-gray-600">{inr(p.offered_salary)}</td>
                    <td className="px-5 py-2.5 text-right tabular-nums font-semibold text-emerald-700">{inr(p.total_commission)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
