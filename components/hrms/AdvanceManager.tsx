'use client'

import { useCallback, useEffect, useState } from 'react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { Plus, Trash2, Loader2, Wallet } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface Employee { id: string; name: string }

interface AdvanceRow {
  id: string
  employee_id: string
  amount: number
  given_on: string
  reason: string | null
  status: 'pending' | 'settled' | 'cancelled'
  created_at: string
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)

const STATUS_STYLE: Record<string, string> = {
  pending:   'bg-amber-100 text-amber-700 border-amber-200',
  settled:   'bg-green-100 text-green-700 border-green-200',
  cancelled: 'bg-gray-100 text-gray-500 border-gray-200',
}

export default function AdvanceManager({ employees }: { employees: Employee[] }) {
  const supabase = createClient()
  const [advances, setAdvances] = useState<AdvanceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ employee_id: '', amount: '', given_on: format(new Date(), 'yyyy-MM-dd'), reason: '' })

  const nameOf = (id: string) => employees.find(e => e.id === id)?.name ?? '—'

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('advance_salaries')
      .select('id, employee_id, amount, given_on, reason, status, created_at')
      .order('created_at', { ascending: false })
    if (error) toast.error('Failed to load advances: ' + error.message)
    setAdvances((data ?? []) as AdvanceRow[])
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  async function handleAdd() {
    if (!form.employee_id) { toast.error('Employee chunein'); return }
    const amount = Number(form.amount)
    if (!amount || amount <= 0) { toast.error('Sahi amount daalein'); return }
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase.from('advance_salaries').insert({
        employee_id: form.employee_id,
        amount,
        given_on: form.given_on,
        reason: form.reason.trim() || null,
        status: 'pending',
        created_by: user?.id ?? null,
      } as never)
      if (error) throw error
      toast.success('Advance added — agle payroll me deduct hoga')
      setShowForm(false)
      setForm({ employee_id: '', amount: '', given_on: format(new Date(), 'yyyy-MM-dd'), reason: '' })
      await load()
    } catch (e) {
      toast.error((e as { message?: string })?.message ?? 'Failed to add advance')
    } finally {
      setSaving(false)
    }
  }

  async function handleCancel(row: AdvanceRow) {
    if (!confirm(`Cancel ${fmt(row.amount)} advance for ${nameOf(row.employee_id)}?`)) return
    const { error } = await supabase
      .from('advance_salaries')
      .update({ status: 'cancelled' } as never)
      .eq('id', row.id)
      .eq('status', 'pending')
    if (error) { toast.error(error.message); return }
    toast.success('Advance cancelled')
    setAdvances(prev => prev.map(a => a.id === row.id ? { ...a, status: 'cancelled' } : a))
  }

  const pendingTotal = advances.filter(a => a.status === 'pending').reduce((s, a) => s + Number(a.amount), 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2">
          <Wallet className="w-4 h-4 text-amber-600" />
          <span className="text-sm font-semibold text-amber-800">Pending recovery: {fmt(pendingTotal)}</span>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="mr-2 h-4 w-4" /> Give Advance
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        </div>
      ) : advances.length === 0 ? (
        <div className="text-center py-16 border rounded-xl bg-white">
          <Wallet className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          <p className="font-medium text-gray-500">Koi advance nahi hai</p>
          <p className="text-xs text-gray-400 mt-1">"Give Advance" se naya advance dein</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-xs">
                <th className="px-3 py-2 text-left">Employee</th>
                <th className="px-3 py-2 text-right">Amount</th>
                <th className="px-3 py-2 text-left">Given On</th>
                <th className="px-3 py-2 text-left">Reason</th>
                <th className="px-3 py-2 text-center">Status</th>
                <th className="px-3 py-2 w-14"></th>
              </tr>
            </thead>
            <tbody>
              {advances.map(a => (
                <tr key={a.id} className="border-b hover:bg-muted/30">
                  <td className="px-3 py-2 font-medium">{nameOf(a.employee_id)}</td>
                  <td className="px-3 py-2 text-right font-semibold">{fmt(Number(a.amount))}</td>
                  <td className="px-3 py-2 text-xs whitespace-nowrap">{format(new Date(a.given_on + 'T00:00:00'), 'dd MMM yyyy')}</td>
                  <td className="px-3 py-2 text-xs text-gray-500">{a.reason ?? '—'}</td>
                  <td className="px-3 py-2 text-center">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border capitalize ${STATUS_STYLE[a.status]}`}>
                      {a.status === 'settled' ? 'Recovered' : a.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    {a.status === 'pending' && (
                      <Button
                        size="sm" variant="ghost" title="Cancel advance"
                        className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                        onClick={() => handleCancel(a)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Give Advance Salary</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Employee *</Label>
              <select
                value={form.employee_id}
                onChange={e => setForm(p => ({ ...p, employee_id: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 h-9 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select employee…</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Amount (₹) *</Label>
                <input
                  type="number" min="1" value={form.amount}
                  onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 h-9 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Given On</Label>
                <input
                  type="date" value={form.given_on}
                  onChange={e => setForm(p => ({ ...p, given_on: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 h-9 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Reason</Label>
              <input
                type="text" value={form.reason} placeholder="e.g. Medical emergency"
                onChange={e => setForm(p => ({ ...p, reason: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 h-9 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <p className="text-xs text-gray-500 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
              Pending advance employee ke agle payroll generate hote hi net salary se deduct ho jayega.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowForm(false)} disabled={saving}>Cancel</Button>
              <Button onClick={handleAdd} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add Advance'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
