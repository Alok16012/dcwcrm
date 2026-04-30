'use client'
import { useState } from 'react'
import { Plus, Pencil, Trash2, History, IndianRupee } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'

interface FeePlan {
  id: string
  course_id: string
  course_name: string
  department_id: string
  department_name: string
  basic_fee: number
  standard_fee: number
  premium_fee: number
  effective_from: string
  is_active: boolean
}

interface Props {
  courses: { id: string; name: string }[]
  departments: { id: string; name: string }[]
}

const SAMPLE_PLANS: FeePlan[] = [
  { id: '1', course_id: '', course_name: 'B.Com', department_id: '', department_name: 'Commerce', basic_fee: 15000, standard_fee: 22000, premium_fee: 32000, effective_from: '2026-04-01', is_active: true },
  { id: '2', course_id: '', course_name: 'BBA', department_id: '', department_name: 'Management', basic_fee: 18000, standard_fee: 26000, premium_fee: 38000, effective_from: '2026-04-01', is_active: true },
  { id: '3', course_id: '', course_name: 'MBA', department_id: '', department_name: 'Management', basic_fee: 28000, standard_fee: 42000, premium_fee: 60000, effective_from: '2026-04-01', is_active: true },
]

function fmt(n: number) {
  return '₹' + n.toLocaleString('en-IN')
}

