'use client'
import { useState, useEffect, useCallback, useTransition, useRef, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { format } from 'date-fns'
import { MoreVertical, Pencil, FileText, Search, Trash2, Download, ChevronLeft, ChevronRight, UserPlus, CheckCircle2, Clock, XCircle, GraduationCap, Star, IndianRupee } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { DataTable } from '@/components/shared/DataTable'
import { PageHeader } from '@/components/shared/PageHeader'
import { createClient } from '@/lib/supabase/client'
import { Textarea } from '@/components/ui/textarea'
import { StudentForm } from '@/components/backend/StudentForm'
import { PrintInvoiceButton } from '@/components/backend/PrintInvoiceButton'
import { toast } from 'sonner'
import { formatCurrency, type Student } from '@/types/app.types'

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  completed: 'bg-blue-100 text-blue-800',
  dropped: 'bg-red-100 text-red-800',
  on_hold: 'bg-yellow-100 text-yellow-800',
}

const MODE_COLORS: Record<string, string> = {
  attending: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'non-attending': 'bg-orange-100 text-orange-700 border-orange-200',
}

const COUNSELLOR_PALETTE = [
  'bg-violet-100 text-violet-700',
  'bg-sky-100 text-sky-700',
  'bg-pink-100 text-pink-700',
  'bg-teal-100 text-teal-700',
  'bg-amber-100 text-amber-700',
  'bg-indigo-100 text-indigo-700',
  'bg-rose-100 text-rose-700',
  'bg-cyan-100 text-cyan-700',
]

