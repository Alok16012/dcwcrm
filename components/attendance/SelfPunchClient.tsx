'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { format, parseISO } from 'date-fns'
import { MapPin, Clock, CheckCircle2, LogIn, LogOut, Calendar, AlertCircle } from 'lucide-react'

function calcStatus(clockIn: string, clockOut: string): 'present' | 'half_day' | 'absent' {
  const [ih, im] = clockIn.split(':').map(Number)
  const [oh, om] = clockOut.split(':').map(Number)
  const mins = (oh * 60 + om) - (ih * 60 + im)
  if (mins >= 360) return 'present'
  if (mins > 0) return 'half_day'
  return 'absent'
}

function calcHours(clockIn: string | null, clockOut: string | null): string {
  if (!clockIn || !clockOut) return '—'
  const [ih, im] = clockIn.split(':').map(Number)
  const [oh, om] = clockOut.split(':').map(Number)
  const mins = (oh * 60 + om) - (ih * 60 + im)
  if (mins <= 0) return '0h'
  return mins % 60 > 0 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${Math.floor(mins / 60)}h`
}

interface AttRecord {
  date: string
  status: string
  clock_in: string | null
  clock_out: string | null
  punch_in_lat: number | null
  punch_in_lng: number | null
  punch_out_lat: number | null
  punch_out_lng: number | null
}

interface Props {
  employeeId: string
  employeeName: string
}

const STATUS_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  present:  { bg: 'bg-green-100',  text: 'text-green-700',  label: 'Present' },
  half_day: { bg: 'bg-amber-100',  text: 'text-amber-700',  label: 'Half Day' },
  absent:   { bg: 'bg-red-100',    text: 'text-red-700',    label: 'Absent' },
  leave:    { bg: 'bg-blue-100',   text: 'text-blue-700',   label: 'Leave' },
  holiday:  { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Holiday' },
  late:     { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Late' },
}

export function SelfPunchClient({ employeeId, employeeName }: Props) {
  const supabase = createClient()
  const db = supabase as any

  const today = format(new Date(), 'yyyy-MM-dd')
  const [now, setNow] = useState(new Date())
  const [todayRecord, setTodayRecord] = useState<AttRecord | null>(null)
  const [history, setHistory] = useState<AttRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [punching, setPunching] = useState(false)
  const [gpsError, setGpsError] = useState('')

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const loadData = useCallback(async () => {
    setLoading(true)
    const { data } = await db
      .from('attendance')
      .select('date, status, clock_in, clock_out, punch_in_lat, punch_in_lng, punch_out_lat, punch_out_lng')
      .eq('employee_id', employeeId)
      .order('date', { ascending: false })
      .limit(30)

    const records = (data ?? []) as AttRecord[]
    setTodayRecord(records.find(r => r.date === today) ?? null)
    setHistory(records.filter(r => r.date !== today))
    setLoading(false)
  }, [employeeId, today, db])

  useEffect(() => { loadData() }, [loadData])

  async function getGPS(): Promise<{ lat: number; lng: number } | null> {
    return new Promise(resolve => {
      if (!navigator.geolocation) { resolve(null); return }
      navigator.geolocation.getCurrentPosition(
        pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => { setGpsError('GPS not available — attendance saved without location'); resolve(null) },
        { timeout: 8000, enableHighAccuracy: true }
      )
    })
  }

  async function handlePunchIn() {
    setPunching(true)
    setGpsError('')
    try {
      const time = format(new Date(), 'HH:mm:ss')
      const gps = await getGPS()
      const { error } = await db.from('attendance').upsert({
        employee_id: employeeId,
        date: today,
        status: 'present',
        clock_in: time,
        clock_out: null,
        punch_in_lat: gps?.lat ?? null,
        punch_in_lng: gps?.lng ?? null,
        punch_out_lat: null,
        punch_out_lng: null,
      }, { onConflict: 'employee_id,date' })
      if (error) throw error
      toast.success(`Punched In at ${format(new Date(), 'hh:mm a')}`)
      await loadData()
    } catch (e) {
      const msg = (e as { message?: string })?.message
      toast.error('Failed to punch in' + (msg ? `: ${msg}` : ''))
    } finally {
      setPunching(false)
    }
  }

  async function handlePunchOut() {
    if (!todayRecord) return
    setPunching(true)
    setGpsError('')
    try {
      const time = format(new Date(), 'HH:mm:ss')
      const gps = await getGPS()
      const clockIn = todayRecord.clock_in?.slice(0, 5) ?? ''
      const clockOut = time.slice(0, 5)
      const status = clockIn ? calcStatus(clockIn, clockOut) : 'present'
      const { error } = await db.from('attendance').update({
        clock_out: time,
        status,
        punch_out_lat: gps?.lat ?? null,
        punch_out_lng: gps?.lng ?? null,
      }).eq('employee_id', employeeId).eq('date', today)
      if (error) throw error
      toast.success(`Punched Out at ${format(new Date(), 'hh:mm a')}`)
      await loadData()
    } catch (e) {
      const msg = (e as { message?: string })?.message
      toast.error('Failed to punch out' + (msg ? `: ${msg}` : ''))
    } finally {
      setPunching(false)
    }
  }

  const hasPunchedIn  = !!todayRecord?.clock_in
  const hasPunchedOut = !!todayRecord?.clock_out
  const workedHours   = calcHours(todayRecord?.clock_in?.slice(0, 5) ?? null, todayRecord?.clock_out?.slice(0, 5) ?? null)

  return (
    <div className="max-w-md mx-auto space-y-4">

      {/* Live Clock Card */}
      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-6 text-white text-center shadow-lg">
        <p className="text-sm font-medium text-blue-200">{format(now, 'EEEE, dd MMMM yyyy')}</p>
        <p className="text-5xl font-bold tracking-tight mt-1 tabular-nums">{format(now, 'hh:mm')}<span className="text-2xl text-blue-300 ml-1">{format(now, 'ss')}</span></p>
        <p className="text-blue-200 text-sm mt-1">{format(now, 'a')}</p>
        <p className="mt-3 text-blue-100 font-medium text-sm">{employeeName}</p>
      </div>

      {/* Today's Status Card */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-gray-800">Today's Attendance</h2>
          {todayRecord?.status && (() => {
            const s = STATUS_STYLE[todayRecord.status] ?? STATUS_STYLE.present
            return <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${s.bg} ${s.text}`}>{s.label}</span>
          })()}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Punch In time */}
          <div className={`rounded-xl p-3 text-center border ${hasPunchedIn ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-100'}`}>
            <LogIn className={`w-4 h-4 mx-auto mb-1 ${hasPunchedIn ? 'text-green-600' : 'text-gray-300'}`} />
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Punch In</p>
            <p className={`text-base font-bold mt-0.5 ${hasPunchedIn ? 'text-green-700' : 'text-gray-300'}`}>
              {hasPunchedIn ? format(new Date(`2000-01-01T${todayRecord!.clock_in!}`), 'hh:mm a') : '—'}
            </p>
            {todayRecord?.punch_in_lat && (
              <p className="text-[10px] text-green-500 flex items-center justify-center gap-0.5 mt-0.5">
                <MapPin className="w-2.5 h-2.5" /> GPS
              </p>
            )}
          </div>

          {/* Punch Out time */}
          <div className={`rounded-xl p-3 text-center border ${hasPunchedOut ? 'bg-orange-50 border-orange-200' : 'bg-gray-50 border-gray-100'}`}>
            <LogOut className={`w-4 h-4 mx-auto mb-1 ${hasPunchedOut ? 'text-orange-600' : 'text-gray-300'}`} />
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Punch Out</p>
            <p className={`text-base font-bold mt-0.5 ${hasPunchedOut ? 'text-orange-700' : 'text-gray-300'}`}>
              {hasPunchedOut ? format(new Date(`2000-01-01T${todayRecord!.clock_out!}`), 'hh:mm a') : '—'}
            </p>
            {todayRecord?.punch_out_lat && (
              <p className="text-[10px] text-orange-500 flex items-center justify-center gap-0.5 mt-0.5">
                <MapPin className="w-2.5 h-2.5" /> GPS
              </p>
            )}
          </div>
        </div>

        {/* Hours worked */}
        {hasPunchedIn && (
          <div className="flex items-center justify-center gap-2 bg-gray-50 rounded-xl py-2.5">
            <Clock className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-semibold text-gray-700">
              {hasPunchedOut ? `${workedHours} worked` : `Clocked in — ${calcHours(todayRecord?.clock_in?.slice(0, 5) ?? null, format(now, 'HH:mm'))} so far`}
            </span>
          </div>
        )}

        {gpsError && (
          <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            {gpsError}
          </div>
        )}

        {/* Action button */}
        {loading ? (
          <div className="h-14 flex items-center justify-center">
            <div className="w-6 h-6 border-4 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
          </div>
        ) : !hasPunchedIn ? (
          <button
            onClick={handlePunchIn}
            disabled={punching}
            className="w-full h-14 rounded-xl bg-green-600 hover:bg-green-700 active:scale-95 transition-all text-white font-bold text-lg shadow-md flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <LogIn className="w-5 h-5" />
            {punching ? 'Capturing location…' : 'Punch In'}
          </button>
        ) : !hasPunchedOut ? (
          <button
            onClick={handlePunchOut}
            disabled={punching}
            className="w-full h-14 rounded-xl bg-orange-500 hover:bg-orange-600 active:scale-95 transition-all text-white font-bold text-lg shadow-md flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <LogOut className="w-5 h-5" />
            {punching ? 'Capturing location…' : 'Punch Out'}
          </button>
        ) : (
          <div className="w-full h-14 rounded-xl bg-gray-100 flex items-center justify-center gap-2 text-gray-500 font-semibold">
            <CheckCircle2 className="w-5 h-5 text-green-500" />
            Done for today!
          </div>
        )}
      </div>

      {/* This month history */}
      {history.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="w-4 h-4 text-gray-400" />
            <h3 className="font-bold text-gray-800 text-sm">Recent Attendance</h3>
          </div>
          <div className="space-y-2">
            {history.slice(0, 14).map(r => {
              const s = STATUS_STYLE[r.status] ?? STATUS_STYLE.absent
              return (
                <div key={r.date} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{format(parseISO(r.date), 'EEE, dd MMM')}</p>
                    <p className="text-[11px] text-gray-400">
                      {r.clock_in ? format(new Date(`2000-01-01T${r.clock_in}`), 'hh:mm a') : '—'}
                      {' → '}
                      {r.clock_out ? format(new Date(`2000-01-01T${r.clock_out}`), 'hh:mm a') : '—'}
                      {r.clock_in && r.clock_out && ` · ${calcHours(r.clock_in.slice(0,5), r.clock_out.slice(0,5))}`}
                    </p>
                  </div>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${s.bg} ${s.text}`}>{s.label}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
