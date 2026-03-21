'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)

type PayrollRow = { id: string; month: number; year: number; incentive: number; net: number; status: string; payment_date: string | null }
type Employee = { id: string; name: string }

interface Props {
  role: string
  myEmployeeId: string | null
  employees: Employee[]
}

export function IncentiveClient({ role, myEmployeeId, employees }: Props) {
  const canAdd = role === 'admin' || role === 'backend'
  const defaultView = myEmployeeId ?? (canAdd && employees.length > 0 ? employees[0].id : '')
  const [payrollRows, setPayrollRows] = useState<PayrollRow[]>([])
  const [loading, setLoading] = useState(true)
  const [viewEmployeeId, setViewEmployeeId] = useState(defaultView)
  const [showAdd, setShowAdd] = useState(false)
  const [selectedEmployee, setSelectedEmployee] = useState(myEmployeeId ?? (employees[0]?.id ?? ''))
  const [addMonth, setAddMonth] = useState(String(new Date().getMonth() + 1))
  const [addYear, setAddYear] = useState(String(new Date().getFullYear()))
  const [addIncentive, setAddIncentive] = useState('')
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  const fetchPayroll = useCallback(async () => {
    if (!viewEmployeeId) { setPayrollRows([]); setLoading(false); return }
    setLoading(true)
    const { data } = await supabase
      .from('payroll')
      .select('id, month, year, incentive, net, status, payment_date')
      .eq('employee_id', viewEmployeeId)
      .order('year', { ascending: false })
      .order('month', { ascending: false })
    setPayrollRows((data ?? []) as PayrollRow[])
    setLoading(false)
  }, [viewEmployeeId])

  useEffect(() => { fetchPayroll() }, [fetchPayroll])

  async function handleAdd() {
    if (!selectedEmployee) { toast.error('Select an employee'); return }
    const incentiveAmt = parseFloat(addIncentive)
    if (isNaN(incentiveAmt) || incentiveAmt <= 0) { toast.error('Enter valid incentive amount'); return }
    setSaving(true)
    try {
      const { data: existing } = await supabase
        .from('payroll')
        .select('id, incentive, gross, net')
        .eq('employee_id', selectedEmployee)
        .eq('month', Number(addMonth))
        .eq('year', Number(addYear))
        .maybeSingle()

      if (existing) {
        const diff = incentiveAmt - ((existing as any).incentive ?? 0)
        await supabase.from('payroll').update({
          incentive: incentiveAmt,
          gross: ((existing as any).gross ?? 0) + diff,
          net: ((existing as any).net ?? 0) + diff,
        } as never).eq('id', (existing as any).id)
      } else {
        await supabase.from('payroll').insert({
          employee_id: selectedEmployee,
          month: Number(addMonth),
          year: Number(addYear),
          basic: 0, hra: 0, allowances: 0,
          incentive: incentiveAmt,
          gross: incentiveAmt,
          pf: 0, tds: 0, other_deductions: 0, leave_deduction: 0,
          net: incentiveAmt,
          status: 'draft',
        } as never)
      }
      toast.success('Incentive saved successfully')
      setShowAdd(false)
      setAddIncentive('')
      fetchPayroll()
    } catch {
      toast.error('Failed to save incentive')
    } finally {
      setSaving(false)
    }
  }

  const totalIncentive = payrollRows.reduce((s, r) => s + (r.incentive ?? 0), 0)
  const paidIncentive = payrollRows.filter((r) => r.status === 'paid').reduce((s, r) => s + (r.incentive ?? 0), 0)
  const unpaidIncentive = totalIncentive - paidIncentive
  const years = Array.from({ length: 5 }, (_, i) => String(new Date().getFullYear() - i))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        {canAdd && employees.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 font-medium">Employee:</span>
            <Select value={viewEmployeeId} onValueChange={(v) => setViewEmployeeId(v ?? '')}>
              <SelectTrigger className="w-48 h-9">
                <SelectValue>{employees.find(e => e.id === viewEmployeeId)?.name ?? 'Select employee'}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {canAdd && (
          <Button size="sm" onClick={() => setShowAdd(true)} className="ml-auto">
            <Plus className="mr-2 h-4 w-4" /> Add Incentive for Old Month
          </Button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border p-4 bg-purple-50">
          <p className="text-sm text-purple-700 font-medium">Total Incentive</p>
          <p className="text-2xl font-bold text-purple-900">{fmt(totalIncentive)}</p>
        </div>
        <div className="rounded-lg border p-4 bg-green-50">
          <p className="text-sm text-green-700 font-medium">Paid</p>
          <p className="text-2xl font-bold text-green-900">{fmt(paidIncentive)}</p>
        </div>
        <div className="rounded-lg border p-4 bg-amber-50">
          <p className="text-sm text-amber-700 font-medium">Pending / Not Paid</p>
          <p className="text-2xl font-bold text-amber-900">{fmt(unpaidIncentive)}</p>
        </div>
      </div>

      <div className="rounded-lg border overflow-hidden">
        <div className="px-4 py-3 border-b bg-gray-50">
          <h3 className="font-semibold text-sm">Month-wise Incentive Breakdown</h3>
        </div>
        {loading ? (
          <div className="px-4 py-8 text-center text-sm text-gray-500">Loading...</div>
        ) : payrollRows.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-gray-500">
            {viewEmployeeId ? 'No payroll records found.' : 'No employee record linked to your account. Contact admin.'}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-2 text-gray-600 font-medium">Month</th>
                <th className="text-right px-4 py-2 text-gray-600 font-medium">Incentive</th>
                <th className="text-right px-4 py-2 text-gray-600 font-medium">Net Pay</th>
                <th className="text-right px-4 py-2 text-gray-600 font-medium">Payment Date</th>
                <th className="text-right px-4 py-2 text-gray-600 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {payrollRows.map((row, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{MONTH_NAMES[row.month - 1]} {row.year}</td>
                  <td className="px-4 py-3 text-right text-purple-700 font-semibold">{fmt(row.incentive ?? 0)}</td>
                  <td className="px-4 py-3 text-right">{fmt(row.net ?? 0)}</td>
                  <td className="px-4 py-3 text-right text-gray-500">
                    {row.payment_date ? new Date(row.payment_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Badge
                      variant={row.status === 'paid' ? 'default' : row.status === 'processed' ? 'secondary' : 'outline'}
                      className="text-xs"
                    >
                      {row.status === 'paid' ? 'Paid' : row.status === 'processed' ? 'Processed' : 'Pending'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Incentive for Old Month</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {employees.length > 0 && (
              <div className="space-y-1.5">
                <Label>Employee</Label>
                <Select value={selectedEmployee} onValueChange={(v) => setSelectedEmployee(v ?? '')}>
                  <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                  <SelectContent>
                    {employees.map((e) => (
                      <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Month</Label>
                <Select value={addMonth} onValueChange={(v) => setAddMonth(v ?? '')}>

                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MONTH_NAMES.map((m, i) => (
                      <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Year</Label>
                <Select value={addYear} onValueChange={(v) => setAddYear(v ?? '')}>

                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {years.map((y) => (
                      <SelectItem key={y} value={y}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Incentive Amount (₹)</Label>
              <Input
                type="number"
                min="0"
                placeholder="0"
                value={addIncentive}
                onChange={(e) => setAddIncentive(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button onClick={handleAdd} disabled={saving}>
                {saving ? 'Saving...' : 'Save Incentive'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