function initials(name: string) {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

function counsellorColor(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff
  return COUNSELLOR_PALETTE[h % COUNSELLOR_PALETTE.length]
}

interface FilterOption { id: string; name: string }
interface BoardOption { id: string; name: string; department_id: string }

export function BackendListClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const deptParam = searchParams.get('dept')

  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [paymentFilter, setPaymentFilter] = useState('')
  const [courseFilter, setCourseFilter] = useState('')
  const [sessionFilter, setSessionFilter] = useState('')
  const [counsellorFilter, setCounsellorFilter] = useState('')
  const [modeFilter, setModeFilter] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState(deptParam || '')
  const [boardFilter, setBoardFilter] = useState('')
  const [courses, setCourses] = useState<FilterOption[]>([])
  const [sessions, setSessions] = useState<FilterOption[]>([])
  const [counsellors, setCounsellors] = useState<FilterOption[]>([])
  const [departments, setDepartments] = useState<FilterOption[]>([])
  const [allBoards, setAllBoards] = useState<BoardOption[]>([])
  const [boards, setBoards] = useState<BoardOption[]>([])
  const [allBoardCounts, setAllBoardCounts] = useState<Record<string, number>>({})
  const [editStudent, setEditStudent] = useState<Student | null>(null)
  const [deleteStudent, setDeleteStudent] = useState<Student | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [activeTab, setActiveTab] = useState<'students' | 'pending' | 'mentorships'>('students')
  const [pendingStudents, setPendingStudents] = useState<any[]>([])
  const [pendingLoading, setPendingLoading] = useState(false)
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [rejectTarget, setRejectTarget] = useState<any | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejecting, setRejecting] = useState(false)
  // Mentorship approvals
  const [mentorships, setMentorships] = useState<any[]>([])
  const [mentorshipsLoading, setMentorshipsLoading] = useState(false)
  const [salaryPct, setSalaryPct] = useState<Record<string, string>>({})
  const [adminRemarks, setAdminRemarks] = useState<Record<string, string>>({})
  const [approvingMentor, setApprovingMentor] = useState<string | null>(null)
  const tabScrollRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  function scrollTabs(dir: 'left' | 'right') {
    if (tabScrollRef.current) {
      tabScrollRef.current.scrollBy({ left: dir === 'left' ? -200 : 200, behavior: 'smooth' })
    }
  }

  // Load filter options once
  useEffect(() => {
    async function loadOptions() {
      const [coursesRes, sessionsRes, counsellorsRes, deptRes, boardRes] = await Promise.all([
        supabase.from('courses').select('id, name').eq('is_active', true).order('name'),
        supabase.from('sessions').select('id, name').order('name'),
        supabase.from('profiles').select('id, full_name').in('role', ['lead', 'telecaller', 'counselor']).order('full_name'),
        supabase.from('departments').select('id, name').order('name'),
        supabase.from('department_sub_sections').select('id, name, department_id').order('name'),
      ])
      setCourses((coursesRes.data ?? []) as FilterOption[])
      setSessions((sessionsRes.data ?? []) as FilterOption[])
      setCounsellors(((counsellorsRes.data ?? []) as { id: string; full_name: string }[]).map(p => ({ id: p.id, name: p.full_name })))
      setDepartments((deptRes.data ?? []) as FilterOption[])
      const allB = (boardRes.data ?? []) as BoardOption[]
      setAllBoards(allB)
      setBoards(allB)

      // Fetch board-wise student counts (no filters — true count per board)
      const { data: countData } = await supabase
        .from('students')
        .select('sub_section_id')
        .neq('status', 'dropped')
        .neq('status', 'pending')
      const counts: Record<string, number> = {}
      ;(countData ?? []).forEach((s: any) => {
        if (s.sub_section_id) counts[s.sub_section_id] = (counts[s.sub_section_id] ?? 0) + 1
      })
      setAllBoardCounts(counts)
    }
    loadOptions()
  }, [])

  // Filter boards based on selected department
  useEffect(() => {
    if (!departmentFilter) {
      setBoards(allBoards)
    } else {
      const filtered = allBoards.filter(b => b.department_id === departmentFilter)
      setBoards(filtered)
      // If current boardFilter doesn't belong to this department, reset it
      if (boardFilter && !filtered.find(b => b.id === boardFilter)) {
        setBoardFilter('')
      }
    }
  }, [departmentFilter, allBoards])

  const fetchStudents = useCallback(async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('students')
        .select(`
          *,
          course:courses(id, name, is_active, created_at),
          sub_course:sub_courses(id, name, is_active, created_at, course_id),
          department:departments(id, name),
          sub_section:department_sub_sections(id, name),
          session:sessions(id, name),
          counsellor:profiles!students_assigned_counsellor_fkey(id, email, full_name, role, is_active, created_at),
          associate:associates!students_referred_by_associate_fkey(id, name, associate_code)
        `)
        .order('enrollment_date', { ascending: true })

      if (search) query = query.or(`full_name.ilike.%${search}%,phone.ilike.%${search}%`)
      if (statusFilter) query = query.eq('status', statusFilter)
      else query = query.neq('status', 'dropped').neq('status', 'pending')
      if (courseFilter) query = query.eq('course_id', courseFilter)
      if (sessionFilter) query = query.eq('session_id', sessionFilter)
      if (counsellorFilter) query = query.eq('assigned_counsellor', counsellorFilter)
      if (modeFilter) query = query.eq('mode', modeFilter)
      if (departmentFilter) query = query.eq('department_id', departmentFilter)
      if (boardFilter) query = query.eq('sub_section_id', boardFilter)
      if (paymentFilter === 'paid') query = query.gt('amount_paid', 0).gte('amount_paid', 'total_fee')
      if (paymentFilter === 'unpaid') query = query.eq('amount_paid', 0)
      if (paymentFilter === 'partial') query = query.gt('amount_paid', 0).lt('amount_paid', 'total_fee')

      const { data, error } = await query
      if (error) {
        console.error('Supabase error fetching students:', error)
        throw error
      }
      setStudents((data as Student[]) ?? [])
    } catch (err) {
      console.error('Catch error fetching students:', err)
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter, paymentFilter, courseFilter, sessionFilter, counsellorFilter, modeFilter, departmentFilter, boardFilter])

  // Tabs: filter by dept if selected, then deduplicate by name to avoid same-name boards from multiple depts
  const tabBoards = useMemo(() => {
    const source = departmentFilter
      ? allBoards.filter(b => b.department_id === departmentFilter)
      : allBoards
    const seen = new Set<string>()
    return source.filter(b => {
      const key = b.name.toLowerCase().trim()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [allBoards, departmentFilter])

  const loadPending = useCallback(async () => {
    setPendingLoading(true)
    const { data } = await (supabase as any)
      .from('students')
      .select(`*, course:courses(name), department:departments(name), sub_section:department_sub_sections(name), counsellor:profiles!students_assigned_counsellor_fkey(full_name)`)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    setPendingStudents(data ?? [])
    setPendingLoading(false)
  }, [supabase])

  const loadMentorships = useCallback(async () => {
    setMentorshipsLoading(true)
    const { data } = await (supabase as any)
      .from('student_mentorships')
      .select(`
        *,
        student:students(id, full_name, enrollment_number, phone),
        telecaller:profiles!student_mentorships_telecaller_id_fkey(id, full_name)
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    setMentorships(data ?? [])
    setMentorshipsLoading(false)
  }, [supabase])

  async function approveMentorship(id: string) {
    setApprovingMentor(id)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const pct = salaryPct[id] ? parseFloat(salaryPct[id]) : null
      const remarks = adminRemarks[id] || null
      const { error } = await (supabase as any)
        .from('student_mentorships')
        .update({
          status: 'approved',
          salary_percentage: pct,
          admin_remarks: remarks,
          approved_by: user?.id ?? null,
          approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
      if (error) throw error
      toast.success('Mentorship approved')
      setMentorships(prev => prev.filter(m => m.id !== id))
    } catch {
      toast.error('Failed to approve mentorship')
    } finally {
      setApprovingMentor(null)
    }
  }

  async function rejectMentorship(id: string) {
    setApprovingMentor(id)
    try {
      const remarks = adminRemarks[id] || null
      const { error } = await (supabase as any)
        .from('student_mentorships')
        .update({ status: 'rejected', admin_remarks: remarks, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
      toast.success('Mentorship rejected')
      setMentorships(prev => prev.filter(m => m.id !== id))
    } catch {
      toast.error('Failed to reject mentorship')
    } finally {
      setApprovingMentor(null)
    }
  }

  async function approveStudent(id: string) {
    setApprovingId(id)
    try {
      const { error } = await supabase.from('students').update({ status: 'active' } as never).eq('id', id)
      if (error) throw error
      toast.success('Student approved and activated')
      setPendingStudents(prev => prev.filter(s => s.id !== id))
    } catch {
      toast.error('Failed to approve student')
    } finally {
      setApprovingId(null)
    }
  }

  async function rejectStudent() {
    if (!rejectTarget) return
    setRejecting(true)
    try {
      const { error } = await supabase.from('students').update({ status: 'dropped' } as never).eq('id', rejectTarget.id)
      if (error) throw error
      toast.success('Student rejected')
      setPendingStudents(prev => prev.filter(s => s.id !== rejectTarget.id))
      setRejectTarget(null)
      setRejectReason('')
    } catch {
      toast.error('Failed to reject student')
    } finally {
      setRejecting(false)
    }
  }

  async function handleDeleteStudent(id: string) {
    try {
      const { error } = await supabase.from('students').delete().eq('id', id)
      if (error) throw error
      setStudents((prev) => prev.filter((s) => s.id !== id))
      toast.success('Student deleted successfully')
    } catch (err) {
      toast.error('Failed to delete student')
      console.error(err)
    }
    setDeleteStudent(null)
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const xlsx = await import('xlsx')
      const rows = students.map((s) => ({
        Name: s.full_name,
        Phone: s.phone,
        Email: s.email || '-',
        City: s.city || '-',
        Mode: s.mode || '-',
        Session: s.session?.name || '-',
        Department: s.department?.name || '-',
        Course: s.course?.name || '-',
        'Sub Course': s.sub_course?.name || '-',
        'Total Fee': s.total_fee || 0,
        'Amount Paid': s.amount_paid || 0,
        'Pending Balance': (s.total_fee || 0) - (s.amount_paid || 0),
        Status: s.status,
        'Enrollment Date': s.enrollment_date ? format(new Date(s.enrollment_date), 'dd MMM yyyy') : '-',
      }))
      const ws = xlsx.utils.json_to_sheet(rows)
      const wb = xlsx.utils.book_new()
      xlsx.utils.book_append_sheet(wb, ws, 'Students')
      xlsx.writeFile(wb, `students-export-${format(new Date(), 'yyyy-MM-dd')}.xlsx`)
      toast.success('Students exported successfully')
    } catch (err) {
      console.error('Export error:', err)
      toast.error('Failed to export students')
    } finally {
      setExporting(false)
    }
  }

  useEffect(() => {
    const timer = setTimeout(fetchStudents, 300)
    return () => clearTimeout(timer)
  }, [fetchStudents])

  // Always load pending count on mount for badge; reload when switching to tab
  useEffect(() => { loadPending(); loadMentorships() }, [loadPending, loadMentorships])
  useEffect(() => {
    if (activeTab === 'pending') loadPending()
    if (activeTab === 'mentorships') loadMentorships()
  }, [activeTab, loadPending, loadMentorships])

  const columns: ColumnDef<Student>[] = [
    {
      id: 'select',
      header: ({ table }) => (
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-gray-300 accent-primary cursor-pointer"
          checked={table.getIsAllPageRowsSelected()}
          ref={(el) => {
            if (el) el.indeterminate = table.getIsSomePageRowsSelected()
          }}
          onChange={(e) => table.toggleAllPageRowsSelected(e.target.checked)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-gray-300 accent-primary cursor-pointer"
          checked={row.getIsSelected()}
          onChange={(e) => row.toggleSelected(e.target.checked)}
          aria-label="Select row"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      id: 'serial',
      header: 'S.No',
      cell: ({ row }) => <span className="text-gray-500 tabular-nums">{row.index + 1}</span>,
    },
    { accessorKey: 'full_name', header: 'Name', cell: ({ row }) => <span className="font-medium">{row.original.full_name}</span> },
    { id: 'guardian_name', accessorFn: (row) => row.guardian_name ?? '', header: "Father's Name", cell: ({ row }) => row.original.guardian_name ?? '-' },
    { accessorKey: 'phone', header: 'Phone' },
    {
      id: 'mode', accessorFn: (row) => row.mode ?? '', header: 'Mode',
      cell: ({ row }) => {
        const m = row.original.mode
        if (!m) return <span className="text-gray-400 text-xs">-</span>
        return (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${MODE_COLORS[m] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
            {m === 'attending' ? '● Attending' : '○ Non-Attending'}
          </span>
        )
      }
    },
    {
      id: 'session', accessorFn: (row) => row.session?.name ?? '', header: 'Session',
      cell: ({ row }) => {
        const s = row.original.session?.name
        if (!s) return <span className="text-gray-400 text-xs">-</span>
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">{s}</span>
      }
    },
    {
      id: 'department', accessorFn: (row) => row.department?.name ?? '', header: 'Dept',
      cell: ({ row }) => {
        const d = row.original.department?.name
        if (!d) return <span className="text-gray-400 text-xs">-</span>
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">{d}</span>
      }
    },
    {
      id: 'sub_section', accessorFn: (row) => row.sub_section?.name ?? '', header: 'Board',
      cell: ({ row }) => {
        const b = row.original.sub_section?.name
        if (!b) return <span className="text-gray-400 text-xs">-</span>
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">{b}</span>
      }
    },
    {
      id: 'course', accessorFn: (row) => row.course?.name ?? '', header: 'Course',
      cell: ({ row }) => {
        const c = row.original.course?.name
        if (!c) return <span className="text-gray-400 text-xs">-</span>
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">{c}</span>
      }
    },
    {
      id: 'counsellor', accessorFn: (row) => row.counsellor?.full_name ?? '', header: 'Counsellor',
      cell: ({ row }) => {
        const name = row.original.counsellor?.full_name
        if (!name) return <span className="text-gray-400 text-xs">-</span>
        const color = counsellorColor(name)
        return (
          <span className="inline-flex items-center gap-1.5">
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${color}`}>
              {initials(name)}
            </span>
            <span className="text-xs font-medium text-gray-700 truncate max-w-[90px]">{name}</span>
          </span>
        )
      }
    },
    {
      id: 'associate', accessorFn: (row: any) => (row as any).associate?.name ?? '', header: 'Associate',
      cell: ({ row }: any) => {
        const a = (row.original as any).associate
        if (!a) return <span className="text-gray-400 text-xs">-</span>
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 whitespace-nowrap">
            {a.name}
            {a.associate_code && <span className="text-indigo-400 font-normal">({a.associate_code})</span>}
          </span>
        )
      }
    },
    { accessorKey: 'total_fee', header: 'Total Fee', cell: ({ row }) => row.original.total_fee ? formatCurrency(row.original.total_fee) : '-' },
    { accessorKey: 'amount_paid', header: 'Paid', cell: ({ row }) => <span className="text-green-700">{formatCurrency(row.original.amount_paid ?? 0)}</span> },
    {
      id: 'pending', header: 'Pending', cell: ({ row }) => {
        const p = (row.original.total_fee ?? 0) - (row.original.amount_paid ?? 0)
        return p > 0 ? <span className="text-red-600">{formatCurrency(p)}</span> : <span className="text-gray-400">-</span>
      }
    },
    {
      accessorKey: 'status', header: 'Status', cell: ({ row }) => (
        <Badge className={`${STATUS_COLORS[row.original.status] ?? 'bg-gray-100 text-gray-800'} border-0 text-xs`}>
          {row.original.status}
        </Badge>
      )
    },
    { accessorKey: 'enrollment_date', header: 'Enrolled', cell: ({ row }) => row.original.enrollment_date ? format(new Date(row.original.enrollment_date), 'dd MMM yyyy') : '-' },
    {
      id: 'actions',
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0" onClick={(e) => e.stopPropagation()}>
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setEditStudent(row.original) }}>
              <Pencil className="mr-2 h-4 w-4" />
              Update Details
            </DropdownMenuItem>
            <div onClick={(e) => e.stopPropagation()}>
              <PrintInvoiceButton student={row.original} />
            </div>
            <DropdownMenuItem
              className="text-red-500 focus:text-red-600 focus:bg-red-50"
              onClick={(e) => { e.stopPropagation(); setDeleteStudent(row.original) }}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Student
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Students"
        description="Manage enrolled students, fees, documents and exams"
        action={(
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
              <Download className="mr-2 h-4 w-4" />
              {exporting ? 'Exporting...' : 'Export Excel'}
            </Button>
            <Button size="sm" onClick={() => setShowAdd(true)}>
              <FileText className="mr-2 h-4 w-4" /> Add Student
            </Button>
          </div>
        )}
      />

      {/* Main tab switcher: Students vs Pending Approvals */}
      <div className="flex gap-2 border-b border-slate-200 pb-0">
        <button
          onClick={() => setActiveTab('students')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'students'
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <FileText className="w-4 h-4" /> All Students
        </button>
        <button
          onClick={() => setActiveTab('pending')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'pending'
              ? 'border-amber-500 text-amber-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <UserPlus className="w-4 h-4" /> New Students
          {pendingStudents.length > 0 && (
            <span className="bg-amber-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
              {pendingStudents.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('mentorships')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'mentorships'
              ? 'border-violet-600 text-violet-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <GraduationCap className="w-4 h-4" /> Mentorships
          {mentorships.length > 0 && (
            <span className="bg-violet-600 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
              {mentorships.length}
            </span>
          )}
        </button>
      </div>

      {/* ── PENDING APPROVALS TAB ── */}
      {activeTab === 'pending' && (
        <div className="space-y-3">
          {pendingLoading ? (
            <div className="text-center py-16 text-muted-foreground text-sm">Loading…</div>
          ) : pendingStudents.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <UserPlus className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No pending students</p>
              <p className="text-xs mt-1">Converted leads will appear here for approval</p>
            </div>
          ) : (
            <div className="rounded-xl border overflow-hidden bg-white">
              <table className="w-full text-sm">
                <thead className="bg-amber-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Name</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600 hidden sm:table-cell">Phone</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600 hidden md:table-cell">Course</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600 hidden lg:table-cell">Counselor</th>
                    <th className="text-right px-4 py-3 font-semibold text-slate-600 hidden md:table-cell">Total Fee</th>
                    <th className="text-right px-4 py-3 font-semibold text-slate-600 hidden md:table-cell">Paid</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-600">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {pendingStudents.map((s: any) => (
                    <tr key={s.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{s.full_name}</p>
                        <p className="text-xs text-muted-foreground">{s.department?.name ?? '—'}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-600 hidden sm:table-cell">{s.phone}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs hidden md:table-cell">{s.course?.name ?? '—'}</td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <span className="inline-flex items-center gap-1.5 text-xs text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                          {s.counsellor?.full_name ?? '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700 font-mono text-xs hidden md:table-cell">
                        {s.total_fee ? `₹${Number(s.total_fee).toLocaleString('en-IN')}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-green-700 font-mono text-xs hidden md:table-cell">
                        {s.amount_paid ? `₹${Number(s.amount_paid).toLocaleString('en-IN')}` : '₹0'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            className="h-7 text-xs gap-1.5 bg-green-600 hover:bg-green-700"
                            disabled={approvingId === s.id}
                            onClick={() => approveStudent(s.id)}
                          >
                            {approvingId === s.id
                              ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              : <><CheckCircle2 className="w-3.5 h-3.5" /> Approve</>
                            }
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1.5 text-red-600 border-red-200 hover:bg-red-50"
                            onClick={() => { setRejectTarget(s); setRejectReason('') }}
                          >
                            <XCircle className="w-3.5 h-3.5" /> Reject
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-4 py-2 border-t bg-amber-50/50 text-xs text-amber-700">
                {pendingStudents.length} student{pendingStudents.length !== 1 ? 's' : ''} awaiting approval
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── MENTORSHIPS TAB ── */}
      {activeTab === 'mentorships' && (
        <div className="space-y-3">
          {mentorshipsLoading ? (
            <div className="text-center py-16 text-muted-foreground text-sm">Loading…</div>
          ) : mentorships.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <GraduationCap className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No pending mentorships</p>
              <p className="text-xs mt-1">Mentorship submissions from student records will appear here</p>
            </div>
          ) : (
            <div className="rounded-xl border overflow-hidden bg-white">
              <div className="px-4 py-2.5 bg-violet-50 border-b flex items-center justify-between">
                <p className="text-xs font-bold text-violet-700 uppercase tracking-wider">Pending Mentorship Approvals</p>
                <span className="text-xs text-violet-600">{mentorships.length} pending</span>
              </div>
              <div className="divide-y">
                {mentorships.map((m: any) => (
                  <div key={m.id} className="px-4 py-4">
                    <div className="flex items-start gap-4">
                      <div className="flex-1 min-w-0">
                        {/* Header row */}
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-sm font-bold text-gray-800">{m.student?.full_name ?? '—'}</span>
                          {m.student?.enrollment_number && (
                            <span className="text-xs text-gray-400 font-mono">#{m.student.enrollment_number}</span>
                          )}
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-100 text-violet-700 border border-violet-200">
                            {m.task_type === 'work_assignment' ? 'Work Assignment' : m.task_type === 'practical' ? 'Practical' : 'Exam'}
                          </span>
                          {m.rating != null && (
                            <span className="flex items-center gap-0.5 text-xs text-amber-600 font-semibold">
                              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                              {m.rating}/10
                            </span>
                          )}
                        </div>
                        {/* Telecaller */}
                        <p className="text-xs text-gray-500">
                          Telecaller: <span className="font-semibold text-gray-700">{m.telecaller?.full_name ?? '—'}</span>
                          {m.student?.phone && <> · {m.student.phone}</>}
                        </p>
                        {m.description && (
                          <p className="text-xs text-gray-600 mt-1 bg-gray-50 rounded px-2 py-1">{m.description}</p>
                        )}
                        {/* Admin inputs */}
                        <div className="flex items-center gap-3 mt-3 flex-wrap">
                          <div className="flex items-center gap-1.5">
                            <IndianRupee className="w-3.5 h-3.5 text-green-600" />
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.5"
                              placeholder="Salary % bonus"
                              value={salaryPct[m.id] ?? ''}
                              onChange={e => setSalaryPct(prev => ({ ...prev, [m.id]: e.target.value }))}
                              className="w-36 h-7 text-xs border border-gray-300 rounded px-2 focus:outline-none focus:ring-1 focus:ring-violet-400"
                            />
                          </div>
                          <input
                            type="text"
                            placeholder="Admin remarks (optional)"
                            value={adminRemarks[m.id] ?? ''}
                            onChange={e => setAdminRemarks(prev => ({ ...prev, [m.id]: e.target.value }))}
                            className="flex-1 min-w-[180px] h-7 text-xs border border-gray-300 rounded px-2 focus:outline-none focus:ring-1 focus:ring-violet-400"
                          />
                        </div>
                      </div>
                      {/* Action buttons */}
                      <div className="flex flex-col gap-2 flex-shrink-0">
                        <Button
                          size="sm"
                          className="h-7 text-xs gap-1.5 bg-green-600 hover:bg-green-700"
                          disabled={approvingMentor === m.id}
                          onClick={() => approveMentorship(m.id)}
                        >
                          {approvingMentor === m.id
                            ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            : <><CheckCircle2 className="w-3.5 h-3.5" /> Approve</>
                          }
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1.5 text-red-600 border-red-200 hover:bg-red-50"
                          disabled={approvingMentor === m.id}
                          onClick={() => rejectMentorship(m.id)}
                        >
                          <XCircle className="w-3.5 h-3.5" /> Reject
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── STUDENTS TAB ── */}
      {activeTab === 'students' && <>

      {/* Premium Board Tabs */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => scrollTabs('left')}
          className="flex-shrink-0 p-1.5 rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div ref={tabScrollRef} className="flex items-center gap-2 overflow-x-auto pb-1 flex-1" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          <button
            onClick={() => setBoardFilter('')}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all whitespace-nowrap flex-shrink-0 ${
              boardFilter === ''
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 ring-2 ring-blue-100'
                : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            All Students
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
              boardFilter === '' ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-500'
            }`}>
              {students.length}
            </span>
          </button>

          {tabBoards.map((board: BoardOption) => (
            <button
              key={board.id}
              onClick={() => setBoardFilter(board.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all whitespace-nowrap flex-shrink-0 ${
                boardFilter === board.id
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 ring-2 ring-indigo-100'
                  : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
              }`}
            >
              {board.name}
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                boardFilter === board.id ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-500'
              }`}>
                {allBoardCounts[board.id] ?? 0}
              </span>
            </button>
          ))}
        </div>

        <button
          onClick={() => scrollTabs('right')}
          className="flex-shrink-0 p-1.5 rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Layer 1: Department + Board */}
      <div className="flex flex-wrap gap-2 p-3 bg-gray-50 rounded-lg border mb-2">
        <span className="text-xs font-semibold text-gray-500 self-center w-full mb-1">Step 1 — Department &amp; Board</span>
        <Select value={departmentFilter} onValueChange={(v) => { setDepartmentFilter(v ?? ''); setBoardFilter('') }}>
          <SelectTrigger className="w-44 h-9">
            <span className="text-sm truncate">
              {departmentFilter ? departments.find(d => d.id === departmentFilter)?.name ?? 'All Departments' : 'All Departments'}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Departments</SelectItem>
            {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={boardFilter} onValueChange={(v) => setBoardFilter(v ?? '')}>
          <SelectTrigger className="w-44 h-9">
            <span className="text-sm truncate">
              {boardFilter ? boards.find(b => b.id === boardFilter)?.name ?? 'All Boards' : 'All Boards'}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Boards</SelectItem>
            {boards.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {(departmentFilter || boardFilter) && (
          <button onClick={() => { setDepartmentFilter(''); setBoardFilter('') }} className="text-xs text-red-500 hover:underline self-center ml-1">
            Clear
          </button>
        )}
      </div>

      {/* Layer 2: Remaining filters + search */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search name, phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? '')}>
          <SelectTrigger className="w-32 h-9"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="dropped">Dropped</SelectItem>
            <SelectItem value="on_hold">On Hold</SelectItem>
          </SelectContent>
        </Select>
        <Select value={modeFilter} onValueChange={(v) => setModeFilter(v ?? '')}>
          <SelectTrigger className="w-36 h-9"><SelectValue placeholder="Mode" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Modes</SelectItem>
            <SelectItem value="attending">Attending</SelectItem>
            <SelectItem value="non-attending">Non-Attending</SelectItem>
          </SelectContent>
        </Select>
        <Select value={courseFilter} onValueChange={(v) => setCourseFilter(v ?? '')}>
          <SelectTrigger className="w-36 h-9"><SelectValue placeholder="Course" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Courses</SelectItem>
            {courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={sessionFilter} onValueChange={(v) => setSessionFilter(v ?? '')}>
          <SelectTrigger className="w-32 h-9"><SelectValue placeholder="Session" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Sessions</SelectItem>
            {sessions.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={counsellorFilter} onValueChange={(v) => setCounsellorFilter(v ?? '')}>
          <SelectTrigger className="w-36 h-9"><SelectValue placeholder="Counsellor" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Counsellors</SelectItem>
            {counsellors.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={paymentFilter} onValueChange={(v) => setPaymentFilter(v ?? '')}>
          <SelectTrigger className="w-32 h-9"><SelectValue placeholder="Payment" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">All</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="partial">Partial</SelectItem>
            <SelectItem value="unpaid">Unpaid</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable
        data={students}
        columns={columns}
        isLoading={loading}
        onRowClick={(s) => router.push(`/backend/${s.id}`)}
      />

      <Dialog open={!!editStudent} onOpenChange={(open) => !open && setEditStudent(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Update Student Details</DialogTitle>
          </DialogHeader>
          {editStudent && (
            <StudentForm
              student={editStudent}
              onSuccess={() => {
                setEditStudent(null)
                fetchStudents()
              }}
              onCancel={() => setEditStudent(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Student</DialogTitle>
          </DialogHeader>
          <StudentForm
            onSuccess={() => {
              setShowAdd(false)
              fetchStudents()
            }}
            onCancel={() => setShowAdd(false)}
          />
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteStudent}
        onCancel={() => setDeleteStudent(null)}
        title="Delete Student"
        description={`Are you sure you want to delete ${deleteStudent?.full_name}? This will permanently remove their record and payment history. This action cannot be undone.`}
        onConfirm={() => deleteStudent && handleDeleteStudent(deleteStudent.id)}
        destructive
      />

      </> /* end students tab */}

      {/* Reject Student Dialog */}
      <Dialog open={!!rejectTarget} onOpenChange={open => !open && setRejectTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <XCircle className="w-5 h-5" /> Reject Student
            </DialogTitle>
          </DialogHeader>
          {rejectTarget && (
            <div className="space-y-4 mt-1">
              <p className="text-sm text-slate-700">
                Rejecting <span className="font-semibold">{rejectTarget.full_name}</span>
                {rejectTarget.counsellor?.full_name && (
                  <span className="text-muted-foreground"> — referred by <span className="text-blue-700 font-medium">{rejectTarget.counsellor.full_name}</span></span>
                )}
              </p>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1.5 block">Reason (optional)</label>
                <Textarea
                  placeholder="e.g. Incomplete documents, duplicate entry…"
                  rows={3}
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  className="resize-none"
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setRejectTarget(null)}>Cancel</Button>
                <Button className="flex-1 bg-red-600 hover:bg-red-700" onClick={rejectStudent} disabled={rejecting}>
                  {rejecting ? 'Rejecting…' : 'Confirm Reject'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
