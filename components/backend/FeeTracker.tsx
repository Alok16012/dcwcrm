'use client'
import { useState, useTransition } from 'react'
import { Plus } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { StatCard } from '@/components/shared/StatCard'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { paymentSchema, type PaymentFormData } from '@/lib/validations/payment.schema'
import { PAYMENT_MODE_LABELS, formatCurrency, type Payment, type Student } from '@/types/app.types'

interface FeeTrackerProps {
  student: Student
  payments: Payment[]
  onPaymentAdded: () => void
}

export function FeeTracker({ student, payments, onPaymentAdded }: FeeTrackerProps) {
  const [showForm, setShowForm] = useState(false)
  const [isPending, startTransition] = useTransition()
  const supabase = createClient()

  const { register, handleSubmit, setValue, reset, formState: { errors } } = useForm<PaymentFormData>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { payment_date: format(new Date(), 'yyyy-MM-dd') },
  })

  const pending = (student.total_fee ?? 0) - (student.amount_paid ?? 0)

  async function onSubmit(data: PaymentFormData) {
    startTransition(async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        const { error } = await supabase.from('payments').insert({
          lead_id: student.lead_id ?? null,
          student_id: student.id,
          amount: data.amount,
          payment_mode: data.payment_mode,
          payment_date: data.payment_date,
          receipt_number: data.receipt_number ?? null,
          notes: data.notes ?? null,
          recorded_by: user?.id,
        } as never)
        if (error) throw error
        toast.success('Payment recorded')
        reset()
        setShowForm(false)
        onPaymentAdded()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to record payment')
      }
    })
  }

  return (
    <div className="space-y-4">
      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Total Fee" value={student.total_fee ? formatCurrency(student.total_fee) : 'Not set'} color="blue" />
        <StatCard label="Amount Paid" value={formatCurrency(student.amount_paid ?? 0)} color="green" />
        <StatCard label="Pending Balance" value={formatCurrency(Math.max(0, pending))} color={pending > 0 ? 'red' : 'default'} />
      </div>

      {/* Payment history */}
      <div className="bg-white rounded-lg border">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-medium">Payment History</h3>
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4 mr-1" /> Record Payment
          </Button>
        </div>
        {payments.length === 0 ? (
          <p className="text-center text-gray-500 py-8 text-sm">No payments recorded yet</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-2 text-gray-600 font-medium">Date</th>
                <th className="text-left px-4 py-2 text-gray-600 font-medium">Amount</th>
                <th className="text-left px-4 py-2 text-gray-600 font-medium">Mode</th>
                <th className="text-left px-4 py-2 text-gray-600 font-medium">Receipt</th>
                <th className="text-left px-4 py-2 text-gray-600 font-medium">Recorded By</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {payments.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-2">{format(new Date(p.payment_date), 'dd MMM yyyy')}</td>
                  <td className="px-4 py-2 font-medium text-green-700">{formatCurrency(p.amount)}</td>
                  <td className="px-4 py-2">{PAYMENT_MODE_LABELS[p.payment_mode]}</td>
                  <td className="px-4 py-2">{p.receipt_number ?? '-'}</td>
                  <td className="px-4 py-2">{(p as Payment & { recorder?: { full_name: string } }).recorder?.full_name ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Payment form dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label>Amount (₹) *</Label>
              <Input type="number" {...register('amount', { valueAsNumber: true })} />
              {errors.amount && <p className="text-xs text-red-500">{errors.amount.message}</p>}
            </div>
            <div>
              <Label>Payment Mode *</Label>
              <Select onValueChange={(v) => setValue('payment_mode', v as PaymentFormData['payment_mode'])}>
                <SelectTrigger><SelectValue placeholder="Select mode" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PAYMENT_MODE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.payment_mode && <p className="text-xs text-red-500">{errors.payment_mode.message}</p>}
            </div>
            <div>
              <Label>Payment Date *</Label>
              <Input type="date" {...register('payment_date')} />
              {errors.payment_date && <p className="text-xs text-red-500">{errors.payment_date.message}</p>}
            </div>
            <div>
              <Label>Receipt Number</Label>
              <Input {...register('receipt_number')} placeholder="Optional" />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea {...register('notes')} rows={2} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit" disabled={isPending}>{isPending ? 'Saving...' : 'Record Payment'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
