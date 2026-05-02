'use client'
import { useState, useEffect, useCallback, useTransition, useRef, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { format } from 'date-fns'
import { MoreVertical, Pencil, FileText, Search, Trash2, Download, ChevronLeft, ChevronRight } from 'lucide-react'
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
          counsellor:profiles!students_assigned_counsellor_fkey(id, email, full_name, role, is_active, created_at)
        `)
        .order('enrollment_date', { ascending: true })

      if (search) query = query.or(`full_name.ilike.%${search}%,phone.ilike.%${search}%`)
      if (statusFilter) query = query.eq('status', statusFilter)
      else query = query.neq('status', 'dropped')
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
    </div>
  )
}
