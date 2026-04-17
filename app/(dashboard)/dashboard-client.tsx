'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import Link from 'next/link'
import { StatCard } from '@/components/shared/StatCard'
import { Badge } from '@/components/ui/badge'
import {
  LayoutDashboard, Users, UserCheck, IndianRupee, Bell, TrendingUp, Star,
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

// ─── Tab Button ────────────────────────────────────────────────────────────────
function TabBtn({
  active, onClick, icon: Icon, label, badge,
}: {
  active: boolean
  onClick: () => void
  icon: React.ElementType
  label: string
  badge?: number
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
        active
          ? 'bg-green-700 text-white shadow-md shadow-green-100'
          : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
      {badge !== undefined && badge > 0 && (
        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
          active ? 'bg-green-600 text-white' : 'bg-red-100 text-red-600'
        }`}>
          {badge}
        </span>
      )}
    </button>
  )
}

export default function DashboardClient({
  totalLeads,
  newToday,
  convertedThisMonth,
  conversionRate,
  totalFeeCollected,
  outstandingFees,
  activeStudents,
  droppedStudents,
  followupsToday,
  interestedStats,
  incentiveHistory = [],
  isLead = false,
  docReceivedCount = 0,
  expectedEnrollmentCount = 0,
  departmentStats = [],
}: DashboardClientProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'interested' | 'followups' | 'incentives' | 'departments'>('overview')

  // Total interested count for badge
  const totalInterested = interestedStats.reduce((s, r) => s + r.interested_total, 0)
  const monthInterested = interestedStats.reduce((s, r) => s + r.interested_month, 0)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">{format(new Date(), 'EEEE, dd MMMM yyyy')}</p>
      </div>

      {/* Tab Bar */}
      <div className="flex items-center gap-1.5 flex-wrap bg-slate-50 rounded-2xl p-1.5 border border-slate-200">
        <TabBtn
          active={activeTab === 'overview'}
          onClick={() => setActiveTab('overview')}
          icon={LayoutDashboard}
          label="Overview"
        />
        <TabBtn
          active={activeTab === 'interested'}
          onClick={() => setActiveTab('interested')}
          icon={Star}
          label="Interested Students"
          badge={monthInterested}
        />
        <TabBtn
          active={activeTab === 'followups'}
          onClick={() => setActiveTab('followups')}
          icon={Bell}
          label="Followups Today"
          badge={followupsToday.length}
        />
        {isLead && (
          <TabBtn
            active={activeTab === 'incentives'}
            onClick={() => setActiveTab('incentives')}
            icon={IndianRupee}
            label="My Incentives"
          />
        )}
        {!isLead && departmentStats.length > 0 && (
          <TabBtn
            active={activeTab === 'departments'}
            onClick={() => setActiveTab('departments')}
            icon={TrendingUp}
            label="Departments"
          />
        )}
      </div>

      {/* ── Overview Tab ──────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          {/* Row 1 */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard label="Total Leads" value={totalLeads} />
            <StatCard label="New Today" value={newToday} color="blue" />
            <StatCard label="Converted This Month" value={convertedThisMonth} color="green" />
            <StatCard label="Conversion Rate" value={conversionRate} color="green" />
          </div>

          {/* Row 2 */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {!isLead && <StatCard label="Total Fee Collected" value={fmt(totalFeeCollected)} color="green" />}
            {!isLead && <StatCard label="Outstanding Fees" value={fmt(outstandingFees)} color="amber" />}
            <StatCard label="Active Students" value={activeStudents} color="blue" />
            <StatCard label="Dropped Students" value={droppedStudents} color={droppedStudents > 0 ? 'amber' : 'default'} />
            {isLead && <StatCard label="Document Received" value={docReceivedCount} color="blue" />}
            {isLead && <StatCard label="Expected Enrollment" value={expectedEnrollmentCount} color="green" />}
          </div>

          {/* Quick summary tiles for counselor */}
          {isLead && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div
                onClick={() => setActiveTab('interested')}
                className="cursor-pointer rounded-xl border border-yellow-100 bg-yellow-50 p-4 hover:bg-yellow-100 transition-all"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Star className="w-4 h-4 text-yellow-600" />
                  <span className="text-xs font-semibold text-yellow-700 uppercase tracking-wide">Interested</span>
                </div>
                <p className="text-2xl font-bold text-yellow-800">{totalInterested}</p>
                <p className="text-xs text-yellow-600 mt-0.5">{monthInterested} this month</p>
              </div>

              <div
                onClick={() => setActiveTab('followups')}
                className="cursor-pointer rounded-xl border border-orange-100 bg-orange-50 p-4 hover:bg-orange-100 transition-all"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Bell className="w-4 h-4 text-orange-600" />
                  <span className="text-xs font-semibold text-orange-700 uppercase tracking-wide">Followups</span>
                </div>
                <p className="text-2xl font-bold text-orange-800">{followupsToday.length}</p>
                <p className="text-xs text-orange-600 mt-0.5">Due today</p>
              </div>

              <div
                onClick={() => setActiveTab('incentives')}
                className="cursor-pointer rounded-xl border border-green-100 bg-green-50 p-4 hover:bg-green-100 transition-all"
              >
                <div className="flex items-center gap-2 mb-2">
                  <IndianRupee className="w-4 h-4 text-green-600" />
                  <span className="text-xs font-semibold text-green-700 uppercase tracking-wide">Incentives</span>
                </div>
                <p className="text-2xl font-bold text-green-800">
                  {incentiveHistory.length > 0
                    ? fmt(incentiveHistory[0]?.incentive ?? 0)
                    : '—'}
                </p>
                <p className="text-xs text-green-600 mt-0.5">Last month earned</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Interested Students Tab ───────────────────────────── */}
      {activeTab === 'interested' && (
        <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b bg-gradient-to-r from-yellow-50 to-orange-50 flex items-center gap-2">
            <Star className="w-4 h-4 text-yellow-600" />
            <h2 className="font-semibold text-sm text-yellow-800">Interested Students — Counselor-wise</h2>
          </div>
          {interestedStats.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">No interested students data yet</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-5 py-3 font-semibold">Counselor</th>
                  <th className="text-right px-5 py-3 font-semibold">This Month</th>
                  <th className="text-right px-5 py-3 font-semibold">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {interestedStats.map((stat) => (
                  <tr key={stat.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3 font-medium text-slate-700 flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {stat.full_name.charAt(0).toUpperCase()}
                      </div>
                      {stat.full_name}
                    </td>
                    <td className="px-5 py-3 text-right font-bold text-green-700">{stat.interested_month}</td>
                    <td className="px-5 py-3 text-right font-bold text-slate-900">{stat.interested_total}</td>
                  </tr>
                ))}
                {/* Totals row */}
                <tr className="bg-slate-50 border-t-2 border-slate-200">
                  <td className="px-5 py-3 font-bold text-slate-700">Total</td>
                  <td className="px-5 py-3 text-right font-bold text-green-700">{monthInterested}</td>
                  <td className="px-5 py-3 text-right font-bold text-slate-900">{totalInterested}</td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Followups Tab ─────────────────────────────────────── */}
      {activeTab === 'followups' && (
        <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b bg-gradient-to-r from-orange-50 to-red-50 flex items-center gap-2">
            <Bell className="w-4 h-4 text-orange-600" />
            <h2 className="font-semibold text-sm text-orange-800">
              Followups Due Today
              {followupsToday.length > 0 && (
                <span className="ml-2 rounded-full bg-orange-200 px-2 py-0.5 text-xs text-orange-800">
                  {followupsToday.length}
                </span>
              )}
            </h2>
          </div>
          {followupsToday.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">No followups due today 🎉</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-5 py-3 font-semibold">Name</th>
                  <th className="text-left px-5 py-3 font-semibold">Phone</th>
                  <th className="text-left px-5 py-3 font-semibold">Assigned To</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {followupsToday.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3 font-medium text-slate-800">{l.full_name}</td>
                    <td className="px-5 py-3 text-slate-600">{l.phone}</td>
                    <td className="px-5 py-3 text-muted-foreground">{l.assigned_to_name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Incentives Tab (counselor only) ───────────────────── */}
      {activeTab === 'incentives' && isLead && (
        <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b bg-gradient-to-r from-green-50 to-emerald-50 flex items-center gap-2">
            <IndianRupee className="w-4 h-4 text-green-600" />
            <h2 className="font-semibold text-sm text-green-800">My Incentives (Month-wise)</h2>
          </div>
          {incentiveHistory.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">No incentive records found. Contact admin if this seems incorrect.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground border-b border-slate-100 bg-slate-50">
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
          )}
        </div>
      )}

      {/* ── Departments Tab (admin only) ───────────────────────── */}
      {activeTab === 'departments' && !isLead && departmentStats.length > 0 && (
        <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b bg-gradient-to-r from-green-50 to-emerald-50 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-green-600" />
            <h2 className="font-semibold text-sm text-green-800">Department-wise Fees &amp; Students</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground border-b border-slate-100 bg-slate-50">
                <th className="text-left px-5 py-3 font-semibold">Department</th>
                <th className="text-right px-5 py-3 font-semibold">Total Students</th>
                <th className="text-right px-5 py-3 font-semibold">Fee Collected</th>
                <th className="text-right px-5 py-3 font-semibold">Pending Fees</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {departmentStats.map((dept) => (
                <tr key={dept.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3 font-medium text-green-700 hover:text-green-900 hover:underline">
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
    </div>
  )
}

