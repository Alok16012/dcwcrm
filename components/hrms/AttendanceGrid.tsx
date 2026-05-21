'use client'

import { useState, useTransition } from 'react'
import { format, addDays, parseISO, isAfter } from 'date-fns'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { useRouter } from 'next/navigation'
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

const STATUS_COLORS: Record<AttendanceStatus, string> = {
  present:  'bg-green-100 text-green-800',
  absent:   'bg-red-100 text-red-800',
  half_day: 'bg-yellow-100 text-yellow-800',
  late:     'bg-orange-100 text-orange-800',
  leave:    'bg-blue-100 text-blue-800',
  holiday:  'bg-gray-100 text-gray-600',
}

const STATUS_LABELS: Record<AttendanceStatus, string> = {
  present:  'P',
  absent:   'A',
  half_day: 'H',
  late:     'L',
  leave:    'LV',
  holiday:  'HD',
}

const STATUS_FULL: Record<AttendanceStatus, string> = {
  present:  'Present',
  absent:   'Absent',
  half_day: 'Half Day',
  late:     'Late',
  leave:    'Leave',
  holiday:  'Holiday',
}

const ALL_STATUSES: AttendanceStatus[] = ['present', 'absent', 'half_day', 'late', 'leave', 'holiday']
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

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
  const [editCell, setEditCell] = useState<{ empId: string; date: string } | null>(null)

  // Bulk state
  const [bulkMode, setBulkMode] = useState<'single' | 'range'>('single')
  const [bulkDate, setBulkDate] = useState('')
  const [bulkFromDate, setBulkFromDate] = useState('')
  const [bulkToDate, setBulkToDate] = useState('')
  const [bulkStatus, setBulkStatus] = useState<AttendanceStatus>('present')
  const [preview, setPreview] = useState<{ count: number; dates: string[] } | null>(null)
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

  function isInCycle(emp: EmployeeAttendance, dateStr: string) {
    return dateStr >= emp.cycle_start && dateStr <= emp.cycle_end
  }

  // Only return actual DB-recorded status — no pre-filling
  function getStatus(emp: EmployeeAttendance, dateStr: string): AttendanceStatus | null {
    return emp.attendance[dateStr] ?? null
  }

  // ── Single cell update ────────────────────────────────────────────────────────
  function updateAttendance(empId: string, dateStr: string, status: AttendanceStatus) {
    startTransition(async () => {
      try {
        const { error } = await supabase.from('attendance').upsert(
          { employee_id: empId, date: dateStr, status } as never,
          { onConflict: 'employee_id,date' }
        )
        if (error) throw error
        setData(prev => prev.map(e =>
          e.employee_id === empId
            ? { ...e, attendance: { ...e.attendance, [dateStr]: status } }
            : e
        ))
      } catch (e: any) {
        toast.error('Failed to update: ' + (e?.message ?? 'unknown error'))
      } finally {
        setEditCell(null)
      }
    })
  }

  // ── Build bulk preview ────────────────────────────────────────────────────────
  function buildPreview() {
    const dates = bulkMode === 'single'
      ? (bulkDate ? [bulkDate] : [])
      : (bulkFromDate && bulkToDate ? getDatesInRange(bulkFromDate, bulkToDate) : [])

    if (!dates.length) { toast.error('Select a date first'); return }

    let count = 0
    for (const emp of data) {
      for (const d of dates) {
        if (isInCycle(emp, d) && d <= today) count++
      }
    }
    if (count === 0) {
      toast.error('No employees have these dates in their active cycle')
      return
    }
    setPreview({ count, dates })
  }

  // ── Apply bulk mark ───────────────────────────────────────────────────────────
  function applyBulk() {
    if (!preview) return
    startTransition(async () => {
      try {
        const upserts: { employee_id: string; date: string; status: AttendanceStatus }[] = []
        for (const emp of data) {
          for (const d of preview.dates) {
            if (isInCycle(emp, d) && d <= today) {
              upserts.push({ employee_id: emp.employee_id, date: d, status: bulkStatus })
            }
          }
        }
        if (!upserts.length) { toast.error('Nothing to mark'); return }

        // Upsert in batches of 100 to avoid request size limits
        const BATCH = 100
        for (let i = 0; i < upserts.length; i += BATCH) {
          const { error } = await supabase
            .from('attendance')
            .upsert(upserts.slice(i, i + BATCH) as never, { onConflict: 'employee_id,date' })
          if (error) throw error
        }

        // Update local state
        setData(prev => prev.map(emp => {
          const newAtt = { ...emp.attendance }
          for (const d of preview.dates) {
            if (isInCycle(emp, d) && d <= today) newAtt[d] = bulkStatus
          }
          return { ...emp, attendance: newAtt }
        }))

        toast.success(`✓ Marked ${upserts.length} records as ${STATUS_FULL[bulkStatus]}`)
        setPreview(null)
        setBulkDate('')
        setBulkFromDate('')
        setBulkToDate('')
      } catch (e: any) {
        toast.error('Bulk mark failed: ' + (e?.message ?? 'Check permissions'))
      }
    })
  }

  return (
    <div className="space-y-4">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(-1)} className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50 text-gray-600 font-bold">‹</button>
          <span className="text-sm font-semibold text-gray-800 min-w-[110px] text-center">{MONTHS[month - 1]} {year} Cycle</span>
          <button onClick={() => navigate(1)} className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50 text-gray-600 font-bold">›</button>
        </div>

        {/* ── Bulk controls ── */}
        <div className="flex items-center gap-2 ml-auto flex-wrap">
          <span className="text-sm text-muted-foreground font-medium">Bulk:</span>

          <Select value={bulkMode} onValueChange={v => { setBulkMode(v as 'single' | 'range'); setPreview(null) }}>
            <SelectTrigger className="w-28 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="single">Single Date</SelectItem>
              <SelectItem value="range">Date Range</SelectItem>
            </SelectContent>
          </Select>

          {bulkMode === 'single' ? (
            <input type="date" value={bulkDate} min={rangeStart} max={today}
              onChange={e => { setBulkDate(e.target.value); setPreview(null) }}
              className="h-9 px-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400" />
          ) : (
            <>
              <input type="date" value={bulkFromDate} min={rangeStart} max={today}
                onChange={e => { setBulkFromDate(e.target.value); setPreview(null) }}
                className="h-9 px-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400" />
              <span className="text-xs text-gray-400">to</span>
              <input type="date" value={bulkToDate} min={bulkFromDate || rangeStart} max={today}
                onChange={e => { setBulkToDate(e.target.value); setPreview(null) }}
                className="h-9 px-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400" />
            </>
          )}

          <Select value={bulkStatus} onValueChange={v => { setBulkStatus(v as AttendanceStatus); setPreview(null) }}>
            <SelectTrigger className="w-32 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ALL_STATUSES.map(s => (
                <SelectItem key={s} value={s}>{STATUS_FULL[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {!preview ? (
            <Button size="sm" onClick={buildPreview}
              disabled={bulkMode === 'single' ? !bulkDate : (!bulkFromDate || !bulkToDate)}
              className="h-9">
              Preview
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5">
                {preview.count} records → {STATUS_FULL[bulkStatus]}
              </span>
              <Button size="sm" onClick={applyBulk} disabled={isPending}
                className="h-9 bg-green-600 hover:bg-green-700">
                {isPending ? 'Saving…' : 'Confirm'}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setPreview(null)} disabled={isPending} className="h-9">
                Cancel
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* ── Grid ── */}
      <div className="overflow-x-auto rounded-md border">
        <table className="min-w-max text-xs">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="sticky left-0 bg-muted/50 px-3 py-2 text-left font-semibold min-w-[160px] z-10">Employee</th>
              <th className="sticky left-[160px] bg-muted/50 px-2 py-2 text-center font-semibold min-w-[100px] z-10 border-r border-gray-200 text-[10px]">Cycle</th>
              {allDates.map(d => {
                const parsed = parseISO(d)
                const isWeekend = [0, 6].includes(parsed.getDay())
                return (
                  <th key={d} className={`px-1 py-1 text-center font-medium w-9 ${d === today ? 'bg-blue-100' : isWeekend ? 'bg-gray-50' : ''}`}>
                    <div className="text-[9px] text-gray-400">{format(parsed, 'EEE')}</div>
                    <div>{format(parsed, 'd')}</div>
                  </th>
                )
              })}
              <th className="px-2 py-2 text-center font-semibold min-w-[40px] text-green-700">P</th>
              <th className="px-2 py-2 text-center font-semibold min-w-[40px] text-red-600">A</th>
              <th className="px-2 py-2 text-center font-semibold min-w-[40px] text-gray-400">—</th>
            </tr>
          </thead>
          <tbody>
            {data.map(emp => {
              const cycleDates = getDatesInRange(emp.cycle_start, emp.cycle_end)
              const pastCycleDates = cycleDates.filter(d => d <= today)

              // Only count actual DB records
              let presentCount = 0, absentCount = 0, unmarkedCount = 0
              for (const d of pastCycleDates) {
                const s = emp.attendance[d]
                if (!s) { unmarkedCount++; continue }
                if (s === 'present' || s === 'late' || s === 'half_day') presentCount++
                else if (s === 'absent') absentCount++
              }

              return (
                <tr key={emp.employee_id} className="border-b hover:bg-muted/30">
                  <td className="sticky left-0 bg-background px-3 py-1.5 font-medium z-10">{emp.employee_name}</td>
                  <td className="sticky left-[160px] bg-background px-2 py-1.5 text-[10px] text-gray-500 border-r border-gray-100 z-10 whitespace-nowrap">
                    {format(parseISO(emp.cycle_start), 'd MMM')} – {format(parseISO(emp.cycle_end), 'd MMM')}
                  </td>
                  {allDates.map(d => {
                    const inCycle = isInCycle(emp, d)
                    const status = inCycle ? getStatus(emp, d) : null
                    const isEditing = editCell?.empId === emp.employee_id && editCell?.date === d
                    const isFuture = d > today
                    const isToday = d === today
                    const parsed = parseISO(d)
                    const isWeekend = [0, 6].includes(parsed.getDay())

                    if (!inCycle) {
                      return <td key={d} className="px-1 py-1 text-center"><span className="text-gray-200">–</span></td>
                    }

                    return (
                      <td key={d} className={`px-1 py-1 text-center ${isToday ? 'bg-blue-50' : isWeekend ? 'bg-gray-50/50' : ''}`}>
                        {isEditing ? (
                          <Select
                            defaultValue={status ?? 'present'}
                            onValueChange={v => updateAttendance(emp.employee_id, d, v as AttendanceStatus)}
                            open
                            onOpenChange={open => !open && setEditCell(null)}
                          >
                            <SelectTrigger className="h-6 w-14 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {ALL_STATUSES.map(s => (
                                <SelectItem key={s} value={s}>{STATUS_FULL[s]}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <button
                            onClick={() => !isFuture && setEditCell({ empId: emp.employee_id, date: d })}
                            title={status ? STATUS_FULL[status] : isFuture ? 'Future' : 'Click to mark'}
                            className={`rounded px-1 py-0.5 font-medium transition-all w-8 ${
                              isFuture
                                ? 'text-gray-200 cursor-default'
                                : status
                                ? `${STATUS_COLORS[status]} hover:opacity-80 cursor-pointer`
                                : 'text-gray-300 hover:bg-gray-100 cursor-pointer'
                            }`}
                          >
                            {isFuture ? '·' : status ? STATUS_LABELS[status] : '—'}
                          </button>
                        )}
                      </td>
                    )
                  })}
                  <td className="px-2 py-1.5 text-center font-bold text-green-700">{presentCount}</td>
                  <td className="px-2 py-1.5 text-center font-bold text-red-600">{absentCount}</td>
                  <td className="px-2 py-1.5 text-center text-gray-400 text-[11px]">{unmarkedCount > 0 ? unmarkedCount : ''}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* ── Legend ── */}
      <div className="flex flex-wrap gap-2 text-xs">
        {ALL_STATUSES.map(s => (
          <Badge key={s} variant="outline" className={`${STATUS_COLORS[s]} border-0`}>
            {STATUS_LABELS[s]} = {STATUS_FULL[s]}
          </Badge>
        ))}
        <Badge variant="outline" className="bg-gray-50 text-gray-400 border-0">– = Out of cycle</Badge>
        <Badge variant="outline" className="bg-gray-50 text-gray-400 border-0">— = Unmarked</Badge>
      </div>
    </div>
  )
}
