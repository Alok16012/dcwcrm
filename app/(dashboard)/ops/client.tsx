'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import {
  RefreshCw,
  IndianRupee,
  Plus, Pencil, Trash2, Download, FileText, ClipboardList, Truck,
} from 'lucide-react'
import dynamic from 'next/dynamic'

const FeePlanBuilder = dynamic(
  () => import('../admin/tabs/FeePlanBuilder').then(m => ({ default: m.FeePlanBuilder })),
  { ssr: false }
)
const TaskManager = dynamic(() => import('./TaskManager'), { ssr: false })
const DispatchManager = dynamic(() => import('@/components/ops/DispatchManager').then(m => ({ default: m.DispatchManager })), { ssr: false })
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { PageHeader } from '@/components/shared/PageHeader'
import * as XLSX from 'xlsx'


interface Lookup { id: string; name: string }
interface FeeRow {
  id: string; actual_fee: number
  basic_percent: number; standard_percent: number; premium_percent: number
  notes: string | null
  department: Lookup | null; course: Lookup | null; session: Lookup | null
}
const EMPTY_FEE = {
  department_id: '', course_id: '', session_id: '',
  actual_fee: '', basic_percent: '10', standard_percent: '20', premium_percent: '30', notes: '',
}
const calcFee = (actual: number, pct: number) => Math.round(actual + (actual * pct / 100))
const fmtINR = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)

