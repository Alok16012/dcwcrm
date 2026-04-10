'use client'

import { useState, useTransition } from 'react'
import { format, addDays, parseISO, isBefore, isAfter } from 'date-fns'
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
  cycle_start: string   // yyyy-MM-dd
  cycle_end: string     // yyyy-MM-dd
  attendance: Record<string, AttendanceStatus> // dateStr → status
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

const ALL_STATUSES: AttendanceStatus[] = ['present', 'absent', 'half_day', 'late', 'leave', 'holiday']

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

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export default function AttendanceGrid({ data: initialData, year, month, rangeStart, rangeEnd }: AttendanceGridProps) {
  const [data, setData] = useState(initialData)
  const [editCell, setEditCell] = useState<{ empId: string; date: string } | null>(null)
  const [bulkDate, setBulkDate] = useState<string>('')
  const [bulkStatus, setBulkStatus] = useState<AttendanceStatus>('present')
  const [isPending, startTransition] = useTransition()
  const supabase = createClient()
  const router = useRouter()

  const allDates = getDatesInRange(rangeStart, rangeEnd)
  const today = format(new Date(), 'yyyy-MM-dd')

  // --- Navigation ---
  function navigate(dir: 1 | -1) {
    let m = month + dir
    let y = year
    if (m > 12) { m = 1; y++ }
    if (m < 1) { m = 12; y-- }
    router.push(`/hrms/attendance?month=${m}&year=${y}`)
  }

  // --- Get effective status for a cell ---
  function getStatus(emp: EmployeeAttendance, dateStr: string): AttendanceStatus | null {
    if (emp.attendance[dateStr]) return emp.attendance[dateStr]
    // Pre-fill past dates within cycle as absent
    const inCycle = dateStr >= emp.cycle_start && dateStr <= emp.cycle_end
    if (inCycle && dateStr < today) return 'absent'
    return null
  }

  function isInCycle(emp: EmployeeAttendance, dateStr: string) {
    return dateStr >= emp.cycle_start && dateStr <= emp.cycle_end
  }

  // --- Update single cell ---
  const updateAttendance = (empId: string, dateStr: string, status: AttendanceStatus) => {
    startTransition(async () => {
      try {
        const { error } = await supabase.from('attendance').upsert(
          { employee_id: empId, date: dateStr, status } as never,
          { onConflict: 'employee_id,date' }
        )
        if (error) throw error
        setData((prev) =>
          prev.map((e) =>
            e.employee_id === empId
              ? { ...e, attendance: { ...e.attendance, [dateStr]: status } }
              : e
          )
        )
      } catch {
        toast.error('Failed to update attendance')
      } finally {
        setEditCell(null)
      }
    })
  }

  // --- Bulk mark ---
  const bulkMark = () => {
    if (!bulkDate) return
    startTransition(async () => {
      try {
        const eligible = data.filter((e) => isInCycle(e, bulkDate))
        const upserts = eligible.map((e) => ({ employee_id: e.employee_id, date: bulkDate, status: bulkStatus }))
        if (!upserts.length) { toast.error('No employees have this date in their cycle'); return }
        const { error } = await supabase.from('attendance').upsert(upserts as never, { onConflict: 'employee_id,date' })
        if (error) throw error
        setData((prev) =>
          prev.map((e) =>
            isInCycle(e, bulkDate)
              ? { ...e, attendance: { ...e.attendance, [bulkDate]: bulkStatus } }
              : e
          )
        )
        toast.success(`Marked ${upserts.length} employees as ${bulkStatus} on ${bulkDate}`)
        setBulkDate('')
      } catch {
        toast.error('Bulk mark failed')
      }
    })
  }

  return (
    <div className="space-y-4">
      {/* Header: navigation + cycle label */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(-1)} className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50 text-gray-600 font-bold">‹</button>
          <span className="text-sm font-semibold text-gray-800 min-w-[110px] text-center">
            {MONTHS[month - 1]} {year} Cycle
          </span>
          <button onClick={() => navigate(1)} className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50 text-gray-600 font-bold">›</button>
        </div>

        <div className="flex items-center gap-2 ml-auto flex-wrap">
          <span className="text-sm text-muted-foreground">Bulk mark:</span>
          <input
            type="date"
            value={bulkDate}
            min={rangeStart}
            max={rangeEnd}
            onChange={(e) => setBulkDate(e.target.value)}
            className="h-9 px-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
          <Select value={bulkStatus} onValueChange={(v) => setBulkStatus(v as AttendanceStatus)}>
            <SelectTrigger className="w-32 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ALL_STATUSES.map((s) => (
                <SelectItem key={s} value={s} className="capitalize">{s.replace('_', ' ')}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={bulkMark} disabled={!bulkDate || isPending} className="h-9">
            Apply
          </Button>
        </div>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto rounded-md border">
        <table className="min-w-max text-xs">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="sticky left-0 bg-muted/50 px-3 py-2 text-left font-semibold min-w-[160px] z-10">Employee</th>
              <th className="sticky left-[160px] bg-muted/50 px-2 py-2 text-center font-semibold min-w-[100px] z-10 border-r border-gray-200 text-[10px]">Cycle</th>
              {allDates.map((d) => {
                const parsed = parseISO(d)
                return (
                  <th key={d} className={`px-1 py-1 text-center font-medium w-9 ${d === today ? 'bg-blue-100' : ''}`}>
                    <div className="text-[9px] text-gray-400">{format(parsed, 'MMM')}</div>
                    <div>{format(parsed, 'd')}</div>
                  </th>
                )
              })}
              <th className="px-2 py-2 text-center font-semibold min-w-[60px]">P</th>
              <th className="px-2 py-2 text-center font-semibold min-w-[60px]">A</th>
            </tr>
          </thead>
          <tbody>
            {data.map((emp) => {
              // Count present and absent within cycle
              let presentCount = 0, absentCount = 0
              const cycleDates = getDatesInRange(emp.cycle_start, emp.cycle_end)
              for (const d of cycleDates) {
                const s = emp.attendance[d] || (d < today ? 'absent' : null)
                if (s === 'present' || s === 'late' || s === 'half_day') presentCount++
                if (s === 'absent') absentCount++
              }

              return (
                <tr key={emp.employee_id} className="border-b hover:bg-muted/30">
                  <td className="sticky left-0 bg-background px-3 py-1.5 font-medium z-10">{emp.employee_name}</td>
                  <td className="sticky left-[160px] bg-background px-2 py-1.5 text-[10px] text-gray-500 border-r border-gray-100 z-10 whitespace-nowrap">
                    {format(parseISO(emp.cycle_start), 'd MMM')} – {format(parseISO(emp.cycle_end), 'd MMM')}
                  </td>
                  {allDates.map((d) => {
                    const inCycle = isInCycle(emp, d)
                    const status = inCycle ? getStatus(emp, d) : null
                    const isEditing = editCell?.empId === emp.employee_id && editCell?.date === d
                    const isToday = d === today
                    const isFuture = d > today

                    if (!inCycle) {
                      return (
                        <td key={d} className="px-1 py-1 text-center">
                          <span className="text-gray-200">–</span>
                        </td>
                      )
                    }

                    return (
                      <td key={d} className={`px-1 py-1 text-center ${isToday ? 'bg-blue-50' : ''}`}>
                        {isEditing ? (
                          <Select
                            defaultValue={status ?? 'absent'}
                            onValueChange={(v) => updateAttendance(emp.employee_id, d, v as AttendanceStatus)}
                            open
                            onOpenChange={(open) => !open && setEditCell(null)}
                          >
                            <SelectTrigger className="h-6 w-14 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {ALL_STATUSES.map((s) => (
                                <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <button
                            onClick={() => !isFuture && setEditCell({ empId: emp.employee_id, date: d })}
                            className={`rounded px-1 py-0.5 font-medium transition-opacity ${
                              isFuture
                                ? 'text-gray-200 cursor-default'
                                : status
                                ? `${STATUS_COLORS[status]} hover:opacity-80`
                                : 'text-gray-300 hover:bg-gray-100'
                            }`}
                          >
                            {isFuture ? '·' : status ? STATUS_LABELS[status] : '—'}
                          </button>
                        )}
                      </td>
                    )
                  })}
                  <td className="px-2 py-1.5 text-center font-semibold text-green-700">{presentCount}</td>
                  <td className="px-2 py-1.5 text-center font-semibold text-red-600">{absentCount}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 text-xs">
        {ALL_STATUSES.map((s) => (
          <Badge key={s} variant="outline" className={`${STATUS_COLORS[s]} border-0`}>
            {STATUS_LABELS[s]} = {s.replace('_', ' ')}
          </Badge>
        ))}
        <Badge variant="outline" className="bg-gray-50 text-gray-400 border-0">– = Out of cycle</Badge>
        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-0">Today</Badge>
      </div>
    </div>
  )
}
