'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { StatCard } from '@/components/shared/StatCard'
import { Badge } from '@/components/ui/badge'
import {
  LayoutDashboard, Users, UserCheck, IndianRupee, Bell, TrendingUp, Star,
  ClipboardList, Clock, AlertTriangle, Zap, CheckCircle2, ChevronRight,
  Phone, MessageCircle, FileText, ArrowRight,
} from 'lucide-react'

interface FollowupLead {
  id: string
  full_name: string
  phone: string
  assigned_to_name: string
}

interface InterestedStat {
  id: string
  full_name: string
  interested_total: number
  interested_month: number
}

interface IncentiveRow {
  month: number
  year: number
  incentive: number
  status: string
  net: number
}

interface DepartmentStat {
  id: string
  name: string
  total_students: number
  collected_fee: number
  pending_fee: number
}

interface DashboardClientProps {
  totalLeads: number
  newToday: number
  convertedThisMonth: number
  conversionRate: string
  totalFeeCollected: number
  outstandingFees: number
  activeStudents: number
  droppedStudents: number
  followupsToday: FollowupLead[]
  interestedStats: InterestedStat[]
  incentiveHistory?: IncentiveRow[]
  isLead?: boolean
  docReceivedCount?: number
  expectedEnrollmentCount?: number
  departmentStats?: DepartmentStat[]
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)

function getInitials(name: string) {
  const parts = name.trim().split(' ')
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

const AVATAR_COLORS = [
  'bg-blue-500', 'bg-blue-500', 'bg-pink-500', 'bg-emerald-500',
  'bg-orange-500', 'bg-cyan-500', 'bg-rose-500', 'bg-indigo-500',
]
function getAvatarColor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

type Tab = 'overview' | 'interested' | 'followups' | 'incentives' | 'departments'

function TabBtn({ active, onClick, icon: Icon, label, badge }: {
  active: boolean; onClick: () => void; icon: React.ElementType; label: string; badge?: number
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
        active ? 'bg-blue-600 text-white shadow-md shadow-blue-100' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
      }`}
    >
      <Icon className="w-3.5 h-3.5 flex-shrink-0" />
      <span className="hidden sm:inline">{label}</span>
      <span className="sm:hidden">{label.split(' ')[0]}</span>
      {badge !== undefined && badge > 0 && (
        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${active ? 'bg-blue-500 text-white' : 'bg-red-100 text-red-600'}`}>
          {badge}
        </span>
      )}
    </button>
  )
}

