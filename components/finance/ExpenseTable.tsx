'use client'

import { useMemo, useState, useTransition } from 'react'
import { format } from 'date-fns'
import { Plus, CheckCircle, XCircle, Trash2, Download } from 'lucide-react'
import * as XLSX from 'xlsx'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { DataTable } from '@/components/shared/DataTable'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { FileUpload } from '@/components/shared/FileUpload'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { DateRangeFilter, NO_DATE_RANGE, inDateRange, rangeBounds, type DateRangeValue } from '@/components/shared/DateRangeFilter'
import { expenseSchema, type ExpenseFormData } from '@/lib/validations/expense.schema'
import type { ColumnDef } from '@tanstack/react-table'
import { EXPENSE_CATEGORY_LABELS, type ExpenseCategory } from '@/types/app.types'

interface ExpenseRow {
  id: string
  expense_date: string
  category: ExpenseCategory
  description: string
  amount: number
  payment_mode: string | null
  bill_url: string | null
  submitted_by_name: string
  status: 'pending' | 'approved' | 'rejected'
}

interface ExpenseTableProps {
  data: ExpenseRow[]
  currentUserId: string
  currentUserRole: string
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)

const CATEGORIES: ExpenseCategory[] = ['rent', 'utilities', 'marketing', 'travel', 'salary', 'board', 'university', 'event', 'misc', 'other']
// Rows saved before migration 125 can still say 'vendor'.
const categoryLabel = (c: string) => EXPENSE_CATEGORY_LABELS[c as ExpenseCategory] ?? (c === 'vendor' ? 'Vendor' : c)

