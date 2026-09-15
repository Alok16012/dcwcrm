'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { UserPlus, Upload, FileCheck2, X, Camera, CheckCircle2, FileDown, Loader2 } from 'lucide-react'
import type { AssociateFormData } from './AssociateApplicationPDF'

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
  name: '', phone: '', father_name: '', email: '',
  aadhar_number: '', pan_number: '',
  state: '', district: '', city: '', pincode: '',
  institution_name: '', institution_address: '',
  bank_name: '', account_number: '', ifsc_code: '', account_holder_name: '',
}

const EMPTY_DOCS = { aadhar: null as File | null, pan: null as File | null, cheque: null as File | null }

// Uploads go to the public student-documents bucket (the old "associate-docs" bucket never existed)
const BUCKET = 'student-documents'

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
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [coordinator, setCoordinator] = useState<{ id: string; full_name: string } | null>(null)
  // After a successful submit the dialog switches to a "download application form" screen
  const [submitted, setSubmitted] = useState<{ data: AssociateFormData; photo: File | null } | null>(null)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    if (!open) return
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data } = await supabase.from('profiles').select('id, full_name').eq('id', user.id).single()
      if (data) setCoordinator(data as any)
    })
  }, [open, supabase])

  useEffect(() => () => { if (photoPreview) URL.revokeObjectURL(photoPreview) }, [photoPreview])

  function set(field: keyof typeof EMPTY, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function pickPhoto(f: File) {
    if (!f.type.startsWith('image/')) { toast.error('Photo must be an image (JPG / PNG)'); return }
    if (f.size > 2 * 1024 * 1024) { toast.error('Photo must be under 2 MB'); return }
    setPhoto(f)
    setPhotoPreview(URL.createObjectURL(f))
  }

  function clearPhoto() {
    setPhoto(null)
    setPhotoPreview(null)
  }

  function resetAll() {
    setForm(EMPTY); setDocs(EMPTY_DOCS); clearPhoto(); setSubmitted(null)
  }

  function handleOpenChange(v: boolean) {
    if (!v && submitted) resetAll()
    onOpenChange(v)
  }

  async function uploadDoc(file: File, folder: string, name: string): Promise<string> {
    const ext = file.name.split('.').pop()
    const path = `associate-docs/${folder}/${name}.${ext}`
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true })
    if (error) throw new Error(`${name} upload failed: ${error.message}`)
    return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name || !form.phone || !form.email) { toast.error('Name, phone, email required'); return }
    if (form.pincode && !/^\d{6}$/.test(form.pincode)) { toast.error('Pincode must be 6 digits'); return }
    setSubmitting(true)
    try {
      const folder = crypto.randomUUID()
      const [aadharUrl, panUrl, chequeUrl, photoUrl] = await Promise.all([
        docs.aadhar ? uploadDoc(docs.aadhar, folder, 'aadhar') : null,
        docs.pan ? uploadDoc(docs.pan, folder, 'pan') : null,
        docs.cheque ? uploadDoc(docs.cheque, folder, 'cheque') : null,
        photo ? uploadDoc(photo, folder, 'photo') : null,
      ])

      const payload = {
        ...form,
        pan_number: form.pan_number.toUpperCase(),
        ifsc_code: form.ifsc_code.toUpperCase(),
        coordinator_id: coordinator?.id ?? null,
        coordinator_name: coordinator?.full_name ?? null,
        aadhar_doc_url: aadharUrl,
        pan_doc_url: panUrl,
        cheque_doc_url: chequeUrl,
        photo_url: photoUrl,
      }
      const { error } = await db.from('associates').insert(payload)
      if (error) { toast.error(error.message); return }
      toast.success('Associate application submitted — pending OPS approval')
      setSubmitted({
        data: { ...payload, status: 'pending', created_at: new Date().toISOString() },
        photo,
      })
      onSuccess?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Submission failed')
    } finally {
      setSubmitting(false)
    }
  }

  async function downloadForm() {
    if (!submitted) return
    setDownloading(true)
    try {
      // react-pdf is browser-only and heavy, so load it on demand
      const { downloadAssociateApplicationPdf } = await import('./AssociateApplicationPDF')
      await downloadAssociateApplicationPdf(submitted.data, submitted.photo)
    } catch {
      toast.error('Could not generate the application form')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-blue-600" /> New Associate Application
          </DialogTitle>
        </DialogHeader>

        {submitted ? (
          <div className="text-center py-8 space-y-4">
            <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto" />
            <div>
              <p className="text-lg font-bold text-gray-900">Application submitted</p>
              <p className="text-sm text-slate-500 mt-1">
                {submitted.data.name}&apos;s application is pending OPS approval. Download the application form to share with them.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <Button onClick={downloadForm} disabled={downloading} className="gap-2 bg-blue-600 hover:bg-blue-700">
                {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
                Download Application Form
              </Button>
              <Button variant="outline" onClick={resetAll}>Add Another</Button>
              <Button variant="ghost" onClick={() => handleOpenChange(false)}>Close</Button>
            </div>
          </div>
        ) : (
          <>
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
                <div className="flex flex-col-reverse sm:flex-row gap-4">
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <F label="Full Name *"><Input placeholder="Ramesh Kumar" value={form.name} onChange={e => set('name', e.target.value)} required /></F>
                    <F label="Mobile *"><Input placeholder="98XXXXXXXX" inputMode="tel" value={form.phone} onChange={e => set('phone', e.target.value)} required /></F>
                    <F label="Father's Name"><Input placeholder="e.g. Suresh Kumar" value={form.father_name} onChange={e => set('father_name', e.target.value)} /></F>
                    <F label="Email *"><Input type="email" placeholder="email@example.com" value={form.email} onChange={e => set('email', e.target.value)} required /></F>
                    <F label="Aadhaar Number"><Input placeholder="XXXX XXXX XXXX" inputMode="numeric" value={form.aadhar_number} onChange={e => set('aadhar_number', e.target.value)} /></F>
                    <F label="PAN Number"><Input placeholder="ABCDE1234F" value={form.pan_number} onChange={e => set('pan_number', e.target.value)} className="uppercase" /></F>
                  </div>
                  <PhotoUpload preview={photoPreview} onSelect={pickPhoto} onClear={clearPhoto} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
                  <F label="State">
                    <select value={form.state} onChange={e => set('state', e.target.value)}
                      className="w-full border rounded-md px-3 h-10 text-sm bg-white text-gray-900 focus:ring-2 focus:ring-ring focus:outline-none">
                      <option value="">Select state…</option>
                      {INDIA_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </F>
                  <F label="District"><Input placeholder="e.g. Patna" value={form.district} onChange={e => set('district', e.target.value)} /></F>
                  <F label="City"><Input placeholder="e.g. Patna" value={form.city} onChange={e => set('city', e.target.value)} /></F>
                  <F label="Pincode"><Input placeholder="800020" inputMode="numeric" maxLength={6} value={form.pincode}
                    onChange={e => set('pincode', e.target.value.replace(/\D/g, ''))} /></F>
                </div>
              </Sec>

              {/* Institution */}
              <Sec title="Institution Details">
                <div className="grid grid-cols-1 gap-4">
                  <F label="Institution Name"><Input placeholder="e.g. ABC College" value={form.institution_name} onChange={e => set('institution_name', e.target.value)} /></F>
                  <F label="Institution Address">
                    <Textarea rows={3} placeholder="Building / Street, Area, Landmark, City" value={form.institution_address}
                      onChange={e => set('institution_address', e.target.value)} className="resize-y" />
                  </F>
                </div>
              </Sec>

              {/* Bank */}
              <Sec title="Bank Details">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <F label="Account Holder Name"><Input placeholder="As per bank records" value={form.account_holder_name} onChange={e => set('account_holder_name', e.target.value)} /></F>
                  <F label="Bank Name"><Input placeholder="State Bank of India" value={form.bank_name} onChange={e => set('bank_name', e.target.value)} /></F>
                  <F label="Account Number"><Input placeholder="XXXXXXXXXXXXXXXXXX" inputMode="numeric" value={form.account_number} onChange={e => set('account_number', e.target.value)} /></F>
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
                <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={submitting}>Cancel</Button>
                <Button type="submit" disabled={submitting} className="min-w-36">
                  {submitting
                    ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : 'Submit Application'
                  }
                </Button>
              </div>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

export function PhotoUpload({ preview, onSelect, onClear }: {
  preview: string | null; onSelect: (f: File) => void; onClear: () => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div className="space-y-1.5 shrink-0 self-center sm:self-start">
      <Label className="text-xs font-medium text-slate-600 block text-center">Passport Photo</Label>
      <input ref={ref} type="file" accept="image/png,image/jpeg" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) onSelect(f); e.target.value = '' }} />
      <div className="relative w-28 h-36">
        {preview ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="Passport photo preview" className="w-28 h-36 object-cover rounded-lg border border-slate-300" />
            <button type="button" onClick={onClear} title="Remove photo"
              className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-white border shadow flex items-center justify-center text-slate-500 hover:text-red-600">
              <X className="w-3.5 h-3.5" />
            </button>
          </>
        ) : (
          <button type="button" onClick={() => ref.current?.click()}
            className="w-28 h-36 flex flex-col items-center justify-center gap-1.5 border-2 border-dashed border-slate-300 rounded-lg text-slate-400 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50 transition-colors">
            <Camera className="w-6 h-6" />
            <span className="text-[11px] font-medium leading-tight text-center px-1">Upload photo<br />JPG / PNG</span>
          </button>
        )}
      </div>
    </div>
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