export default function DashboardClient({
  totalLeads, newToday, convertedThisMonth, conversionRate,
  totalFeeCollected, outstandingFees, activeStudents, droppedStudents,
  followupsToday, interestedStats, incentiveHistory = [],
  isLead = false, docReceivedCount = 0, expectedEnrollmentCount = 0, departmentStats = [],
}: DashboardClientProps) {
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [myTasks, setMyTasks] = useState<any[]>([])

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      ;(supabase as any).from('tasks').select('id,title,urgency,due_date,status')
        .eq('assigned_to', user.id).neq('status', 'done')
        .order('due_date').limit(5)
        .then(({ data }: any) => setMyTasks(data ?? []))
    })
  }, [])

  const totalInterested = interestedStats.reduce((s, r) => s + r.interested_total, 0)
  const monthInterested = interestedStats.reduce((s, r) => s + r.interested_month, 0)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-xs text-gray-400 mt-0.5">{format(new Date(), 'EEEE, dd MMMM yyyy')}</p>
      </div>

      {/* Tab Bar — horizontally scrollable on mobile */}
      <div className="overflow-x-auto -mx-1 px-1 pb-0.5">
        <div className="flex items-center gap-1 bg-slate-50 rounded-xl p-1 border border-slate-200 w-max min-w-full">
          <TabBtn active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} icon={LayoutDashboard} label="Overview" />
          <TabBtn active={activeTab === 'interested'} onClick={() => setActiveTab('interested')} icon={Star} label="Interested" badge={monthInterested} />
          <TabBtn active={activeTab === 'followups'} onClick={() => setActiveTab('followups')} icon={Bell} label="Followups Today" badge={followupsToday.length} />
          {isLead && <TabBtn active={activeTab === 'incentives'} onClick={() => setActiveTab('incentives')} icon={IndianRupee} label="My Incentives" />}
          {!isLead && departmentStats.length > 0 && <TabBtn active={activeTab === 'departments'} onClick={() => setActiveTab('departments')} icon={TrendingUp} label="Departments" />}
        </div>
      </div>

      {/* ── Overview ── */}
      {activeTab === 'overview' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Total Leads" value={totalLeads} />
            <StatCard label="New Today" value={newToday} color="blue" />
            <StatCard label="Converted" value={convertedThisMonth} color="green" />
            <StatCard label="Conversion" value={conversionRate} color="green" />
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {!isLead && <StatCard label="Fee Collected" value={fmt(totalFeeCollected)} color="green" />}
            {!isLead && <StatCard label="Outstanding" value={fmt(outstandingFees)} color="amber" />}
            <StatCard label="Active Students" value={activeStudents} color="blue" />
            <StatCard label="Dropped" value={droppedStudents} color={droppedStudents > 0 ? 'amber' : 'default'} />
            {isLead && <StatCard label="Doc Received" value={docReceivedCount} color="blue" />}
            {isLead && <StatCard label="Exp. Enrollment" value={expectedEnrollmentCount} color="green" />}
          </div>

          {isLead && (
            <div className="grid grid-cols-3 gap-2.5">
              <Link href="/leads?status=interested" className="rounded-xl border border-yellow-100 bg-yellow-50 p-3.5 hover:bg-yellow-100 transition-all text-left group">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <Star className="w-4 h-4 text-yellow-600 flex-shrink-0" />
                    <span className="text-[10px] font-bold text-yellow-700 uppercase tracking-wide">Interested</span>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-yellow-400 group-hover:text-yellow-600" />
                </div>
                <p className="text-xl font-bold text-yellow-800">{totalInterested}</p>
                <p className="text-[11px] text-yellow-600 mt-0.5">{monthInterested} this month</p>
              </Link>

              <Link href="/leads?followup=today" className="rounded-xl border border-orange-100 bg-orange-50 p-3.5 hover:bg-orange-100 transition-all text-left group">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <Bell className="w-4 h-4 text-orange-600 flex-shrink-0" />
                    <span className="text-[10px] font-bold text-orange-700 uppercase tracking-wide">Followup</span>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-orange-400 group-hover:text-orange-600" />
                </div>
                <p className="text-xl font-bold text-orange-800">{followupsToday.length}</p>
                <p className="text-[11px] text-orange-600 mt-0.5">Due today</p>
              </Link>

              <Link href="/leads?status=document_received" className="rounded-xl border border-blue-100 bg-blue-50 p-3.5 hover:bg-blue-100 transition-all text-left group">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-blue-600 flex-shrink-0" />
                    <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wide">Doc Received</span>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-blue-400 group-hover:text-blue-600" />
                </div>
                <p className="text-xl font-bold text-blue-800">{docReceivedCount}</p>
                <p className="text-[11px] text-blue-600 mt-0.5">Documents in</p>
              </Link>
            </div>
          )}
        </div>
      )}

      {/* ── Interested ── */}
      {activeTab === 'interested' && (
        <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-3.5 border-b bg-gradient-to-r from-yellow-50 to-orange-50 flex items-center gap-2">
            <Star className="w-4 h-4 text-yellow-600" />
            <h2 className="font-semibold text-sm text-yellow-800">Interested Students — Counselor-wise</h2>
          </div>
          {interestedStats.length === 0 ? (
            <div className="py-14 text-center text-sm text-gray-400">No data yet</div>
          ) : (
            <>
              {/* Mobile cards */}
              <div className="md:hidden divide-y divide-gray-50">
                {interestedStats.map((stat) => (
                  <div key={stat.id} className="px-4 py-3.5 flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold ${getAvatarColor(stat.full_name)}`}>
                      {getInitials(stat.full_name)}
                    </div>
                    <span className="flex-1 text-sm font-medium text-gray-800 truncate">{stat.full_name}</span>
                    <div className="flex items-center gap-4">
                      <div className="text-center">
                        <p className="text-[10px] text-gray-400">Month</p>
                        <p className="text-sm font-bold text-blue-600">{stat.interested_month}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] text-gray-400">Total</p>
                        <p className="text-sm font-bold text-gray-900">{stat.interested_total}</p>
                      </div>
                    </div>
                  </div>
                ))}
                <div className="px-4 py-3 bg-slate-50 flex items-center">
                  <span className="flex-1 text-sm font-bold text-gray-700">Total</span>
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <p className="text-[10px] text-gray-400">Month</p>
                      <p className="text-sm font-bold text-blue-700">{monthInterested}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] text-gray-400">Total</p>
                      <p className="text-sm font-bold text-gray-900">{totalInterested}</p>
                    </div>
                  </div>
                </div>
              </div>
              {/* Desktop table */}
              <table className="hidden md:table w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 border-b border-slate-100 bg-slate-50">
                    <th className="text-left px-5 py-3 font-semibold">Counselor</th>
                    <th className="text-right px-5 py-3 font-semibold">This Month</th>
                    <th className="text-right px-5 py-3 font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {interestedStats.map((stat) => (
                    <tr key={stat.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3 font-medium text-slate-700 flex items-center gap-2">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${getAvatarColor(stat.full_name)}`}>
                          {getInitials(stat.full_name)}
                        </div>
                        {stat.full_name}
                      </td>
                      <td className="px-5 py-3 text-right font-bold text-blue-600">{stat.interested_month}</td>
                      <td className="px-5 py-3 text-right font-bold text-slate-900">{stat.interested_total}</td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50 border-t-2 border-slate-200">
                    <td className="px-5 py-3 font-bold text-slate-700">Total</td>
                    <td className="px-5 py-3 text-right font-bold text-blue-700">{monthInterested}</td>
                    <td className="px-5 py-3 text-right font-bold text-slate-900">{totalInterested}</td>
                  </tr>
                </tbody>
              </table>
            </>
          )}
        </div>
      )}

      {/* ── Followups ── */}
      {activeTab === 'followups' && (
        <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-3.5 border-b bg-gradient-to-r from-orange-50 to-red-50 flex items-center gap-2">
            <Bell className="w-4 h-4 text-orange-600" />
            <h2 className="font-semibold text-sm text-orange-800">
              Followups Due Today
              {followupsToday.length > 0 && (
                <span className="ml-2 rounded-full bg-orange-200 px-2 py-0.5 text-xs text-orange-800">{followupsToday.length}</span>
              )}
            </h2>
          </div>
          {followupsToday.length === 0 ? (
            <div className="py-14 text-center">
              <CheckCircle2 className="w-8 h-8 text-green-400 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-600">All caught up!</p>
              <p className="text-xs text-gray-400 mt-0.5">No followups due today</p>
            </div>
          ) : (
            <>
              {/* Mobile cards */}
              <div className="md:hidden divide-y divide-gray-50">
                {followupsToday.map((l) => (
                  <div key={l.id} className="px-4 py-3.5 flex items-center gap-3 hover:bg-orange-50/40 transition-colors">
                    <Link href={`/leads/${l.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                      <div className={`w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold ${getAvatarColor(l.full_name)}`}>
                        {getInitials(l.full_name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{l.full_name}</p>
                        <p className="text-xs font-mono text-gray-500">{l.phone.startsWith('+') ? l.phone : `+91 ${l.phone}`}</p>
                        {l.assigned_to_name && <p className="text-[11px] text-gray-400">{l.assigned_to_name}</p>}
                      </div>
                    </Link>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <a href={`tel:${l.phone}`} className="p-2 bg-blue-50 rounded-xl hover:bg-blue-100 transition-colors" onClick={(e) => e.stopPropagation()}>
                        <Phone className="w-4 h-4 text-blue-600" />
                      </a>
                      <a href={`https://wa.me/${l.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="p-2 bg-green-50 rounded-xl hover:bg-green-100 transition-colors" onClick={(e) => e.stopPropagation()}>
                        <MessageCircle className="w-4 h-4 text-green-600" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
              {/* Desktop table */}
              <table className="hidden md:table w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 border-b border-slate-100 bg-slate-50">
                    <th className="text-left px-5 py-3 font-semibold">Name</th>
                    <th className="text-left px-5 py-3 font-semibold">Phone</th>
                    <th className="text-left px-5 py-3 font-semibold">Assigned To</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {followupsToday.map((l) => (
                    <tr key={l.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3 font-medium text-slate-800">{l.full_name}</td>
                      <td className="px-5 py-3 text-slate-600 font-mono">{l.phone.startsWith('+') ? l.phone : `+91 ${l.phone}`}</td>
                      <td className="px-5 py-3 text-gray-400">{l.assigned_to_name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}

      {/* ── Incentives ── */}
      {activeTab === 'incentives' && isLead && (
        <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-3.5 border-b bg-gradient-to-r from-green-50 to-emerald-50 flex items-center gap-2">
            <IndianRupee className="w-4 h-4 text-green-600" />
            <h2 className="font-semibold text-sm text-green-800">My Incentives (Month-wise)</h2>
          </div>
          {incentiveHistory.length === 0 ? (
            <div className="py-14 text-center text-sm text-gray-400">No incentive records found.</div>
          ) : (
            <>
              {/* Mobile cards */}
              <div className="md:hidden divide-y divide-gray-50">
                {incentiveHistory.map((row, i) => (
                  <div key={i} className="px-4 py-3.5 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{MONTH_NAMES[row.month - 1]} {row.year}</p>
                      <p className="text-xs text-gray-400 mt-0.5">Net: {fmt(row.net ?? 0)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-sm font-bold text-green-700">{fmt(row.incentive ?? 0)}</p>
                      </div>
                      <Badge variant={row.status === 'paid' ? 'default' : row.status === 'processed' ? 'secondary' : 'outline'} className="text-xs">
                        {row.status === 'paid' ? 'Paid' : row.status === 'processed' ? 'Processed' : 'Draft'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
              {/* Desktop table */}
              <table className="hidden md:table w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 border-b border-slate-100 bg-slate-50">
                    <th className="text-left px-5 py-3 font-semibold">Month</th>
                    <th className="text-right px-5 py-3 font-semibold">Incentive</th>
                    <th className="text-right px-5 py-3 font-semibold">Net Pay</th>
                    <th className="text-right px-5 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {incentiveHistory.map((row, i) => (
                    <tr key={i} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3 font-medium">{MONTH_NAMES[row.month - 1]} {row.year}</td>
                      <td className="px-5 py-3 text-right text-green-700 font-semibold">{fmt(row.incentive ?? 0)}</td>
                      <td className="px-5 py-3 text-right">{fmt(row.net ?? 0)}</td>
                      <td className="px-5 py-3 text-right">
                        <Badge variant={row.status === 'paid' ? 'default' : row.status === 'processed' ? 'secondary' : 'outline'} className="text-xs">
                          {row.status === 'paid' ? 'Paid' : row.status === 'processed' ? 'Processed' : 'Draft'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}

      {/* ── Departments ── */}
      {activeTab === 'departments' && !isLead && departmentStats.length > 0 && (
        <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-3.5 border-b bg-gradient-to-r from-blue-50 to-indigo-50 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-600" />
            <h2 className="font-semibold text-sm text-blue-800">Department-wise Fees &amp; Students</h2>
          </div>
          {/* Mobile cards */}
          <div className="md:hidden divide-y divide-gray-50">
            {departmentStats.map((dept) => (
              <Link key={dept.id} href={`/backend?dept=${dept.id}`} className="block px-4 py-3.5 hover:bg-blue-50/40 transition-colors">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-sm font-semibold text-blue-700">{dept.name}</p>
                  <span className="text-xs bg-blue-100 text-blue-700 rounded-full px-2 py-0.5 font-medium">{dept.total_students} students</span>
                </div>
                <div className="flex items-center gap-4">
                  <div>
                    <p className="text-[10px] text-gray-400">Collected</p>
                    <p className="text-xs font-bold text-green-700">{fmt(dept.collected_fee)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400">Pending</p>
                    <p className="text-xs font-bold text-amber-600">{fmt(dept.pending_fee)}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
          {/* Desktop table */}
          <table className="hidden md:table w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 border-b border-slate-100 bg-slate-50">
                <th className="text-left px-5 py-3 font-semibold">Department</th>
                <th className="text-right px-5 py-3 font-semibold">Total Students</th>
                <th className="text-right px-5 py-3 font-semibold">Fee Collected</th>
                <th className="text-right px-5 py-3 font-semibold">Pending Fees</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {departmentStats.map((dept) => (
                <tr key={dept.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3 font-medium text-blue-600 hover:text-blue-800 hover:underline">
                    <Link href={`/backend?dept=${dept.id}`}>{dept.name}</Link>
                  </td>
                  <td className="px-5 py-3 text-right">{dept.total_students}</td>
                  <td className="px-5 py-3 text-right text-green-700 font-medium">{fmt(dept.collected_fee)}</td>
                  <td className="px-5 py-3 text-right text-amber-600 font-medium">{fmt(dept.pending_fee)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── My Tasks ── */}
      {myTasks.length > 0 && (
        <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-3.5 border-b bg-gradient-to-r from-blue-50 to-blue-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-blue-600" />
              <h3 className="font-semibold text-sm text-slate-800">My Pending Tasks</h3>
              <span className="bg-blue-600 text-white text-[10px] rounded-full px-2 py-0.5 font-medium">{myTasks.length}</span>
            </div>
            <Link href="/tasks" className="text-xs text-blue-600 hover:underline flex items-center gap-0.5">
              View all <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y">
            {myTasks.map((t: any) => {
              const todayStr = new Date().toISOString().slice(0, 10)
              const isToday = t.due_date === todayStr
              const isOverdue = t.due_date < todayStr
              const urgColor = t.urgency === 'urgent' ? 'bg-red-500' : t.urgency === 'high' ? 'bg-orange-400' : t.urgency === 'medium' ? 'bg-blue-400' : 'bg-slate-300'
              const urgIcon = t.urgency === 'urgent' ? <Zap className="w-3.5 h-3.5 text-red-600" /> : t.urgency === 'high' ? <AlertTriangle className="w-3.5 h-3.5 text-orange-500" /> : <Clock className="w-3.5 h-3.5 text-blue-500" />
              return (
                <div key={t.id} className={`px-4 py-3 flex items-center gap-3 ${isToday ? 'bg-amber-50' : isOverdue ? 'bg-red-50' : ''}`}>
                  <div className={`w-1 h-8 rounded-full flex-shrink-0 ${urgColor}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{t.title}</p>
                    <p className={`text-xs mt-0.5 ${isToday ? 'text-amber-600 font-medium' : isOverdue ? 'text-red-600 font-medium' : 'text-gray-400'}`}>
                      {isToday ? 'Due Today' : isOverdue
                        ? `Overdue · ${new Date(t.due_date + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}`
                        : new Date(t.due_date + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  {urgIcon}
                </div>
              )
            })}
          </div>
          <div className="px-4 py-2.5 border-t bg-slate-50">
            <Link href="/tasks" className="text-xs text-blue-600 hover:underline font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Go to Tasks to mark done
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