export default function ExpenseTable({ data: initialData, currentUserId, currentUserRole }: ExpenseTableProps) {
  const [data, setData] = useState(initialData)
  const [showForm, setShowForm] = useState(false)
  const [billUrl, setBillUrl] = useState('')
  const [confirmAction, setConfirmAction] = useState<{ id: string; action: 'approved' | 'rejected' | 'delete' } | null>(null)
  const [isPending, startTransition] = useTransition()
  const [range, setRange] = useState<DateRangeValue>(NO_DATE_RANGE)
  const [categoryFilter, setCategoryFilter] = useState<string>('')

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseSchema),
    defaultValues: { category: 'misc', amount: 0 },
  })

  const supabase = createClient()
  const canApprove = currentUserRole === 'admin' || currentUserRole === 'backend'

  const onSubmit = (values: ExpenseFormData) => {
    startTransition(async () => {
      try {
        const { data: inserted, error } = await supabase
          .from('expenses')
          .insert({
            ...values,
            bill_url: billUrl || null,
            submitted_by: currentUserId,
            status: 'pending',
          } as never)
          .select('*')
          .single()
        if (error) throw error
        setData((prev) => [{ ...(inserted as object), submitted_by_name: 'You' } as ExpenseRow, ...prev])
        toast.success('Expense submitted')
        setShowForm(false)
        reset()
        setBillUrl('')
      } catch (e) {
        // 23514: the database doesn't know this category yet (migration 125 not run)
        toast.error((e as { code?: string })?.code === '23514'
          ? 'This category needs migration 125_expense_categories.sql — run it in Supabase'
          : 'Failed to submit expense')
      }
    })
  }

  const handleDelete = (id: string) => {
    startTransition(async () => {
      try {
        const { error } = await supabase.from('expenses').delete().eq('id', id)
        if (error) throw error
        setData((prev) => prev.filter((e) => e.id !== id))
        toast.success('Expense deleted')
      } catch {
        toast.error('Failed to delete expense')
      } finally {
        setConfirmAction(null)
      }
    })
  }

  const handleStatusChange = (id: string, status: 'approved' | 'rejected') => {
    startTransition(async () => {
      try {
        const { error } = await supabase
          .from('expenses')
          .update({ status, approved_by: currentUserId } as never)
          .eq('id', id)
        if (error) throw error
        setData((prev) => prev.map((e) => (e.id === id ? { ...e, status } : e)))
        toast.success(`Expense ${status}`)
      } catch {
        toast.error('Failed to update expense')
      } finally {
        setConfirmAction(null)
      }
    })
  }

  const columns: ColumnDef<ExpenseRow>[] = [
    {
      accessorKey: 'expense_date',
      header: 'Date',
      cell: ({ getValue }) => format(new Date(getValue() as string), 'dd MMM yyyy'),
    },
    {
      accessorKey: 'category',
      header: 'Category',
      cell: ({ getValue }) => (
        <Badge variant="outline">{categoryLabel(getValue() as string)}</Badge>
      ),
    },
    { accessorKey: 'description', header: 'Description' },
    {
      accessorKey: 'amount',
      header: 'Amount',
      cell: ({ getValue }) => fmt(getValue() as number),
    },
    { accessorKey: 'submitted_by_name', header: 'Submitted By' },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ getValue }) => {
        const s = getValue() as string
        return (
          <Badge variant={s === 'approved' ? 'default' : s === 'rejected' ? 'destructive' : 'secondary'} className="capitalize">
            {s}
          </Badge>
        )
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        if (!canApprove) return null
        return (
          <div className="flex gap-1">
            {row.original.status === 'pending' && (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-green-600 hover:text-green-700"
                  onClick={() => setConfirmAction({ id: row.original.id, action: 'approved' })}
                >
                  <CheckCircle className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-red-600 hover:text-red-700"
                  onClick={() => setConfirmAction({ id: row.original.id, action: 'rejected' })}
                >
                  <XCircle className="h-4 w-4" />
                </Button>
              </>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="text-gray-400 hover:text-red-600"
              onClick={() => setConfirmAction({ id: row.original.id, action: 'delete' })}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )
      },
    },
  ]

  const now = new Date()
  const thisMonthExpenses = data.filter((e) => {
    const d = new Date(e.expense_date)
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && e.status !== 'rejected'
  })
  const thisMonthTotal = thisMonthExpenses.reduce((s, e) => s + e.amount, 0)
  const pendingCount = data.filter((e) => e.status === 'pending').length

  const filtered = useMemo(() => data.filter((e) =>
    inDateRange(e.expense_date, range) && (!categoryFilter || e.category === categoryFilter)
  ), [data, range, categoryFilter])
  const filteredTotal = filtered.filter((e) => e.status !== 'rejected').reduce((s, e) => s + Number(e.amount || 0), 0)
  const filtering = Boolean(range.preset || categoryFilter)

  function exportExcel() {
    if (filtered.length === 0) { toast.error('No expenses to export'); return }
    const rows = filtered.map((e) => ({
      Date: format(new Date(e.expense_date), 'dd-MM-yyyy'),
      Category: categoryLabel(e.category),
      Description: e.description,
      'Amount (₹)': Number(e.amount || 0),
      'Payment Mode': e.payment_mode ?? '',
      Status: e.status.charAt(0).toUpperCase() + e.status.slice(1),
      'Bill / Receipt': e.bill_url ?? '',
    }))
    rows.push({ Date: '', Category: '', Description: 'Total (excluding rejected)', 'Amount (₹)': filteredTotal, 'Payment Mode': '', Status: '', 'Bill / Receipt': '' })
    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [{ wch: 12 }, { wch: 14 }, { wch: 50 }, { wch: 12 }, { wch: 14 }, { wch: 10 }, { wch: 40 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Expenses')
    const { from, to } = rangeBounds(range)
    const span = from || to ? `_${from ?? 'start'}_to_${to ?? 'today'}` : ''
    const cat = categoryFilter ? `_${categoryLabel(categoryFilter).replace(/\W+/g, '-')}` : ''
    XLSX.writeFile(wb, `Expenses${cat}${span}.xlsx`)
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg bg-red-50 border border-red-100 p-3">
          <p className="text-xs text-red-700 font-medium">This Month's Expenses</p>
          <p className="text-xl font-bold text-red-900">{fmt(thisMonthTotal)}</p>
        </div>
        <div className="rounded-lg bg-yellow-50 border border-yellow-100 p-3">
          <p className="text-xs text-yellow-700 font-medium">Pending Approval</p>
          <p className="text-xl font-bold text-yellow-900">{pendingCount}</p>
        </div>
        <div className="rounded-lg bg-gray-50 border border-gray-200 p-3">
          <p className="text-xs text-gray-600 font-medium">Total Records</p>
          <p className="text-xl font-bold text-gray-900">{data.length}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <DateRangeFilter label="Date" value={range} onChange={setRange} />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className={`h-9 rounded-lg border px-2 text-sm bg-white min-w-40 ${categoryFilter ? 'border-blue-300 bg-blue-50 text-blue-700' : 'text-gray-600'}`}
        >
          <option value="">Category: All</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{categoryLabel(c)}</option>)}
        </select>
        {filtering && (
          <>
            <span className="text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-2.5 py-1.5">
              {filtered.length} record{filtered.length === 1 ? '' : 's'} · {fmt(filteredTotal)}
            </span>
            <button onClick={() => { setRange(NO_DATE_RANGE); setCategoryFilter('') }} className="text-xs text-red-500 hover:underline">
              Clear
            </button>
          </>
        )}
        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={exportExcel}>
            <Download className="mr-2 h-4 w-4" /> Download Excel
          </Button>
          <Button onClick={() => setShowForm(true)}>
            <Plus className="mr-2 h-4 w-4" /> Add Expense
          </Button>
        </div>
      </div>

      <DataTable data={filtered} columns={columns} />

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Expense</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Category</Label>
                <Select onValueChange={(v) => setValue('category', v as ExpenseCategory)} value={watch('category')}>
                  <SelectTrigger><span className="text-sm">{categoryLabel(watch('category'))}</span></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>{categoryLabel(c)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Date</Label>
                <Input type="date" {...register('expense_date')} />
                {errors.expense_date && <p className="text-xs text-red-500">{errors.expense_date.message}</p>}
              </div>
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Input {...register('description')} placeholder="Brief description" />
              {errors.description && <p className="text-xs text-red-500">{errors.description.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Amount (₹)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  {...register('amount', { valueAsNumber: true })}
                />
                {errors.amount && <p className="text-xs text-red-500">{errors.amount.message}</p>}
              </div>
              <div className="space-y-1">
                <Label>Payment Mode</Label>
                <Input {...register('payment_mode')} placeholder="UPI / Cash / etc." />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Textarea {...register('notes')} rows={2} />
            </div>
            <div className="space-y-1">
              <Label>Bill / Receipt</Label>
              <FileUpload
                bucket="expense-bills"
                onUploadComplete={(url) => setBillUrl(url)}
                accept=".pdf,.jpg,.jpeg,.png"
                maxSizeMB={5}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit" disabled={isPending}>{isPending ? 'Submitting…' : 'Submit'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {confirmAction && (
        <ConfirmDialog
          open
          title={confirmAction.action === 'delete' ? 'Delete Expense' : `${confirmAction.action === 'approved' ? 'Approve' : 'Reject'} Expense`}
          description={confirmAction.action === 'delete' ? 'Are you sure you want to delete this expense? This cannot be undone.' : `Are you sure you want to ${confirmAction.action === 'approved' ? 'approve' : 'reject'} this expense?`}
          confirmLabel={confirmAction.action === 'delete' ? 'Delete' : confirmAction.action === 'approved' ? 'Approve' : 'Reject'}
          destructive={confirmAction.action !== 'approved'}
          onConfirm={() => confirmAction.action === 'delete' ? handleDelete(confirmAction.id) : handleStatusChange(confirmAction.id, confirmAction.action as 'approved' | 'rejected')}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </div>
  )
}
