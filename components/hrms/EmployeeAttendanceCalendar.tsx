'use client'

import { useState, useTransition } from 'react'
import { format, parseISO, addDays, isAfter } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { AttendanceStatus } from '@/types/app.types'

const STATUS_CONFIG: Record<AttendanceStatus, { label: string; short: string; bg: string; text: string; ring: string }> = {
  present:  { label: 'Present',  short: 'P',  bg: 'bg-green-100',  text: 'text-green-800',  ring: 'ring-green-400' },
  absent:   { label: 'Absent',   short: 'A',  bg: 'bg-red-100',    text: 'text-red-800',    ring: 'ring-red-400' },
  half_day: { label: 'Half Day', short: 'H',  bg: 'bg-yellow-100', text: 'text-yellow-800', ring: 'ring-yellow-400' },
  late:     { label: 'Late',     short: 'L',  bg: 'bg-orange-100', text: 'text-orange-800', ring: 'ring-orange-400' },
  leave:    { label: 'Leave',    short: 'LV', bg: 'bg-blue-100',   text: 'text-blue-800',   ring: 'ring-blue-400' },
  holiday:  { label: 'Holiday',  short: 'HD', bg: 'bg-gray-100',   text: 'text-gray-600',   ring: 'ring-gray-300' },
}

const ALL_STATUSES: AttendanceStatus[] = ['present', 'absent', 'half_day', 'late', 'leave', 'holiday']
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function getDates(start: string, end: string): string[] {
  const dates: string[] = []
  let cur = parseISO(start)
  const endD = parseISO(end)
  while (!isAfter(cur, endD)) { dates.push(format(cur, 'yyyy-MM-dd')); cur = addDays(cur, 1) }
  return dates
}

interface Props {
  employeeId: string
  employeeName: string
  cycleStart: string
  cycleEnd: string
  initialAttendance: Record<string, AttendanceStatus>
  year: number
  month: number
}

