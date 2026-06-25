'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import {
  CheckCircle2, XCircle, GraduationCap, RefreshCw, IndianRupee,
  Users, Search, Award, UserCog, Clock, ClipboardList, Download, FileText, X,
} from 'lucide-react'
import { format } from 'date-fns'

function fmtEnroll(n: string | null | undefined) {
  if (!n) return '—'
  if (n.startsWith('ENR-')) return 'DCW-' + n.slice(4).replace(/[^0-9]/g, '')
  return n
}

interface Counselor { id: string; full_name: string }
interface StudentRow {
  id: string
  full_name: string
  guardian_name: string | null
  enrollment_number: string | null
  phone: string | null
  mode: string | null
  mentor_telecaller_id: string | null
  course: { name: string } | null
  department: { name: string } | null
  sub_section: { name: string } | null
  session: { name: string } | null
}

const MODE_CLS: Record<string, string> = {
  attending: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'non-attending': 'bg-orange-50 text-orange-700 border-orange-200',
}

const TYPE_LABELS: Record<string, { label: string; cls: string }> = {
  practical:  { label: 'Practical',  cls: 'bg-emerald-100 text-emerald-800' },
  assignment: { label: 'Assignment', cls: 'bg-blue-100 text-blue-800' },
  theory:     { label: 'Theory',     cls: 'bg-blue-100 text-blue-800' },
  work_assignment: { label: 'Work Assignment', cls: 'bg-blue-100 text-blue-800' },
  exam:       { label: 'Exam',       cls: 'bg-blue-100 text-blue-800' },
}

const AVATAR = ['from-blue-500 to-blue-600','from-blue-500 to-cyan-600','from-emerald-500 to-teal-600','from-rose-500 to-pink-600','from-amber-500 to-orange-600','from-indigo-500 to-blue-600']
function pal(name: string) { let h = 0; for (let i=0;i<name.length;i++) h=(h*31+name.charCodeAt(i))&0xffff; return AVATAR[h%AVATAR.length] }
function inits(name: string) { return name.split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase() }

