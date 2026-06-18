'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  CheckCircle2, Clock, XCircle, RefreshCw, GraduationCap, IndianRupee,
  TrendingUp, Bell, Users, Wallet, ArrowRight, AlertCircle, Copy,
  UserCheck, BarChart2, ChevronRight, Package, Phone, PhoneCall,
  School, UserCog,
} from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { STUDENT_LIFECYCLE, getLifecycleStage, lifecycleProgress } from '@/components/shared/StudentLifecycle'

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)

const LEAD_STATUS: Record<string, { label: string; color: string }> = {
  new:          { label: 'New',        color: 'bg-blue-100 text-blue-800' },
  contacted:    { label: 'Contacted',  color: 'bg-indigo-100 text-indigo-800' },
  interested:   { label: 'Interested', color: 'bg-blue-100 text-blue-800' },
  not_interested:{ label: 'Not Interested', color: 'bg-gray-100 text-gray-600' },
  follow_up:    { label: 'Follow-up',  color: 'bg-amber-100 text-amber-800' },
  converted:    { label: 'Converted',  color: 'bg-green-100 text-green-800' },
  lost:         { label: 'Lost',       color: 'bg-red-100 text-red-800' },
}

interface Associate {
  id: string; name: string; associate_code: string | null; wallet_balance: number; email: string
}

