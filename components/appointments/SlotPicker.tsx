'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { generateDaySlots, isWorkingDay } from '@/lib/appointments/constants'
import { cn } from '@/lib/utils'

interface SlotPickerProps {
  hostId: string | null
  date: string
  value?: string | null
  onChange?: (time: string) => void
  readOnly?: boolean
  /** Bump this to force a refetch — e.g. after a booking attempt collides. */
  refreshKey?: number
  /** The appointment being edited, so its own current slot doesn't show as booked. */
  excludeId?: string
}

export function SlotPicker({ hostId, date, value, onChange, readOnly, refreshKey, excludeId }: SlotPickerProps) {
  const supabase = createClient()
  const [booked, setBooked] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!hostId || !date) { setBooked(new Set()); return }
    setLoading(true)
    let query = supabase
      .from('appointments')
      .select('scheduled_time')
      .eq('host_id', hostId)
      .eq('scheduled_date', date)
      .neq('status', 'cancelled')
    if (excludeId) query = query.neq('id', excludeId)
    query.then(({ data }) => {
      // Postgres `time` comes back as 'HH:MM:SS' — slots are 'HH:MM'.
      setBooked(new Set(((data ?? []) as { scheduled_time: string }[]).map((r) => r.scheduled_time.slice(0, 5))))
      setLoading(false)
    })
  }, [hostId, date, refreshKey, excludeId]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!hostId) {
    return <p className="text-sm text-gray-400 py-4 text-center">Select a host to see their slots</p>
  }
  if (!date) {
    return <p className="text-sm text-gray-400 py-4 text-center">Pick a date to see slots</p>
  }
  if (!isWorkingDay(new Date(`${date}T00:00:00`))) {
    return <p className="text-sm text-amber-600 py-4 text-center">Office is closed on Sunday — pick another date</p>
  }
  if (loading) {
    return <p className="text-sm text-gray-400 py-4 text-center">Loading slots…</p>
  }

  const slots = generateDaySlots()

  return (
    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
      {slots.map((slot) => {
        const isBooked = booked.has(slot)
        const isSelected = value === slot
        return (
          <button
            key={slot}
            type="button"
            disabled={readOnly || isBooked}
            onClick={() => onChange?.(slot)}
            className={cn(
              'h-11 rounded-lg text-sm font-semibold border transition-colors',
              isBooked
                ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed line-through'
                : isSelected
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-200 hover:border-blue-400 hover:text-blue-700 active:scale-95'
            )}
            title={isBooked ? 'Already booked' : slot}
          >
            {slot}
          </button>
        )
      })}
    </div>
  )
}
