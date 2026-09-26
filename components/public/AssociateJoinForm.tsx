'use client'
import { withBase } from '@/lib/base-path'
import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { UserPlus, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const INDIA_STATES = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat',
  'Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh',
  'Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab',
  'Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh',
  'Uttarakhand','West Bengal','Andaman and Nicobar Islands','Chandigarh',
  'Dadra & Nagar Haveli and Daman & Diu','Delhi','Jammu and Kashmir',
  'Ladakh','Lakshadweep','Puducherry',
]

const EMPTY = {
  name: '', phone: '', email: '', father_name: '',
  aadhar_number: '', pan_number: '',
  state: '', district: '', city: '', pincode: '',
  institution_name: '', institution_address: '',
  account_holder_name: '', bank_name: '', account_number: '', ifsc_code: '',
  coordinator_id: '',
}

const selectCls = 'w-full border rounded-md px-3 h-10 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500'

export default function AssociateJoinForm() {
  const [form, setForm] = useState(EMPTY)
  const [hp, setHp] = useState('')
  const [coordinators, setCoordinators] = useState<{ id: string; full_name: string }[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    fetch(withBase('/api/public/associate-apply'))
      .then(r => r.json())
      .then(d => setCoordinators(d.coordinators ?? []))
      .catch(() => { /* the field stays empty and the API re-validates anyway */ })
  }, [])

  const set = (k: keyof typeof EMPTY, v: string) => setForm(p => ({ ...p, [k]: v }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const res = await fetch(withBase('/api/public/associate-apply'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, hp }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Something went wrong'); return }
      setSubmitted(true)
    } catch {
      toast.error('Network error — please try again')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-8 pb-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">✓</span>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Application submitted</h2>
            <p className="text-sm text-gray-600">
              Thank you, {form.name.split(' ')[0] || 'friend'}. Your application has gone to
              {' '}<span className="font-semibold">{coordinators.find(c => c.id === form.coordinator_id)?.full_name ?? 'your coordinator'}</span>{' '}
              at Distance Courses Wala. They will contact you on {form.phone} after review.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 py-8 px-4">
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader className="text-center border-b">
          <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-2">
            <UserPlus className="w-6 h-6 text-white" />
          </div>
          <CardTitle className="text-xl">Become an Associate</CardTitle>
          <p className="text-sm text-gray-500">
            Distance Courses Wala — fill this form and your coordinator will take it forward
          </p>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Honeypot */}
            <input type="text" value={hp} onChange={e => setHp(e.target.value)} tabIndex={-1}
              autoComplete="off" className="hidden" aria-hidden="true" />

            <Section title="Your Details">
              <F label="Full Name *"><Input required placeholder="Ramesh Kumar" value={form.name} onChange={e => set('name', e.target.value)} /></F>
              <F label="Mobile Number *">
                <Input required inputMode="tel" maxLength={10} placeholder="98XXXXXXXX" value={form.phone}
                  onChange={e => set('phone', e.target.value.replace(/\D/g, ''))} />
              </F>
              <F label="Email *"><Input required type="email" placeholder="you@example.com" value={form.email} onChange={e => set('email', e.target.value)} /></F>
              <F label="Father's Name"><Input placeholder="e.g. Suresh Kumar" value={form.father_name} onChange={e => set('father_name', e.target.value)} /></F>
              <F label="Aadhaar Number"><Input inputMode="numeric" placeholder="XXXX XXXX XXXX" value={form.aadhar_number} onChange={e => set('aadhar_number', e.target.value)} /></F>
              <F label="PAN Number"><Input placeholder="ABCDE1234F" className="uppercase" value={form.pan_number} onChange={e => set('pan_number', e.target.value)} /></F>
            </Section>

            <Section title="Address">
              <F label="State">
                <select className={selectCls} value={form.state} onChange={e => set('state', e.target.value)}>
                  <option value="">Select state…</option>
                  {INDIA_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </F>
              <F label="District"><Input placeholder="e.g. Patna" value={form.district} onChange={e => set('district', e.target.value)} /></F>
              <F label="City"><Input placeholder="e.g. Patna" value={form.city} onChange={e => set('city', e.target.value)} /></F>
              <F label="Pincode">
                <Input inputMode="numeric" maxLength={6} placeholder="800020" value={form.pincode}
                  onChange={e => set('pincode', e.target.value.replace(/\D/g, ''))} />
              </F>
            </Section>

            <Section title="Institution">
              <F label="Institution Name" full><Input placeholder="e.g. ABC College" value={form.institution_name} onChange={e => set('institution_name', e.target.value)} /></F>
              <F label="Institution Address" full>
                <Textarea rows={3} className="resize-y" placeholder="Building / Street, Area, Landmark, City"
                  value={form.institution_address} onChange={e => set('institution_address', e.target.value)} />
              </F>
            </Section>

            <Section title="Bank Details">
              <F label="Account Holder Name"><Input placeholder="As per bank records" value={form.account_holder_name} onChange={e => set('account_holder_name', e.target.value)} /></F>
              <F label="Bank Name"><Input placeholder="State Bank of India" value={form.bank_name} onChange={e => set('bank_name', e.target.value)} /></F>
              <F label="Account Number"><Input inputMode="numeric" value={form.account_number} onChange={e => set('account_number', e.target.value)} /></F>
              <F label="IFSC Code"><Input className="uppercase" placeholder="SBIN0001234" value={form.ifsc_code} onChange={e => set('ifsc_code', e.target.value)} /></F>
            </Section>

            <Section title="Your Coordinator">
              <F label="Who is your coordinator at DCW? *" full>
                <select required className={selectCls} value={form.coordinator_id} onChange={e => set('coordinator_id', e.target.value)}>
                  <option value="">Select coordinator…</option>
                  {coordinators.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                </select>
              </F>
            </Section>

            <p className="text-xs text-gray-500 bg-slate-50 rounded-lg p-3">
              Your application goes to the coordinator you pick. Documents (Aadhaar, PAN, cancelled cheque
              and photo) can be shared with them after approval.
            </p>

            <Button type="submit" className="w-full h-11" disabled={submitting}>
              {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting…</> : 'Submit Application'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-bold uppercase tracking-wide text-blue-700">{title}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>
    </div>
  )
}

function F({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={`space-y-1.5 ${full ? 'sm:col-span-2' : ''}`}>
      <Label className="text-xs font-medium text-slate-600">{label}</Label>
      {children}
    </div>
  )
}
