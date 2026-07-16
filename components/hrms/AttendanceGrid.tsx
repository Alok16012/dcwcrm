'use client'

import { useState, useTransition } from 'react'
import { format, addDays, parseISO, isAfter } from 'date-fns'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import { Eraser, Loader2 } from 'lucide-react'
import type { AttendanceStatus } from '@/types/app.types'

interface EmployeeAttendance {
  employee_id: string
  employee_name: string
  cycle_start: string
  cycle_end: string
  attendance: Record<string, AttendanceStatus>
}

interface AttendanceGridProps {
  data: EmployeeAttendance[]
  year: number
  month: number
  rangeStart: string
  rangeEnd: string
}

const STATUS_META: Record<AttendanceStatus, { label: string; full: string; cell: string; chip: string }> = {
  present:  { label: 'P',  full: 'Present',  cell: 'bg-green-100 text-green-800',   chip: 'bg-green-600 text-white' },
  absent:   { label: 'A',  full: 'Absent',   cell: 'bg-red-100 text-red-700',       chip: 'bg-red-600 text-white' },
  half_day: { label: 'H',  full: 'Half Day', cell: 'bg-yellow-100 text-yellow-800', chip: 'bg-yellow-500 text-white' },
  late:     { label: 'L',  full: 'Late',     cell: 'bg-orange-100 text-orange-800', chip: 'bg-orange-500 text-white' },
  leave:    { label: 'LV', full: 'Leave',    cell: 'bg-blue-100 text-blue-800',     chip: 'bg-blue-600 text-white' },
  holiday:  { label: 'HD', full: 'Holiday',  cell: 'bg-gray-200 text-gray-600',     chip: 'bg-gray-500 text-white' },
}

const ALL_STATUSES: AttendanceStatus[] = ['present', 'absent', 'half_day', 'late', 'leave', 'holiday']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

function getDatesInRange(start: string, end: string): string[] {
  const dates: string[] = []
  let cur = parseISO(start)
  const endDate = parseISO(end)
  while (!isAfter(cur, endDate)) {
    dates.push(format(cur, 'yyyy-MM-dd'))
    cur = addDays(cur, 1)
  }
  return dates
}

