'use client'
import { useState } from 'react'
import { Phone, MapPin, Mail, CheckCircle2, Loader2, GraduationCap } from 'lucide-react'

export interface PublicFormField {
  key: string
  label: string
  type: 'text' | 'email' | 'phone' | 'number' | 'textarea' | 'select'
  required?: boolean
  options?: string[]
  placeholder?: string
}

export interface PublicForm {
  slug: string
  title: string
  subtitle?: string | null
  fields: PublicFormField[]
  success_message?: string | null
}

const COMPANY = {
  name: 'Distance Courses Wala',
  address: 'K-212, Near SBI ATM, Kankarbagh, Hanuman Nagar, Patna, Bihar – 800020',
  phone: '099395 87009',
  email: 'info@distancecourseswala.in',
}

export function PublicLeadForm({ form, preview = false }: { form: PublicForm; preview?: boolean }) {
  const [values, setValues] = useState<Record<string, string>>({})
  const [hp, setHp] = useState('') // honeypot
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState<string | null>(null)
  const [error, setError] = useState('')

  function setField(key: string, val: string) {
    setValues((p) => ({ ...p, [key]: val }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    // In the admin builder this renders as a live preview — never submit.
    if (preview) return
    setError('')

    // Client-side required check
    for (const f of form.fields) {
      if (f.required && !String(values[f.key] ?? '').trim()) {
        setError(`${f.label} is required`)
        return
      }
    }
    const phoneField = form.fields.find((f) => f.type === 'phone' || f.key === 'phone')
    if (phoneField) {
      const digits = String(values[phoneField.key] ?? '').replace(/\D/g, '')
      if (digits.length < 10) { setError('Please enter a valid 10-digit mobile number'); return }
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/public/lead-form', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: form.slug, values, hp }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Something went wrong, please try again'); return }
      setDone(data.message ?? form.success_message ?? 'Thank you! Our team will contact you shortly.')
    } catch {
      setError('Network error — please try again')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 to-slate-200 flex flex-col items-center px-4 py-6 sm:py-10">
      <div className="w-full max-w-md">
        {/* Brand header */}
        <div className="flex flex-col items-center text-center mb-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand-logo.png" alt={COMPANY.name} className="w-16 h-16 rounded-2xl shadow-md mb-3" />
          <h1 className="text-lg font-extrabold text-slate-900 tracking-tight">{COMPANY.name}</h1>
          <p className="text-xs text-slate-500 mt-0.5">Distance & Regular Education Experts</p>
        </div>

        {done ? (
          /* ── SUCCESS ── */
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-500 to-green-600 py-8 flex flex-col items-center text-white">
              <CheckCircle2 className="w-16 h-16 mb-2" />
              <p className="text-lg font-bold">Done!</p>
            </div>
            <div className="p-6 text-center">
              <p className="text-slate-700 leading-relaxed">{done}</p>
              <a
                href={`tel:${COMPANY.phone.replace(/\s/g, '')}`}
                className="mt-5 inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors"
              >
                <Phone className="w-4 h-4" /> Call Us Now
              </a>
            </div>
          </div>
        ) : (
          /* ── FORM ── */
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl overflow-hidden">
            {/* Form title band */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-5 text-white">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-5 h-5" />
                <h2 className="text-base font-bold leading-tight">{form.title}</h2>
              </div>
              {form.subtitle && <p className="text-blue-100 text-sm mt-1">{form.subtitle}</p>}
            </div>

            <div className="p-5 space-y-4">
              {form.fields.map((f) => (
                <div key={f.key} className="space-y-1.5">
                  <label className="block text-sm font-semibold text-slate-700">
                    {f.label}{f.required && <span className="text-red-500 ml-0.5">*</span>}
                  </label>
                  {f.type === 'textarea' ? (
                    <textarea
                      value={values[f.key] ?? ''}
                      onChange={(e) => setField(f.key, e.target.value)}
                      placeholder={f.placeholder}
                      rows={3}
                      className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-[15px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    />
                  ) : f.type === 'select' ? (
                    <select
                      value={values[f.key] ?? ''}
                      onChange={(e) => setField(f.key, e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-[15px] text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none"
                    >
                      <option value="">Select...</option>
                      {(f.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input
                      type={f.type === 'phone' ? 'tel' : f.type === 'number' ? 'number' : f.type === 'email' ? 'email' : 'text'}
                      inputMode={f.type === 'phone' ? 'numeric' : undefined}
                      value={values[f.key] ?? ''}
                      onChange={(e) => setField(f.key, e.target.value)}
                      placeholder={f.placeholder}
                      className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-[15px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  )}
                </div>
              ))}

              {/* Honeypot — visually hidden, bots fill it */}
              <input
                type="text" tabIndex={-1} autoComplete="off"
                value={hp} onChange={(e) => setHp(e.target.value)}
                className="hidden" aria-hidden="true"
              />

              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 text-[15px]"
              >
                {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</> : 'Submit'}
              </button>
              <p className="text-[11px] text-center text-slate-400">
                Your information is safe. We&apos;ll only contact you about course details.
              </p>
            </div>
          </form>
        )}

        {/* Footer — address / phone / email */}
        <div className="mt-6 text-center space-y-2 pb-4">
          <div className="flex items-start justify-center gap-1.5 text-xs text-slate-500">
            <MapPin className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span className="max-w-xs">{COMPANY.address}</span>
          </div>
          <div className="flex items-center justify-center gap-4 text-xs text-slate-600">
            <a href={`tel:${COMPANY.phone.replace(/\s/g, '')}`} className="flex items-center gap-1 hover:text-blue-600">
              <Phone className="w-3.5 h-3.5" /> {COMPANY.phone}
            </a>
            <a href={`mailto:${COMPANY.email}`} className="flex items-center gap-1 hover:text-blue-600">
              <Mail className="w-3.5 h-3.5" /> {COMPANY.email}
            </a>
          </div>
          <p className="text-[10px] text-slate-400 pt-1">© {new Date().getFullYear()} {COMPANY.name}. All rights reserved.</p>
        </div>
      </div>
    </div>
  )
}
