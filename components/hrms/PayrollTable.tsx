'use client'

import { useState, useTransition } from 'react'
import { format } from 'date-fns'
import { Download, Mail, Trash2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { pdf } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/client'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { SalarySlipPDF } from './SalarySlipPDF'

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
  advance_deduction?: number
  net: number
  status: 'draft' | 'processed' | 'paid'
  payment_date: string | null
  attendance?: { present: number; late: number; absent: number; half_day: number; leave: number; holiday: number }
}

interface PayrollTableProps {
  data: PayrollRow[]
  isAdmin: boolean
  employeeId?: string
  employeeName?: string
  employeeCode?: string
  designation?: string
  department?: string
  totalIncentives?: number
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)

export default function PayrollTable({ 
  data: initialData, 
  isAdmin, 
  employeeId, 
  employeeName, 
  employeeCode,
  designation,
  department,
  totalIncentives 
}: PayrollTableProps) {
  const [data, setData] = useState(initialData)
  const [confirmBulk, setConfirmBulk] = useState<'process' | 'paid' | null>(null)
  const [showGenerate, setShowGenerate] = useState(false)
  const [deleteRow, setDeleteRow] = useState<PayrollRow | null>(null)
  const [sendingId, setSendingId] = useState<string | null>(null)
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [year, setYear] = useState(new Date().getFullYear())

  const [isPending, startTransition] = useTransition()
  const supabase = createClient()

  const updatePayrollField = (id: string, field: 'hra' | 'allowances' | 'incentive', value: number) => {
    setData((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r
        const updatedRow = { ...r, [field]: value }
        const gross = updatedRow.basic + updatedRow.hra + updatedRow.allowances + updatedRow.incentive
        const net = gross - updatedRow.pf - updatedRow.tds - updatedRow.other_deductions - updatedRow.leave_deduction - (updatedRow.advance_deduction ?? 0)
        return { ...updatedRow, gross, net }
      })
    )
  }

  const savePayrollRow = (row: PayrollRow) => {
    startTransition(async () => {
      try {
        const { error } = await supabase
          .from('payroll')
          .update({ 
            hra: row.hra, 
            allowances: row.allowances, 
            incentive: row.incentive, 
            gross: row.gross, 
            net: row.net 
          } as never)
          .eq('id', row.id)
        if (error) throw error
        toast.success('Payroll updated')
      } catch {
        toast.error('Failed to update payroll')
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

  const buildSlipBlob = async (row: PayrollRow) => {
    const logoBase64 = await fetch('/brand-logo.png')
      .then(r => r.blob())
      .then(blob => new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result as string)
        reader.readAsDataURL(blob)
      }))
      .catch(() => '')
    return pdf(
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
        otherDeductions={row.other_deductions + (row.advance_deduction ?? 0)}
        net={row.net}
        paymentDate={row.payment_date}
        logoBase64={logoBase64}
      />
    ).toBlob()
  }

  const slipFileName = (row: PayrollRow) => {
    const monthName = format(new Date(row.year, row.month - 1), 'MMMM_yyyy')
    return `Salary_Slip_${row.employee_name.replace(/\s+/g, '_')}_${monthName}.pdf`
  }

  const downloadSlip = async (row: PayrollRow) => {
    try {
      const blob = await buildSlipBlob(row)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = slipFileName(row)
      a.click()
      URL.revokeObjectURL(url)
    } catch (e: any) {
      console.error('Salary slip PDF error:', e)
      toast.error('PDF failed: ' + (e?.message ?? String(e)))
    }
  }

  const emailSlip = async (row: PayrollRow) => {
    setSendingId(row.id)
    try {
      const blob = await buildSlipBlob(row)
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve((reader.result as string).split(',')[1] ?? '')
        reader.onerror = reject
        reader.readAsDataURL(blob)
      })
      const res = await fetch('/api/hrms/payroll/send-slip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payroll_id: row.id, pdf_base64: base64, file_name: slipFileName(row) }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to send')
      toast.success(`Slip emailed to ${json.sent_to}`)
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to send slip')
    } finally {
      setSendingId(null)
    }
  }

  const handleDelete = (row: PayrollRow) => {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/hrms/payroll/${row.id}`, { method: 'DELETE' })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Failed to delete')
        setData(prev => prev.filter(r => r.id !== row.id))
        toast.success('Payroll deleted')
      } catch (e: any) {
        toast.error(e?.message ?? 'Failed to delete payroll')
      } finally {
        setDeleteRow(null)
      }
    })
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
        const { payroll, attendance } = await res.json()
        setData((prev) => [{
          ...payroll,
          employee_name: employeeName,
          employee_code: employeeCode,
          designation: designation,
          department: department,
          attendance,
        }, ...prev])
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
              <th className="px-3 py-2 text-left">Month</th>
              <th className="px-3 py-2 text-right">Basic</th>
              <th className="px-3 py-2 text-right">HRA</th>
              <th className="px-3 py-2 text-right">Allow.</th>
              <th className="px-3 py-2 text-right">Incentive</th>
              <th className="px-3 py-2 text-right font-semibold">Gross</th>
              <th className="px-3 py-2 text-center">Attendance</th>
              <th className="px-3 py-2 text-right">PF</th>
              <th className="px-3 py-2 text-right">TDS</th>
              <th className="px-3 py-2 text-right">LOP Ded.</th>
              <th className="px-3 py-2 text-right" title="Advance salary recovered">Adv.</th>
              <th className="px-3 py-2 text-right font-semibold">Net</th>
              <th className="px-3 py-2 text-center">Status</th>
              <th className="px-3 py-2 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.id} className="border-b hover:bg-muted/30">
                <td className="px-3 py-2 font-medium">{row.employee_name}</td>
                <td className="px-3 py-2 text-xs font-semibold text-blue-700 whitespace-nowrap">
                  {format(new Date(row.year, row.month - 1), 'MMM yyyy')}
                </td>
                <td className="px-3 py-2 text-right text-xs">{fmt(row.basic)}</td>
                <td className="px-3 py-2 text-right">
                  {isAdmin && row.status === 'draft' ? (
                    <Input
                      type="number"
                      min="0"
                      className="h-7 w-20 text-right text-xs"
                      value={row.hra}
                      onChange={(e) => updatePayrollField(row.id, 'hra', Number(e.target.value))}
                      onBlur={() => savePayrollRow(row)}
                    />
                  ) : (
                    <span className="text-xs">{fmt(row.hra)}</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  {isAdmin && row.status === 'draft' ? (
                    <Input
                      type="number"
                      min="0"
                      className="h-7 w-20 text-right text-xs"
                      value={row.allowances}
                      onChange={(e) => updatePayrollField(row.id, 'allowances', Number(e.target.value))}
                      onBlur={() => savePayrollRow(row)}
                    />
                  ) : (
                    <span className="text-xs">{fmt(row.allowances)}</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  {isAdmin && row.status === 'draft' ? (
                    <Input
                      type="number"
                      min="0"
                      className="h-7 w-20 text-right text-xs"
                      value={row.incentive}
                      onChange={(e) => updatePayrollField(row.id, 'incentive', Number(e.target.value))}
                      onBlur={() => savePayrollRow(row)}
                    />
                  ) : (
                    <span className="text-xs">{fmt(row.incentive)}</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right font-semibold text-xs">{fmt(row.gross)}</td>
                <td className="px-3 py-2">
                  {row.attendance ? (
                    <div className="flex flex-wrap justify-center gap-1">
                      <span className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold text-green-800" title="Present (incl. late)">P {row.attendance.present + row.attendance.late}</span>
                      <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-800" title="Absent">A {row.attendance.absent}</span>
                      <span className="rounded bg-yellow-100 px-1.5 py-0.5 text-[10px] font-semibold text-yellow-800" title="Half day">H {row.attendance.half_day}</span>
                      <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-800" title="Leave (deducted)">LV {row.attendance.leave}</span>
                    </div>
                  ) : (
                    <span className="block text-center text-xs text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right text-xs text-red-600">-{fmt(row.pf)}</td>
                <td className="px-3 py-2 text-right text-xs text-red-600">-{fmt(row.tds)}</td>
                <td className="px-3 py-2 text-right text-xs text-red-600">-{fmt(row.leave_deduction)}</td>
                <td className="px-3 py-2 text-right text-xs text-red-600">-{fmt(row.advance_deduction ?? 0)}</td>
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
                  <div className="flex items-center justify-center gap-0.5">
                    <Button size="sm" variant="ghost" title="Download slip" onClick={() => downloadSlip(row)}>
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                    {isAdmin && (
                      <Button
                        size="sm" variant="ghost" title="Email slip to employee"
                        className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        disabled={sendingId === row.id}
                        onClick={() => emailSlip(row)}
                      >
                        {sendingId === row.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
                      </Button>
                    )}
                    {isAdmin && row.status !== 'paid' && (
                      <Button
                        size="sm" variant="ghost" title="Delete payroll"
                        className="text-red-500 hover:text-red-600 hover:bg-red-50"
                        onClick={() => setDeleteRow(row)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
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

      {deleteRow && (
        <ConfirmDialog
          open
          title="Delete Payroll"
          description={`Delete ${format(new Date(deleteRow.year, deleteRow.month - 1), 'MMM yyyy')} payroll for ${deleteRow.employee_name}? Isse jude advance wapas pending ho jayenge.`}
          confirmLabel="Delete"
          onConfirm={() => handleDelete(deleteRow)}
          onCancel={() => setDeleteRow(null)}
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
