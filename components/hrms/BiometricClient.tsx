'use client'
import { withBase } from '@/lib/base-path'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import { toast } from 'sonner'
import {
  Fingerprint, ScanFace, CreditCard, KeyRound, Wifi, WifiOff,
  UserPlus, RefreshCw, AlertTriangle, CheckCircle2, Clock,
} from 'lucide-react'

export interface BiometricDevice {
  id: string
  name: string
  model: string | null
  serial_no: string | null
  ip_address: string | null
  location: string | null
  is_active: boolean
  last_seen_at: string | null
  last_event_at: string | null
  agent_version: string | null
}

export interface BiometricPunch {
  id: string
  biometric_user_id: string | null
  card_no: string | null
  card_name: string | null
  employee_id: string | null
  punch_time: string
  punched_at: string
  method: string | null
  direction: string | null
  status: string
  device_serial: string | null
  source: string
}

export interface MappableEmployee {
  id: string
  name: string
  employee_code: string
  department: string | null
  biometric_user_id: string | null
  biometric_card_no: string | null
}

interface UnmappedIdentity {
  userId: string | null
  cardNo: string | null
  name: string | null
  count: number
  lastAt: string
}

interface Props {
  date: string
  devices: BiometricDevice[]
  punches: BiometricPunch[]
  employees: MappableEmployee[]
  employeeNameById: Record<string, string>
  unmapped: UnmappedIdentity[]
}

/** The agent heartbeats every minute; three misses is a dead link. */
const OFFLINE_AFTER_MS = 3 * 60 * 1000

function methodIcon(method: string | null) {
  if (!method) return Clock
  if (method.startsWith('face')) return ScanFace
  if (method.includes('fingerprint')) return Fingerprint
  if (method.includes('card')) return CreditCard
  if (method.includes('password')) return KeyRound
  return Clock
}

function methodLabel(method: string | null): string {
  if (!method) return '—'
  return method
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' + ')
}

function timeAgo(iso: string | null): string {
  if (!iso) return 'never'
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 60) return `${seconds}s ago`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

