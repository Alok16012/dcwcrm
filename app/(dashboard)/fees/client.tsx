'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/shared/PageHeader'
import { Download, RefreshCw, Search, IndianRupee } from 'lucide-react'
import * as XLSX from 'xlsx'

interface FeeRow {
  id: string
  actual_fee: number
  basic_percent: number
  standard_percent: number
  premium_percent: number
  notes: string | null
  department: { id: string; name: string } | null
  course: { id: string; name: string } | null
  session: { id: string; name: string } | null
}

function calcFee(actual: number, pct: number) {
  return Math.round(actual * pct / 100)
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)

export function FeesClient() {
  const db = createClient() as any
  const [fees, setFees] = useState<FeeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Filter options
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([])
  const [courses, setCourses] = useState<{ id: string; name: string }[]>([])
  const [sessions, setSessions] = useState<{ id: string; name: string }[]>([])
  const [filterDept, setFilterDept] = useState('')
  const [filterCourse, setFilterCourse] = useState('')
  const [filterSession, setFilterSession] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await db
      .from('fee_structures')
      .select('*, department:departments(id,name), course:courses(id,name), session:sessions(id,name)')
      .order('created_at', { ascending: false })
    setFees((data ?? []) as FeeRow[])
    setLoading(false)
  }, [db])

  useEffect(() => {
    load()
    Promise.all([
      db.from('departments').select('id,name').eq('is_active', true).order('name'),
      db.from('courses').select('id,name').eq('is_active', true).order('name'),
      db.from('sessions').select('id,name').eq('is_active', true).order('name'),
    ]).then(([d, c, s]) => {
      setDepartments(d.data ?? [])
      setCourses(c.data ?? [])
      setSessions(s.data ?? [])
    })
  }, [load])

  const filtered = fees.filter(f => {
    const q = search.toLowerCase()
    const matchSearch = !q ||
      f.department?.name.toLowerCase().includes(q) ||
      f.course?.name.toLowerCase().includes(q) ||
      f.session?.name.toLowerCase().includes(q)
    const matchDept = !filterDept || f.department?.id === filterDept
    const matchCourse = !filterCourse || f.course?.id === filterCourse
    const matchSession = !filterSession || f.session?.id === filterSession
    return matchSearch && matchDept && matchCourse && matchSession
  })

  function downloadExcel() {
    const rows = filtered.map(f => ({
      Department: f.department?.name ?? '—',
      Course: f.course?.name ?? '—',
      Session: f.session?.name ?? '—',
      'Actual Fee (₹)': f.actual_fee,
      'Basic %': f.basic_percent,
      'Basic Fee (₹)': calcFee(f.actual_fee, f.basic_percent),
      'Standard %': f.standard_percent,
      'Standard Fee (₹)': calcFee(f.actual_fee, f.standard_percent),
      'Premium %': f.premium_percent,
      'Premium Fee (₹)': calcFee(f.actual_fee, f.premium_percent),
      Notes: f.notes ?? '',
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    // Set column widths
    ws['!cols'] = [20, 25, 15, 15, 10, 15, 12, 16, 12, 16, 20].map(w => ({ wch: w }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Fee Structure')
    XLSX.writeFile(wb, 'DCW_Fee_Structure.xlsx')
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Fee Structure" description="View course fees by department, course and session" />

      {/* Filters */}
      <div className="bg-white border rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input placeholder="Search department, course, session…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
          </div>
          <select value={filterDept} onChange={e => setFilterDept(e.target.value)}
            className="border rounded-lg px-3 h-9 text-sm bg-white text-slate-700 min-w-36">
            <option value="">All Departments</option>
            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <select value={filterCourse} onChange={e => setFilterCourse(e.target.value)}
            className="border rounded-lg px-3 h-9 text-sm bg-white text-slate-700 min-w-36">
            <option value="">All Courses</option>
            {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={filterSession} onChange={e => setFilterSession(e.target.value)}
            className="border rounded-lg px-3 h-9 text-sm bg-white text-slate-700 min-w-32">
            <option value="">All Sessions</option>
            {sessions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <Button variant="outline" size="sm" onClick={load} className="gap-1.5 h-9">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
          <Button size="sm" onClick={downloadExcel} disabled={filtered.length === 0} className="gap-1.5 h-9 bg-green-600 hover:bg-green-700">
            <Download className="w-3.5 h-3.5" /> Download Excel
          </Button>
        </div>
        {(filterDept || filterCourse || filterSession || search) && (
          <button onClick={() => { setFilterDept(''); setFilterCourse(''); setFilterSession(''); setSearch('') }}
            className="text-xs text-blue-600 hover:underline">Clear filters</button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-16 text-muted-foreground text-sm">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <IndianRupee className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No fee structures found</p>
          <p className="text-xs mt-1">OPS team will add fee structures</p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Department</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Course</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Session</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600 hidden md:table-cell">Actual Fee</th>
                  <th className="text-center px-4 py-3 font-semibold text-amber-700 bg-amber-50/60">Basic</th>
                  <th className="text-center px-4 py-3 font-semibold text-blue-700 bg-blue-50/60">Standard</th>
                  <th className="text-center px-4 py-3 font-semibold text-purple-700 bg-purple-50/60">Premium</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map(f => (
                  <tr key={f.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900">{f.department?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-700">{f.course?.name ?? '—'}</td>
                    <td className="px-4 py-3">
                      <Badge className="bg-slate-100 text-slate-700 border-0 text-xs">{f.session?.name ?? '—'}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-500 text-xs hidden md:table-cell">
                      {fmt(f.actual_fee)}
                    </td>
                    <td className="px-4 py-3 bg-amber-50/40">
                      <div className="text-center">
                        <p className="font-bold text-amber-800 font-mono">{fmt(calcFee(f.actual_fee, f.basic_percent))}</p>
                        <p className="text-[10px] text-amber-500">{f.basic_percent}%</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 bg-blue-50/40">
                      <div className="text-center">
                        <p className="font-bold text-blue-800 font-mono">{fmt(calcFee(f.actual_fee, f.standard_percent))}</p>
                        <p className="text-[10px] text-blue-500">{f.standard_percent}%</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 bg-purple-50/40">
                      <div className="text-center">
                        <p className="font-bold text-purple-800 font-mono">{fmt(calcFee(f.actual_fee, f.premium_percent))}</p>
                        <p className="text-[10px] text-purple-500">{f.premium_percent}%</p>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2.5 border-t bg-slate-50 text-xs text-slate-500">
            Showing {filtered.length} of {fees.length} fee structures
          </div>
        </div>
      )}
    </div>
  )
}