export default function MentorshipDashboardPage() {
  const supabase = createClient()

  const [tab, setTab] = useState<'students' | 'approvals'>('students')
  const [students, setStudents] = useState<StudentRow[]>([])
  const [counselors, setCounselors] = useState<Counselor[]>([])
  const [loading, setLoading] = useState(true)
  const [changingId, setChangingId] = useState<string | null>(null)

  // filters
  const [counselorFilter, setCounselorFilter] = useState<string>('all') // 'all' | id | 'unassigned'
  const [departmentFilter, setDepartmentFilter] = useState('all')
  const [courseFilter, setCourseFilter] = useState('all')
  const [boardFilter, setBoardFilter] = useState('all')
  const [sessionFilter, setSessionFilter] = useState('all')
  const [search, setSearch] = useState('')

  // approvals
  const [mentorships, setMentorships] = useState<any[]>([])
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [salaryPct, setSalaryPct] = useState<Record<string, string>>({})
  const [adminRemarks, setAdminRemarks] = useState<Record<string, string>>({})
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkBusy, setBulkBusy] = useState(false)
  const [previewImg, setPreviewImg] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [studRes, conRes, pendRes] = await Promise.all([
        (supabase as any).from('students')
          .select(`id, full_name, guardian_name, enrollment_number, phone, mode, mentor_telecaller_id,
            course:courses(name), department:departments(name),
            sub_section:department_sub_sections(name), session:sessions(name)`)
          .neq('status', 'dropped').order('full_name'),
        (supabase as any).from('profiles').select('id, full_name')
          .in('role', ['counselor', 'lead']).eq('is_active', true).order('full_name'),
        (supabase as any).from('mentorship_payments')
          .select(`*, mentorship:student_mentorships!mentorship_payments_mentorship_id_fkey(
            managed_by, total_amount,
            student:students(id, full_name, enrollment_number, phone),
            telecaller:profiles!student_mentorships_telecaller_id_fkey(id, full_name)
          )`)
          .eq('status', 'pending').order('created_at', { ascending: false }),
      ])
      setStudents((studRes.data ?? []) as StudentRow[])
      setCounselors((conRes.data ?? []) as Counselor[])
      setMentorships(pendRes.data ?? [])
    } catch {
      toast.error('Failed to load mentorship data')
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => { load() }, [load])

  async function exportExcel() {
    try {
      const xlsx = await import('xlsx')
      const rows = filtered.map((s, i) => ({
        'S.No': i + 1,
        Enrollment: fmtEnroll(s.enrollment_number),
        Name: s.full_name,
        "Father's Name": s.guardian_name || '-',
        Phone: s.phone || '-',
        Mode: s.mode || '-',
        Department: s.department?.name || '-',
        Course: s.course?.name || '-',
        Board: s.sub_section?.name || '-',
        Session: s.session?.name || '-',
        Mentor: s.mentor_telecaller_id ? (conName[s.mentor_telecaller_id] ?? '-') : 'Unassigned',
      }))
      const ws = xlsx.utils.json_to_sheet(rows)
      const wb = xlsx.utils.book_new()
      xlsx.utils.book_append_sheet(wb, ws, 'Mentorship')
      xlsx.writeFile(wb, `mentorship-students-${format(new Date(), 'yyyy-MM-dd')}.xlsx`)
      toast.success('Exported successfully')
    } catch {
      toast.error('Export failed')
    }
  }

  async function changeMentor(studentId: string, value: string) {
    const newMentor = value === 'none' ? null : value
    setChangingId(studentId)
    try {
      const { data, error } = await (supabase as any)
        .from('students')
        .update({ mentor_telecaller_id: newMentor })
        .eq('id', studentId)
        .select('id')
      if (error) throw error
      if (!data || (data as any[]).length === 0) throw new Error('Update blocked (permission)')
      setStudents(prev => prev.map(s => s.id === studentId ? { ...s, mentor_telecaller_id: newMentor } : s))
      toast.success(newMentor ? 'Mentor updated' : 'Mentor removed')
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to update mentor')
    } finally {
      setChangingId(null)
    }
  }

  // Approve a payment + credit the mentor's incentive (best-effort ledger)
  async function markApproved(id: string, userId?: string) {
    const amt = salaryPct[id] ? parseFloat(salaryPct[id]) : null
    const { error } = await (supabase as any).from('mentorship_payments').update({
      status: 'approved',
      admin_remarks: adminRemarks[id] || null,
      approved_by: userId ?? null,
      approved_at: new Date().toISOString(),
    }).eq('id', id)
    if (error) throw error
    if (amt && amt > 0) {
      // store the exact incentive amount (₹) on the payment — ignore if column absent
      try { await (supabase as any).from('mentorship_payments').update({ incentive_amount: amt }).eq('id', id) } catch {}
      const m = mentorships.find(x => x.id === id)
      const mentorId = m?.mentorship?.telecaller?.id
      if (mentorId) {
        // detailed ledger entry (best-effort)
        try {
          await (supabase as any).from('mentor_incentives').insert({
            mentor_id: mentorId,
            payment_id: id,
            student_id: m?.mentorship?.student?.id ?? null,
            amount: amt,
            reason: `Mentorship — ${m?.mentorship?.student?.full_name ?? 'student'}`,
            created_by: userId ?? null,
          })
        } catch {}
        // credit the mentor's payroll incentive for the current month → reflects in HRMS + Incentive page
        try { await creditPayrollIncentive(mentorId, amt) } catch {}
      }
    }
  }

  // Add the incentive to the mentor's payroll (current month) so it shows in HRMS + their Incentive page
  async function creditPayrollIncentive(mentorProfileId: string, amount: number) {
    const { data: emp } = await (supabase as any).from('employees')
      .select('id, basic_salary, hra, allowances, pf_deduction, tds_deduction').eq('profile_id', mentorProfileId).maybeSingle()
    if (!emp) return
    const now = new Date()
    const month = now.getMonth() + 1
    const year = now.getFullYear()
    const { data: existing } = await (supabase as any).from('payroll')
      .select('id, incentive, gross, net').eq('employee_id', emp.id).eq('month', month).eq('year', year).maybeSingle()
    if (existing) {
      await (supabase as any).from('payroll').update({
        incentive: (existing.incentive ?? 0) + amount,
        gross: (existing.gross ?? 0) + amount,
        net: (existing.net ?? 0) + amount,
      }).eq('id', existing.id)
    } else {
      // No payroll generated yet this month — build a full row from the employee's
      // salary structure so basic/HRA/allowances aren't lost (mentorship incentive added on top)
      const basic = Number(emp.basic_salary ?? 0)
      const hra = Number(emp.hra ?? 0)
      const allowances = Number(emp.allowances ?? 0)
      const pf = Number(emp.pf_deduction ?? 0)
      const tds = Number(emp.tds_deduction ?? 0)
      const gross = basic + hra + allowances + amount
      const net = gross - pf - tds
      await (supabase as any).from('payroll').insert({
        employee_id: emp.id, month, year,
        basic, hra, allowances, incentive: amount, gross,
        pf, tds, other_deductions: 0, leave_deduction: 0, net, status: 'draft',
      })
    }
  }

  async function approve(id: string) {
    setApprovingId(id)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      await markApproved(id, user?.id)
      toast.success('Payment approved')
      setMentorships(prev => prev.filter(m => m.id !== id))
      setSelectedIds(prev => { const s = new Set(prev); s.delete(id); return s })
    } catch (e: any) { toast.error(e?.message ?? 'Failed to approve') } finally { setApprovingId(null) }
  }

  async function reject(id: string) {
    setApprovingId(id)
    try {
      const { error } = await (supabase as any).from('mentorship_payments')
        .update({ status: 'rejected', admin_remarks: adminRemarks[id] || null }).eq('id', id)
      if (error) throw error
      toast.success('Payment rejected')
      setMentorships(prev => prev.filter(m => m.id !== id))
      setSelectedIds(prev => { const s = new Set(prev); s.delete(id); return s })
    } catch (e: any) { toast.error(e?.message ?? 'Failed to reject') } finally { setApprovingId(null) }
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  }
  function toggleSelectAll() {
    setSelectedIds(prev => prev.size === mentorships.length ? new Set() : new Set(mentorships.map(m => m.id)))
  }

  async function bulkApprove() {
    if (selectedIds.size === 0) return
    setBulkBusy(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const ids = Array.from(selectedIds)
      for (const id of ids) await markApproved(id, user?.id)
      toast.success(`Approved ${ids.length} payment${ids.length !== 1 ? 's' : ''}`)
      setMentorships(prev => prev.filter(m => !selectedIds.has(m.id)))
      setSelectedIds(new Set())
    } catch (e: any) { toast.error(e?.message ?? 'Bulk approve failed') } finally { setBulkBusy(false) }
  }

  async function bulkReject() {
    if (selectedIds.size === 0) return
    setBulkBusy(true)
    try {
      const ids = Array.from(selectedIds)
      const { error } = await (supabase as any).from('mentorship_payments')
        .update({ status: 'rejected' }).in('id', ids)
      if (error) throw error
      toast.success(`Rejected ${ids.length} record${ids.length !== 1 ? 's' : ''}`)
      setMentorships(prev => prev.filter(m => !selectedIds.has(m.id)))
      setSelectedIds(new Set())
    } catch { toast.error('Bulk reject failed') } finally { setBulkBusy(false) }
  }

  // derived
  const conName = useMemo(() => Object.fromEntries(counselors.map(c => [c.id, c.full_name])), [counselors])
  const departmentOptions = useMemo(() => Array.from(new Set(students.map(s => s.department?.name).filter(Boolean) as string[])).sort(), [students])
  const courseOptions = useMemo(() => Array.from(new Set(students.map(s => s.course?.name).filter(Boolean) as string[])).sort(), [students])
  const boardOptions = useMemo(() => Array.from(new Set(students.map(s => s.sub_section?.name).filter(Boolean) as string[])).sort(), [students])
  const sessionOptions = useMemo(() => Array.from(new Set(students.map(s => s.session?.name).filter(Boolean) as string[])).sort(), [students])

  const counselorCounts = useMemo(() => {
    const m: Record<string, number> = {}
    students.forEach(s => { if (s.mentor_telecaller_id) m[s.mentor_telecaller_id] = (m[s.mentor_telecaller_id] ?? 0) + 1 })
    return m
  }, [students])

  const withMentor = students.filter(s => s.mentor_telecaller_id).length
  const withoutMentor = students.length - withMentor

  const filtered = useMemo(() => students.filter(s => {
    if (counselorFilter === 'unassigned' && s.mentor_telecaller_id) return false
    if (counselorFilter !== 'all' && counselorFilter !== 'unassigned' && s.mentor_telecaller_id !== counselorFilter) return false
    if (departmentFilter !== 'all' && s.department?.name !== departmentFilter) return false
    if (courseFilter !== 'all' && s.course?.name !== courseFilter) return false
    if (boardFilter !== 'all' && s.sub_section?.name !== boardFilter) return false
    if (sessionFilter !== 'all' && s.session?.name !== sessionFilter) return false
    if (search) {
      const q = search.toLowerCase()
      if (!s.full_name.toLowerCase().includes(q) && !(s.phone ?? '').includes(search) && !fmtEnroll(s.enrollment_number).toLowerCase().includes(q)) return false
    }
    return true
  }), [students, counselorFilter, departmentFilter, courseFilter, boardFilter, sessionFilter, search])

  return (
    <div className="space-y-5">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-blue-600 to-indigo-700 p-6 text-white">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4" />
        <div className="relative flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center"><Award className="w-4 h-4" /></div>
              <h1 className="text-xl font-bold tracking-tight">Mentorship Dashboard</h1>
            </div>
            <p className="text-blue-200 text-sm mt-1">Counselor-wise students, mentor assignment & work approvals</p>
          </div>
          <button onClick={load} className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 transition-colors px-3 py-1.5 rounded-lg text-sm font-medium flex-shrink-0">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
        <div className="relative grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
          {[
            { icon: Users, label: 'Total Students', value: students.length },
            { icon: UserCog, label: 'With Mentor', value: withMentor },
            { icon: GraduationCap, label: 'Without Mentor', value: withoutMentor },
            { icon: Clock, label: 'Pending Approvals', value: mentorships.length },
          ].map(s => (
            <div key={s.label} className="bg-white/15 rounded-xl px-3 py-3 backdrop-blur-sm">
              <s.icon className="w-4 h-4 text-white/70 mb-1" />
              <p className="text-2xl font-bold">{s.value}</p>
              <p className="text-[11px] text-white/70 font-medium">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        <button onClick={() => setTab('students')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${tab==='students' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
          <Users className="w-4 h-4" /> Students & Mentors
        </button>
        <button onClick={() => setTab('approvals')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${tab==='approvals' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
          <ClipboardList className="w-4 h-4" /> Approvals
          {mentorships.length > 0 && <span className="bg-amber-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5">{mentorships.length}</span>}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48"><div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
      ) : tab === 'students' ? (
        <>
          {/* Counselor chips */}
          <div className="flex gap-1.5 flex-wrap">
            <button onClick={() => setCounselorFilter('all')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${counselorFilter==='all' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'}`}>
              All <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${counselorFilter==='all'?'bg-white/20':'bg-gray-100 text-gray-500'}`}>{students.length}</span>
            </button>
            {counselors.filter(c => counselorCounts[c.id]).map(c => (
              <button key={c.id} onClick={() => setCounselorFilter(c.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${counselorFilter===c.id ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'}`}>
                {c.full_name} <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${counselorFilter===c.id?'bg-white/20':'bg-gray-100 text-gray-500'}`}>{counselorCounts[c.id]}</span>
              </button>
            ))}
            <button onClick={() => setCounselorFilter('unassigned')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${counselorFilter==='unassigned' ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-amber-600 border-amber-200 hover:border-amber-400'}`}>
              Unassigned <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${counselorFilter==='unassigned'?'bg-white/20':'bg-amber-100'}`}>{withoutMentor}</span>
            </button>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, phone, enroll…"
                className="w-full pl-9 pr-3 h-9 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-blue-400" />
            </div>
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger className="w-auto min-w-[150px] h-9 text-xs gap-1">
                <span className="text-gray-400 font-semibold">Department:</span><SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {departmentOptions.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={courseFilter} onValueChange={setCourseFilter}>
              <SelectTrigger className="w-auto min-w-[140px] h-9 text-xs gap-1">
                <span className="text-gray-400 font-semibold">Course:</span><SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {courseOptions.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={boardFilter} onValueChange={setBoardFilter}>
              <SelectTrigger className="w-auto min-w-[120px] h-9 text-xs gap-1">
                <span className="text-gray-400 font-semibold">Board:</span><SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {boardOptions.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={sessionFilter} onValueChange={setSessionFilter}>
              <SelectTrigger className="w-auto min-w-[120px] h-9 text-xs gap-1">
                <span className="text-gray-400 font-semibold">Session:</span><SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {sessionOptions.map(se => <SelectItem key={se} value={se}>{se}</SelectItem>)}
              </SelectContent>
            </Select>
            {(departmentFilter!=='all' || courseFilter!=='all' || boardFilter!=='all' || sessionFilter!=='all' || search || counselorFilter!=='all') && (
              <button onClick={() => { setDepartmentFilter('all'); setCourseFilter('all'); setBoardFilter('all'); setSessionFilter('all'); setSearch(''); setCounselorFilter('all') }} className="text-xs text-blue-600 hover:underline">Clear</button>
            )}
            <Button variant="outline" size="sm" onClick={exportExcel} className="gap-1.5 h-9 ml-auto" disabled={filtered.length === 0}>
              <Download className="w-3.5 h-3.5" /> Export Excel
            </Button>
          </div>

          {/* Table */}
          {filtered.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl border-2 border-dashed border-gray-200">
              <GraduationCap className="w-10 h-10 mx-auto mb-3 text-gray-300" />
              <p className="font-semibold text-gray-500">No students found</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
                <table className="text-sm" style={{ width: 'max-content', minWidth: '100%' }}>
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      {['S.No','Enrollment','Student',"Father's Name",'Phone','Mode','Department','Course','Board','Session','Mentor (change)'].map(h => (
                        <th key={h} className="text-left px-3 py-3 text-[11px] font-bold uppercase tracking-wider text-gray-500 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filtered.map((s, idx) => {
                      return (
                        <tr key={s.id} className="hover:bg-blue-50/30 transition-colors">
                          <td className="px-3 py-3 text-gray-400 text-xs tabular-nums">{idx + 1}</td>
                          <td className="px-3 py-3"><span className="font-mono text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-lg whitespace-nowrap">{fmtEnroll(s.enrollment_number)}</span></td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-2.5 min-w-[150px]">
                              <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${pal(s.full_name)} flex items-center justify-center text-white font-bold text-xs flex-shrink-0`}>{inits(s.full_name)}</div>
                              <span className="font-semibold text-gray-900 text-sm whitespace-nowrap">{s.full_name}</span>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-xs text-gray-600 whitespace-nowrap">{s.guardian_name ?? '—'}</td>
                          <td className="px-3 py-3 text-xs text-gray-600 whitespace-nowrap">{s.phone ?? '—'}</td>
                          <td className="px-3 py-3">{s.mode ? <span className={`text-xs px-2 py-0.5 rounded-lg font-semibold border whitespace-nowrap ${MODE_CLS[s.mode] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>{s.mode === 'attending' ? 'Attending' : 'Non-Attending'}</span> : <span className="text-gray-400 text-xs">—</span>}</td>
                          <td className="px-3 py-3">{s.department?.name ? <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-lg font-medium whitespace-nowrap">{s.department.name}</span> : <span className="text-gray-400 text-xs">—</span>}</td>
                          <td className="px-3 py-3"><span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-lg font-medium whitespace-nowrap">{s.course?.name ?? '—'}</span></td>
                          <td className="px-3 py-3">{s.sub_section?.name ? <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-lg font-bold whitespace-nowrap">{s.sub_section.name}</span> : <span className="text-gray-400 text-xs">—</span>}</td>
                          <td className="px-3 py-3 text-xs text-gray-500 whitespace-nowrap">{s.session?.name ?? '—'}</td>
                          <td className="px-3 py-3">
                            <div className="min-w-[170px]">
                              <Select value={s.mentor_telecaller_id ?? 'none'} onValueChange={(v) => changeMentor(s.id, v)} disabled={changingId === s.id}>
                                <SelectTrigger className={`h-8 text-xs ${s.mentor_telecaller_id ? 'border-blue-200 bg-blue-50' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
                                  <SelectValue placeholder="Assign mentor…">
                                    {changingId === s.id ? 'Updating…' : (s.mentor_telecaller_id ? conName[s.mentor_telecaller_id] ?? 'Unknown' : 'Assign mentor…')}
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">— Remove mentor —</SelectItem>
                                  {counselors.map(c => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-2 border-t border-gray-100 bg-gray-50 text-xs text-gray-400 font-medium">
                {filtered.length} student{filtered.length !== 1 ? 's' : ''}
                {counselorFilter !== 'all' && counselorFilter !== 'unassigned' && ` · Mentor: ${conName[counselorFilter] ?? ''}`}
              </div>
            </div>
          )}
        </>
      ) : (
        /* ── APPROVALS TAB ── */
        mentorships.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground bg-white border rounded-xl">
            <GraduationCap className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No pending mentorships</p>
            <p className="text-xs mt-1">Submitted work from counselors will appear here</p>
          </div>
        ) : (
          <div className="rounded-xl border overflow-hidden bg-white">
            <div className="px-4 py-2.5 bg-blue-50 border-b flex items-center gap-3 flex-wrap">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 accent-blue-600 cursor-pointer"
                  checked={mentorships.length > 0 && selectedIds.size === mentorships.length}
                  ref={el => { if (el) el.indeterminate = selectedIds.size > 0 && selectedIds.size < mentorships.length }}
                  onChange={toggleSelectAll}
                />
                <span className="text-xs font-bold text-blue-700 uppercase tracking-wider">Pending Approvals</span>
              </label>
              {selectedIds.size > 0 ? (
                <div className="flex items-center gap-2 ml-auto">
                  <span className="text-xs font-semibold text-blue-700">{selectedIds.size} selected</span>
                  <Button size="sm" className="h-7 text-xs gap-1.5 bg-green-600 hover:bg-green-700" disabled={bulkBusy} onClick={bulkApprove}>
                    {bulkBusy ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><CheckCircle2 className="w-3.5 h-3.5" /> Approve {selectedIds.size}</>}
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5 text-red-600 border-red-200 hover:bg-red-50" disabled={bulkBusy} onClick={bulkReject}>
                    <XCircle className="w-3.5 h-3.5" /> Reject
                  </Button>
                </div>
              ) : (
                <span className="text-xs text-blue-600 ml-auto">{mentorships.length} pending</span>
              )}
            </div>
            <div className="divide-y">
              {mentorships.map((m: any) => {
                const stu = m.mentorship?.student
                const mentorName = m.mentorship?.telecaller?.full_name
                return (
                  <div key={m.id} className={`px-4 py-4 ${selectedIds.has(m.id) ? 'bg-blue-50/40' : ''}`}>
                    <div className="flex items-start gap-3 flex-wrap sm:flex-nowrap">
                      <input
                        type="checkbox"
                        className="h-4 w-4 mt-1 rounded border-gray-300 accent-blue-600 cursor-pointer flex-shrink-0"
                        checked={selectedIds.has(m.id)}
                        onChange={() => toggleSelect(m.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-sm font-bold text-gray-800">{stu?.full_name ?? '—'}</span>
                          {stu?.enrollment_number && <span className="text-xs text-gray-400 font-mono">{fmtEnroll(stu.enrollment_number)}</span>}
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 flex items-center gap-0.5">
                            <IndianRupee className="w-2.5 h-2.5" />{Number(m.amount).toLocaleString('en-IN')} payment
                          </span>
                          {m.note && <span className="text-xs font-semibold text-gray-700">{m.note}</span>}
                        </div>
                        <p className="text-xs text-gray-500">
                          Mentor: <span className="font-semibold text-gray-700">{mentorName ?? '—'}</span>
                          {m.mentorship?.total_amount != null && <> · Case total ₹{m.mentorship.total_amount}</>}
                          <> · {format(new Date(m.created_at), 'dd MMM yyyy')}</>
                        </p>
                        {m.screenshot_url ? (
                          <button
                            onClick={() => setPreviewImg(m.screenshot_url)}
                            className="mt-2 inline-flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-blue-100"
                          >
                            <FileText className="w-3.5 h-3.5" /> View Screenshot / Proof
                          </button>
                        ) : (
                          <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-amber-600 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg">
                            <XCircle className="w-3 h-3" /> No screenshot uploaded
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-3 flex-wrap">
                          <div className="flex items-center gap-1 border border-gray-300 rounded px-2 h-7">
                            <span className="text-gray-400 text-xs font-bold">₹</span>
                            <input type="number" min="0" step="1" placeholder="Incentive to mentor"
                              value={salaryPct[m.id] ?? ''} onChange={e => setSalaryPct(p => ({ ...p, [m.id]: e.target.value }))}
                              className="w-36 h-full text-xs focus:outline-none" />
                          </div>
                          <input type="text" placeholder="Admin remarks (optional)"
                            value={adminRemarks[m.id] ?? ''} onChange={e => setAdminRemarks(p => ({ ...p, [m.id]: e.target.value }))}
                            className="flex-1 min-w-[160px] h-7 text-xs border border-gray-300 rounded px-2 focus:outline-none focus:ring-1 focus:ring-blue-400" />
                        </div>
                      </div>
                      <div className="flex sm:flex-col gap-2 flex-shrink-0">
                        <Button size="sm" className="h-7 text-xs gap-1.5 bg-green-600 hover:bg-green-700 flex-1" disabled={approvingId === m.id} onClick={() => approve(m.id)}>
                          {approvingId === m.id ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><CheckCircle2 className="w-3.5 h-3.5" /> Approve</>}
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5 text-red-600 border-red-200 hover:bg-red-50 flex-1" disabled={approvingId === m.id} onClick={() => reject(m.id)}>
                          <XCircle className="w-3.5 h-3.5" /> Reject
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      )}

      {/* Screenshot preview */}
      {previewImg && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setPreviewImg(null)}
        >
          <button
            onClick={() => setPreviewImg(null)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/90 flex items-center justify-center hover:bg-white"
          >
            <X className="w-5 h-5 text-gray-700" />
          </button>
          {/\.pdf($|\?)/i.test(previewImg) ? (
            <iframe src={previewImg} className="w-full max-w-3xl h-[80vh] rounded-xl bg-white" onClick={e => e.stopPropagation()} />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewImg} alt="Proof" className="max-w-full max-h-[85vh] rounded-xl object-contain" onClick={e => e.stopPropagation()} />
          )}
        </div>
      )}
    </div>
  )
}
