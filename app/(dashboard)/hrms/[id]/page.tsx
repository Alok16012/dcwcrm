import { redirect, notFound } from 'next/navigation'
import { format, getMonth, getYear } from 'date-fns'
import { createServerClient } from '@/lib/supabase/server'
import { ROLE_LABELS } from '@/types/app.types'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import AttendanceGrid from '@/components/hrms/AttendanceGrid'
import PayrollTable from '@/components/hrms/PayrollTable'

interface PageProps {
  params: { id: string }
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)

export default async function EmployeeDetailPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) redirect('/login')

  const { data: currentProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single() as { data: { role: string } | null }

  if (!currentProfile || !['admin', 'backend'].includes(currentProfile.role)) redirect('/')

  const now = new Date()
  const currentMonth = getMonth(now) + 1
  const currentYear = getYear(now)
  const monthStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}`

  const empRes = await supabase.from('employees').select('id, employee_code, department, designation, joining_date, basic_salary, hra, allowances, pf_deduction, tds_deduction, bank_account, bank_ifsc, is_active, profile_id, salary_cycle_start_day').eq('id', id).single()

  const employee = empRes.data as {
    id: string; employee_code: string; department: string | null; designation: string | null;
    joining_date: string | null; basic_salary: number; hra: number; allowances: number;
    pf_deduction: number; tds_deduction: number; bank_account: string | null;
    bank_ifsc: string | null; is_active: boolean; profile_id: string;
    salary_cycle_start_day: number | null;
  } | null

  if (!employee) notFound()

  const [attRes, payrollRes, studentsRes] = await Promise.all([
    supabase.from('attendance').select('date, status').eq('employee_id', id).gte('date', `${monthStr}-01`).lte('date', `${monthStr}-31`),
    supabase.from('payroll').select('*').eq('employee_id', id).order('year', { ascending: false }).order('month', { ascending: false }),
    supabase.from('students').select('id, full_name, course:courses(name), incentive_amount, enrollment_date').eq('assigned_counsellor', employee.profile_id).gt('incentive_amount', 0),
  ])

  const attendanceRaw = attRes.data as { date: string; status: string }[] | null
  const payrollData = payrollRes.data as Record<string, unknown>[] | null

  // Fetch profile separately
  const { data: profileRaw } = await supabase.from('profiles').select('id, full_name, email, phone, role').eq('id', employee.profile_id).single()
  const profile = profileRaw as { id: string; full_name: string; email: string; phone: string | null; role: string } | null

  // Build attendance map keyed by date string
  const attendanceMap: Record<string, import('@/types/app.types').AttendanceStatus> = {}
  for (const a of attendanceRaw ?? []) {
    attendanceMap[a.date] = a.status as import('@/types/app.types').AttendanceStatus
  }

  // Compute cycle dates for this employee
  const cycleDay = employee.salary_cycle_start_day ?? 1
  const cycleStartDate = cycleDay === 1
    ? `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`
    : (() => {
        const d = new Date(currentYear, currentMonth - 2, cycleDay)
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      })()
  const cycleEndDate = cycleDay === 1
    ? (() => { const d = new Date(currentYear, currentMonth, 0); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` })()
    : (() => {
        const d = new Date(currentYear, currentMonth - 1, cycleDay - 1)
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      })()

  const employeeAttendance = [{
    employee_id: employee.id,
    employee_name: profile?.full_name ?? '—',
    cycle_start: cycleStartDate,
    cycle_end: cycleEndDate,
    attendance: attendanceMap,
  }]

  type PayrollRow = { id: string; employee_id: string; employee_name: string; employee_code?: string; designation?: string; department?: string; bank_account?: string; month: number; year: number; basic: number; hra: number; allowances: number; incentive: number; gross: number; pf: number; tds: number; other_deductions: number; leave_deduction: number; net: number; status: 'draft' | 'processed' | 'paid'; payment_date: string | null }
  const payrollRows = (payrollData ?? []).map((p) => ({
    ...(p as Record<string, unknown>),
    employee_name: profile?.full_name ?? '—',
    employee_code: employee.employee_code ?? undefined,
    designation: employee.designation ?? undefined,
    department: employee.department ?? undefined,
    bank_account: employee.bank_account ?? undefined,
  })) as PayrollRow[]

  const assignedStudents = (studentsRes.data as any[]) ?? []
  
  // Calculate current cycle incentives
  const startDay = employee.salary_cycle_start_day || 1
  let cycleStart: Date;
  let cycleEnd: Date;
  if (startDay === 1) {
    cycleStart = new Date(currentYear, currentMonth - 1, 1)
    cycleEnd = new Date(currentYear, currentMonth, 0)
  } else {
    cycleStart = new Date(currentYear, currentMonth - 2, startDay)
    cycleEnd = new Date(currentYear, currentMonth - 1, startDay - 1)
  }

  const currentCycleIncentives = assignedStudents
    .filter(s => {
      if (!s.enrollment_date) return false
      const d = new Date(s.enrollment_date)
      return d >= cycleStart && d <= cycleEnd
    })
    .reduce((acc, s) => acc + (s.incentive_amount || 0), 0)

  const totalIncentives = assignedStudents.reduce((acc, s) => acc + (s.incentive_amount || 0), 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{profile?.full_name ?? 'Employee'}</h1>
        <p className="text-sm text-muted-foreground">{employee.employee_code} · {employee.designation}</p>
      </div>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="payroll">Payroll History</TabsTrigger>
          <TabsTrigger value="incentives">Incentives</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-4 pt-4">
          <div className="grid grid-cols-2 gap-4 rounded-lg border p-4 sm:grid-cols-3">
            <InfoRow label="Full Name" value={profile?.full_name ?? '—'} />
            <InfoRow label="Email" value={profile?.email ?? '—'} />
            <InfoRow label="Phone" value={profile?.phone ?? '—'} />
            <InfoRow label="Role" value={profile?.role ? (ROLE_LABELS[profile.role as import('@/types/app.types').UserRole] ?? profile.role) : '—'} />
            <InfoRow label="Department" value={employee.department ?? '—'} />
            <InfoRow label="Designation" value={employee.designation ?? '—'} />
            <InfoRow label="Joining Date" value={employee.joining_date ? format(new Date(employee.joining_date), 'dd MMM yyyy') : '—'} />
            <InfoRow label="Status" value={employee.is_active ? 'Active' : 'Inactive'} className="capitalize" />
          </div>
          <div className="rounded-lg border p-4">
            <h3 className="font-semibold mb-3">Salary Structure</h3>
            <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
              <InfoRow label="Basic" value={fmt(employee.basic_salary)} />
              <InfoRow label="HRA" value={fmt(employee.hra)} />
              <InfoRow label="Allowances" value={fmt(employee.allowances)} />
              <InfoRow label="PF Deduction" value={fmt(employee.pf_deduction)} />
              <InfoRow label="TDS" value={fmt(employee.tds_deduction)} />
              <InfoRow label="Gross" value={fmt(employee.basic_salary + employee.hra + employee.allowances)} />
            </div>
          </div>
          {(employee.bank_account || employee.bank_ifsc) && (
            <div className="rounded-lg border p-4">
              <h3 className="font-semibold mb-3">Bank Details</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <InfoRow label="Account" value={employee.bank_account ?? '—'} />
                <InfoRow label="IFSC" value={employee.bank_ifsc ?? '—'} />
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="attendance" className="pt-4">
          <AttendanceGrid
            data={employeeAttendance}
            year={currentYear}
            month={currentMonth}
            rangeStart={cycleStartDate}
            rangeEnd={cycleEndDate}
          />
        </TabsContent>

        <TabsContent value="payroll" className="space-y-4 pt-4">
          <PayrollTable 
            data={payrollRows} 
            isAdmin={['admin', 'backend'].includes(currentProfile.role)} 
            employeeId={employee.id} 
            totalIncentives={currentCycleIncentives} 
            employeeName={profile?.full_name || 'Employee'} 
            employeeCode={employee.employee_code || undefined}
            designation={employee.designation || undefined}
            department={employee.department || undefined}
          />
        </TabsContent>

        <TabsContent value="incentives" className="pt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-lg border p-4 bg-purple-50/50 flex justify-between items-center transition-all hover:shadow-sm">
              <div>
                <h3 className="font-semibold text-purple-900">Current Cycle Incentive</h3>
                <p className="text-xs text-purple-700">
                  {format(cycleStart, 'dd MMM')} to {format(cycleEnd, 'dd MMM yyyy')}
                </p>
              </div>
              <div className="text-2xl font-bold text-purple-700">
                {fmt(currentCycleIncentives)}
              </div>
            </div>
            <div className="rounded-lg border p-4 bg-gray-50/50 flex justify-between items-center">
              <div>
                <h3 className="font-semibold text-gray-900">Total Career Incentives</h3>
                <p className="text-xs text-gray-700">Lifetime verified earnings</p>
              </div>
              <div className="text-xl font-bold text-gray-700">
                {fmt(totalIncentives)}
              </div>
            </div>
          </div>

          {/* Month-wise summary */}
          {assignedStudents.length > 0 && (() => {
            const monthMap: Record<string, { label: string; total: number }> = {}
            for (const s of assignedStudents) {
              if (!s.enrollment_date) continue
              const d = new Date(s.enrollment_date)
              const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
              const label = format(d, 'MMMM yyyy')
              if (!monthMap[key]) monthMap[key] = { label, total: 0 }
              monthMap[key].total += s.incentive_amount || 0
            }
            const months = Object.entries(monthMap).sort((a, b) => b[0].localeCompare(a[0]))
            return (
              <div className="rounded-lg border overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 border-b">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Month-wise Breakdown</p>
                </div>
                <div className="divide-y">
                  {months.map(([key, { label, total }]) => (
                    <div key={key} className="flex justify-between items-center px-4 py-3">
                      <span className="text-sm font-medium text-gray-700">{label}</span>
                      <span className="text-sm font-bold text-purple-700">{fmt(total)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}

          {/* Student-wise detail */}
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Student Name</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Course</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Enrollment Date</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Incentive</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {assignedStudents.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-gray-400">No incentives recorded yet</td>
                  </tr>
                ) : (
                  assignedStudents.map((s: any) => (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{s.full_name}</td>
                      <td className="px-4 py-3 text-gray-600">{s.course?.name || '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{s.enrollment_date ? format(new Date(s.enrollment_date), 'dd MMM yyyy') : '—'}</td>
                      <td className="px-4 py-3 text-right font-medium text-green-600">{fmt(s.incentive_amount)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function InfoRow({ label, value, className = '' }: { label: string; value: string; className?: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`font-medium ${className}`}>{value}</p>
    </div>
  )
}
