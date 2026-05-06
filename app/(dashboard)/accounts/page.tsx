import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import AccountsClient from './client'

export default async function AccountsPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single() as { data: { role: string; full_name: string } | null }

  if (!profile || !['admin', 'accounts'].includes(profile.role)) redirect('/')

  const now = new Date()
  const monthStart = format(startOfMonth(now), 'yyyy-MM-dd')
  const monthEnd = format(endOfMonth(now), 'yyyy-MM-dd')

  const [
    incomeMonthRes,
    incomeTotalRes,
    expenseMonthRes,
    studentsRes,
    pendingExpensesRes,
    recentAdmissionsRes,
    coursesRes,
    sessionsRes,
    counsellorsRes,
  ] = await Promise.all([
    supabase.from('payments').select('amount').gte('payment_date', monthStart).lte('payment_date', monthEnd),
    supabase.from('payments').select('amount'),
    supabase.from('expenses').select('amount').neq('status', 'rejected').gte('expense_date', monthStart).lte('expense_date', monthEnd),
    supabase.from('students').select('id, full_name, enrollment_number, total_fee, amount_paid, enrollment_date, status, courses(name), sessions(name)').order('enrollment_date', { ascending: false }).limit(50),
    supabase.from('expenses').select('id').eq('status', 'pending'),
    supabase.from('payments').select('id, amount, payment_date, payment_mode, receipt_number, notes, student_id, lead_id, students(full_name), leads(full_name)').order('payment_date', { ascending: false }).limit(20),
    supabase.from('courses').select('id, name, sub_courses(id, name)').order('name'),
    supabase.from('sessions').select('id, name, is_active').order('created_at', { ascending: false }),
    supabase.from('profiles').select('id, full_name, role').in('role', ['lead', 'counselor']).eq('is_active', true),
  ])

  const incomeMonth = ((incomeMonthRes.data ?? []) as { amount: number }[]).reduce((s, r) => s + (r.amount ?? 0), 0)
  const incomeTotal = ((incomeTotalRes.data ?? []) as { amount: number }[]).reduce((s, r) => s + (r.amount ?? 0), 0)
  const expenseMonth = ((expenseMonthRes.data ?? []) as { amount: number }[]).reduce((s, r) => s + (r.amount ?? 0), 0)
  const pendingExpenseCount = (pendingExpensesRes.data ?? []).length

  const students = (studentsRes.data ?? []) as {
    id: string; full_name: string; enrollment_number: string;
    total_fee: number | null; amount_paid: number | null;
    enrollment_date: string | null; status: string;
    courses: { name: string } | null;
    sessions: { name: string } | null;
  }[]

  const outstandingFees = students.reduce((s, r) => s + Math.max(0, (r.total_fee ?? 0) - (r.amount_paid ?? 0)), 0)

  const recentPayments = ((recentAdmissionsRes.data ?? []) as any[]).map(p => ({
    id: p.id,
    amount: p.amount,
    payment_date: p.payment_date,
    payment_mode: p.payment_mode,
    receipt_number: p.receipt_number,
    notes: p.notes,
    student_name: p.students?.full_name || p.leads?.full_name || 'Manual Income',
  }))

  const courses = (coursesRes.data ?? []) as {
    id: string; name: string;
    sub_courses: { id: string; name: string }[];
  }[]

  const sessions = (sessionsRes.data ?? []) as {
    id: string; name: string; is_active: boolean;
  }[]

  const counsellors = (counsellorsRes.data ?? []) as {
    id: string; full_name: string; role: string;
  }[]

  // Course-wise fee collection from students
  const courseStats = courses.map(course => {
    const courseStudents = students.filter(s => (s.courses as any)?.name === course.name)
    const totalFee = courseStudents.reduce((s, r) => s + (r.total_fee ?? 0), 0)
    const collectedFee = courseStudents.reduce((s, r) => s + (r.amount_paid ?? 0), 0)
    return {
      id: course.id,
      name: course.name,
      studentCount: courseStudents.length,
      totalFee,
      collectedFee,
      pendingFee: Math.max(0, totalFee - collectedFee),
    }
  }).filter(c => c.studentCount > 0).sort((a, b) => b.collectedFee - a.collectedFee)

  return (
    <AccountsClient
      userName={profile.full_name}
      month={format(now, 'MMMM yyyy')}
      incomeMonth={incomeMonth}
      incomeTotal={incomeTotal}
      expenseMonth={expenseMonth}
      outstandingFees={outstandingFees}
      pendingExpenseCount={pendingExpenseCount}
      students={students}
      recentPayments={recentPayments}
      courses={courses}
      sessions={sessions}
      counsellors={counsellors}
      courseStats={courseStats}
    />
  )
}