export default function BiometricClient({
  date, devices, punches, employees, employeeNameById, unmapped,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)

  async function saveMapping(identity: UnmappedIdentity) {
    const key = identity.userId ?? identity.cardNo ?? ''
    const employeeId = mapping[key]
    if (!employeeId) {
      toast.error('Pick an employee first')
      return
    }
    setSaving(key)
    try {
      const res = await fetch(withBase('/api/biometric/map'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          employee_id: employeeId,
          biometric_user_id: identity.userId,
          biometric_card_no: identity.cardNo,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Mapping failed')

      toast.success(
        json.backfilled > 0
          ? `Mapped — ${json.backfilled} past punch(es) applied across ${json.days} day(s)`
          : 'Mapped'
      )
      startTransition(() => router.refresh())
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Mapping failed')
    } finally {
      setSaving(null)
    }
  }

  const mappedCount = employees.filter(e => e.biometric_user_id || e.biometric_card_no).length
  const successPunches = punches.filter(p => p.status === 'success')

  return (
    <div className="space-y-5">

      {/* ------------------------------------------------------- devices --- */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {devices.length === 0 && (
          <div className="sm:col-span-2 lg:col-span-3 rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center">
            <Fingerprint className="w-6 h-6 mx-auto text-gray-400" />
            <p className="mt-2 font-semibold text-gray-700">No device connected yet</p>
            <p className="text-sm text-gray-500 mt-1">
              Start the bridge agent on the office machine — the controller registers itself here
              on its first heartbeat. See <code className="text-xs bg-white px-1 py-0.5 rounded border">agent/README.md</code>.
            </p>
          </div>
        )}

        {devices.map(d => {
          const online =
            !!d.last_seen_at && Date.now() - new Date(d.last_seen_at).getTime() < OFFLINE_AFTER_MS
          return (
            <div key={d.id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-bold text-gray-900 truncate">{d.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{d.model ?? 'Dahua'}</p>
                </div>
                <span
                  className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full ${
                    online ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}
                >
                  {online ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                  {online ? 'Online' : 'Offline'}
                </span>
              </div>

              <dl className="mt-3 space-y-1 text-xs">
                <div className="flex justify-between gap-2">
                  <dt className="text-gray-400">Serial</dt>
                  <dd className="font-mono text-gray-700 truncate">{d.serial_no ?? '—'}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-gray-400">LAN address</dt>
                  <dd className="font-mono text-gray-700">{d.ip_address ?? '—'}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-gray-400">Last heartbeat</dt>
                  <dd className={online ? 'text-gray-700' : 'text-red-600 font-semibold'}>
                    {timeAgo(d.last_seen_at)}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-gray-400">Last punch</dt>
                  <dd className="text-gray-700">{timeAgo(d.last_event_at)}</dd>
                </div>
              </dl>
            </div>
          )
        })}
      </div>

      {/* --------------------------------------------------------- stats --- */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Punches today', value: successPunches.length, icon: CheckCircle2, tone: 'text-blue-600' },
          { label: 'Staff recognised', value: new Set(successPunches.filter(p => p.employee_id).map(p => p.employee_id)).size, icon: ScanFace, tone: 'text-green-600' },
          { label: 'Enrolled & mapped', value: `${mappedCount}/${employees.length}`, icon: UserPlus, tone: 'text-indigo-600' },
          { label: 'Unknown identities', value: unmapped.length, icon: AlertTriangle, tone: unmapped.length ? 'text-amber-600' : 'text-gray-400' },
        ].map(s => (
          <div key={s.label} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <s.icon className={`w-4 h-4 ${s.tone}`} />
            <p className="text-2xl font-bold text-gray-900 mt-2 tabular-nums">{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* ------------------------------------------------------ unmapped --- */}
      {unmapped.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <h2 className="font-bold text-amber-900">Unknown device identities</h2>
          </div>
          <p className="text-sm text-amber-800 mt-1">
            These User IDs punched today but belong to no employee yet. Map one and its past
            punches are applied to attendance automatically.
          </p>

          <div className="mt-3 space-y-2">
            {unmapped.map(u => {
              const key = u.userId ?? u.cardNo ?? 'anon'
              return (
                <div
                  key={key}
                  className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-xl bg-white border border-amber-200 p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-900 text-sm">
                      {u.name ?? 'Unnamed'}{' '}
                      <span className="font-mono text-xs text-gray-500">
                        (User ID {u.userId ?? '—'}{u.cardNo ? ` · Card ${u.cardNo}` : ''})
                      </span>
                    </p>
                    <p className="text-xs text-gray-500">
                      {u.count} punch{u.count > 1 ? 'es' : ''} · last {timeAgo(u.lastAt)}
                    </p>
                  </div>

                  <select
                    value={mapping[key] ?? ''}
                    onChange={e => setMapping(m => ({ ...m, [key]: e.target.value }))}
                    className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm min-w-[200px]"
                  >
                    <option value="">Select employee…</option>
                    {employees.map(e => (
                      <option key={e.id} value={e.id}>
                        {e.name} ({e.employee_code})
                        {e.biometric_user_id ? ` — already ${e.biometric_user_id}` : ''}
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={() => saveMapping(u)}
                    disabled={saving === key}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-amber-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
                  >
                    <UserPlus className="w-4 h-4" />
                    {saving === key ? 'Mapping…' : 'Map'}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* -------------------------------------------------------- punches --- */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between gap-2 p-4 border-b border-gray-100">
          <div>
            <h2 className="font-bold text-gray-900">Punch log</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {format(parseISO(date), 'EEEE, dd MMMM yyyy')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              defaultValue={date}
              onChange={e =>
                startTransition(() => router.push(`/hrms/biometric?date=${e.target.value}`))
              }
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
            />
            <button
              onClick={() => startTransition(() => router.refresh())}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-600 hover:bg-gray-50"
            >
              <RefreshCw className={`w-4 h-4 ${isPending ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {punches.length === 0 ? (
          <p className="p-8 text-center text-sm text-gray-500">No punches recorded on this date.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-2 font-semibold">Time</th>
                  <th className="px-4 py-2 font-semibold">Employee</th>
                  <th className="px-4 py-2 font-semibold">Device ID</th>
                  <th className="px-4 py-2 font-semibold">Method</th>
                  <th className="px-4 py-2 font-semibold">Result</th>
                  <th className="px-4 py-2 font-semibold">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {punches.map(p => {
                  const Icon = methodIcon(p.method)
                  return (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-semibold text-gray-900 tabular-nums whitespace-nowrap">
                        {format(parseISO(`2000-01-01T${p.punch_time}`), 'hh:mm:ss a')}
                      </td>
                      <td className="px-4 py-2.5">
                        {p.employee_id ? (
                          <span className="text-gray-800">{employeeNameById[p.employee_id] ?? '—'}</span>
                        ) : (
                          <span className="text-amber-600 font-medium">
                            {p.card_name ?? 'Unmapped'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs text-gray-500">
                        {p.biometric_user_id ?? p.card_no ?? '—'}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="inline-flex items-center gap-1.5 text-gray-600">
                          <Icon className="w-3.5 h-3.5 text-gray-400" />
                          {methodLabel(p.method)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                            p.status === 'success'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {p.status === 'success' ? 'Granted' : 'Denied'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-gray-400">{p.source}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
