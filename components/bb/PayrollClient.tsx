'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { PDFDownloadLink } from '@react-pdf/renderer'
import {
  Banknote, ChevronLeft, ChevronRight, RefreshCw, Download, Loader2, CheckCircle2,
} from 'lucide-react'
import { bbClient } from '@/lib/bb/db'
import { inr, inrShort } from '@/lib/bb/constants'
import { SalarySlipPDF, type SlipData } from './SalarySlipPDF'

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface PayrollStaff {
  employee_id: string
  name: string
  employee_code: string
  designation: string | null
  joining_date: string | null
  bank_account: string | null
  bank_name: string | null
  monthly: number
  payroll: {
    id: string
    basic: number
    hra: number
    allowances: number
    present_days: number
    absent_days: number
    half_days: number
    leave_days: number
    lop_days: number
    leave_deduction: number
    placement_count: number
    placement_incentive: number
    gross: number
    pf: number
    tds: number
    other_deductions: number
    net: number
    status: string
    payment_date: string | null
  } | null
}

export default function PayrollClient({
  staff, month, year, canEdit,
}: { staff: PayrollStaff[]; month: number; year: number; canEdit: boolean }) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [busy, setBusy] = useState<string | null>(null)
  const [logo, setLogo] = useState('')

  function move(delta: number) {
    const d = new Date(year, month - 1 + delta, 1)
    startTransition(() => router.push(`/bb/payroll?month=${d.getMonth() + 1}&year=${d.getFullYear()}`))
  }

  async function ensureLogo(): Promise<string> {
    if (logo) return logo
    try {
      const blob = await fetch('/bb-mark.png').then(r => r.blob())
      const uri = await new Promise<string>(res => {
        const fr = new FileReader()
        fr.onloadend = () => res(fr.result as string)
        fr.readAsDataURL(blob)
      })
      setLogo(uri)
      return uri
    } catch {
      return ''
    }
  }

  async function generate(s: PayrollStaff) {
    setBusy(s.employee_id)
    try {
      const res = await fetch('/api/bb/payroll/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ employee_id: s.employee_id, month, year }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not generate')
      toast.success(`${s.name}: net ${inr(json.net)}`)
      await ensureLogo()
      startTransition(() => router.refresh())
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not generate')
    } finally {
      setBusy(null)
    }
  }

  async function generateAll() {
    setBusy('all')
    let ok = 0
    for (const s of staff) {
      if (s.payroll?.status === 'paid') continue
      try {
        const res = await fetch('/api/bb/payroll/generate', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ employee_id: s.employee_id, month, year }),
        })
        if (res.ok) ok++
      } catch { /* keep going — one failure should not stop the run */ }
    }
    setBusy(null)
    toast.success(`Generated ${ok} of ${staff.length}`)
    await ensureLogo()
    startTransition(() => router.refresh())
  }

  async function markPaid(s: PayrollStaff) {
    if (!s.payroll) return
    setBusy(s.employee_id)
    try {
      const db = bbClient()
      const { error } = await db.from('bb_payroll')
        .update({ status: 'paid', payment_date: new Date().toISOString().slice(0, 10) })
        .eq('id', s.payroll.id)
      if (error) throw new Error(error.message)
      toast.success(`${s.name} marked paid`)
      startTransition(() => router.refresh())
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not update')
    } finally {
      setBusy(null)
    }
  }

  function slipData(s: PayrollStaff): SlipData | null {
    if (!s.payroll) return null
    const p = s.payroll
    return {
      employeeName: s.name,
      employeeCode: s.employee_code,
      designation: s.designation,
      joiningDate: s.joining_date,
      bankAccount: s.bank_account,
      bankName: s.bank_name,
      month, year,
      basic: p.basic, hra: p.hra, allowances: p.allowances,
      placementCount: p.placement_count,
      placementIncentive: p.placement_incentive,
      presentDays: p.present_days, absentDays: p.absent_days,
      halfDays: p.half_days, leaveDays: p.leave_days, lopDays: p.lop_days,
      leaveDeduction: p.leave_deduction,
      pf: p.pf, tds: p.tds, otherDeductions: p.other_deductions,
      gross: p.gross, net: p.net,
    }
  }

  const totalNet = staff.reduce((t, s) => t + Number(s.payroll?.net ?? 0), 0)
  const totalIncentive = staff.reduce((t, s) => t + Number(s.payroll?.placement_incentive ?? 0), 0)
  const generated = staff.filter(s => s.payroll).length

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button onClick={() => move(-1)} className="p-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="font-bold text-gray-900 w-40 text-center">
            {format(new Date(year, month - 1), 'MMMM yyyy')}
          </span>
          <button onClick={() => move(1)} className="p-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        {canEdit && staff.length > 0 && (
          <button
            onClick={generateAll}
            disabled={busy === 'all'}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${busy === 'all' ? 'animate-spin' : ''}`} />
            {busy === 'all' ? 'Generating…' : 'Generate all'}
          </button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: 'Total net payable', value: inrShort(totalNet) },
          { label: 'Placement incentive', value: inrShort(totalIncentive) },
          { label: 'Slips generated', value: `${generated}/${staff.length}` },
        ].map(m => (
          <div key={m.label} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{m.label}</p>
            <p className="text-3xl font-bold text-gray-900 mt-1.5 tabular-nums">{m.value}</p>
          </div>
        ))}
      </div>

      {staff.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center">
          <Banknote className="w-7 h-7 mx-auto text-gray-300" />
          <p className="mt-3 font-semibold text-gray-700">No staff</p>
          <p className="text-sm text-gray-500 mt-1">Add people under Team first.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Staff</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Gross</th>
                  <th className="px-4 py-2.5 font-semibold text-right">LOP</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Incentive</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Net</th>
                  <th className="px-4 py-2.5 font-semibold">Status</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {staff.map(s => {
                  const p = s.payroll
                  const slip = slipData(s)
                  return (
                    <tr key={s.employee_id} className={`hover:bg-gray-50 ${busy === s.employee_id ? 'opacity-50' : ''}`}>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-gray-900">{s.name}</p>
                        <p className="text-xs text-gray-400">{s.employee_code} · {s.designation || '—'}</p>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                        {p ? inr(p.gross) : <span className="text-gray-300">{inr(s.monthly)}</span>}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {p ? (
                          p.lop_days > 0
                            ? <span className="text-red-600">{p.lop_days}d · −{inr(p.leave_deduction)}</span>
                            : <span className="text-gray-400">—</span>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {p && p.placement_incentive > 0 ? (
                          <span className="text-emerald-700 font-semibold">
                            +{inr(p.placement_incentive)}
                            <span className="text-gray-400 font-normal"> ({p.placement_count})</span>
                          </span>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-bold text-gray-900">
                        {p ? inr(p.net) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {!p ? (
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                            not generated
                          </span>
                        ) : (
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                            p.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                          }`}>
                            {p.status}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          {canEdit && p?.status !== 'paid' && (
                            <button
                              onClick={() => generate(s)}
                              className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs font-semibold text-gray-600 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300"
                            >
                              {p ? 'Recalculate' : 'Generate'}
                            </button>
                          )}
                          {slip && (
                            <PDFDownloadLink
                              document={<SalarySlipPDF data={slip} logoBase64={logo} />}
                              fileName={`Salary_${s.name.replace(/\s+/g, '_')}_${month}-${year}.pdf`}
                            >
                              {({ loading }) => (
                                <span className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50">
                                  {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                                  Slip
                                </span>
                              )}
                            </PDFDownloadLink>
                          )}
                          {canEdit && p && p.status !== 'paid' && (
                            <button
                              onClick={() => markPaid(s)}
                              title="Mark paid"
                              className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:text-green-700 hover:border-green-300"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
