import { redirect, notFound } from 'next/navigation'
import { format, getMonth, getYear } from 'date-fns'
import { createServerClient } from '@/lib/supabase/server'
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
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user ?? null
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

  const empRes = await supabase.from('employees').select('id, employee_code, department, designation, joining_date, basic_salary, hra, allowances, pf_deduction, tds_deduction, bank_account, bank_ifsc, is_active, profile_id').eq('id', id).single()

  const employee = empRes.data as {
    id: string; employee_code: string; department: string | null; designation: string | null;
    joining_date: string | null; basic_salary: number; hra: number; allowances: number;
    pf_deduction: number; tds_deduction: number; bank_account: string | null;
    bank_ifsc: string | null; is_active: boolean; profile_id: string;
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

  // Build attendance map
  const attendanceMap: Record<number, import('@/types/app.types').AttendanceStatus> = {}
  for (const a of attendanceRaw ?? []) {
    const day = Number(a.date.split('-')[2])
    attendanceMap[day] = a.status as import('@/types/app.types').AttendanceStatus
  }

  const employeeAttendance = [{
    employee_id: employee.id,
    employee_name: profile?.full_name ?? '—',
    attendance: attendanceMap,
  }]

  type PayrollRow = { id: string; employee_id: string; employee_name: string; month: number; year: number; basic: number; hra: number; allowances: number; incentive: number; gross: number; pf: number; tds: number; other_deductions: number; leave_deduction: number; net: number; status: 'draft' | 'processed' | 'paid'; payment_date: string | null }
  const payrollRows = (payrollData ?? []).map((p) => ({
    ...(p as Record<string, unknown>),
    employee_name: profile?.full_name ?? '—',
  })) as PayrollRow[]

  const assignedStudents = (studentsRes.data as any[]) ?? []
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
            <InfoRow label="Role" value={profile?.role ?? '—'} className="capitalize" />
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
          />
        </TabsContent>

        <TabsContent value="payroll" className="space-y-4 pt-4">
          <PayrollTable data={payrollRows} isAdmin={profile?.role === 'admin'} employeeId={employee.id} totalIncentives={totalIncentives} employeeName={profile?.full_name || 'Employee'} />
        </TabsContent>

        <TabsContent value="incentives" className="pt-4 space-y-4">
          <div className="rounded-lg border p-4 bg-purple-50/50 flex justify-between items-center">
            <div>
              <h3 className="font-semibold text-purple-900">Total Valid Incentives</h3>
              <p className="text-sm text-purple-700">From successful student enrollments</p>
            </div>
            <div className="text-2xl font-bold text-purple-700">
              {fmt(totalIncentives)}
            </div>
          </div>

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
                  assignedStudents.map(s => (
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
