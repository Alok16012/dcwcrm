'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'
import { Button } from '@/components/ui/button'
import { Download, Printer, BarChart3 } from 'lucide-react'

// Attendance / leave / payroll reports, exportable to Excel (requirement doc §26).

export interface ReportRow {
  employee_id: string; name: string; employee_code: string; department: string; designation: string
  present: number; late: number; half_day: number; absent: number
  cl: number; sl: number; lwp: number; weekly_off: number; holiday: number; missing: number
  work_minutes: number; late_minutes: number; early_minutes: number
  cl_balance: number; sl_balance: number
  salary: number; gross: number; lop_deduction: number; late_deduction: number
  advance_deduction: number; pf: number; tds: number; net: number; payroll_status: string
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const hours = (m: number) => `${Math.floor(m / 60)}h ${m % 60}m`
const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`

type Tab = 'attendance' | 'leave' | 'payroll'

export default function HrmsReportsClient({ rows, month, year, workingDays }: {
  rows: ReportRow[]; month: number; year: number; workingDays: number
}) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('attendance')

  const period = `${MONTHS[month - 1]} ${year}`
  const years = Array.from({ length: 5 }, (_, i) => year + 1 - i)

  function go(m: number, y: number) { router.push(`/hrms/reports?month=${m}&year=${y}`) }

  const sheetRows = (): Record<string, string | number>[] => {
    if (tab === 'attendance') return rows.map((r, i) => ({
      'S.No': i + 1, Employee: r.name, Code: r.employee_code, Department: r.department,
      'Working Days': workingDays, Present: r.present, Late: r.late, 'Half Day': r.half_day,
      Absent: r.absent, 'Weekly Off': r.weekly_off, Holidays: r.holiday, Missing: r.missing,
      'Working Hours': hours(r.work_minutes), 'Late (min)': r.late_minutes, 'Early Leaving (min)': r.early_minutes,
    }))
    if (tab === 'leave') return rows.map((r, i) => ({
      'S.No': i + 1, Employee: r.name, Code: r.employee_code,
      'CL Used': r.cl, 'SL Used': r.sl, 'LWP Days': r.lwp,
      'CL Balance': r.cl_balance, 'SL Balance': r.sl_balance,
    }))
    return rows.map((r, i) => ({
      'S.No': i + 1, Employee: r.name, Code: r.employee_code, 'Monthly Salary': r.salary,
      Present: r.present, 'Half Day': r.half_day, Absent: r.absent, LWP: r.lwp, Late: r.late,
      Gross: r.gross, 'LOP Deduction': r.lop_deduction, 'Late Deduction': r.late_deduction,
      Advance: r.advance_deduction, PF: r.pf, TDS: r.tds, 'Net Salary': r.net, Status: r.payroll_status,
    }))
  }

  function exportExcel() {
    const data = sheetRows()
    if (data.length === 0) return
    const ws = XLSX.utils.json_to_sheet(data)
    ws['!cols'] = Object.keys(data[0]).map(k => ({ wch: Math.max(10, k.length + 2) }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, tab)
    XLSX.writeFile(wb, `DCW_${tab}_report_${MONTHS[month - 1]}_${year}.xlsx`)
  }

  const totals = rows.reduce((t, r) => ({
    present: t.present + r.present, late: t.late + r.late, half_day: t.half_day + r.half_day,
    absent: t.absent + r.absent, lwp: t.lwp + r.lwp, net: t.net + r.net,
  }), { present: 0, late: 0, half_day: 0, absent: 0, lwp: 0, net: 0 })

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap print:hidden">
        <div>
          <h1 className="text-2xl font-bold">Reports</h1>
          <p className="text-sm text-muted-foreground">{period} · {rows.length} employees</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select value={month} onChange={e => go(Number(e.target.value), year)}
            className="border rounded-lg px-2 h-9 text-sm bg-white">
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
          <select value={year} onChange={e => go(month, Number(e.target.value))}
            className="border rounded-lg px-2 h-9 text-sm bg-white">
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-1.5 h-9">
            <Printer className="w-3.5 h-3.5" /> Print / PDF
          </Button>
          <Button size="sm" onClick={exportExcel} disabled={rows.length === 0}
            className="gap-1.5 h-9 bg-green-600 hover:bg-green-700">
            <Download className="w-3.5 h-3.5" /> Export Excel
          </Button>
        </div>
      </div>

      <div className="flex gap-1.5 p-1 bg-gray-100 rounded-xl w-fit print:hidden">
        {(['attendance', 'leave', 'payroll'] as const).map(k => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-3.5 py-2 rounded-lg text-sm font-semibold capitalize transition-all ${tab === k ? 'bg-white shadow-sm text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}>
            {k}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-16 border rounded-2xl bg-white">
          <BarChart3 className="w-10 h-10 mx-auto mb-3 text-gray-200" />
          <p className="font-semibold text-gray-500">No active employees</p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b text-[10px] uppercase text-slate-500">
                <tr>
                  <th className="text-left px-3 py-2">#</th>
                  <th className="text-left px-3 py-2">Employee</th>
                  {tab === 'attendance' && <>
                    <th className="text-center px-2 py-2">Present</th><th className="text-center px-2 py-2">Late</th>
                    <th className="text-center px-2 py-2">Half</th><th className="text-center px-2 py-2">Absent</th>
                    <th className="text-center px-2 py-2">W/Off</th><th className="text-center px-2 py-2">Holiday</th>
                    <th className="text-center px-2 py-2">Missing</th>
                    <th className="text-right px-3 py-2">Hours</th><th className="text-right px-3 py-2">Late min</th>
                  </>}
                  {tab === 'leave' && <>
                    <th className="text-center px-2 py-2">CL Used</th><th className="text-center px-2 py-2">SL Used</th>
                    <th className="text-center px-2 py-2">LWP</th>
                    <th className="text-center px-2 py-2">CL Balance</th><th className="text-center px-2 py-2">SL Balance</th>
                  </>}
                  {tab === 'payroll' && <>
                    <th className="text-right px-3 py-2">Salary</th><th className="text-right px-3 py-2">Gross</th>
                    <th className="text-right px-3 py-2">LOP</th><th className="text-right px-3 py-2">Late</th>
                    <th className="text-right px-3 py-2">Advance</th><th className="text-right px-3 py-2">Net</th>
                    <th className="text-center px-3 py-2">Status</th>
                  </>}
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((r, i) => (
                  <tr key={r.employee_id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 text-xs text-gray-400 tabular-nums">{i + 1}</td>
                    <td className="px-3 py-2">
                      <p className="font-medium text-gray-900 whitespace-nowrap">{r.name}</p>
                      <p className="text-[11px] text-gray-400">{r.employee_code || '—'}{r.department ? ` · ${r.department}` : ''}</p>
                    </td>
                    {tab === 'attendance' && <>
                      <Num v={r.present} /><Num v={r.late} warn={r.late > 0} /><Num v={r.half_day} warn={r.half_day > 0} />
                      <Num v={r.absent} bad={r.absent > 0} /><Num v={r.weekly_off} muted /><Num v={r.holiday} muted />
                      <Num v={r.missing} warn={r.missing > 0} />
                      <td className="px-3 py-2 text-right tabular-nums">{hours(r.work_minutes)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-orange-600">{r.late_minutes}</td>
                    </>}
                    {tab === 'leave' && <>
                      <Num v={r.cl} /><Num v={r.sl} /><Num v={r.lwp} bad={r.lwp > 0} />
                      <Num v={r.cl_balance} strong /><Num v={r.sl_balance} strong />
                    </>}
                    {tab === 'payroll' && <>
                      <td className="px-3 py-2 text-right tabular-nums">{inr(r.salary)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{inr(r.gross)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-red-600">{r.lop_deduction ? inr(r.lop_deduction) : '—'}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-red-600">{r.late_deduction ? inr(r.late_deduction) : '—'}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-red-600">{r.advance_deduction ? inr(r.advance_deduction) : '—'}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-bold text-gray-900">{inr(r.net)}</td>
                      <td className="px-3 py-2 text-center">
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{r.payroll_status}</span>
                      </td>
                    </>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2.5 border-t bg-slate-50 text-xs text-slate-600 flex flex-wrap gap-4">
            <span>Present <b>{totals.present}</b></span>
            <span>Late <b>{totals.late}</b></span>
            <span>Half Day <b>{totals.half_day}</b></span>
            <span>Absent <b>{totals.absent}</b></span>
            <span>LWP <b>{totals.lwp}</b></span>
            {tab === 'payroll' && <span className="ml-auto">Net payable <b>{inr(totals.net)}</b></span>}
          </div>
        </div>
      )}
    </div>
  )
}

function Num({ v, warn, bad, muted, strong }: { v: number; warn?: boolean; bad?: boolean; muted?: boolean; strong?: boolean }) {
  const cls = bad ? 'text-red-600 font-semibold' : warn ? 'text-orange-600 font-semibold'
    : muted ? 'text-gray-300' : strong ? 'text-blue-700 font-bold' : 'text-gray-700'
  return <td className={`px-2 py-2 text-center tabular-nums ${cls}`}>{v}</td>
}