export default function OpsClient() {
  const supabase = createClient()
  const db = supabase as any

  // ── Fee management state ──
  const [fees, setFees] = useState<FeeRow[]>([])
  const [feeLoading, setFeeLoading] = useState(false)
  const [feeOpen, setFeeOpen] = useState(false)
  const [editFee, setEditFee] = useState<FeeRow | null>(null)
  const [feeForm, setFeeForm] = useState(EMPTY_FEE)
  const [feeSaving, setFeeSaving] = useState(false)
  const [depts, setDepts] = useState<Lookup[]>([])
  const [courseList, setCourseList] = useState<Lookup[]>([])
  const [sessionList, setSessionList] = useState<Lookup[]>([])

  const loadFees = useCallback(async () => {
    setFeeLoading(true)
    const { data } = await db
      .from('fee_structures')
      .select('*, department:departments(id,name), course:courses(id,name), session:sessions(id,name)')
      .order('created_at', { ascending: false })
    setFees((data ?? []) as FeeRow[])
    setFeeLoading(false)
  }, [db])

  async function loadLookups() {
    const [d, c, s] = await Promise.all([
      db.from('departments').select('id,name').eq('is_active', true).order('name'),
      db.from('courses').select('id,name').eq('is_active', true).order('name'),
      db.from('sessions').select('id,name').eq('is_active', true).order('name'),
    ])
    setDepts(d.data ?? [])
    setCourseList(c.data ?? [])
    setSessionList(s.data ?? [])
  }

  function openAddFee() {
    setEditFee(null)
    setFeeForm(EMPTY_FEE)
    loadLookups()
    setFeeOpen(true)
  }

  function openEditFee(f: FeeRow) {
    setEditFee(f)
    setFeeForm({
      department_id: f.department?.id ?? '',
      course_id: f.course?.id ?? '',
      session_id: f.session?.id ?? '',
      actual_fee: String(f.actual_fee),
      basic_percent: String(f.basic_percent),
      standard_percent: String(f.standard_percent),
      premium_percent: String(f.premium_percent),
      notes: f.notes ?? '',
    })
    loadLookups()
    setFeeOpen(true)
  }

  async function handleSaveFee() {
    if (!feeForm.department_id || !feeForm.course_id || !feeForm.session_id || !feeForm.actual_fee) {
      toast.error('Department, course, session and actual fee are required')
      return
    }
    setFeeSaving(true)
    const payload = {
      department_id: feeForm.department_id,
      course_id: feeForm.course_id,
      session_id: feeForm.session_id,
      actual_fee: Number(feeForm.actual_fee),
      basic_percent: Number(feeForm.basic_percent),
      standard_percent: Number(feeForm.standard_percent),
      premium_percent: Number(feeForm.premium_percent),
      notes: feeForm.notes || null,
      updated_at: new Date().toISOString(),
    }
    try {
      if (editFee) {
        const { error } = await db.from('fee_structures').update(payload).eq('id', editFee.id)
        if (error) { toast.error(error.message); return }
        toast.success('Fee structure updated')
      } else {
        const { error } = await db.from('fee_structures').insert(payload)
        if (error) { toast.error(error.message); return }
        toast.success('Fee structure added')
      }
      setFeeOpen(false)
      loadFees()
    } finally { setFeeSaving(false) }
  }

  async function handleDeleteFee(id: string) {
    if (!confirm('Delete this fee structure?')) return
    const { error } = await db.from('fee_structures').delete().eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success('Deleted')
    loadFees()
  }

  function downloadFeeExcel() {
    const rows = fees.map(f => ({
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
    ws['!cols'] = [20, 25, 15, 15, 10, 15, 12, 16, 12, 16, 20].map(w => ({ wch: w }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Fee Structure')
    XLSX.writeFile(wb, 'DCW_Fee_Structure.xlsx')
  }

  return (
    <div className="space-y-6">
      <PageHeader title="OPS" description="Fee management, dispatch and tasks" />

      <Tabs defaultValue="fees" className="space-y-4">
        <TabsList className="bg-white border">
          <TabsTrigger value="fees" className="gap-1.5 text-xs sm:text-sm" onClick={loadFees}>
            <IndianRupee className="w-4 h-4" /> Fee Management
          </TabsTrigger>
          <TabsTrigger value="feeplan" className="gap-1.5 text-xs sm:text-sm">
            <FileText className="w-4 h-4" /> Fee Plan PDF
          </TabsTrigger>
          <TabsTrigger value="dispatch" className="gap-1.5 text-xs sm:text-sm">
            <Truck className="w-4 h-4" /> Dispatch
          </TabsTrigger>
          <TabsTrigger value="tasks" className="gap-1.5 text-xs sm:text-sm">
            <ClipboardList className="w-4 h-4" /> Tasks
          </TabsTrigger>
        </TabsList>

        {/* ══ FEE PLAN PDF ══ */}
        <TabsContent value="feeplan" className="space-y-4">
          <FeePlanBuilder />
        </TabsContent>

        {/* ══ DISPATCH MANAGEMENT ══ */}
        <TabsContent value="dispatch" className="space-y-4">
          <DispatchManager />
        </TabsContent>

        {/* ══ TASK MANAGEMENT ══ */}
        <TabsContent value="tasks" className="space-y-4">
          <TaskManager />
        </TabsContent>

        {/* ══ FEE MANAGEMENT ══ */}
        <TabsContent value="fees" className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <Button size="sm" onClick={openAddFee} className="gap-1.5 h-8">
              <Plus className="w-3.5 h-3.5" /> Add Fee Structure
            </Button>
            <Button variant="outline" size="sm" onClick={loadFees} className="gap-1.5 h-8">
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={downloadFeeExcel} disabled={fees.length === 0}
              className="gap-1.5 h-8 ml-auto text-green-700 border-green-300 hover:bg-green-50">
              <Download className="w-3.5 h-3.5" /> Download Excel
            </Button>
          </div>

          {feeLoading ? (
            <div className="text-center py-16 text-muted-foreground text-sm">Loading…</div>
          ) : fees.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <IndianRupee className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No fee structures yet</p>
              <p className="text-xs mt-1">Click "Add Fee Structure" to create one</p>
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
                      <th className="text-right px-4 py-3 font-semibold text-slate-600">Actual Fee</th>
                      <th className="text-center px-4 py-3 font-semibold text-amber-700 bg-amber-50/60">Basic</th>
                      <th className="text-center px-4 py-3 font-semibold text-blue-700 bg-blue-50/60">Standard</th>
                      <th className="text-center px-4 py-3 font-semibold text-purple-700 bg-purple-50/60">Premium</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {fees.map(f => (
                      <tr key={f.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 font-medium text-gray-900">{f.department?.name ?? '—'}</td>
                        <td className="px-4 py-3 text-slate-700">{f.course?.name ?? '—'}</td>
                        <td className="px-4 py-3 text-slate-500 text-xs">{f.session?.name ?? '—'}</td>
                        <td className="px-4 py-3 text-right font-mono text-slate-500 text-xs">{fmtINR(f.actual_fee)}</td>
                        <td className="px-4 py-3 bg-amber-50/40">
                          <div className="text-center">
                            <p className="font-bold text-amber-800 font-mono text-xs">{fmtINR(calcFee(f.actual_fee, f.basic_percent))}</p>
                            <p className="text-[10px] text-amber-500">{f.basic_percent}%</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 bg-blue-50/40">
                          <div className="text-center">
                            <p className="font-bold text-blue-800 font-mono text-xs">{fmtINR(calcFee(f.actual_fee, f.standard_percent))}</p>
                            <p className="text-[10px] text-blue-500">{f.standard_percent}%</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 bg-purple-50/40">
                          <div className="text-center">
                            <p className="font-bold text-purple-800 font-mono text-xs">{fmtINR(calcFee(f.actual_fee, f.premium_percent))}</p>
                            <p className="text-[10px] text-purple-500">{f.premium_percent}%</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEditFee(f)}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                              onClick={() => handleDeleteFee(f.id)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-2 border-t bg-slate-50 text-xs text-slate-500">{fees.length} fee structure{fees.length !== 1 ? 's' : ''}</div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Fee Add/Edit Dialog ── */}
      <Dialog open={feeOpen} onOpenChange={setFeeOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IndianRupee className="w-5 h-5 text-blue-600" />
              {editFee ? 'Edit Fee Structure' : 'Add Fee Structure'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Selects */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-600">Department *</Label>
                <select value={feeForm.department_id} onChange={e => setFeeForm(p => ({ ...p, department_id: e.target.value }))}
                  className="w-full border rounded-lg px-3 h-9 text-sm bg-white">
                  <option value="">Select…</option>
                  {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-600">Course *</Label>
                <select value={feeForm.course_id} onChange={e => setFeeForm(p => ({ ...p, course_id: e.target.value }))}
                  className="w-full border rounded-lg px-3 h-9 text-sm bg-white">
                  <option value="">Select…</option>
                  {courseList.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-600">Session *</Label>
                <select value={feeForm.session_id} onChange={e => setFeeForm(p => ({ ...p, session_id: e.target.value }))}
                  className="w-full border rounded-lg px-3 h-9 text-sm bg-white">
                  <option value="">Select…</option>
                  {sessionList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>

            {/* Actual fee */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Actual Fee (₹) *</Label>
              <Input type="number" min="0" placeholder="e.g. 50000"
                value={feeForm.actual_fee} onChange={e => setFeeForm(p => ({ ...p, actual_fee: e.target.value }))} />
            </div>

            {/* Tier percentages */}
            <div className="border rounded-xl p-4 space-y-3 bg-slate-50">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Tier Markup (% added on top of actual fee)</p>
              <div className="grid grid-cols-3 gap-3">
                {(['basic', 'standard', 'premium'] as const).map(tier => {
                  const key = `${tier}_percent` as keyof typeof feeForm
                  const colors = { basic: 'amber', standard: 'blue', premium: 'purple' }
                  const color = colors[tier]
                  const computed = feeForm.actual_fee && feeForm[key]
                    ? calcFee(Number(feeForm.actual_fee), Number(feeForm[key]))
                    : 0
                  return (
                    <div key={tier} className="space-y-1.5">
                      <Label className={`text-xs font-semibold text-${color}-700 capitalize`}>{tier}</Label>
                      <div className="relative">
                        <Input type="number" min="0" max="200"
                          value={feeForm[key]}
                          onChange={e => setFeeForm(p => ({ ...p, [key]: e.target.value }))}
                          className="pr-7" />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">%</span>
                      </div>
                      {computed > 0 && (
                        <p className={`text-xs font-bold text-${color}-700`}>{fmtINR(computed)}</p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Notes (optional)</Label>
              <Input placeholder="Any special remarks…" value={feeForm.notes}
                onChange={e => setFeeForm(p => ({ ...p, notes: e.target.value }))} />
            </div>

            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setFeeOpen(false)} disabled={feeSaving}>Cancel</Button>
              <Button onClick={handleSaveFee} disabled={feeSaving} className="min-w-28">
                {feeSaving
                  ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : editFee ? 'Update' : 'Save'
                }
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  )
}
