'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { UserPlus, Upload, FileCheck2, X } from 'lucide-react'

const INDIA_STATES = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat',
  'Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh',
  'Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab',
  'Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh',
  'Uttarakhand','West Bengal',
  'Andaman and Nicobar Islands','Chandigarh','Dadra & Nagar Haveli and Daman & Diu',
  'Delhi','Jammu and Kashmir','Ladakh','Lakshadweep','Puducherry',
]

const EMPTY = {
  name: '', phone: '', father_phone: '', email: '',
  aadhar_number: '', pan_number: '',
  state: '', district: '',
  institution_name: '', institution_address: '',
  current_address: '', current_city: '', current_state: '', current_pincode: '',
  same_as_current: false,
  permanent_address: '', permanent_city: '', permanent_state: '', permanent_pincode: '',
  bank_name: '', account_number: '', ifsc_code: '', account_holder_name: '',
}

const EMPTY_DOCS = { aadhar: null as File | null, pan: null as File | null, cheque: null as File | null }

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  onSuccess?: () => void
}

export function CreateAssociateDialog({ open, onOpenChange, onSuccess }: Props) {
  const supabase = createClient()
  const db = supabase as any
  const [form, setForm] = useState(EMPTY)
  const [docs, setDocs] = useState(EMPTY_DOCS)
  const [submitting, setSubmitting] = useState(false)
  const [coordinator, setCoordinator] = useState<{ id: string; full_name: string } | null>(null)

  useEffect(() => {
    if (!open) return
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data } = await supabase.from('profiles').select('id, full_name').eq('id', user.id).single()
      if (data) setCoordinator(data as any)
    })
  }, [open, supabase])

  function set(field: keyof typeof EMPTY, value: string | boolean) {
    setForm(prev => {
      const next = { ...prev, [field]: value }
      if (field === 'same_as_current' && value === true) {
        next.permanent_address = prev.current_address
        next.permanent_city = prev.current_city
        next.permanent_state = prev.current_state
        next.permanent_pincode = prev.current_pincode
      }
      return next
    })
  }

  async function uploadDoc(file: File, folder: string, name: string): Promise<string | null> {
    const ext = file.name.split('.').pop()
    const path = `${folder}/${name}.${ext}`
    const { error } = await supabase.storage.from('associate-docs').upload(path, file, { upsert: true })
    if (error) { toast.error(`Upload failed: ${error.message}`); return null }
    const { data } = supabase.storage.from('associate-docs').getPublicUrl(path)
    return data.publicUrl
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name || !form.phone || !form.email) { toast.error('Name, phone, email required'); return }
    setSubmitting(true)
    try {
      const folder = crypto.randomUUID()
      const [aadharUrl, panUrl, chequeUrl] = await Promise.all([
        docs.aadhar ? uploadDoc(docs.aadhar, folder, 'aadhar') : Promise.resolve(null),
        docs.pan ? uploadDoc(docs.pan, folder, 'pan') : Promise.resolve(null),
        docs.cheque ? uploadDoc(docs.cheque, folder, 'cheque') : Promise.resolve(null),
      ])

      const payload = {
        ...form,
        permanent_address: form.same_as_current ? form.current_address : form.permanent_address,
        permanent_city: form.same_as_current ? form.current_city : form.permanent_city,
        permanent_state: form.same_as_current ? form.current_state : form.permanent_state,
        permanent_pincode: form.same_as_current ? form.current_pincode : form.permanent_pincode,
        coordinator_id: coordinator?.id ?? null,
        coordinator_name: coordinator?.full_name ?? null,
        aadhar_doc_url: aadharUrl,
        pan_doc_url: panUrl,
        cheque_doc_url: chequeUrl,
      }
      const { error } = await db.from('associates').insert(payload)
      if (error) { toast.error(error.message); return }
      toast.success('Associate application submitted — pending OPS approval')
      setForm(EMPTY)
      setDocs(EMPTY_DOCS)
      onOpenChange(false)
      onSuccess?.()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-blue-600" /> New Associate Application
          </DialogTitle>
        </DialogHeader>

        {coordinator && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5 flex items-center gap-2 text-sm">
            <span className="text-blue-600 font-medium">Coordinator:</span>
            <span className="text-blue-900 font-semibold">{coordinator.full_name}</span>
            <span className="ml-auto text-xs text-blue-400">auto-filled</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5 mt-2">
          {/* Personal */}
          <Sec title="Personal Details">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <F label="Full Name *"><Input placeholder="Ramesh Kumar" value={form.name} onChange={e => set('name', e.target.value)} required /></F>
              <F label="Mobile *"><Input placeholder="98XXXXXXXX" value={form.phone} onChange={e => set('phone', e.target.value)} required /></F>
              <F label="Father's Mobile"><Input placeholder="98XXXXXXXX" value={form.father_phone} onChange={e => set('father_phone', e.target.value)} /></F>
              <F label="Email *"><Input type="email" placeholder="email@example.com" value={form.email} onChange={e => set('email', e.target.value)} required /></F>
              <F label="Aadhaar Number"><Input placeholder="XXXX XXXX XXXX" value={form.aadhar_number} onChange={e => set('aadhar_number', e.target.value)} /></F>
              <F label="PAN Number"><Input placeholder="ABCDE1234F" value={form.pan_number} onChange={e => set('pan_number', e.target.value)} className="uppercase" /></F>
              <F label="State">
                <select value={form.state} onChange={e => set('state', e.target.value)}
                  className="w-full border rounded-md px-3 h-10 text-sm bg-white text-gray-900 focus:ring-2 focus:ring-ring focus:outline-none">
                  <option value="">Select state…</option>
                  {INDIA_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </F>
              <F label="District"><Input placeholder="e.g. Jaipur" value={form.district} onChange={e => set('district', e.target.value)} /></F>
            </div>
          </Sec>

          {/* Institution */}
          <Sec title="Institution Details">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <F label="Institution Name"><Input placeholder="e.g. ABC College" value={form.institution_name} onChange={e => set('institution_name', e.target.value)} /></F>
              <F label="Institution Address"><Input placeholder="Full address of institution" value={form.institution_address} onChange={e => set('institution_address', e.target.value)} /></F>
            </div>
          </Sec>

          {/* Current Address */}
          <Sec title="Current Address">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <F label="Full Address" className="lg:col-span-3"><Input placeholder="House No., Street, Area" value={form.current_address} onChange={e => set('current_address', e.target.value)} /></F>
              <F label="City"><Input placeholder="Jaipur" value={form.current_city} onChange={e => set('current_city', e.target.value)} /></F>
              <F label="State"><Input placeholder="Rajasthan" value={form.current_state} onChange={e => set('current_state', e.target.value)} /></F>
              <F label="Pincode"><Input placeholder="302001" value={form.current_pincode} onChange={e => set('current_pincode', e.target.value)} /></F>
            </div>
          </Sec>

          {/* Permanent Address */}
          <Sec title="Permanent Address">
            <label className="flex items-center gap-2 mb-4 cursor-pointer w-fit">
              <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-blue-600"
                checked={form.same_as_current} onChange={e => set('same_as_current', e.target.checked)} />
              <span className="text-sm font-medium text-slate-700">Same as current address</span>
            </label>
            {!form.same_as_current && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <F label="Full Address" className="lg:col-span-3"><Input placeholder="House No., Street, Area" value={form.permanent_address} onChange={e => set('permanent_address', e.target.value)} /></F>
                <F label="City"><Input placeholder="Delhi" value={form.permanent_city} onChange={e => set('permanent_city', e.target.value)} /></F>
                <F label="State"><Input placeholder="Delhi" value={form.permanent_state} onChange={e => set('permanent_state', e.target.value)} /></F>
                <F label="Pincode"><Input placeholder="110001" value={form.permanent_pincode} onChange={e => set('permanent_pincode', e.target.value)} /></F>
              </div>
            )}
          </Sec>

          {/* Bank */}
          <Sec title="Bank Details">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <F label="Account Holder Name"><Input placeholder="As per bank records" value={form.account_holder_name} onChange={e => set('account_holder_name', e.target.value)} /></F>
              <F label="Bank Name"><Input placeholder="State Bank of India" value={form.bank_name} onChange={e => set('bank_name', e.target.value)} /></F>
              <F label="Account Number"><Input placeholder="XXXXXXXXXXXXXXXXXX" value={form.account_number} onChange={e => set('account_number', e.target.value)} /></F>
              <F label="IFSC Code"><Input placeholder="SBIN0001234" value={form.ifsc_code} onChange={e => set('ifsc_code', e.target.value)} className="uppercase" /></F>
            </div>
          </Sec>

          {/* Documents */}
          <Sec title="Documents">
            <p className="text-xs text-slate-500 -mt-1 mb-1">Upload scanned copies or photos (JPG, PNG, PDF)</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <DocUpload label="Aadhaar Card" file={docs.aadhar}
                onSelect={f => setDocs(d => ({ ...d, aadhar: f }))}
                onClear={() => setDocs(d => ({ ...d, aadhar: null }))} />
              <DocUpload label="PAN Card" file={docs.pan}
                onSelect={f => setDocs(d => ({ ...d, pan: f }))}
                onClear={() => setDocs(d => ({ ...d, pan: null }))} />
              <DocUpload label="Cancelled Cheque" file={docs.cheque}
                onSelect={f => setDocs(d => ({ ...d, cheque: f }))}
                onClear={() => setDocs(d => ({ ...d, cheque: null }))} />
            </div>
          </Sec>

          <div className="flex gap-3 justify-end pt-1">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
            <Button type="submit" disabled={submitting} className="min-w-36">
              {submitting
                ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : 'Submit Application'
              }
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function DocUpload({ label, file, onSelect, onClear }: {
  label: string; file: File | null; onSelect: (f: File) => void; onClear: () => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-slate-600">{label}</Label>
      <input ref={ref} type="file" accept="image/*,application/pdf" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) onSelect(f) }} />
      {file ? (
        <div className="flex items-center gap-2 border border-green-300 bg-green-50 rounded-lg px-3 py-2.5 text-sm">
          <FileCheck2 className="w-4 h-4 text-green-600 flex-shrink-0" />
          <span className="text-green-800 text-xs truncate flex-1">{file.name}</span>
          <button type="button" onClick={onClear} className="text-green-500 hover:text-red-500 transition-colors flex-shrink-0">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => ref.current?.click()}
          className="w-full flex flex-col items-center justify-center gap-1.5 border-2 border-dashed border-slate-300 rounded-lg py-4 text-slate-400 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50 transition-colors">
          <Upload className="w-5 h-5" />
          <span className="text-xs font-medium">Click to upload</span>
        </button>
      )}
    </div>
  )
}

function Sec({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border rounded-xl p-4 space-y-3 bg-slate-50/60">
      <h4 className="text-xs font-semibold text-blue-700 uppercase tracking-wide">{title}</h4>
      {children}
    </div>
  )
}

function F({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1.5 ${className ?? ''}`}>
      <Label className="text-xs font-medium text-slate-600">{label}</Label>
      {children}
    </div>
  )
}