export default function AssociateClient() {
  const supabase = createClient()
  const db = supabase as any
  const [associate, setAssociate] = useState<Associate | null>(null)
  const [stats, setStats] = useState({ totalLeads: 0, totalStudents: 0, commissionEarned: 0, totalRevenue: 0 })
  const [recentLeads, setRecentLeads] = useState<any[]>([])
  const [recentTxns, setRecentTxns] = useState<any[]>([])
  const [notifications, setNotifications] = useState<any[]>([])
  const [students, setStudents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data: assoc } = await db.from('associates').select('id, name, associate_code, wallet_balance, email').eq('user_id', user.id).single()
    if (!assoc) { setLoading(false); return }
    setAssociate(assoc)

    const STUDENT_FIELDS = `
      id, full_name, total_fee, verification_status, exam_status, result_status,
      enrollment_number, portal_active, admit_card_url,
      sub_section:department_sub_sections(name),
      counsellor:profiles!students_assigned_counsellor_fkey(full_name)
    `

    const [
      leadRes, directRes, assocLeadsRes, txnRes, notifRes,
    ] = await Promise.all([
      supabase.from('leads').select('id, full_name, phone, status, created_at, course:courses(name)').eq('referred_by_associate', assoc.id).order('created_at', { ascending: false }),
      db.from('students').select(STUDENT_FIELDS).eq('referred_by_associate', assoc.id),
      supabase.from('leads').select('id').eq('referred_by_associate', assoc.id),
      db.from('associate_wallet_txns').select('id, type, amount, reason, created_at').eq('associate_id', assoc.id).order('created_at', { ascending: false }).limit(5),
      db.from('associate_notifications').select('id, title, message, type, is_read, created_at').eq('associate_id', assoc.id).order('created_at', { ascending: false }).limit(5),
    ])

    // Students: merge direct + via leads + via associate_code, dedup by id
    const leadIds = ((assocLeadsRes.data ?? []) as any[]).map(l => l.id)
    let viaLeads: any[] = []
    if (leadIds.length > 0) {
      const { data } = await db.from('students').select(STUDENT_FIELDS).in('lead_id', leadIds)
      viaLeads = data ?? []
    }
    let viaCode: any[] = []
    if (assoc.associate_code) {
      const { data } = await db.from('students').select(STUDENT_FIELDS).eq('referred_by_associate', assoc.associate_code)
      viaCode = data ?? []
    }
    const seen = new Set<string>()
    const allStudents = [...(directRes.data ?? []), ...viaLeads, ...viaCode].filter((s: any) => {
      if (seen.has(s.id)) return false; seen.add(s.id); return true
    })

    // Mark dispatched students
    let dispatchMap: Record<string, boolean> = {}
    if (allStudents.length > 0) {
      const { data: disp } = await db.from('student_dispatches').select('student_id, status')
        .in('student_id', allStudents.map((s: any) => s.id)).eq('status', 'delivered')
      ;(disp ?? []).forEach((d: any) => { dispatchMap[d.student_id] = true })
    }
    const studentsWithDispatch = allStudents.map((s: any) => ({ ...s, dispatched: !!dispatchMap[s.id] }))

    const allLeads = (leadRes.data ?? []) as any[]
    const allTxns = (txnRes.data ?? []) as any[]
    const commissionEarned = allTxns.filter((t: any) => t.type === 'credit').reduce((s: number, t: any) => s + t.amount, 0)
    const totalRevenue = studentsWithDispatch.reduce((s: number, st: any) => s + (st.total_fee ?? 0), 0)

    setStudents(studentsWithDispatch)
    setStats({
      totalLeads: allLeads.length,
      totalStudents: studentsWithDispatch.length,
      commissionEarned,
      totalRevenue,
    })
    setRecentLeads(allLeads.slice(0, 6))
    setRecentTxns(allTxns)
    setNotifications((notifRes.data ?? []) as any[])
    setLoading(false)
  }, [supabase, db])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
      </div>
    )
  }
  if (!associate) {
    return (
      <div className="flex items-center justify-center min-h-[400px] text-center">
        <div>
          <p className="font-semibold text-gray-800">Associate profile not found</p>
          <p className="text-sm text-gray-400 mt-1">Contact admin if this is unexpected</p>
        </div>
      </div>
    )
  }

  const unread = notifications.filter(n => !n.is_read).length

  // Board-wise breakdown (NIOS / BBOSE / …)
  const boardBreakdown = Object.entries(
    students.reduce((acc: Record<string, number>, s: any) => {
      const b = s.sub_section?.name ?? 'Unassigned'
      acc[b] = (acc[b] ?? 0) + 1
      return acc
    }, {})
  ).sort((a, b) => b[1] - a[1])

  // Counselor-wise breakdown
  const counselorBreakdown = Object.entries(
    students.reduce((acc: Record<string, number>, s: any) => {
      const c = s.counsellor?.full_name ?? 'Not Assigned'
      acc[c] = (acc[c] ?? 0) + 1
      return acc
    }, {})
  ).sort((a, b) => b[1] - a[1])

  return (
    <div className="space-y-5 max-w-5xl">

      {/* Welcome Banner */}
      <div className="relative bg-gradient-to-br from-gray-900 via-blue-950 to-indigo-900 rounded-2xl p-6 text-white overflow-hidden">
        <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
        <div className="absolute right-6 top-1/2 -translate-y-1/2 opacity-10">
          <BarChart2 className="w-28 h-28" />
        </div>
        <div className="relative flex items-start justify-between flex-wrap gap-4">
          <div>
            <p className="text-blue-300 text-sm font-medium">Welcome back,</p>
            <h1 className="text-2xl font-extrabold mt-0.5">{associate.name}</h1>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              {associate.associate_code && (
                <button
                  onClick={() => { navigator.clipboard.writeText(associate.associate_code!); toast.success('Code copied') }}
                  className="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur-sm text-xs px-3 py-1.5 rounded-full font-mono font-semibold hover:bg-white/30 transition-colors"
                >
                  {associate.associate_code}
                  <Copy className="w-3 h-3 opacity-70" />
                </button>
              )}
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={load} className="border-white/30 text-white bg-white/10 hover:bg-white/20 gap-2">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Total Leads"
          value={stats.totalLeads.toString()}
          sub="Referred by you"
          icon={Users}
          color="blue"
          href="/associate/admissions"
        />
        <StatCard
          label="Total Students"
          value={stats.totalStudents.toString()}
          sub="Converted admissions"
          icon={GraduationCap}
          color="indigo"
          href="/associate/students"
        />
        <StatCard
          label="Commission Earned"
          value={fmt(stats.commissionEarned)}
          sub="Total credits received"
          icon={TrendingUp}
          color="emerald"
          href="/associate/account"
        />
        <StatCard
          label="Total Revenue"
          value={fmt(stats.totalRevenue)}
          sub="From referred students"
          icon={TrendingUp}
          color="emerald"
          href="/associate/students"
        />
      </div>

      {/* Co-ordinator Contact */}
      <div className="bg-gradient-to-r from-emerald-900/80 to-green-900/80 border border-emerald-700/50 rounded-2xl px-5 py-4 flex items-center gap-4">
        <div className="w-10 h-10 bg-emerald-400/20 rounded-xl flex items-center justify-center shrink-0">
          <Phone className="w-5 h-5 text-emerald-300" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 mb-0.5">WhatsApp Co-ordinator</p>
          <p className="text-sm font-bold text-white">DCW Support Team</p>
          <p className="text-xs font-mono text-emerald-300">+91 99395 87009</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <a href="tel:+919939587009"
            className="flex items-center gap-1 bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-semibold px-3 py-1.5 rounded-xl transition-colors">
            <PhoneCall className="h-3.5 w-3.5" /> Call
          </a>
          <a href="https://wa.me/919939587009" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-semibold px-3 py-1.5 rounded-xl transition-colors">
            <Phone className="h-3.5 w-3.5" /> WhatsApp
          </a>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-4 md:grid-cols-7 gap-2.5">
        {[
          { label: 'Add Lead',    href: '/associate/admissions?new=1',icon: Users,         color: 'text-blue-600',    bg: 'bg-blue-50' },
          { label: 'My Students', href: '/associate/students',         icon: GraduationCap, color: 'text-indigo-600',  bg: 'bg-indigo-50' },
          { label: 'Accounts',    href: '/associate/account',          icon: IndianRupee,   color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Dispatch',    href: '/associate/dispatch',         icon: Package,       color: 'text-blue-600',  bg: 'bg-blue-50' },
          { label: 'Resources',   href: '/associate/resources',        icon: BarChart2,     color: 'text-orange-600',  bg: 'bg-orange-50' },
          { label: 'Support',     href: '/associate/support',          icon: AlertCircle,   color: 'text-rose-600',    bg: 'bg-rose-50' },
          { label: 'Profile',     href: '/associate/profile',          icon: UserCheck,     color: 'text-gray-600',    bg: 'bg-gray-100' },
        ].map(({ label, href, icon: Icon, color, bg }) => (
          <Link
            key={href}
            href={href}
            className="bg-white border border-gray-100 rounded-xl p-3 flex flex-col items-center gap-1.5 hover:shadow-md hover:border-gray-200 transition-all text-center"
          >
            <div className={`w-9 h-9 ${bg} rounded-lg flex items-center justify-center`}>
              <Icon className={`h-4 w-4 ${color}`} />
            </div>
            <span className="text-[10px] font-semibold text-gray-600 leading-tight">{label}</span>
          </Link>
        ))}
      </div>

      {/* Board + Counselor breakdown */}
      {students.length > 0 && (
        <div className="grid md:grid-cols-2 gap-4">
          {/* Board-wise */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3.5 border-b border-gray-50">
              <School className="h-4 w-4 text-blue-500" />
              <span className="font-semibold text-gray-900 text-sm">Students by Board</span>
            </div>
            <div className="p-4 flex flex-wrap gap-2">
              {boardBreakdown.map(([board, count]) => (
                <div key={board} className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2">
                  <span className="text-sm font-bold text-blue-700">{board}</span>
                  <span className="text-xs font-bold bg-blue-600 text-white rounded-full px-2 py-0.5">{count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Counselor-wise */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3.5 border-b border-gray-50">
              <UserCog className="h-4 w-4 text-blue-500" />
              <span className="font-semibold text-gray-900 text-sm">Counselors Attached</span>
            </div>
            <div className="p-4 flex flex-wrap gap-2">
              {counselorBreakdown.map(([cName, count]) => (
                <div key={cName} className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2">
                  <span className="text-sm font-semibold text-blue-700">{cName}</span>
                  <span className="text-xs font-bold bg-blue-600 text-white rounded-full px-2 py-0.5">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Students Progress (lifecycle) */}
      {students.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-50">
            <div className="flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-emerald-500" />
              <span className="font-semibold text-gray-900 text-sm">Students Progress</span>
            </div>
            <Link href="/associate/students" className="text-xs text-blue-600 hover:underline flex items-center gap-1 font-medium">
              View all <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {students.slice(0, 6).map((s: any) => {
              const done = getLifecycleStage(s)
              const { pct } = lifecycleProgress(s)
              return (
                <div key={s.id} className="px-5 py-3">
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <p className="text-sm font-semibold text-gray-900">{s.full_name}</p>
                    {s.sub_section?.name && (
                      <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{s.sub_section.name}</span>
                    )}
                    {s.counsellor?.full_name && (
                      <span className="text-[10px] text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full">{s.counsellor.full_name}</span>
                    )}
                    <span className="ml-auto text-[10px] font-bold text-emerald-600">{pct}%</span>
                  </div>
                  {/* Mini lifecycle dots */}
                  <div className="flex items-center gap-1">
                    {STUDENT_LIFECYCLE.map((step) => (
                      <div key={step.key} className="flex-1 flex flex-col items-center gap-1">
                        <div className={`w-full h-1.5 rounded-full ${done[step.key] ? 'bg-emerald-500' : 'bg-gray-200'}`} title={step.label} />
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Content Grid */}
      <div className="grid lg:grid-cols-2 gap-4">

        {/* Recent Leads */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-50">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-500" />
              <span className="font-semibold text-gray-900 text-sm">Recent Leads</span>
            </div>
            <Link href="/associate/admissions" className="text-xs text-blue-600 hover:underline flex items-center gap-1 font-medium">
              View all <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          {recentLeads.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <Users className="w-10 h-10 mx-auto mb-3 text-gray-200" />
              <p className="text-sm font-medium text-gray-400">No referrals yet</p>
              <p className="text-xs text-gray-300 mt-1">Add a lead to get started</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {recentLeads.map((l: any) => {
                const st = LEAD_STATUS[l.status] ?? LEAD_STATUS['new']!
                return (
                  <div key={l.id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{l.full_name}</p>
                      <p className="text-xs text-gray-400">{l.course?.name ?? '—'} · {l.phone}</p>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-1 rounded-full ml-3 whitespace-nowrap ${st.color}`}>
                      {st.label}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
          <div className="px-5 py-3 border-t border-gray-50">
            <Link href="/associate/admissions?new=1" className="w-full flex items-center justify-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors">
              + Add New Lead
            </Link>
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-50">
            <div className="flex items-center gap-2">
              <IndianRupee className="h-4 w-4 text-emerald-500" />
              <span className="font-semibold text-gray-900 text-sm">Recent Transactions</span>
            </div>
            <Link href="/associate/account" className="text-xs text-blue-600 hover:underline flex items-center gap-1 font-medium">
              View all <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          {recentTxns.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <Wallet className="w-10 h-10 mx-auto mb-3 text-gray-200" />
              <p className="text-sm font-medium text-gray-400">No transactions yet</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {recentTxns.map((t: any) => (
                <div key={t.id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{t.reason ?? 'Transaction'}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(t.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  <span className={`font-bold text-sm font-mono ml-3 ${t.type === 'credit' ? 'text-emerald-600' : 'text-red-500'}`}>
                    {t.type === 'credit' ? '+' : '-'}{fmt(t.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Latest Updates */}
      {notifications.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-50">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-indigo-500" />
              <span className="font-semibold text-gray-900 text-sm">Latest Updates</span>
              {unread > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{unread}</span>
              )}
            </div>
            <Link href="/associate/notifications" className="text-xs text-blue-600 hover:underline flex items-center gap-1 font-medium">
              See all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {notifications.map((n: any) => (
              <div key={n.id} className={`px-5 py-3 flex gap-3 items-start ${!n.is_read ? 'bg-blue-50/40' : 'hover:bg-gray-50'} transition-colors`}>
                <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${n.type === 'urgent' ? 'bg-red-500' : n.type === 'success' ? 'bg-emerald-500' : 'bg-blue-500'}`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${!n.is_read ? 'text-gray-900' : 'text-gray-600'}`}>{n.title}</p>
                  {n.message && <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{n.message}</p>}
                </div>
                <p className="text-[10px] text-gray-300 shrink-0 mt-0.5 font-medium">
                  {new Date(n.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, sub, icon: Icon, color, href }: {
  label: string; value: string; sub: string; icon: any;
  color: 'blue' | 'indigo' | 'emerald' | 'amber'; href: string
}) {
  const colors = {
    blue:   { bg: 'bg-blue-50',   border: 'border-blue-100',   icon: 'text-blue-600',   val: 'text-blue-700' },
    indigo: { bg: 'bg-indigo-50', border: 'border-indigo-100', icon: 'text-indigo-600', val: 'text-indigo-700' },
    emerald:{ bg: 'bg-emerald-50',border: 'border-emerald-100',icon: 'text-emerald-600',val: 'text-emerald-700' },
    amber:  { bg: 'bg-amber-50',  border: 'border-amber-100',  icon: 'text-amber-600',  val: 'text-amber-700' },
  }
  const c = colors[color]
  return (
    <Link href={href} className={`${c.bg} ${c.border} border rounded-2xl p-4 hover:shadow-md transition-all group`}>
      <div className="flex items-start justify-between mb-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{label}</p>
        <div className={`w-8 h-8 bg-white rounded-xl flex items-center justify-center border ${c.border}`}>
          <Icon className={`h-4 w-4 ${c.icon}`} />
        </div>
      </div>
      <p className={`text-xl font-extrabold ${c.val} leading-tight`}>{value}</p>
      <p className="text-[10px] text-gray-400 mt-1 font-medium">{sub}</p>
    </Link>
  )
}
