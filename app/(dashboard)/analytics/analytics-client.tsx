'use client'

import { useState, useEffect } from 'react'
import { format, subDays, subMonths, startOfMonth, endOfMonth } from 'date-fns'
import {
  ResponsiveContainer,
  LineChart, Line,
  BarChart, Bar,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import { createClient } from '@/lib/supabase/client'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)

const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#3b82f6', '#a855f7', '#ec4899', '#14b8a6']

function ChartSkeleton() {
  return <Skeleton className="w-full h-64" />
}

export default function AnalyticsClient() {
  const supabase = createClient()
  const now = new Date()
  const [dateFrom, setDateFrom] = useState(format(startOfMonth(now), 'yyyy-MM-dd'))
  const [dateTo, setDateTo] = useState(format(endOfMonth(now), 'yyyy-MM-dd'))

  // ---- Lead analytics state ----
  const [leadsPerDay, setLeadsPerDay] = useState<{ date: string; count: number }[]>([])
  const [leadsBySource, setLeadsBySource] = useState<{ source: string; count: number }[]>([])
  const [funnelData, setFunnelData] = useState<{ stage: string; count: number; pct: string }[]>([])
  const [telecallerPerf, setTelecallerPerf] = useState<{
    name: string; assigned: number; contacted: number; conversions: number; rate: string
  }[]>([])
  const [loadingLeads, setLoadingLeads] = useState(true)

  // ---- Revenue analytics state ----
  const [monthlyRevenue, setMonthlyRevenue] = useState<{ month: string; revenue: number }[]>([])
  const [revByCourse, setRevByCourse] = useState<{ course: string; revenue: number }[]>([])
  const [paymentModes, setPaymentModes] = useState<{ mode: string; value: number }[]>([])
  const [counsellorRevenue, setCounsellorRevenue] = useState<{ name: string; revenue: number; count: number }[]>([])
  const [loadingRevenue, setLoadingRevenue] = useState(true)

  // ---- Operations state ----
  const [enrollmentTrend, setEnrollmentTrend] = useState<{ month: string; count: number }[]>([])
  const [pendingActions, setPendingActions] = useState({ docsMissing: 0, examsPending: 0, followupsOverdue: 0 })
  const [loadingOps, setLoadingOps] = useState(true)

  // ---- HR state ----
  const [attendanceRates, setAttendanceRates] = useState<{ name: string; rate: number }[]>([])
  const [leaveUtil, setLeaveUtil] = useState<{ name: string; leaves: number }[]>([])
  const [loadingHr, setLoadingHr] = useState(true)

  // Fetch lead analytics
  useEffect(() => {
    setLoadingLeads(true)
    async function load() {
      try {
        const [leadsRes, profilesRes] = await Promise.all([
          supabase.from('leads').select('id, created_at, source, status, assigned_to').gte('created_at', dateFrom).lte('created_at', dateTo + 'T23:59:59'),
          supabase.from('profiles').select('id, full_name'),
        ])
        const leadsRaw = leadsRes.data as { id: string; created_at: string; source: string; status: string; assigned_to: string | null }[] | null
        const profiles = profilesRes.data as { id: string; full_name: string }[] | null

        // Leads per day (last 30)
        const dayMap: Record<string, number> = {}
        const last30 = Array.from({ length: 30 }, (_, i) => format(subDays(new Date(), 29 - i), 'yyyy-MM-dd'))
        last30.forEach((d) => (dayMap[d] = 0))
        for (const l of leadsRaw ?? []) {
          const d = l.created_at.slice(0, 10)
          if (dayMap[d] !== undefined) dayMap[d]++
        }
        setLeadsPerDay(last30.map((d) => ({ date: format(new Date(d), 'dd MMM'), count: dayMap[d] })))

        // By source
        const srcMap: Record<string, number> = {}
        for (const l of leadsRaw ?? []) {
          srcMap[l.source] = (srcMap[l.source] ?? 0) + 1
        }
        setLeadsBySource(Object.entries(srcMap).map(([source, count]) => ({ source, count })))

        // Funnel
        const STAGES = ['new', 'contacted', 'interested', 'counselled', 'application_sent', 'converted']
        const total = (leadsRaw ?? []).length || 1
        const stageMap: Record<string, number> = {}
        for (const l of leadsRaw ?? []) {
          stageMap[l.status] = (stageMap[l.status] ?? 0) + 1
        }
        setFunnelData(STAGES.map((s) => ({
          stage: s.replace('_', ' '),
          count: stageMap[s] ?? 0,
          pct: (((stageMap[s] ?? 0) / total) * 100).toFixed(1) + '%',
        })))

        // Telecaller performance
        const profMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p.full_name]))
        const perfMap: Record<string, { assigned: number; contacted: number; conversions: number }> = {}
        for (const l of leadsRaw ?? []) {
          if (!l.assigned_to || !profMap[l.assigned_to]) continue
          if (!perfMap[l.assigned_to]) perfMap[l.assigned_to] = { assigned: 0, contacted: 0, conversions: 0 }
          perfMap[l.assigned_to].assigned++
          if (['contacted', 'interested', 'counselled', 'application_sent', 'converted'].includes(l.status))
            perfMap[l.assigned_to].contacted++
          if (l.status === 'converted') perfMap[l.assigned_to].conversions++
        }
        setTelecallerPerf(
          Object.entries(perfMap).map(([id, v]) => ({
            name: profMap[id],
            ...v,
            rate: v.assigned > 0 ? ((v.conversions / v.assigned) * 100).toFixed(1) + '%' : '0%',
          }))
        )
      } finally {
        setLoadingLeads(false)
      }
    }
    load()
  }, [dateFrom, dateTo])

  // Fetch revenue analytics
  useEffect(() => {
    setLoadingRevenue(true)
    async function load() {
      try {
        const [paymentsRes, coursesRes, profilesRes2] = await Promise.all([
          supabase.from('payments').select('amount, payment_mode, payment_date, leads ( assigned_to, course_id )').gte('payment_date', dateFrom).lte('payment_date', dateTo),
          supabase.from('courses').select('id, name'),
          supabase.from('profiles').select('id, full_name'),
        ])
        const payments = paymentsRes.data as { amount: number; payment_mode: string; payment_date: string; leads: { assigned_to: string | null; course_id: string | null } | null }[] | null
        const courses = coursesRes.data as { id: string; name: string }[] | null
        const profiles = profilesRes2.data as { id: string; full_name: string }[] | null

        // Monthly revenue last 12
        const mrMap: Record<string, number> = {}
        for (let i = 11; i >= 0; i--) {
          const d = subMonths(new Date(), i)
          mrMap[format(d, 'MMM yy')] = 0
        }
        for (const p of payments ?? []) {
          const key = format(new Date(p.payment_date), 'MMM yy')
          if (mrMap[key] !== undefined) mrMap[key] += p.amount ?? 0
        }
        setMonthlyRevenue(Object.entries(mrMap).map(([month, revenue]) => ({ month, revenue })))

        // Revenue by course
        const courseMap = Object.fromEntries((courses ?? []).map((c) => [c.id, c.name]))
        const rcMap: Record<string, number> = {}
        for (const p of payments ?? []) {
          const cid = (p.leads as { course_id: string } | null)?.course_id
          if (!cid) continue
          const name = courseMap[cid] ?? 'Unknown'
          rcMap[name] = (rcMap[name] ?? 0) + (p.amount ?? 0)
        }
        setRevByCourse(Object.entries(rcMap).map(([course, revenue]) => ({ course, revenue })))

        // Payment modes
        const modeMap: Record<string, number> = {}
        for (const p of payments ?? []) {
          modeMap[p.payment_mode] = (modeMap[p.payment_mode] ?? 0) + (p.amount ?? 0)
        }
        setPaymentModes(Object.entries(modeMap).map(([mode, value]) => ({ mode: mode.toUpperCase(), value })))

        // Counsellor revenue
        const profMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p.full_name]))
        const crMap: Record<string, { revenue: number; count: number }> = {}
        for (const p of payments ?? []) {
          const aid = (p.leads as { assigned_to: string } | null)?.assigned_to
          if (!aid || !profMap[aid]) continue
          if (!crMap[aid]) crMap[aid] = { revenue: 0, count: 0 }
          crMap[aid].revenue += p.amount ?? 0
          crMap[aid].count++
        }
        setCounsellorRevenue(
          Object.entries(crMap).map(([id, v]) => ({ name: profMap[id], ...v }))
        )
      } finally {
        setLoadingRevenue(false)
      }
    }
    load()
  }, [dateFrom, dateTo])

  // Fetch operations
  useEffect(() => {
    setLoadingOps(true)
    async function load() {
      try {
        const today = format(new Date(), 'yyyy-MM-dd')
        const [studentsRes, examsRes, overdueRes] = await Promise.all([
          supabase.from('students').select('enrollment_date').gte('enrollment_date', format(subMonths(new Date(), 12), 'yyyy-MM-dd')),
          supabase.from('student_exams').select('*', { count: 'exact', head: true }).is('is_passed', null),
          supabase.from('leads').select('*', { count: 'exact', head: true }).lt('next_followup_date', today).not('next_followup_date', 'is', null).not('status', 'in', '("converted","lost","cold")'),
        ])
        const studentsRaw = studentsRes.data as { enrollment_date: string | null }[] | null
        const examsPending = examsRes.count
        const overdue = overdueRes.count

        // Enrollment trend
        const etMap: Record<string, number> = {}
        for (let i = 11; i >= 0; i--) {
          etMap[format(subMonths(new Date(), i), 'MMM yy')] = 0
        }
        for (const s of studentsRaw ?? []) {
          if (!s.enrollment_date) continue
          const key = format(new Date(s.enrollment_date), 'MMM yy')
          if (etMap[key] !== undefined) etMap[key]++
        }
        setEnrollmentTrend(Object.entries(etMap).map(([month, count]) => ({ month, count })))

        // Pending actions
        const { count: docsMissing } = await supabase
          .from('student_documents')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending')

        setPendingActions({
          docsMissing: docsMissing ?? 0,
          examsPending: examsPending ?? 0,
          followupsOverdue: overdue ?? 0,
        })
      } finally {
        setLoadingOps(false)
      }
    }
    load()
  }, [])

  // Fetch HR
  useEffect(() => {
    setLoadingHr(true)
    async function load() {
      try {
        const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd')
        const monthEnd = format(endOfMonth(new Date()), 'yyyy-MM-dd')
        const yearStart = format(new Date(new Date().getFullYear(), 0, 1), 'yyyy-MM-dd')

        const [empRes, attRes, leavesRes] = await Promise.all([
          supabase.from('employees').select('id, profiles ( full_name )').eq('is_active', true),
          supabase.from('attendance').select('employee_id, status').gte('date', monthStart).lte('date', monthEnd),
          supabase.from('leave_requests').select('employee_id, employees ( profiles ( full_name ) )').eq('status', 'approved').gte('from_date', yearStart),
        ])
        const employees = empRes.data as { id: string; profiles: { full_name: string } | null }[] | null
        const attendance = attRes.data as { employee_id: string; status: string }[] | null
        const leaves = leavesRes.data as { employee_id: string; employees: { profiles: { full_name: string } | null } | null }[] | null

        // Attendance rate per employee
        const attByEmp: Record<string, { present: number; total: number }> = {}
        for (const a of attendance ?? []) {
          if (!attByEmp[a.employee_id]) attByEmp[a.employee_id] = { present: 0, total: 0 }
          attByEmp[a.employee_id].total++
          if (a.status === 'present' || a.status === 'half_day') attByEmp[a.employee_id].present++
        }
        setAttendanceRates(
          (employees ?? []).map((e) => {
            const stats = attByEmp[e.id] ?? { present: 0, total: 1 }
            return {
              name: (e.profiles as { full_name: string } | null)?.full_name ?? '—',
              rate: Math.round((stats.present / stats.total) * 100),
            }
          })
        )

        // Leave utilization
        const lvMap: Record<string, number> = {}
        for (const l of leaves ?? []) {
          const name = ((l.employees as { profiles: { full_name: string } | null } | null)?.profiles?.full_name) ?? '—'
          lvMap[name] = (lvMap[name] ?? 0) + 1
        }
        setLeaveUtil(Object.entries(lvMap).map(([name, leaves]) => ({ name, leaves })))
      } finally {
        setLoadingHr(false)
      }
    }
    load()
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <div className="space-y-1">
            <Label className="text-xs">From</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-8 text-xs" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">To</Label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-8 text-xs" />
          </div>
        </div>
      </div>

      <Tabs defaultValue="leads">
        <TabsList className="flex-wrap">
          <TabsTrigger value="leads">Lead Analytics</TabsTrigger>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="ops">Operations</TabsTrigger>
          <TabsTrigger value="hr">HR</TabsTrigger>
        </TabsList>

        {/* ---- LEADS ---- */}
        <TabsContent value="leads" className="space-y-6 pt-4">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-lg border p-4">
              <h3 className="text-sm font-semibold mb-3">Leads Per Day (Last 30 Days)</h3>
              {loadingLeads ? <ChartSkeleton /> : (
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={leadsPerDay}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={4} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="count" stroke="#6366f1" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="rounded-lg border p-4">
              <h3 className="text-sm font-semibold mb-3">Leads by Source</h3>
              {loadingLeads ? <ChartSkeleton /> : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={leadsBySource}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="source" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#6366f1" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="rounded-lg border p-4">
            <h3 className="text-sm font-semibold mb-3">Stage Funnel</h3>
            {loadingLeads ? <Skeleton className="h-32 w-full" /> : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-muted-foreground border-b">
                    <th className="text-left py-1">Stage</th>
                    <th className="text-right py-1">Count</th>
                    <th className="text-right py-1">% of Total</th>
                  </tr>
                </thead>
                <tbody>
                  {funnelData.map((f) => (
                    <tr key={f.stage} className="border-b last:border-0">
                      <td className="py-1.5 capitalize font-medium">{f.stage}</td>
                      <td className="py-1.5 text-right">{f.count}</td>
                      <td className="py-1.5 text-right text-muted-foreground">{f.pct}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="rounded-lg border p-4">
            <h3 className="text-sm font-semibold mb-3">Telecaller Performance</h3>
            {loadingLeads ? <Skeleton className="h-32 w-full" /> : telecallerPerf.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-muted-foreground border-b">
                    <th className="text-left py-1">Name</th>
                    <th className="text-right py-1">Assigned</th>
                    <th className="text-right py-1">Contacted</th>
                    <th className="text-right py-1">Conversions</th>
                    <th className="text-right py-1">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {telecallerPerf.map((t) => (
                    <tr key={t.name} className="border-b last:border-0">
                      <td className="py-1.5 font-medium">{t.name}</td>
                      <td className="py-1.5 text-right">{t.assigned}</td>
                      <td className="py-1.5 text-right">{t.contacted}</td>
                      <td className="py-1.5 text-right">{t.conversions}</td>
                      <td className="py-1.5 text-right text-green-700 font-semibold">{t.rate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </TabsContent>

        {/* ---- REVENUE ---- */}
        <TabsContent value="revenue" className="space-y-6 pt-4">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-lg border p-4">
              <h3 className="text-sm font-semibold mb-3">Monthly Revenue (Last 12 Months)</h3>
              {loadingRevenue ? <ChartSkeleton /> : (
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={monthlyRevenue}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v) => fmt(Number(v))} />
                    <Line type="monotone" dataKey="revenue" stroke="#22c55e" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="rounded-lg border p-4">
              <h3 className="text-sm font-semibold mb-3">Revenue by Course</h3>
              {loadingRevenue ? <ChartSkeleton /> : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={revByCourse}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="course" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v) => fmt(Number(v))} />
                    <Bar dataKey="revenue" fill="#22c55e" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-lg border p-4">
              <h3 className="text-sm font-semibold mb-3">Payment Mode Split</h3>
              {loadingRevenue ? <ChartSkeleton /> : paymentModes.length === 0 ? (
                <p className="text-sm text-muted-foreground">No payment data</p>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={paymentModes} dataKey="value" nameKey="mode" cx="50%" cy="50%" outerRadius={80} label={({ mode, percent }) => `${mode} ${((percent ?? 0) * 100).toFixed(0)}%`}>
                      {paymentModes.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => fmt(Number(v))} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="rounded-lg border p-4">
              <h3 className="text-sm font-semibold mb-3">Counsellor Revenue (Period)</h3>
              {loadingRevenue ? <Skeleton className="h-32 w-full" /> : counsellorRevenue.length === 0 ? (
                <p className="text-sm text-muted-foreground">No data</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-muted-foreground border-b">
                      <th className="text-left py-1">Counsellor</th>
                      <th className="text-right py-1">Payments</th>
                      <th className="text-right py-1">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {counsellorRevenue.sort((a, b) => b.revenue - a.revenue).map((c) => (
                      <tr key={c.name} className="border-b last:border-0">
                        <td className="py-1.5 font-medium">{c.name}</td>
                        <td className="py-1.5 text-right">{c.count}</td>
                        <td className="py-1.5 text-right font-semibold text-green-700">{fmt(c.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ---- OPERATIONS ---- */}
        <TabsContent value="ops" className="space-y-6 pt-4">
          <div className="rounded-lg border p-4">
            <h3 className="text-sm font-semibold mb-3">Student Enrollment Trend</h3>
            {loadingOps ? <ChartSkeleton /> : (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={enrollmentTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" stroke="#3b82f6" dot />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="rounded-lg border p-4">
            <h3 className="text-sm font-semibold mb-3">Pending Actions</h3>
            {loadingOps ? <Skeleton className="h-20 w-full" /> : (
              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-md bg-amber-50 p-3 text-center">
                  <p className="text-2xl font-bold text-amber-700">{pendingActions.docsMissing}</p>
                  <p className="text-xs text-amber-600 mt-1">Docs Pending</p>
                </div>
                <div className="rounded-md bg-blue-50 p-3 text-center">
                  <p className="text-2xl font-bold text-blue-700">{pendingActions.examsPending}</p>
                  <p className="text-xs text-blue-600 mt-1">Exams Awaiting Result</p>
                </div>
                <div className="rounded-md bg-red-50 p-3 text-center">
                  <p className="text-2xl font-bold text-red-700">{pendingActions.followupsOverdue}</p>
                  <p className="text-xs text-red-600 mt-1">Overdue Followups</p>
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ---- HR ---- */}
        <TabsContent value="hr" className="space-y-6 pt-4">
          <div className="rounded-lg border p-4">
            <h3 className="text-sm font-semibold mb-3">Attendance Rate (Current Month)</h3>
            {loadingHr ? <ChartSkeleton /> : attendanceRates.length === 0 ? (
              <p className="text-sm text-muted-foreground">No attendance data</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={attendanceRates}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} tickFormatter={(v) => v + '%'} />
                  <Tooltip formatter={(v) => Number(v) + '%'} />
                  <Bar dataKey="rate" fill="#6366f1" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="rounded-lg border p-4">
            <h3 className="text-sm font-semibold mb-3">Leave Utilization (This Year)</h3>
            {loadingHr ? <Skeleton className="h-32 w-full" /> : leaveUtil.length === 0 ? (
              <p className="text-sm text-muted-foreground">No leaves approved yet</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-muted-foreground border-b">
                    <th className="text-left py-1">Employee</th>
                    <th className="text-right py-1">Leaves Taken</th>
                  </tr>
                </thead>
                <tbody>
                  {leaveUtil.sort((a, b) => b.leaves - a.leaves).map((l) => (
                    <tr key={l.name} className="border-b last:border-0">
                      <td className="py-1.5 font-medium">{l.name}</td>
                      <td className="py-1.5 text-right">{l.leaves}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
