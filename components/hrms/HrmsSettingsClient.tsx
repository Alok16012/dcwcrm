'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Clock, CalendarDays, Banknote, Save, Loader2, Info } from 'lucide-react'

// Every rule the attendance engine and payroll use. Nothing here is hard-coded
// in the app — this row is the source of truth (requirement doc §4, §31).

type Settings = Record<string, any>

const inputCls = 'w-full border border-gray-200 rounded-lg px-3 h-10 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500'

const WEEK_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export default function HrmsSettingsClient({ initial, exists }: { initial: Settings; exists: boolean }) {
  const supabase = createClient()
  const db = supabase as any
  const [form, setForm] = useState<Settings>({ ...initial })
  const [saving, setSaving] = useState(false)

  const set = (k: string, v: string | number | boolean) => setForm(p => ({ ...p, [k]: v }))
  const time = (k: string, d: string) => String(form[k] ?? d).slice(0, 5)

  async function save() {
    // Times must run forward: start → grace → late → half day
    const order = ['office_start', 'grace_till', 'late_till', 'half_day_till']
    for (let i = 1; i < order.length; i++) {
      if (time(order[i], '') <= time(order[i - 1], '')) {
        toast.error('Grace, late and half-day times must come one after another')
        return
      }
    }
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const payload = {
      id: true,
      working_days: Number(form.working_days) || 26,
      weekly_off_day: Number(form.weekly_off_day) || 0,
      office_start: time('office_start', '10:30'),
      office_end: time('office_end', '18:00'),
      grace_till: time('grace_till', '10:45'),
      late_till: time('late_till', '11:30'),
      half_day_till: time('half_day_till', '12:30'),
      early_leaving_grace_min: Number(form.early_leaving_grace_min) || 0,
      min_full_day_minutes: Number(form.min_full_day_minutes) || 360,
      cl_per_month: Number(form.cl_per_month) || 0,
      sl_per_month: Number(form.sl_per_month) || 0,
      leave_carry_forward: !!form.leave_carry_forward,
      max_carry_forward: form.max_carry_forward === '' || form.max_carry_forward == null ? null : Number(form.max_carry_forward),
      salary_divisor: Number(form.salary_divisor) || 26,
      half_day_factor: Number(form.half_day_factor) || 0.5,
      late_deduction_amount: Number(form.late_deduction_amount) || 0,
      salary_advance_enabled: !!form.salary_advance_enabled,
      updated_by: user?.id ?? null,
      updated_at: new Date().toISOString(),
    }
    const { error } = exists
      ? await db.from('hrms_settings').update(payload).eq('id', true)
      : await db.from('hrms_settings').insert(payload)
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success('Settings saved — new punches use these rules')
  }

  const perDay = Number(form.salary_divisor) > 0 ? 13000 / Number(form.salary_divisor) : 0

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900">HRMS Settings</h1>
          <p className="text-sm text-gray-500 mt-0.5">Attendance, leave and payroll rules — used by every calculation</p>
        </div>
        <Button onClick={save} disabled={saving} className="gap-1.5">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Settings
        </Button>
      </div>

      <Section title="Attendance & Shift" icon={Clock}>
        <Field label="Office Start"><input type="time" value={time('office_start', '10:30')} onChange={e => set('office_start', e.target.value)} className={inputCls} /></Field>
        <Field label="Grace Till" hint="On time, no deduction"><input type="time" value={time('grace_till', '10:45')} onChange={e => set('grace_till', e.target.value)} className={inputCls} /></Field>
        <Field label="Late Till" hint="After grace, late deduction"><input type="time" value={time('late_till', '11:30')} onChange={e => set('late_till', e.target.value)} className={inputCls} /></Field>
        <Field label="Half Day Till" hint="After this, absent"><input type="time" value={time('half_day_till', '12:30')} onChange={e => set('half_day_till', e.target.value)} className={inputCls} /></Field>
        <Field label="Office End"><input type="time" value={time('office_end', '18:00')} onChange={e => set('office_end', e.target.value)} className={inputCls} /></Field>
        <Field label="Early Leaving Grace (min)"><input type="number" min="0" value={form.early_leaving_grace_min ?? 0} onChange={e => set('early_leaving_grace_min', e.target.value)} className={inputCls} /></Field>
        <Field label="Weekly Off">
          <select value={form.weekly_off_day ?? 0} onChange={e => set('weekly_off_day', Number(e.target.value))} className={inputCls}>
            {WEEK_DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
          </select>
        </Field>
        <Field label="Working Days / Month"><input type="number" min="1" max="31" value={form.working_days ?? 26} onChange={e => set('working_days', e.target.value)} className={inputCls} /></Field>
      </Section>

      <div className="flex items-start gap-2 text-xs text-blue-800 bg-blue-50 border border-blue-100 rounded-xl p-3">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <p>
          Punch in till <b>{time('grace_till', '10:45')}</b> counts as present ·{' '}
          till <b>{time('late_till', '11:30')}</b> late · till <b>{time('half_day_till', '12:30')}</b> half day ·
          after that absent. {WEEK_DAYS[Number(form.weekly_off_day) || 0]} is the weekly off.
        </p>
      </div>

      <Section title="Leave" icon={CalendarDays}>
        <Field label="Casual Leave / Month"><input type="number" step="0.5" min="0" value={form.cl_per_month ?? 1} onChange={e => set('cl_per_month', e.target.value)} className={inputCls} /></Field>
        <Field label="Sick Leave / Month"><input type="number" step="0.5" min="0" value={form.sl_per_month ?? 1} onChange={e => set('sl_per_month', e.target.value)} className={inputCls} /></Field>
        <Field label="Carry Forward">
          <select value={form.leave_carry_forward === false ? 'no' : 'yes'} onChange={e => set('leave_carry_forward', e.target.value === 'yes')} className={inputCls}>
            <option value="yes">Yes — unused leave carries over</option>
            <option value="no">No — lapses each month</option>
          </select>
        </Field>
        <Field label="Max Carry Forward" hint="Blank = no limit">
          <input type="number" step="0.5" min="0" value={form.max_carry_forward ?? ''} onChange={e => set('max_carry_forward', e.target.value)} className={inputCls} />
        </Field>
      </Section>

      <Section title="Payroll" icon={Banknote}>
        <Field label="Salary Divisor" hint="Monthly salary ÷ this = per day"><input type="number" min="1" max="31" value={form.salary_divisor ?? 26} onChange={e => set('salary_divisor', e.target.value)} className={inputCls} /></Field>
        <Field label="Half Day Factor" hint="0.5 = half day's pay cut"><input type="number" step="0.1" min="0" max="1" value={form.half_day_factor ?? 0.5} onChange={e => set('half_day_factor', e.target.value)} className={inputCls} /></Field>
        <Field label="Late Deduction (₹)" hint="Per late occurrence"><input type="number" min="0" value={form.late_deduction_amount ?? 0} onChange={e => set('late_deduction_amount', e.target.value)} className={inputCls} /></Field>
        <Field label="Salary Advance">
          <select value={form.salary_advance_enabled === false ? 'no' : 'yes'} onChange={e => set('salary_advance_enabled', e.target.value === 'yes')} className={inputCls}>
            <option value="yes">Enabled</option>
            <option value="no">Disabled</option>
          </select>
        </Field>
        <div className="sm:col-span-2 lg:col-span-4 text-xs text-gray-500 bg-gray-50 border rounded-xl p-3">
          Example on ₹13,000 salary: per day <b>₹{perDay.toFixed(0)}</b> · half day cut{' '}
          <b>₹{(perDay * (Number(form.half_day_factor) || 0.5)).toFixed(0)}</b> · absent / LWP cut <b>₹{perDay.toFixed(0)}</b> ·
          each late <b>₹{Number(form.late_deduction_amount) || 0}</b>
        </div>
      </Section>
    </div>
  )
}

function Section({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <div className="bg-white border rounded-2xl p-4 space-y-3">
      <p className="text-xs font-bold uppercase tracking-wide text-blue-700 flex items-center gap-1.5">
        <Icon className="w-3.5 h-3.5" /> {title}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">{children}</div>
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-semibold text-slate-600">{label}</Label>
      {children}
      {hint && <p className="text-[10px] text-gray-400">{hint}</p>}
    </div>
  )
}
