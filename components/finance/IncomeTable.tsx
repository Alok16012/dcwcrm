'use client'

import { useState, useTransition } from 'react'
import { format } from 'date-fns'
import { Download, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/shared/DataTable'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { ColumnDef } from '@tanstack/react-table'

// Minimal schema for manual income
const manualIncomeSchema = z.object({
  amount: z.number().min(1, 'Amount must be greater than 0'),
  payment_date: z.string().min(1, 'Date required'),
  payment_mode: z.enum(['cash', 'upi', 'card', 'neft', 'rtgs', 'cheque', 'other']),
  notes: z.string().min(1, 'Description required'),
  receipt_number: z.string().optional(),
})
type ManualIncomeData = z.infer<typeof manualIncomeSchema>

interface PaymentRow {
  id: string
  payment_date: string
  student_name: string
  course_name: string
  amount: number
  payment_mode: string
  receipt_number: string | null
  notes: string | null
  recorded_by_name: string
}

interface IncomeTableProps {
  data: PaymentRow[]
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)

const columns: ColumnDef<PaymentRow>[] = [
  {
    accessorKey: 'payment_date',
    header: 'Date',
    cell: ({ getValue }) => format(new Date(getValue() as string), 'dd MMM yyyy'),
  },
  { accessorKey: 'student_name', header: 'Source/Student' },
  {
    accessorKey: 'notes',
    header: 'Description',
    cell: ({ getValue }) => (getValue() as string) || '—',
  },
  {
    accessorKey: 'amount',
    header: 'Amount',
    cell: ({ getValue }) => fmt(getValue() as number),
  },
  {
    accessorKey: 'payment_mode',
    header: 'Mode',
    cell: ({ getValue }) => <span className="capitalize">{(getValue() as string).toUpperCase()}</span>,
  },
  {
    accessorKey: 'receipt_number',
    header: 'Receipt #',
    cell: ({ getValue }) => (getValue() as string) || '—',
  },
]

export default function IncomeTable({ data: initialData }: IncomeTableProps) {
  const [data, setData] = useState(initialData)
  const [showForm, setShowForm] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [isPending, startTransition] = useTransition()
  const supabase = createClient()

  const { register, handleSubmit, setValue, reset, formState: { errors } } = useForm<ManualIncomeData>({
    resolver: zodResolver(manualIncomeSchema),
    defaultValues: { payment_mode: 'cash', amount: 0, payment_date: format(new Date(), 'yyyy-MM-dd') },
  })

  // Export functionality
  const handleExport = () => {
    setExporting(true)
    startTransition(async () => {
      try {
        const xlsx = await import('xlsx')
        const rows = data.map((r) => ({
          Date: format(new Date(r.payment_date), 'dd MMM yyyy'),
          Source: r.student_name,
          Description: r.notes || '',
          Amount: r.amount,
          Mode: r.payment_mode.toUpperCase(),
          'Receipt #': r.receipt_number || '',
        }))
        const ws = xlsx.utils.json_to_sheet(rows)
        const wb = xlsx.utils.book_new()
        xlsx.utils.book_append_sheet(wb, ws, 'Income')
        xlsx.writeFile(wb, `income-${format(new Date(), 'yyyy-MM-dd')}.xlsx`)
      } finally {
        setExporting(false)
      }
    })
  }

  // Add manual income
  const onSubmit = (values: ManualIncomeData) => {
    startTransition(async () => {
      try {
        const { data: userAuth } = await supabase.auth.getUser()
        const { data: inserted, error } = await supabase
          .from('payments')
          .insert({
            ...values,
            recorded_by: userAuth?.user?.id || null,
          } as never)
          .select('*')
          .single()

        if (error) throw error

        const newRow = inserted as any;
        setData((prev) => [{
          id: newRow.id,
          payment_date: newRow.payment_date,
          student_name: 'Manual Income',
          course_name: '—',
          amount: newRow.amount,
          payment_mode: newRow.payment_mode,
          receipt_number: newRow.receipt_number,
          notes: newRow.notes,
          recorded_by_name: 'You',
        }, ...prev])

        toast.success('Income recorded')
        setShowForm(false)
        reset()
      } catch (e) {
        toast.error('Failed to record manual income')
      }
    })
  }

  const total = data.reduce((s, r) => s + r.amount, 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {data.length} entries · Total: <span className="font-semibold text-foreground">{fmt(total)}</span>
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
            <Download className="mr-2 h-4 w-4" />
            {exporting ? 'Exporting…' : 'Export Excel'}
          </Button>
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus className="mr-2 h-4 w-4" /> Add Income
          </Button>
        </div>
      </div>

      <DataTable data={data} columns={columns} />

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Manual Income</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Amount (₹)</Label>
                <Input type="number" min="0" step="0.01" {...register('amount', { valueAsNumber: true })} />
                {errors.amount && <p className="text-xs text-red-500">{errors.amount.message}</p>}
              </div>
              <div className="space-y-1">
                <Label>Date</Label>
                <Input type="date" {...register('payment_date')} />
                {errors.payment_date && <p className="text-xs text-red-500">{errors.payment_date.message}</p>}
              </div>
              <div className="space-y-1">
                <Label>Payment Mode</Label>
                <Select onValueChange={(v) => setValue('payment_mode', v as any)} defaultValue="cash">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['cash', 'upi', 'card', 'neft', 'rtgs', 'cheque', 'other'].map(m => (
                      <SelectItem key={m} value={m} className="capitalize">{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Receipt / Ref #</Label>
                <Input {...register('receipt_number')} placeholder="Optional" />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Description / Notes</Label>
              <Textarea {...register('notes')} placeholder="General income details" rows={2} />
              {errors.notes && <p className="text-xs text-red-500">{errors.notes.message}</p>}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit" disabled={isPending}>{isPending ? 'Saving…' : 'Save Income'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
