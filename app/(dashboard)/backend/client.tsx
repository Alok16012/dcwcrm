'use client'
import { useState, useEffect, useCallback, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { MoreVertical, Pencil, FileText, Search, Trash2, Download } from 'lucide-react'
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

interface FilterOption { id: string; name: string }

export function BackendListClient() {
  const router = useRouter()
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
  const [courses, setCourses] = useState<FilterOption[]>([])
  const [sessions, setSessions] = useState<FilterOption[]>([])
  const [counsellors, setCounsellors] = useState<FilterOption[]>([])
  const [editStudent, setEditStudent] = useState<Student | null>(null)
  const [deleteStudent, setDeleteStudent] = useState<Student | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [isPending, startTransition] = useTransition()
  const supabase = createClient()

  // Load filter options once
  useEffect(() => {
    async function loadOptions() {
      const [coursesRes, sessionsRes, counsellorsRes] = await Promise.all([
        supabase.from('courses').select('id, name').eq('is_active', true).order('name'),
        supabase.from('sessions').select('id, name').order('name'),
        supabase.from('profiles').select('id, full_name').eq('role', 'lead').order('full_name'),
      ])
      setCourses((coursesRes.data ?? []) as FilterOption[])
      setSessions((sessionsRes.data ?? []) as FilterOption[])
      setCounsellors(((counsellorsRes.data ?? []) as { id: string; full_name: string }[]).map(p => ({ id: p.id, name: p.full_name })))
    }
    loadOptions()
  }, [])

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
      if (courseFilter) query = query.eq('course_id', courseFilter)
      if (sessionFilter) query = query.eq('session_id', sessionFilter)
      if (counsellorFilter) query = query.eq('assigned_counsellor', counsellorFilter)
      if (modeFilter) query = query.eq('mode', modeFilter)
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
  }, [search, statusFilter, paymentFilter, courseFilter, sessionFilter, counsellorFilter, modeFilter])

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
    { id: 'guardian_name', header: "Father's Name", cell: ({ row }) => row.original.guardian_name ?? '-' },
    { accessorKey: 'phone', header: 'Phone' },
    { id: 'mode', header: 'Mode', cell: ({ row }) => <Badge variant="outline" className="capitalize">{row.original.mode ?? '-'}</Badge> },
    { id: 'session', header: 'Session', cell: ({ row }) => row.original.session?.name ?? '-' },
    { id: 'department', header: 'Dept', cell: ({ row }) => row.original.department?.name ?? '-' },
    { id: 'course', header: 'Course', cell: ({ row }) => row.original.course?.name ?? '-' },
    { id: 'counsellor', header: 'Counsellor', cell: ({ row }) => row.original.counsellor?.full_name ?? '-' },
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

      {/* Filters */}
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
            <SelectItem value="open_schooling">Open Schooling</SelectItem>
            <SelectItem value="college">College</SelectItem>
            <SelectItem value="online">Online</SelectItem>
            <SelectItem value="offline">Offline</SelectItem>
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