export function FeeManager({ courses, departments }: Props) {
  const [plans, setPlans] = useState<FeePlan[]>(SAMPLE_PLANS)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<FeePlan | null>(null)
  const [form, setForm] = useState({ course_id: '', department_id: '', basic_fee: '', standard_fee: '', premium_fee: '', effective_from: new Date().toISOString().split('T')[0] })

  function openAdd() {
    setEditing(null)
    setForm({ course_id: '', department_id: '', basic_fee: '', standard_fee: '', premium_fee: '', effective_from: new Date().toISOString().split('T')[0] })
    setOpen(true)
  }

  function openEdit(p: FeePlan) {
    setEditing(p)
    setForm({ course_id: p.course_id, department_id: p.department_id, basic_fee: String(p.basic_fee), standard_fee: String(p.standard_fee), premium_fee: String(p.premium_fee), effective_from: p.effective_from })
    setOpen(true)
  }

  function handleSave() {
    if (!form.basic_fee || !form.standard_fee || !form.premium_fee) {
      toast.error('Please fill all fee fields')
      return
    }
    const courseName = courses.find(c => c.id === form.course_id)?.name ?? form.course_id ?? 'New Course'
    const deptName = departments.find(d => d.id === form.department_id)?.name ?? form.department_id ?? 'General'
    if (editing) {
      setPlans(prev => prev.map(p => p.id === editing.id ? { ...p, ...form, course_name: courseName, department_name: deptName, basic_fee: Number(form.basic_fee), standard_fee: Number(form.standard_fee), premium_fee: Number(form.premium_fee) } : p))
      toast.success('Fee plan updated')
    } else {
      setPlans(prev => [...prev, { id: Date.now().toString(), ...form, course_name: courseName, department_name: deptName, basic_fee: Number(form.basic_fee), standard_fee: Number(form.standard_fee), premium_fee: Number(form.premium_fee), is_active: true }])
      toast.success('Fee plan added')
    }
    setOpen(false)
  }

  function handleDelete(id: string) {
    setPlans(prev => prev.filter(p => p.id !== id))
    toast.success('Fee plan removed')
  }

  function toggleActive(id: string) {
    setPlans(prev => prev.map(p => p.id === id ? { ...p, is_active: !p.is_active } : p))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Fee & Plan Manager</h2>
          <p className="text-sm text-muted-foreground">Set Basic / Standard / Premium fees per course with version history. Each version is date-stamped.</p>
        </div>
        <Button size="sm" onClick={openAdd}><Plus className="w-4 h-4 mr-1" /> Add Fee Plan</Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        {['Basic', 'Standard', 'Premium'].map((plan, i) => {
          const avg = Math.round(plans.filter(p => p.is_active).reduce((s, p) => s + [p.basic_fee, p.standard_fee, p.premium_fee][i], 0) / (plans.filter(p => p.is_active).length || 1))
          const colors = ['bg-blue-50 border-blue-200 text-blue-700', 'bg-purple-50 border-purple-200 text-purple-700', 'bg-amber-50 border-amber-200 text-amber-700']
          return (
            <Card key={plan} className={`border ${colors[i].split(' ').slice(0, 2).join(' ')}`}>
              <CardContent className="p-4">
                <p className={`text-xs font-semibold uppercase tracking-wide ${colors[i].split(' ')[2]}`}>{plan} Plan</p>
                <p className="text-xl font-bold mt-1">{fmt(avg)}</p>
                <p className="text-xs text-muted-foreground">Avg across active plans</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Plans table */}
      <div className="rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-slate-600">Course</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600">Department</th>
              <th className="text-right px-4 py-3 font-semibold text-blue-600">Basic</th>
              <th className="text-right px-4 py-3 font-semibold text-purple-600">Standard</th>
              <th className="text-right px-4 py-3 font-semibold text-amber-600">Premium</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600">Effective From</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {plans.map(p => (
              <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 font-medium">{p.course_name}</td>
                <td className="px-4 py-3 text-slate-600">{p.department_name}</td>
                <td className="px-4 py-3 text-right font-mono text-blue-700">{fmt(p.basic_fee)}</td>
                <td className="px-4 py-3 text-right font-mono text-purple-700">{fmt(p.standard_fee)}</td>
                <td className="px-4 py-3 text-right font-mono text-amber-700">{fmt(p.premium_fee)}</td>
                <td className="px-4 py-3 text-slate-500">{p.effective_from}</td>
                <td className="px-4 py-3">
                  <button onClick={() => toggleActive(p.id)}>
                    <Badge className={p.is_active ? 'bg-green-100 text-green-800 border-0 cursor-pointer' : 'bg-gray-100 text-gray-600 border-0 cursor-pointer'}>
                      {p.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </button>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 justify-end">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(p)}><Pencil className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => handleDelete(p.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                </td>
              </tr>
            ))}
            {plans.length === 0 && (
              <tr><td colSpan={8} className="text-center py-8 text-slate-400">No fee plans added yet</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
        <History className="w-4 h-4 text-blue-500 flex-shrink-0" />
        Fee plans are versioned by effective date. Existing admissions always reference their original fee version.
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><IndianRupee className="w-4 h-4" />{editing ? 'Edit Fee Plan' : 'Add Fee Plan'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Course</Label>
                <Select value={form.course_id} onValueChange={v => setForm(f => ({ ...f, course_id: v ?? '' }))}>
                  <SelectTrigger><SelectValue placeholder="Select course" /></SelectTrigger>
                  <SelectContent>
                    {courses.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Department</Label>
                <Select value={form.department_id} onValueChange={v => setForm(f => ({ ...f, department_id: v ?? '' }))}>
                  <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                  <SelectContent>
                    {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Basic Fee (₹)</Label>
                <Input type="number" placeholder="15000" value={form.basic_fee} onChange={e => setForm(f => ({ ...f, basic_fee: e.target.value }))} />
              </div>
              <div>
                <Label>Standard Fee (₹)</Label>
                <Input type="number" placeholder="22000" value={form.standard_fee} onChange={e => setForm(f => ({ ...f, standard_fee: e.target.value }))} />
              </div>
              <div>
                <Label>Premium Fee (₹)</Label>
                <Input type="number" placeholder="32000" value={form.premium_fee} onChange={e => setForm(f => ({ ...f, premium_fee: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Effective From</Label>
              <Input type="date" value={form.effective_from} onChange={e => setForm(f => ({ ...f, effective_from: e.target.value }))} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={handleSave}>{editing ? 'Save Changes' : 'Add Plan'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
