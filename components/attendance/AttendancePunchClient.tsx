'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Clock, Save } from 'lucide-react'

interface EmployeeRow {
  employee_id: string
  employee_name: string
  punch_in: string | null
  punch_out: string | null
  status: 'present' | 'half_day' | 'absent' | null
}

interface Props {
  date: string
  employees: EmployeeRow[]
}

// 6+ hours → Present, >0 < 6hrs → Half Day, else → Absent
function calcStatus(punchIn: string, punchOut: string): 'present' | 'half_day' | 'absent' {
  if (!punchIn || !punchOut) return 'absent'
  const [ih, im] = punchIn.split(':').map(Number)
  const [oh, om] = punchOut.split(':').map(Number)
  const worked = (oh * 60 + om) - (ih * 60 + im)
  if (worked >= 360) return 'present'   // 6 hrs = 360 min
  if (worked > 0) return 'half_day'
  return 'absent'
}

function calcHours(punchIn: string | null, punchOut: string | null): string {
  if (!punchIn || !punchOut) return '—'
  const [ih, im] = punchIn.split(':').map(Number)
  const [oh, om] = punchOut.split(':').map(Number)
  const worked = (oh * 60 + om) - (ih * 60 + im)
  if (worked <= 0) return '0h'
  const h = Math.floor(worked / 60)
  const m = worked % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

const STATUS_BADGE: Record<'present' | 'half_day' | 'absent', { label: string; cls: string }> = {
  present:  { label: 'Present',  cls: 'bg-green-100 text-green-800 border-0' },
  half_day: { label: 'Half Day', cls: 'bg-yellow-100 text-yellow-800 border-0' },
  absent:   { label: 'Absent',   cls: 'bg-red-100 text-red-800 border-0' },
}

export function AttendancePunchClient({ date: initialDate, employees }: Props) {
  const [date, setDate]   = useState(initialDate)
  const [rows, setRows]   = useState<EmployeeRow[]>(employees)
  const [saving, setSaving] = useState<string | null>(null)
  const supabase = createClient()

  // Reload rows when date changes
  async function loadDate(newDate: string) {
    setDate(newDate)
    const { data } = await supabase
      .from('attendance')
      .select('employee_id, status, clock_in, clock_out')
      .eq('date', newDate)

    const attMap: Record<string, { status: string; clock_in: string | null; clock_out: string | null }> = {}
    for (const a of (data ?? []) as { employee_id: string; status: string; clock_in: string | null; clock_out: string | null }[]) {
      attMap[a.employee_id] = a
    }

    setRows(prev => prev.map(r => {
      const att = attMap[r.employee_id]
      return {
        ...r,
        punch_in:  att?.clock_in  ? att.clock_in.slice(0, 5)  : null,
        punch_out: att?.clock_out ? att.clock_out.slice(0, 5) : null,
        status:    att ? (att.status as EmployeeRow['status']) : null,
      }
    }))
  }

  function updateRow(empId: string, field: 'punch_in' | 'punch_out', value: string) {
    setRows(prev => prev.map(r => {
      if (r.employee_id !== empId) return r
      const updated = { ...r, [field]: value || null }
      updated.status = (updated.punch_in && updated.punch_out)
        ? calcStatus(updated.punch_in, updated.punch_out)
        : null
      return updated
    }))
  }

  async function saveRow(empId: string) {
    const row = rows.find(r => r.employee_id === empId)
    if (!row) return
    setSaving(empId)
    try {
      const status = (row.punch_in && row.punch_out) ? calcStatus(row.punch_in, row.punch_out) : 'absent'
      const { error } = await supabase.from('attendance').upsert({
        employee_id: empId,
        date,
        status,
        clock_in:  row.punch_in  ? `${row.punch_in}:00`  : null,
        clock_out: row.punch_out ? `${row.punch_out}:00` : null,
      } as never, { onConflict: 'employee_id,date' })
      if (error) throw error
      setRows(prev => prev.map(r => r.employee_id === empId ? { ...r, status } : r))
      toast.success(`Saved — ${row.employee_name}`)
    } catch {
      toast.error('Failed to save')
    } finally {
      setSaving(null)
    }
  }

  async function saveAll() {
    setSaving('__all__')
    try {
      const upserts = rows.map(r => ({
        employee_id: r.employee_id,
        date,
        status: (r.punch_in && r.punch_out) ? calcStatus(r.punch_in, r.punch_out) : 'absent',
        clock_in:  r.punch_in  ? `${r.punch_in}:00`  : null,
        clock_out: r.punch_out ? `${r.punch_out}:00` : null,
      }))
      const { error } = await supabase.from('attendance').upsert(upserts as never, { onConflict: 'employee_id,date' })
      if (error) throw error
      setRows(prev => prev.map(r => ({
        ...r,
        status: (r.punch_in && r.punch_out) ? calcStatus(r.punch_in, r.punch_out) : 'absent',
      })))
      toast.success(`All ${rows.length} employees saved`)
    } catch {
      toast.error('Failed to save all')
    } finally {
      setSaving(null)
    }
  }

  const presentCount  = rows.filter(r => r.status === 'present').length
  const halfCount     = rows.filter(r => r.status === 'half_day').length
  const absentCount   = rows.filter(r => !r.status || r.status === 'absent').length

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="date"
          value={date}
          max={format(new Date(), 'yyyy-MM-dd')}
          onChange={e => e.target.value && loadDate(e.target.value)}
          className="h-9 px-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
        <Button size="sm" onClick={saveAll} disabled={saving === '__all__'} className="ml-auto">
          <Save className="w-4 h-4 mr-1.5" />
          {saving === '__all__' ? 'Saving...' : 'Save All'}
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total',     value: rows.length,  bg: 'bg-white',             text: 'text-gray-800' },
          { label: 'Present',   value: presentCount, bg: 'bg-green-50 border-green-100',  text: 'text-green-700' },
          { label: 'Half Day',  value: halfCount,    bg: 'bg-yellow-50 border-yellow-100', text: 'text-yellow-700' },
          { label: 'Absent',    value: absentCount,  bg: 'bg-red-50 border-red-100',    text: 'text-red-700' },
        ].map(c => (
          <div key={c.label} className={`${c.bg} border rounded-xl p-4 text-center`}>
            <div className={`text-2xl font-bold ${c.text}`}>{c.value}</div>
            <div className="text-xs text-gray-500 mt-1">{c.label}</div>
          </div>
        ))}
      </div>

      {/* Rule info */}
      <div className="flex items-center gap-2 text-xs text-gray-600 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
        <Clock className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
        <span>
          Working window: <strong>11:00 AM – 6:00 PM</strong> (7 hrs total) &nbsp;|&nbsp;
          <strong className="text-green-700">6+ hrs</strong> = Full Day &nbsp;|&nbsp;
          <strong className="text-yellow-700">&lt;6 hrs</strong> = Half Day &nbsp;|&nbsp;
          <strong className="text-red-700">No punch</strong> = Absent
        </span>
      </div>

      {/* Attendance table */}
      <div className="rounded-md border bg-white overflow-x-auto">
        <table className="text-sm" style={{ width: 'max-content', minWidth: '100%' }}>
          <thead>
            <tr className="border-b bg-gray-50 text-gray-700">
              <th className="px-4 py-3 text-left font-semibold min-w-[200px]">Employee</th>
              <th className="px-4 py-3 text-center font-semibold min-w-[150px]">Punch In</th>
              <th className="px-4 py-3 text-center font-semibold min-w-[150px]">Punch Out</th>
              <th className="px-4 py-3 text-center font-semibold min-w-[100px]">Hours</th>
              <th className="px-4 py-3 text-center font-semibold min-w-[130px]">Status</th>
              <th className="px-4 py-3 text-center font-semibold min-w-[80px]">Save</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => {
              const hours  = calcHours(row.punch_in, row.punch_out)
              const status = (row.punch_in && row.punch_out)
                ? calcStatus(row.punch_in, row.punch_out)
                : (row.status ?? 'absent')
              const badge  = STATUS_BADGE[status]

              return (
                <tr key={row.employee_id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{row.employee_name}</td>

                  <td className="px-4 py-3 text-center">
                    <input
                      type="time"
                      value={row.punch_in ?? ''}
                      min="11:00"
                      max="18:00"
                      onChange={e => updateRow(row.employee_id, 'punch_in', e.target.value)}
                      className="h-8 px-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 w-28"
                    />
                  </td>

                  <td className="px-4 py-3 text-center">
                    <input
                      type="time"
                      value={row.punch_out ?? ''}
                      min="11:00"
                      max="18:00"
                      onChange={e => updateRow(row.employee_id, 'punch_out', e.target.value)}
                      className="h-8 px-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 w-28"
                    />
                  </td>

                  <td className="px-4 py-3 text-center">
                    <span className={`font-medium ${hours === '—' ? 'text-gray-400' : 'text-gray-800'}`}>
                      {hours}
                    </span>
                  </td>

                  <td className="px-4 py-3 text-center">
                    <Badge className={badge.cls}>{badge.label}</Badge>
                  </td>

                  <td className="px-4 py-3 text-center">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => saveRow(row.employee_id)}
                      disabled={saving === row.employee_id}
                      className="h-7 text-xs px-3"
                    >
                      {saving === row.employee_id ? '...' : 'Save'}
                    </Button>
                  </td>
                </tr>
              )
            })}

            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-gray-400 text-sm">
                  No active employees found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
