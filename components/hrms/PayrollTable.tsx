'use client'

import { useState, useTransition } from 'react'
import { format } from 'date-fns'
import { Download } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'

interface PayrollRow {
  id: string
  employee_id: string
  employee_name: string
  employee_code?: string
  designation?: string
  department?: string
  bank_account?: string
  month: number
  year: number
  basic: number
  hra: number
  allowances: number
  incentive: number
  gross: number
  pf: number
  tds: number
  other_deductions: number
  leave_deduction: number
  net: number
  status: 'draft' | 'processed' | 'paid'
  payment_date: string | null
}

interface PayrollTableProps {
  data: PayrollRow[]
  isAdmin: boolean
  employeeId?: string
  employeeName?: string
  totalIncentives?: number
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)

export default function PayrollTable({ data: initialData, isAdmin, employeeId, employeeName, totalIncentives }: PayrollTableProps) {
  const [data, setData] = useState(initialData)
  const [confirmBulk, setConfirmBulk] = useState<'process' | 'paid' | null>(null)
  const [showGenerate, setShowGenerate] = useState(false)
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [year, setYear] = useState(new Date().getFullYear())

  const [isPending, startTransition] = useTransition()
  const supabase = createClient()

  const updateIncentive = (id: string, value: number) => {
    setData((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r
        const gross = r.basic + r.hra + r.allowances + value
        const net = gross - r.pf - r.tds - r.other_deductions
        return { ...r, incentive: value, gross, net }
      })
    )
  }

  const saveIncentive = (row: PayrollRow) => {
    startTransition(async () => {
      try {
        const { error } = await supabase
          .from('payroll')
          .update({ incentive: row.incentive, gross: row.gross, net: row.net } as never)
          .eq('id', row.id)
        if (error) throw error
        toast.success('Incentive saved')
      } catch {
        toast.error('Failed to save incentive')
      }
    })
  }

  const bulkUpdateStatus = (newStatus: 'processed' | 'paid') => {
    startTransition(async () => {
      try {
        const ids = data
          .filter((r) => newStatus === 'processed' ? r.status === 'draft' : r.status === 'processed')
          .map((r) => r.id)
        const update: Record<string, unknown> = { status: newStatus }
        if (newStatus === 'paid') update.payment_date = new Date().toISOString()
        const { error } = await supabase.from('payroll').update(update as never).in('id', ids)
        if (error) throw error
        setData((prev) =>
          prev.map((r) => {
            if (!ids.includes(r.id)) return r
            return { ...r, status: newStatus, payment_date: newStatus === 'paid' ? new Date().toISOString() : r.payment_date }
          })
        )
        toast.success(`Payroll ${newStatus}`)
      } catch {
        toast.error('Failed to update payroll')
      } finally {
        setConfirmBulk(null)
      }
    })
  }

  const downloadSlip = async (row: PayrollRow) => {
    try {
      const { pdf } = await import('@react-pdf/renderer')
      const { SalarySlipPDF } = await import('./SalarySlipPDF')
      const logoBase64 = await fetch('/brand-logo.png')
        .then(r => r.blob())
        .then(blob => new Promise<string>((resolve) => {
          const reader = new FileReader()
          reader.onloadend = () => resolve(reader.result as string)
          reader.readAsDataURL(blob)
        }))
        .catch(() => '')
      const monthName = format(new Date(row.year, row.month - 1), 'MMMM yyyy')
      const blob = await pdf(
        <SalarySlipPDF
          employeeName={row.employee_name}
          employeeCode={row.employee_code}
          designation={row.designation}
          department={row.department}
          bankAccount={row.bank_account}
          month={row.month}
          year={row.year}
          basic={row.basic}
          hra={row.hra}
          allowances={row.allowances}
          incentive={row.incentive}
          gross={row.gross}
          pf={row.pf}
          tds={row.tds}
          leaveDeduction={row.leave_deduction}
          otherDeductions={row.other_deductions}
          net={row.net}
          paymentDate={row.payment_date}
          logoBase64={logoBase64}
        />
      ).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Salary_Slip_${row.employee_name.replace(/\s+/g, '_')}_${monthName.replace(' ', '_')}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Failed to generate PDF')
    }
  }

  const handleGenerate = () => {
    startTransition(async () => {
      try {
        const res = await fetch('/api/hrms/payroll/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ employee_id: employeeId, month, year, incentive: totalIncentives }),
        })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || 'Failed to generate payroll')
        }
        const { payroll } = await res.json()
        setData((prev) => [{ ...payroll, employee_name: employeeName }, ...prev])
        toast.success(`Payroll generated for ${format(new Date(year, month - 1), 'MMM yyyy')}`)
        setShowGenerate(false)
      } catch (err: any) {
        toast.error(err.message || 'Failed to generate payroll')
      }
    })
  }

  const hasDraft = data.some((r) => r.status === 'draft')
  const hasProcessed = data.some((r) => r.status === 'processed')

  return (
    <div className="space-y-4">
      {isAdmin && (
        <div className="flex gap-2 justify-end">
          {employeeId && (
            <Button variant="outline" size="sm" onClick={() => setShowGenerate(true)}>
              + Generate Month
            </Button>
          )}
          {hasDraft && (
            <Button variant="outline" size="sm" onClick={() => setConfirmBulk('process')}>
              Process All
            </Button>
          )}
          {hasProcessed && (
            <Button size="sm" onClick={() => setConfirmBulk('paid')}>
              Mark All Paid
            </Button>
          )}
        </div>
      )}

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-xs">
              <th className="px-3 py-2 text-left">Employee</th>
              <th className="px-3 py-2 text-right">Basic</th>
              <th className="px-3 py-2 text-right">HRA</th>
              <th className="px-3 py-2 text-right">Allow.</th>
              <th className="px-3 py-2 text-right">Incentive</th>
              <th className="px-3 py-2 text-right font-semibold">Gross</th>
              <th className="px-3 py-2 text-right">PF</th>
              <th className="px-3 py-2 text-right">TDS</th>
              <th className="px-3 py-2 text-right">Leave Ded.</th>
              <th className="px-3 py-2 text-right font-semibold">Net</th>
              <th className="px-3 py-2 text-center">Status</th>
              <th className="px-3 py-2 text-center">Slip</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.id} className="border-b hover:bg-muted/30">
                <td className="px-3 py-2 font-medium">{row.employee_name}</td>
                <td className="px-3 py-2 text-right text-xs">{fmt(row.basic)}</td>
                <td className="px-3 py-2 text-right text-xs">{fmt(row.hra)}</td>
                <td className="px-3 py-2 text-right text-xs">{fmt(row.allowances)}</td>
                <td className="px-3 py-2 text-right">
                  {isAdmin && row.status === 'draft' ? (
                    <Input
                      type="number"
                      min="0"
                      className="h-7 w-24 text-right text-xs"
                      value={row.incentive}
                      onChange={(e) => updateIncentive(row.id, Number(e.target.value))}
                      onBlur={() => saveIncentive(row)}
                    />
                  ) : (
                    <span className="text-xs">{fmt(row.incentive)}</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right font-semibold text-xs">{fmt(row.gross)}</td>
                <td className="px-3 py-2 text-right text-xs text-red-600">-{fmt(row.pf)}</td>
                <td className="px-3 py-2 text-right text-xs text-red-600">-{fmt(row.tds)}</td>
                <td className="px-3 py-2 text-right text-xs text-red-600">-{fmt(row.leave_deduction)}</td>
                <td className="px-3 py-2 text-right font-bold text-green-700">{fmt(row.net)}</td>
                <td className="px-3 py-2 text-center">
                  <Badge
                    variant={row.status === 'paid' ? 'default' : row.status === 'processed' ? 'secondary' : 'outline'}
                    className="capitalize text-xs"
                  >
                    {row.status}
                  </Badge>
                </td>
                <td className="px-3 py-2 text-center">
                  <Button size="sm" variant="ghost" onClick={() => downloadSlip(row)}>
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {confirmBulk && (
        <ConfirmDialog
          open
          title={confirmBulk === 'process' ? 'Process Payroll' : 'Mark as Paid'}
          description={
            confirmBulk === 'process'
              ? 'Move all draft payroll entries to processed?'
              : 'Mark all processed payroll entries as paid? This will execute any automated logic and distribute incentives to ledgers.'
          }
          confirmLabel={confirmBulk === 'process' ? 'Process' : 'Mark Paid'}
          onConfirm={() => bulkUpdateStatus(confirmBulk === 'process' ? 'processed' : 'paid')}
          onCancel={() => setConfirmBulk(null)}
        />
      )}

      {showGenerate && (
        <ConfirmDialog
          open
          title="Generate Monthly Payroll"
          description={`Generate draft salary slip for ${employeeName}? Any verified incentives (₹${totalIncentives}) linked to this profile will be injected into this payroll cycle.`}
          confirmLabel="Generate"
          onConfirm={handleGenerate}
          onCancel={() => setShowGenerate(false)}
        />
      )}
    </div>
  )
}
