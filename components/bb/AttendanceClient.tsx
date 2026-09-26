'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { format, getDaysInMonth, parseISO, isSunday } from 'date-fns'
import { CalendarCheck, ChevronLeft, ChevronRight } from 'lucide-react'
import { bbClient } from '@/lib/bb/db'

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface AttendanceStaff {
  id: string
  name: string
  employee_code: string
}

export interface AttendanceCell {
  employee_id: string
  date: string
  status: string
}

/** Click order. A cell cycles through these, then back to unmarked. */
const CYCLE = ['present', 'absent', 'half_day', 'leave', 'holiday'] as const

const CELL: Record<string, { letter: string; cls: string; label: string }> = {
  present:  { letter: 'P', cls: 'bg-green-100 text-green-700 hover:bg-green-200', label: 'Present' },
  absent:   { letter: 'A', cls: 'bg-red-100 text-red-700 hover:bg-red-200', label: 'Absent' },
  half_day: { letter: 'H', cls: 'bg-amber-100 text-amber-700 hover:bg-amber-200', label: 'Half day' },
  leave:    { letter: 'L', cls: 'bg-blue-100 text-blue-700 hover:bg-blue-200', label: 'Leave' },
  holiday:  { letter: 'O', cls: 'bg-violet-100 text-violet-700 hover:bg-violet-200', label: 'Holiday' },
  late:     { letter: 'T', cls: 'bg-orange-100 text-orange-700 hover:bg-orange-200', label: 'Late' },
}

export default function AttendanceClient({
  staff, cells, month, year, currentUserId, canEdit,
}: {
  staff: AttendanceStaff[]
  cells: AttendanceCell[]
  month: number
  year: number
  currentUserId: string
  canEdit: boolean
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [busy, setBusy] = useState<string | null>(null)

  // Optimistic overlay so a click feels instant; the refresh reconciles it.
  const [local, setLocal] = useState<Record<string, string>>({})

  const days = getDaysInMonth(new Date(year, month - 1))
  const key = (e: string, d: string) => `${e}|${d}`

  const base = cells.reduce<Record<string, string>>((acc, c) => {
    acc[key(c.employee_id, c.date)] = c.status
    return acc
  }, {})
  const statusAt = (e: string, d: string) => local[key(e, d)] ?? base[key(e, d)] ?? ''

  function move(delta: number) {
    const d = new Date(year, month - 1 + delta, 1)
    startTransition(() =>
      router.push(`/bb/attendance?month=${d.getMonth() + 1}&year=${d.getFullYear()}`)
    )
  }

  async function cycle(employeeId: string, date: string) {
    if (!canEdit) return
    const current = statusAt(employeeId, date)
    const idx = CYCLE.indexOf(current as any)
    const next = idx === -1 ? CYCLE[0] : idx === CYCLE.length - 1 ? '' : CYCLE[idx + 1]

    const k = key(employeeId, date)
    setLocal(l => ({ ...l, [k]: next }))
    setBusy(k)

    try {
      const db = bbClient()
      if (next === '') {
        const { error } = await db.from('bb_attendance').delete()
          .eq('employee_id', employeeId).eq('date', date)
        if (error) throw new Error(error.message)
      } else {
        const { error } = await db.from('bb_attendance').upsert(
          { employee_id: employeeId, date, status: next, marked_by: currentUserId },
          { onConflict: 'employee_id,date' }
        )
        if (error) throw new Error(error.message)
      }
    } catch (e) {
      // Put the cell back where it was rather than leaving a lie on screen.
      setLocal(l => {
        const copy = { ...l }
        delete copy[k]
        return copy
      })
      toast.error(e instanceof Error ? e.message : 'Could not save')
    } finally {
      setBusy(null)
    }
  }

  function summary(employeeId: string) {
    let p = 0, a = 0, h = 0, l = 0
    for (let d = 1; d <= days; d++) {
      const date = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      const s = statusAt(employeeId, date)
      if (s === 'present' || s === 'late') p++
      else if (s === 'absent') a++
      else if (s === 'half_day') h++
      else if (s === 'leave') l++
    }
    return { p, a, h, l }
  }

  if (staff.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center">
        <CalendarCheck className="w-7 h-7 mx-auto text-gray-300" />
        <p className="mt-3 font-semibold text-gray-700">No staff to mark</p>
        <p className="text-sm text-gray-500 mt-1">Add people under Team first.</p>
      </div>
    )
  }

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

        <div className="flex flex-wrap gap-2">
          {Object.entries(CELL).filter(([k]) => k !== 'late').map(([k, v]) => (
            <span key={k} className={`text-[11px] font-bold px-2 py-1 rounded-md ${v.cls.split(' hover')[0]}`}>
              {v.letter} · {v.label}
            </span>
          ))}
        </div>
      </div>

      {canEdit && (
        <p className="text-xs text-gray-500">
          Click a cell to cycle Present → Absent → Half day → Leave → Holiday → clear.
        </p>
      )}

      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50">
                <th className="sticky left-0 z-10 bg-gray-50 px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 min-w-[170px] border-r border-gray-200">
                  Staff
                </th>
                {Array.from({ length: days }, (_, i) => {
                  const d = i + 1
                  const dt = new Date(year, month - 1, d)
                  return (
                    <th
                      key={d}
                      className={`px-0 py-2 text-[11px] font-semibold w-8 ${isSunday(dt) ? 'text-red-500 bg-red-50/50' : 'text-gray-500'}`}
                    >
                      {d}
                    </th>
                  )
                })}
                <th className="px-3 py-2 text-[11px] font-semibold uppercase text-gray-500 border-l border-gray-200 whitespace-nowrap">
                  P / A / H / L
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {staff.map(s => {
                const sum = summary(s.id)
                return (
                  <tr key={s.id} className="hover:bg-gray-50/50">
                    <td className="sticky left-0 z-10 bg-white px-4 py-2 border-r border-gray-200">
                      <p className="font-semibold text-gray-900 text-sm whitespace-nowrap">{s.name}</p>
                      <p className="text-[11px] text-gray-400">{s.employee_code}</p>
                    </td>
                    {Array.from({ length: days }, (_, i) => {
                      const d = i + 1
                      const date = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
                      const status = statusAt(s.id, date)
                      const style = status ? CELL[status] : null
                      const k = key(s.id, date)
                      return (
                        <td key={d} className="p-0.5 text-center">
                          <button
                            onClick={() => cycle(s.id, date)}
                            disabled={!canEdit}
                            title={`${format(parseISO(date), 'dd MMM')} — ${style?.label ?? 'not marked'}`}
                            className={`w-7 h-7 rounded-md text-[11px] font-bold transition-colors ${
                              style ? style.cls : 'bg-gray-50 text-gray-300 hover:bg-gray-100'
                            } ${busy === k ? 'opacity-50' : ''} ${canEdit ? 'cursor-pointer' : 'cursor-default'}`}
                          >
                            {style?.letter ?? '·'}
                          </button>
                        </td>
                      )
                    })}
                    <td className="px-3 py-2 text-xs tabular-nums whitespace-nowrap border-l border-gray-200">
                      <span className="text-green-700 font-bold">{sum.p}</span>
                      <span className="text-gray-300"> / </span>
                      <span className="text-red-600 font-bold">{sum.a}</span>
                      <span className="text-gray-300"> / </span>
                      <span className="text-amber-600 font-bold">{sum.h}</span>
                      <span className="text-gray-300"> / </span>
                      <span className="text-blue-600 font-bold">{sum.l}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
