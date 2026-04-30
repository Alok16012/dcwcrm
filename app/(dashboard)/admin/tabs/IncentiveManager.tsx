'use client'
import { useState } from 'react'
import { Plus, Pencil, Trash2, TrendingUp, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'

interface IncentiveSlab {
  id: string
  course_id: string
  course_name: string
  department_id: string
  department_name: string
  basic_incentive: number
  standard_incentive: number
  premium_incentive: number
  incentive_type: 'flat' | 'percent'
  effective_from: string
  is_active: boolean
}

interface Props {
  courses: { id: string; name: string }[]
  departments: { id: string; name: string }[]
}

const SAMPLE: IncentiveSlab[] = [
  { id: '1', course_id: '', course_name: 'B.Com', department_id: '', department_name: 'Commerce', basic_incentive: 500, standard_incentive: 800, premium_incentive: 1200, incentive_type: 'flat', effective_from: '2026-04-01', is_active: true },
  { id: '2', course_id: '', course_name: 'BBA', department_id: '', department_name: 'Management', basic_incentive: 600, standard_incentive: 1000, premium_incentive: 1500, incentive_type: 'flat', effective_from: '2026-04-01', is_active: true },
  { id: '3', course_id: '', course_name: 'MBA', department_id: '', department_name: 'Management', basic_incentive: 5, standard_incentive: 7, premium_incentive: 10, incentive_type: 'percent', effective_from: '2026-04-01', is_active: true },
]

function formatIncentive(slab: IncentiveSlab, key: 'basic_incentive' | 'standard_incentive' | 'premium_incentive') {
  const v = slab[key]
  return slab.incentive_type === 'flat' ? `₹${v.toLocaleString('en-IN')}` : `${v}%`
}

export function IncentiveManager({ courses, departments }: Props) {
  const [slabs, setSlabs] = useState<IncentiveSlab[]>(SAMPLE)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<IncentiveSlab | null>(null)
  const [form, setForm] = useState({
    course_id: '', department_id: '',
    basic_incentive: '', standard_incentive: '', premium_incentive: '',
    incentive_type: 'flat' as 'flat' | 'percent',
    effective_from: new Date().toISOString().split('T')[0],
  })

  function openAdd() {
    setEditing(null)
    setForm({ course_id: '', department_id: '', basic_incentive: '', standard_incentive: '', premium_incentive: '', incentive_type: 'flat', effective_from: new Date().toISOString().split('T')[0] })
    setOpen(true)
  }

  function openEdit(s: IncentiveSlab) {
    setEditing(s)
    setForm({ course_id: s.course_id, department_id: s.department_id, basic_incentive: String(s.basic_incentive), standard_incentive: String(s.standard_incentive), premium_incentive: String(s.premium_incentive), incentive_type: s.incentive_type, effective_from: s.effective_from })
    setOpen(true)
  }

  function handleSave() {
    if (!form.basic_incentive || !form.standard_incentive || !form.premium_incentive) { toast.error('Fill all incentive fields'); return }
    const courseName = courses.find(c => c.id === form.course_id)?.name ?? 'New Course'
    const deptName = departments.find(d => d.id === form.department_id)?.name ?? 'General'
    const entry = { ...form, course_name: courseName, department_name: deptName, basic_incentive: Number(form.basic_incentive), standard_incentive: Number(form.standard_incentive), premium_incentive: Number(form.premium_incentive), is_active: true }
    if (editing) {
      setSlabs(prev => prev.map(s => s.id === editing.id ? { ...s, ...entry } : s))
      toast.success('Incentive slab updated')
    } else {
      setSlabs(prev => [...prev, { id: Date.now().toString(), ...entry }])
      toast.success('Incentive slab added')
    }
    setOpen(false)
  }

  function handleDelete(id: string) { setSlabs(prev => prev.filter(s => s.id !== id)); toast.success('Slab removed') }
  function toggleActive(id: string) { setSlabs(prev => prev.map(s => s.id === id ? { ...s, is_active: !s.is_active } : s)) }

  const totalCredit = slabs.filter(s => s.is_active && s.incentive_type === 'flat').reduce((a, s) => a + s.premium_incentive, 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Incentive Slab Manager</h2>
          <p className="text-sm text-muted-foreground">Set flat or percentage incentives per course per plan. Versioned by effective date.</p>
        </div>
        <Button size="sm" onClick={openAdd}><Plus className="w-4 h-4 mr-1" /> Add Slab</Button>
      </div>

      {/* Quick stat */}
      <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
        <TrendingUp className="w-5 h-5 text-green-600 flex-shrink-0" />
        <div>
          <p className="text-sm font-semibold text-green-800">Max Premium Incentive Pool</p>
          <p className="text-xs text-green-600">₹{totalCredit.toLocaleString('en-IN')} total across active flat-rate premium slabs</p>
        </div>
      </div>

      <div className="rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-slate-600">Course</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600">Department</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600">Type</th>
              <th className="text-right px-4 py-3 font-semibold text-blue-600">Basic</th>
              <th className="text-right px-4 py-3 font-semibold text-purple-600">Standard</th>
              <th className="text-right px-4 py-3 font-semibold text-amber-600">Premium</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600">Effective</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {slabs.map(s => (
              <tr key={s.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium">{s.course_name}</td>
                <td className="px-4 py-3 text-slate-600">{s.department_name}</td>
                <td className="px-4 py-3">
                  <Badge variant="outline" className={s.incentive_type === 'flat' ? 'text-green-700 border-green-300' : 'text-blue-700 border-blue-300'}>
                    {s.incentive_type === 'flat' ? 'Flat ₹' : 'Percent %'}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-right font-mono text-blue-700">{formatIncentive(s, 'basic_incentive')}</td>
                <td className="px-4 py-3 text-right font-mono text-purple-700">{formatIncentive(s, 'standard_incentive')}</td>
                <td className="px-4 py-3 text-right font-mono text-amber-700">{formatIncentive(s, 'premium_incentive')}</td>
                <td className="px-4 py-3 text-slate-500">{s.effective_from}</td>
                <td className="px-4 py-3">
                  <button onClick={() => toggleActive(s.id)}>
                    <Badge className={s.is_active ? 'bg-green-100 text-green-800 border-0 cursor-pointer' : 'bg-gray-100 text-gray-600 border-0 cursor-pointer'}>
                      {s.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </button>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 justify-end">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(s)}><Pencil className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => handleDelete(s.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                </td>
              </tr>
            ))}
            {slabs.length === 0 && (
              <tr><td colSpan={9} className="text-center py-8 text-slate-400">No incentive slabs configured</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-start gap-2 text-xs text-muted-foreground bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
        <Info className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
        <span>
          For part payment admissions, incentive is held until full payment. For yearly payment, incentive is split per year as configured (e.g. Year 1 = 60%, Year 2 = 25%, Year 3 = 15%).
        </span>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Incentive Slab' : 'Add Incentive Slab'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Course</Label>
                <Select value={form.course_id} onValueChange={v => setForm(f => ({ ...f, course_id: v ?? '' }))}>
                  <SelectTrigger><SelectValue placeholder="Select course" /></SelectTrigger>
                  <SelectContent>{courses.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Department</Label>
                <Select value={form.department_id} onValueChange={v => setForm(f => ({ ...f, department_id: v ?? '' }))}>
                  <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                  <SelectContent>{departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Incentive Type</Label>
              <Select value={form.incentive_type} onValueChange={v => setForm(f => ({ ...f, incentive_type: v as 'flat' | 'percent' }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="flat">Flat Amount (₹)</SelectItem>
                  <SelectItem value="percent">Percentage (%)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Basic {form.incentive_type === 'flat' ? '(₹)' : '(%)'}</Label>
                <Input type="number" placeholder={form.incentive_type === 'flat' ? '500' : '5'} value={form.basic_incentive} onChange={e => setForm(f => ({ ...f, basic_incentive: e.target.value }))} />
              </div>
              <div>
                <Label>Standard {form.incentive_type === 'flat' ? '(₹)' : '(%)'}</Label>
                <Input type="number" placeholder={form.incentive_type === 'flat' ? '800' : '7'} value={form.standard_incentive} onChange={e => setForm(f => ({ ...f, standard_incentive: e.target.value }))} />
              </div>
              <div>
                <Label>Premium {form.incentive_type === 'flat' ? '(₹)' : '(%)'}</Label>
                <Input type="number" placeholder={form.incentive_type === 'flat' ? '1200' : '10'} value={form.premium_incentive} onChange={e => setForm(f => ({ ...f, premium_incentive: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Effective From</Label>
              <Input type="date" value={form.effective_from} onChange={e => setForm(f => ({ ...f, effective_from: e.target.value }))} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={handleSave}>{editing ? 'Save Changes' : 'Add Slab'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
