import { createServerClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { StudentDetailClient } from './client'

interface Props {
  params: { id: string }
}

export default async function StudentDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user ?? null
  if (!user) redirect('/login')

  const { data: student } = await supabase
    .from('students')
    .select(`
      *,
      course:courses(id, name, is_active, created_at),
      sub_course:sub_courses(id, name, is_active, created_at, course_id),
      department:departments(id, name),
      sub_section:department_sub_sections(id, name),
      counsellor:profiles!students_assigned_counsellor_fkey(id, email, full_name, role, is_active, created_at)
    `)
    .eq('id', id)
    .single()

  if (!student) notFound()

  const { data: payments } = await supabase
    .from('payments')
    .select('*, recorder:profiles(id, email, full_name, role, is_active, created_at)')
    .eq('student_id', id)
    .order('payment_date', { ascending: false })

  const { data: documents } = await supabase
    .from('student_documents')
    .select('*')
    .eq('student_id', id)

  const { data: exams } = await supabase
    .from('student_exams')
    .select('*')
    .eq('student_id', id)
    .order('created_at', { ascending: false })

  return (
    <StudentDetailClient
      student={student as never}
      payments={(payments ?? []) as never}
      documents={(documents ?? []) as never}
      exams={(exams ?? []) as never}
    />
  )
}
