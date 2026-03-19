'use client'

import { format } from 'date-fns'
import { StatCard } from '@/components/shared/StatCard'

interface RecentLead {
  id: string
  full_name: string
  course_name: string
  status: string
  created_at: string
}

interface FollowupLead {
  id: string
  full_name: string
  phone: string
  assigned_to_name: string
}

interface TopTelecaller {
  id: string
  full_name: string
  conversions: number
}

interface DashboardClientProps {
  totalLeads: number
  newToday: number
  convertedThisMonth: number
  conversionRate: string
  feeCollectedThisMonth: number
  outstandingFees: number
  activeStudents: number
  pendingDocs: number
  recentLeads: RecentLead[]
  followupsToday: FollowupLead[]
  topTelecallers: TopTelecaller[]
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)

export default function DashboardClient({
  totalLeads,
  newToday,
  convertedThisMonth,
  conversionRate,
  feeCollectedThisMonth,
  outstandingFees,
  activeStudents,
  pendingDocs,
  recentLeads,
  followupsToday,
  topTelecallers,
}: DashboardClientProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">{format(new Date(), 'EEEE, dd MMMM yyyy')}</p>
      </div>

      {/* Stat cards — row 1 */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total Leads" value={totalLeads} />
        <StatCard label="New Today" value={newToday} color="blue" />
        <StatCard label="Converted This Month" value={convertedThisMonth} color="green" />
        <StatCard label="Conversion Rate" value={conversionRate} color="green" />
      </div>

      {/* Stat cards — row 2 */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Fee Collected (Month)" value={fmt(feeCollectedThisMonth)} color="green" />
        <StatCard label="Outstanding Fees" value={fmt(outstandingFees)} color="amber" />
        <StatCard label="Active Students" value={activeStudents} color="blue" />
        <StatCard label="Pending Documents" value={pendingDocs} color={pendingDocs > 0 ? 'amber' : 'default'} />
      </div>

      {/* 3-column grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Recent Leads */}
        <div className="rounded-lg border p-4 space-y-3">
          <h2 className="font-semibold text-sm">Recent Leads</h2>
          {recentLeads.length === 0 ? (
            <p className="text-xs text-muted-foreground">No recent leads</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted-foreground">
                  <th className="text-left pb-1">Name</th>
                  <th className="text-left pb-1">Course</th>
                  <th className="text-left pb-1">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentLeads.map((l) => (
                  <tr key={l.id} className="border-t">
                    <td className="py-1 font-medium">{l.full_name}</td>
                    <td className="py-1 text-muted-foreground">{l.course_name || '—'}</td>
                    <td className="py-1 capitalize">{l.status.replace('_', ' ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Followups Due Today */}
        <div className="rounded-lg border p-4 space-y-3">
          <h2 className="font-semibold text-sm">
            Followups Due Today
            {followupsToday.length > 0 && (
              <span className="ml-2 rounded-full bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">
                {followupsToday.length}
              </span>
            )}
          </h2>
          {followupsToday.length === 0 ? (
            <p className="text-xs text-muted-foreground">No followups due today</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted-foreground">
                  <th className="text-left pb-1">Name</th>
                  <th className="text-left pb-1">Phone</th>
                  <th className="text-left pb-1">Assigned To</th>
                </tr>
              </thead>
              <tbody>
                {followupsToday.map((l) => (
                  <tr key={l.id} className="border-t">
                    <td className="py-1 font-medium">{l.full_name}</td>
                    <td className="py-1">{l.phone}</td>
                    <td className="py-1 text-muted-foreground">{l.assigned_to_name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Top Telecallers */}
        <div className="rounded-lg border p-4 space-y-3">
          <h2 className="font-semibold text-sm">Top Telecallers (This Month)</h2>
          {topTelecallers.length === 0 ? (
            <p className="text-xs text-muted-foreground">No data yet</p>
          ) : (
            <ol className="space-y-2">
              {topTelecallers.map((tc, i) => (
                <li key={tc.id} className="flex items-center gap-2 text-sm">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-xs font-bold">
                    {i + 1}
                  </span>
                  <span className="flex-1">{tc.full_name}</span>
                  <span className="text-xs font-semibold text-green-700">{tc.conversions} conv.</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  )
}