export default function AttendanceGrid({ data: initialData, year, month, rangeStart, rangeEnd }: AttendanceGridProps) {
  const [data, setData] = useState(initialData)
  // The "brush": pick a status once, then click cells to paint it (Excel-style)
  const [brush, setBrush] = useState<AttendanceStatus | 'clear'>('present')
  const [isPending, startTransition] = useTransition()

  const supabase = createClient()
  const router = useRouter()

  const allDates = getDatesInRange(rangeStart, rangeEnd)
  const today = format(new Date(), 'yyyy-MM-dd')

  function navigate(dir: 1 | -1) {
    let m = month + dir, y = year
    if (m > 12) { m = 1; y++ }
    if (m < 1) { m = 12; y-- }
    router.push(`/hrms/attendance?month=${m}&year=${y}`)
  }

  const isInCycle = (emp: EmployeeAttendance, dateStr: string) =>
    dateStr >= emp.cycle_start && dateStr <= emp.cycle_end

  function applyLocal(changes: { empId: string; date: string; status: AttendanceStatus | null }[]) {
    setData(prev => prev.map(e => {
      const mine = changes.filter(c => c.empId === e.employee_id)
      if (!mine.length) return e
      const att = { ...e.attendance }
      for (const c of mine) {
        if (c.status === null) delete att[c.date]
        else att[c.date] = c.status
      }
      return { ...e, attendance: att }
    }))
  }

  // Paint one or many cells with the current brush
  function paint(cells: { empId: string; date: string }[]) {
    const valid = cells.filter(c => {
      const emp = data.find(e => e.employee_id === c.empId)
      return emp && isInCycle(emp, c.date) && c.date <= today
    })
    if (!valid.length) return
    startTransition(async () => {
      try {
        if (brush === 'clear') {
          for (const c of valid) {
            const { error } = await supabase.from('attendance').delete()
              .eq('employee_id', c.empId).eq('date', c.date)
            if (error) throw error
          }
          applyLocal(valid.map(c => ({ ...c, status: null })))
        } else {
          const rows = valid.map(c => ({ employee_id: c.empId, date: c.date, status: brush }))
          const BATCH = 100
          for (let i = 0; i < rows.length; i += BATCH) {
            const { error } = await supabase.from('attendance')
              .upsert(rows.slice(i, i + BATCH) as never[], { onConflict: 'employee_id,date' })
            if (error) throw error
          }
          applyLocal(valid.map(c => ({ ...c, status: brush })))
        }
        if (valid.length > 1) {
          toast.success(brush === 'clear'
            ? `${valid.length} cells cleared`
            : `${valid.length} marked ${STATUS_META[brush].full}`)
        }
      } catch (e) {
        const msg = (e as { message?: string })?.message ?? 'unknown error'
        toast.error('Save failed: ' + msg)
      }
    })
  }

  // Column header click: paint the whole day for every employee
  function paintDay(dateStr: string) {
    paint(data.map(e => ({ empId: e.employee_id, date: dateStr })))
  }

  // "Fill row" — paint every unmarked past day in the employee's cycle
  function fillRow(emp: EmployeeAttendance) {
    if (brush === 'clear') { toast.error('Select a status first (not eraser)'); return }
    const cells = getDatesInRange(emp.cycle_start, emp.cycle_end)
      .filter(d => d <= today && !emp.attendance[d])
      .map(d => ({ empId: emp.employee_id, date: d }))
    if (!cells.length) { toast.info('No unmarked days left'); return }
    paint(cells)
  }

  return (
    <div className="space-y-4">

      {/* ── Month nav + brush palette ── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50 text-gray-600 font-bold text-lg">‹</button>
          <span className="text-base font-bold text-gray-800 min-w-[150px] text-center">{MONTHS[month - 1]} {year}</span>
          <button onClick={() => navigate(1)} className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50 text-gray-600 font-bold text-lg">›</button>
        </div>
        {isPending && <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}

        <div className="flex items-center gap-1.5 ml-auto flex-wrap">
          {ALL_STATUSES.map(s => (
            <button
              key={s}
              onClick={() => setBrush(s)}
              title={STATUS_META[s].full}
              className={`px-3 h-9 rounded-lg text-xs font-bold transition-all border ${
                brush === s
                  ? `${STATUS_META[s].chip} border-transparent ring-2 ring-offset-1 ring-gray-400`
                  : `${STATUS_META[s].cell} border-transparent opacity-70 hover:opacity-100`
              }`}
            >
              {STATUS_META[s].label} · {STATUS_META[s].full}
            </button>
          ))}
          <button
            onClick={() => setBrush('clear')}
            title="Eraser — click a cell to clear it"
            className={`px-3 h-9 rounded-lg text-xs font-bold transition-all border flex items-center gap-1 ${
              brush === 'clear'
                ? 'bg-gray-800 text-white border-transparent ring-2 ring-offset-1 ring-gray-400'
                : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
            }`}
          >
            <Eraser className="w-3.5 h-3.5" /> Clear
          </button>
        </div>
      </div>

      <p className="text-xs text-gray-500 -mt-2">
        Upar status chuno, phir table me cell pe click karo — wahi status lag jayega.
        Din ke number pe click = us din sab employees mark. Naam ke aage <b>Fill</b> = us employee ke bache hue din mark.
      </p>

      {/* ── Grid ── */}
      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="min-w-max text-xs border-collapse">
          <thead>
            <tr className="bg-slate-100">
              <th className="sticky left-0 bg-slate-100 px-3 py-2 text-left font-bold min-w-[170px] z-10 border-b border-r border-slate-200">Employee</th>
              {allDates.map(d => {
                const parsed = parseISO(d)
                const isWeekend = [0, 6].includes(parsed.getDay())
                const isFuture = d > today
                return (
                  <th key={d} className={`p-0 text-center border-b border-l border-slate-200 ${d === today ? 'bg-blue-100' : isWeekend ? 'bg-slate-200/60' : ''}`}>
                    <button
                      onClick={() => !isFuture && paintDay(d)}
                      disabled={isFuture}
                      title={isFuture ? 'Future date' : `Mark all employees on ${format(parsed, 'd MMM')}`}
                      className={`w-9 py-1.5 ${isFuture ? 'cursor-default opacity-40' : 'hover:bg-blue-200 cursor-pointer'}`}
                    >
                      <div className="text-[9px] text-gray-500 leading-none">{format(parsed, 'EEEEE')}</div>
                      <div className="font-bold">{format(parsed, 'd')}</div>
                    </button>
                  </th>
                )
              })}
              <th className="px-2 py-2 text-center font-bold text-green-700 border-b border-l border-slate-200" title="Present + Late">P</th>
              <th className="px-2 py-2 text-center font-bold text-red-600 border-b border-l border-slate-200" title="Absent">A</th>
              <th className="px-2 py-2 text-center font-bold text-yellow-600 border-b border-l border-slate-200" title="Half Day">H</th>
              <th className="px-2 py-2 text-center font-bold text-blue-600 border-b border-l border-slate-200" title="Leave">LV</th>
              <th className="px-2 py-2 text-center font-bold text-gray-400 border-b border-l border-slate-200" title="Unmarked past days">?</th>
            </tr>
          </thead>
          <tbody>
            {data.map(emp => {
              const cycleDates = getDatesInRange(emp.cycle_start, emp.cycle_end)
              const pastCycleDates = cycleDates.filter(d => d <= today)
              let p = 0, a = 0, h = 0, lv = 0, un = 0
              for (const d of pastCycleDates) {
                const s = emp.attendance[d]
                if (!s) un++
                else if (s === 'present' || s === 'late') p++
                else if (s === 'absent') a++
                else if (s === 'half_day') h++
                else if (s === 'leave') lv++
              }

              return (
                <tr key={emp.employee_id} className="hover:bg-slate-50">
                  <td className="sticky left-0 bg-white px-3 py-1 font-semibold z-10 border-b border-r border-slate-200 whitespace-nowrap">
                    <div className="flex items-center justify-between gap-2">
                      <span>{emp.employee_name}</span>
                      <button
                        onClick={() => fillRow(emp)}
                        title="Fill all unmarked past days with the selected status"
                        className="text-[10px] font-bold text-blue-600 hover:text-blue-800 border border-blue-200 rounded px-1.5 py-0.5 hover:bg-blue-50"
                      >
                        Fill
                      </button>
                    </div>
                    <div className="text-[9px] font-normal text-gray-400">
                      {format(parseISO(emp.cycle_start), 'd MMM')} – {format(parseISO(emp.cycle_end), 'd MMM')}
                    </div>
                  </td>
                  {allDates.map(d => {
                    const inCycle = isInCycle(emp, d)
                    const isFuture = d > today
                    const status = inCycle ? emp.attendance[d] : undefined
                    const isToday = d === today
                    const isWeekend = [0, 6].includes(parseISO(d).getDay())

                    if (!inCycle) {
                      return <td key={d} className="border-b border-l border-slate-100 bg-slate-50 text-center text-slate-200">–</td>
                    }
                    return (
                      <td key={d} className={`p-0 text-center border-b border-l border-slate-100 ${isToday ? 'bg-blue-50' : isWeekend ? 'bg-slate-50' : ''}`}>
                        <button
                          onClick={() => !isFuture && paint([{ empId: emp.employee_id, date: d }])}
                          disabled={isFuture}
                          title={status ? `${STATUS_META[status].full} — click to mark ${brush === 'clear' ? 'clear' : STATUS_META[brush].full}` : isFuture ? 'Future' : 'Click to mark'}
                          className={`w-9 h-8 font-bold transition-colors ${
                            isFuture
                              ? 'text-gray-200 cursor-default'
                              : status
                              ? `${STATUS_META[status].cell} hover:opacity-75`
                              : 'text-gray-300 hover:bg-blue-100'
                          }`}
                        >
                          {isFuture ? '·' : status ? STATUS_META[status].label : ''}
                        </button>
                      </td>
                    )
                  })}
                  <td className="px-2 text-center font-bold text-green-700 border-b border-l border-slate-200">{p}</td>
                  <td className="px-2 text-center font-bold text-red-600 border-b border-l border-slate-200">{a}</td>
                  <td className="px-2 text-center font-bold text-yellow-600 border-b border-l border-slate-200">{h}</td>
                  <td className="px-2 text-center font-bold text-blue-600 border-b border-l border-slate-200">{lv}</td>
                  <td className="px-2 text-center font-semibold text-gray-400 border-b border-l border-slate-200">{un || ''}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* ── Legend ── */}
      <div className="flex flex-wrap gap-2 text-xs">
        {ALL_STATUSES.map(s => (
          <span key={s} className={`${STATUS_META[s].cell} rounded px-2 py-0.5 font-medium`}>
            {STATUS_META[s].label} = {STATUS_META[s].full}
          </span>
        ))}
        <span className="bg-slate-50 text-gray-400 rounded px-2 py-0.5">– = cycle ke bahar</span>
        <span className="bg-slate-50 text-gray-400 rounded px-2 py-0.5">? = unmarked</span>
      </div>
    </div>
  )
}
