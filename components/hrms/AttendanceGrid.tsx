'use client'

import { useState, useTransition } from 'react'
import { format, getDaysInMonth, startOfMonth } from 'date-fns'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import type { AttendanceStatus } from '@/types/app.types'

interface EmployeeAttendance {
  employee_id: string
  employee_name: string
  attendance: Record<number, AttendanceStatus> // day → status
}

interface AttendanceGridProps {
  data: EmployeeAttendance[]
  year: number
  month: number // 1-12
}

const STATUS_COLORS: Record<AttendanceStatus, string> = {
  present: 'bg-green-100 text-green-800',
  absent: 'bg-red-100 text-red-800',
  half_day: 'bg-yellow-100 text-yellow-800',
  late: 'bg-orange-100 text-orange-800',
  leave: 'bg-blue-100 text-blue-800',
  holiday: 'bg-gray-100 text-gray-600',
}

const STATUS_LABELS: Record<AttendanceStatus, string> = {
  present: 'P',
  absent: 'A',
  half_day: 'H',
  late: 'L',
  leave: 'LV',
  holiday: 'HD',
}

const ALL_STATUSES: AttendanceStatus[] = ['present', 'absent', 'half_day', 'late', 'leave', 'holiday']

export default function AttendanceGrid({ data: initialData, year, month }: AttendanceGridProps) {
  const [data, setData] = useState(initialData)
  const [editCell, setEditCell] = useState<{ empId: string; day: number } | null>(null)
  const [bulkDay, setBulkDay] = useState<number | null>(null)
  const [bulkStatus, setBulkStatus] = useState<AttendanceStatus>('present')
  const [isPending, startTransition] = useTransition()
  const supabase = createClient()

  const daysInMonth = getDaysInMonth(new Date(year, month - 1))
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)

  const updateAttendance = (empId: string, day: number, status: AttendanceStatus) => {
    startTransition(async () => {
      const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      try {
        const { error } = await supabase.from('attendance').upsert(
          { employee_id: empId, date, status } as never,
          { onConflict: 'employee_id,date' }
        )
        if (error) throw error
        setData((prev) =>
          prev.map((e) =>
            e.employee_id === empId
              ? { ...e, attendance: { ...e.attendance, [day]: status } }
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

  const bulkMark = () => {
    if (!bulkDay) return
    startTransition(async () => {
      const date = `${year}-${String(month).padStart(2, '0')}-${String(bulkDay).padStart(2, '0')}`
      try {
        const upserts = data.map((e) => ({ employee_id: e.employee_id, date, status: bulkStatus }))
        const { error } = await supabase.from('attendance').upsert(upserts as never, { onConflict: 'employee_id,date' })
        if (error) throw error
        setData((prev) =>
          prev.map((e) => ({ ...e, attendance: { ...e.attendance, [bulkDay]: bulkStatus } }))
        )
        toast.success(`Marked all as ${bulkStatus} on day ${bulkDay}`)
        setBulkDay(null)
      } catch {
        toast.error('Bulk mark failed')
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm font-medium">
          {format(startOfMonth(new Date(year, month - 1)), 'MMMM yyyy')}
        </p>
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-sm text-muted-foreground">Bulk mark day</span>
          <Select onValueChange={(v) => setBulkDay(Number(v))}>
            <SelectTrigger className="w-20"><SelectValue placeholder="Day" /></SelectTrigger>
            <SelectContent>
              {days.map((d) => (
                <SelectItem key={d} value={String(d)}>{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={bulkStatus} onValueChange={(v) => setBulkStatus(v as AttendanceStatus)}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ALL_STATUSES.map((s) => (
                <SelectItem key={s} value={s} className="capitalize">{s.replace('_', ' ')}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={bulkMark} disabled={!bulkDay || isPending}>
            Apply
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="min-w-max text-xs">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="sticky left-0 bg-muted/50 px-3 py-2 text-left font-medium min-w-[160px]">Employee</th>
              {days.map((d) => (
                <th key={d} className="px-2 py-2 text-center font-medium w-8">{d}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((emp) => (
              <tr key={emp.employee_id} className="border-b hover:bg-muted/30">
                <td className="sticky left-0 bg-background px-3 py-1.5 font-medium">{emp.employee_name}</td>
                {days.map((d) => {
                  const status = emp.attendance[d]
                  const isEditing = editCell?.empId === emp.employee_id && editCell?.day === d
                  return (
                    <td key={d} className="px-1 py-1 text-center">
                      {isEditing ? (
                        <Select
                          defaultValue={status}
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
                          onClick={() => setEditCell({ empId: emp.employee_id, day: d })}
                          className={`rounded px-1.5 py-0.5 font-medium transition-opacity hover:opacity-80 ${
                            status ? STATUS_COLORS[status] : 'text-muted-foreground'
                          }`}
                        >
                          {status ? STATUS_LABELS[status] : '—'}
                        </button>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        {ALL_STATUSES.map((s) => (
          <Badge key={s} variant="outline" className={`${STATUS_COLORS[s]} border-0`}>
            {STATUS_LABELS[s]} = {s.replace('_', ' ')}
          </Badge>
        ))}
      </div>
    </div>
  )
}