export default function EmployeeAttendanceCalendar({
  employeeId, employeeName, cycleStart, cycleEnd, initialAttendance, year, month,
}: Props) {
  const [attendance, setAttendance] = useState(initialAttendance)
  const [active, setActive] = useState<string | null>(null) // date with open picker
  const [isPending, startTransition] = useTransition()
  const supabase = createClient()

  const today = format(new Date(), 'yyyy-MM-dd')
  const cycleDates = getDates(cycleStart, cycleEnd)

  // Summary counts (actual records only)
  const pastDates = cycleDates.filter(d => d <= today)
  let present = 0, absent = 0, leave = 0, unmarked = 0
  for (const d of pastDates) {
    const s = attendance[d]
    if (!s) { unmarked++; continue }
    if (s === 'present' || s === 'late' || s === 'half_day') present++
    else if (s === 'absent') absent++
    else if (s === 'leave') leave++
  }

  function handleNav(dir: 1 | -1) {
    let m = month + dir, y = year
    if (m > 12) { m = 1; y++ }
    if (m < 1) { m = 12; y-- }
    window.location.href = `?tab=attendance&month=${m}&year=${y}`
  }

  function mark(date: string, status: AttendanceStatus) {
    if (date > today) return
    startTransition(async () => {
      try {
        const { error } = await supabase.from('attendance').upsert(
          { employee_id: employeeId, date, status } as never,
          { onConflict: 'employee_id,date' }
        )
        if (error) throw error
        setAttendance(prev => ({ ...prev, [date]: status }))
        toast.success(`${format(parseISO(date), 'd MMM')} → ${STATUS_CONFIG[status].label}`)
      } catch (e: any) {
        toast.error('Failed: ' + (e?.message ?? 'unknown'))
      } finally {
        setActive(null)
      }
    })
  }

  return (
    <div className="space-y-4">

      {/* ── Cycle navigation + summary ── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <button onClick={() => handleNav(-1)} className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50">
            <ChevronLeft className="w-4 h-4 text-gray-600" />
          </button>
          <span className="text-sm font-semibold text-gray-800 min-w-[120px] text-center">
            {MONTHS[month - 1]} {year} Cycle
          </span>
          <button onClick={() => handleNav(1)} className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50">
            <ChevronRight className="w-4 h-4 text-gray-600" />
          </button>
        </div>
        <span className="text-xs text-gray-400 border border-gray-200 rounded-lg px-2.5 py-1">
          {format(parseISO(cycleStart), 'd MMM')} – {format(parseISO(cycleEnd), 'd MMM yyyy')}
        </span>

        {/* Summary chips */}
        <div className="flex items-center gap-2 ml-auto flex-wrap">
          <span className="text-xs font-semibold bg-green-100 text-green-800 px-2.5 py-1 rounded-full">P: {present}</span>
          <span className="text-xs font-semibold bg-red-100 text-red-800 px-2.5 py-1 rounded-full">A: {absent}</span>
          {leave > 0 && <span className="text-xs font-semibold bg-blue-100 text-blue-800 px-2.5 py-1 rounded-full">LV: {leave}</span>}
          {unmarked > 0 && <span className="text-xs font-semibold bg-gray-100 text-gray-500 px-2.5 py-1 rounded-full">Unmarked: {unmarked}</span>}
        </div>
      </div>

      {/* ── Calendar grid ── */}
      <div className="grid grid-cols-7 gap-1.5">
        {/* Day headers */}
        {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => (
          <div key={d} className="text-center text-[10px] font-semibold text-gray-400 py-1">{d}</div>
        ))}

        {/* Leading empty cells to align first day */}
        {(() => {
          const firstDate = parseISO(cycleStart)
          const dow = firstDate.getDay() // 0=Sun, 1=Mon...
          const offset = dow === 0 ? 6 : dow - 1 // shift so Mon=0
          return Array.from({ length: offset }).map((_, i) => <div key={`pad-${i}`} />)
        })()}

        {/* Date cells */}
        {cycleDates.map(d => {
          const status = attendance[d] ?? null
          const isFuture = d > today
          const isToday = d === today
          const cfg = status ? STATUS_CONFIG[status] : null
          const parsed = parseISO(d)
          const isWeekend = [0, 6].includes(parsed.getDay())
          const isOpen = active === d

          return (
            <div key={d} className="relative">
              <button
                disabled={isFuture || isPending}
                onClick={() => setActive(isOpen ? null : d)}
                className={[
                  'w-full aspect-square rounded-xl flex flex-col items-center justify-center text-xs font-semibold transition-all',
                  isToday ? 'ring-2 ring-blue-400 ring-offset-1' : '',
                  isFuture ? 'opacity-30 cursor-default' : 'cursor-pointer hover:scale-105',
                  cfg ? `${cfg.bg} ${cfg.text}` : isWeekend ? 'bg-gray-50 text-gray-400' : 'bg-white border border-gray-100 text-gray-400 hover:bg-gray-50',
                ].join(' ')}
              >
                <span className="text-[10px] opacity-60">{format(parsed, 'd')}</span>
                <span className="text-sm leading-none">{cfg ? cfg.short : '—'}</span>
              </button>

              {/* Status picker popover */}
              {isOpen && (
                <div className="absolute z-50 top-full mt-1 left-1/2 -translate-x-1/2 bg-white border border-gray-200 rounded-xl shadow-xl p-2 w-36">
                  <p className="text-[10px] text-gray-400 font-medium mb-1.5 text-center">{format(parsed, 'd MMM yyyy')}</p>
                  <div className="space-y-0.5">
                    {ALL_STATUSES.map(s => (
                      <button
                        key={s}
                        onClick={() => mark(d, s)}
                        className={[
                          'w-full text-left px-2 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-2',
                          status === s
                            ? `${STATUS_CONFIG[s].bg} ${STATUS_CONFIG[s].text}`
                            : 'hover:bg-gray-50 text-gray-700',
                        ].join(' ')}
                      >
                        <span className={`w-5 text-center text-[10px] font-bold px-1 py-0.5 rounded ${STATUS_CONFIG[s].bg} ${STATUS_CONFIG[s].text}`}>
                          {STATUS_CONFIG[s].short}
                        </span>
                        {STATUS_CONFIG[s].label}
                        {status === s && <span className="ml-auto text-[10px]">✓</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Legend ── */}
      <div className="flex flex-wrap gap-2">
        {ALL_STATUSES.map(s => (
          <span key={s} className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${STATUS_CONFIG[s].bg} ${STATUS_CONFIG[s].text}`}>
            {STATUS_CONFIG[s].short} = {STATUS_CONFIG[s].label}
          </span>
        ))}
      </div>
    </div>
  )
}
