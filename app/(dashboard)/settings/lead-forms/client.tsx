'use client'
import { useState, useEffect } from 'react'
import {
  Plus, Trash2, Pencil, Copy, ArrowUp, ArrowDown,
  Link2, FileText, Check, X, Eye
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { PageHeader } from '@/components/shared/PageHeader'
import { PublicLeadForm, type PublicForm } from '@/components/public/PublicLeadForm'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

interface FormField {
  key: string
  label: string
  type: 'text' | 'email' | 'phone' | 'number' | 'textarea' | 'select'
  required?: boolean
  options?: string[]
  placeholder?: string
}

interface LeadForm {
  id: string
  slug: string
  title: string
  subtitle: string | null
  fields: FormField[]
  success_message: string | null
  source: string
  is_active: boolean
  submissions_count: number
  created_at: string
}

// "Saves as" → lead column mapping. 'extra' = stored in metadata.
const SAVE_TARGETS = [
  { value: 'full_name', label: 'Name' },
  { value: 'phone', label: 'Phone' },
  { value: 'email', label: 'Email' },
  { value: 'city', label: 'City' },
  { value: 'state', label: 'State' },
  { value: 'extra', label: 'Extra info (notes)' },
]
const RESERVED = new Set(['full_name', 'phone', 'email', 'city', 'state'])

const INPUT_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'phone', label: 'Phone' },
  { value: 'email', label: 'Email' },
  { value: 'number', label: 'Number' },
  { value: 'textarea', label: 'Long text' },
  { value: 'select', label: 'Dropdown' },
]

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

function defaultFields(): FormField[] {
  return [
    { key: 'full_name', label: 'Full Name', type: 'text', required: true, placeholder: 'Your name' },
    { key: 'phone', label: 'Mobile Number', type: 'phone', required: true, placeholder: '10-digit mobile number' },
    { key: 'course', label: 'Which course are you interested in?', type: 'select', required: false, options: ['NIOS 10th', 'NIOS 12th', 'BA', 'B.Com', 'BBA', 'MBA', 'Other'] },
    { key: 'city', label: 'City', type: 'text', required: false, placeholder: 'Your city' },
  ]
}

const DEFAULT_SUCCESS = 'Thank you! Our team will contact you shortly.'

export function LeadFormsClient({ forms: initial }: { forms: LeadForm[] }) {
  const [forms, setForms] = useState<LeadForm[]>(initial)
  const [editing, setEditing] = useState<LeadForm | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<LeadForm | null>(null)
  const [origin, setOrigin] = useState('')
  const supabase = createClient()

  useEffect(() => { setOrigin(window.location.origin) }, [])

  function publicUrl(slug: string) { return `${origin}/f/${slug}` }

  function copyLink(slug: string) {
    navigator.clipboard.writeText(publicUrl(slug))
    toast.success('Link copied! Paste it in your Meta ad')
  }

  async function toggleActive(f: LeadForm) {
    const { error } = await supabase.from('lead_capture_forms')
      .update({ is_active: !f.is_active } as never).eq('id', f.id)
    if (error) { toast.error('Failed'); return }
    setForms((p) => p.map((x) => x.id === f.id ? { ...x, is_active: !x.is_active } : x))
    toast.success(f.is_active ? 'Form turned off' : 'Form is live now')
  }

  async function handleDelete(f: LeadForm) {
    const { error } = await supabase.from('lead_capture_forms').delete().eq('id', f.id)
    if (error) { toast.error('Failed'); return }
    setForms((p) => p.filter((x) => x.id !== f.id))
    setDeleteTarget(null)
    toast.success('Form delete ho gaya')
  }

  function startNew() {
    setEditing({
      id: '', slug: '', title: '', subtitle: '', fields: defaultFields(),
      success_message: DEFAULT_SUCCESS,
      source: 'meta_ads', is_active: true, submissions_count: 0, created_at: '',
    })
  }

  function onSaved(saved: LeadForm) {
    setForms((p) => {
      const exists = p.some((x) => x.id === saved.id)
      return exists ? p.map((x) => x.id === saved.id ? saved : x) : [saved, ...p]
    })
    setEditing(null)
  }

  return (
    <div>
      <PageHeader
        title="Lead Capture Forms"
        description="Create public forms for Meta ads — anyone can fill without login"
        action={<Button size="sm" onClick={startNew}><Plus className="w-4 h-4 mr-1" /> New Form</Button>}
      />

      {forms.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-dashed">
          <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No forms yet</p>
          <p className="text-sm text-gray-400 mt-1">Create your first form and use its link in your Meta ad</p>
          <Button className="mt-4" onClick={startNew}><Plus className="w-4 h-4 mr-1" /> New Form</Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {forms.map((f) => (
            <div key={f.id} className="bg-white border rounded-xl p-4 shadow-sm flex flex-col">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900 truncate">{f.title || 'Untitled'}</h3>
                    <Badge variant={f.is_active ? 'default' : 'outline'} className={f.is_active ? 'bg-green-100 text-green-700 border-0' : 'text-gray-400'}>
                      {f.is_active ? 'Live' : 'Off'}
                    </Badge>
                  </div>
                  {f.subtitle && <p className="text-xs text-gray-500 mt-0.5 truncate">{f.subtitle}</p>}
                </div>
                <Switch checked={f.is_active} onCheckedChange={() => toggleActive(f)} />
              </div>

              <div className="flex items-center gap-2 mt-3 text-xs">
                <span className="text-gray-400">{f.fields.length} fields</span>
                <span className="text-gray-300">·</span>
                <span className="text-blue-600 font-medium">{f.submissions_count} submissions</span>
              </div>

              {/* Public link */}
              <button
                onClick={() => copyLink(f.slug)}
                className="mt-3 flex items-center gap-2 bg-slate-50 hover:bg-slate-100 border rounded-lg px-3 py-2 text-left transition-colors group"
              >
                <Link2 className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                <span className="text-xs text-slate-600 truncate flex-1 font-mono">/f/{f.slug}</span>
                <Copy className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 flex-shrink-0" />
              </button>

              <div className="flex items-center gap-1.5 mt-3 pt-3 border-t">
                <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" onClick={() => setEditing(f)}>
                  <Pencil className="w-3.5 h-3.5 mr-1" /> Edit
                </Button>
                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => window.open(publicUrl(f.slug), '_blank')}>
                  <Eye className="w-3.5 h-3.5" />
                </Button>
                <Button size="sm" variant="ghost" className="h-8 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => setDeleteTarget(f)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <FormBuilder
          form={editing}
          existingSlugs={forms.filter((x) => x.id !== editing.id).map((x) => x.slug)}
          onClose={() => setEditing(null)}
          onSaved={onSaved}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          open
          title="Delete Form"
          description={`Delete "${deleteTarget.title}"? This link will stop working. (Leads already received stay safe.)`}
          confirmLabel="Delete"
          destructive
          onConfirm={() => handleDelete(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}

function FormBuilder({ form, existingSlugs, onClose, onSaved }: {
  form: LeadForm
  existingSlugs: string[]
  onClose: () => void
  onSaved: (f: LeadForm) => void
}) {
  const isNew = !form.id
  const [title, setTitle] = useState(form.title)
  const [slug, setSlug] = useState(form.slug)
  const [slugTouched, setSlugTouched] = useState(!isNew)
  const [subtitle, setSubtitle] = useState(form.subtitle ?? '')
  const [successMsg, setSuccessMsg] = useState(form.success_message ?? '')
  const [fields, setFields] = useState<FormField[]>(form.fields ?? [])
  const [saving, setSaving] = useState(false)
  const [view, setView] = useState<'edit' | 'preview'>('edit') // small-screen toggle
  const supabase = createClient()

  // Auto-slug from title until the user edits slug manually
  useEffect(() => {
    if (!slugTouched) setSlug(slugify(title))
  }, [title, slugTouched])

  function saveTargetOf(f: FormField): string {
    return RESERVED.has(f.key) ? f.key : 'extra'
  }

  function updateField(i: number, patch: Partial<FormField>) {
    setFields((prev) => prev.map((f, idx) => idx === i ? { ...f, ...patch } : f))
  }

  function setFieldTarget(i: number, target: string) {
    setFields((prev) => prev.map((f, idx) => {
      if (idx !== i) return f
      const key = target === 'extra' ? `custom_${slugify(f.label) || 'field'}` : target
      return { ...f, key }
    }))
  }

  function setFieldLabel(i: number, label: string) {
    setFields((prev) => prev.map((f, idx) => {
      if (idx !== i) return f
      // keep custom keys in sync with the label
      const key = RESERVED.has(f.key) ? f.key : `custom_${slugify(label) || 'field'}`
      return { ...f, label, key }
    }))
  }

  function addField() {
    setFields((prev) => [...prev, { key: `custom_field_${prev.length + 1}`, label: '', type: 'text', required: false }])
  }
  function removeField(i: number) { setFields((prev) => prev.filter((_, idx) => idx !== i)) }
  function move(i: number, dir: -1 | 1) {
    setFields((prev) => {
      const j = i + dir
      if (j < 0 || j >= prev.length) return prev
      const next = [...prev]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  }

  async function save() {
    if (!title.trim()) { toast.error('Enter a form title'); return }
    const finalSlug = slugify(slug || title)
    if (!finalSlug) { toast.error('Enter a valid link (slug)'); return }
    if (existingSlugs.includes(finalSlug)) { toast.error('This link (slug) is already in use'); return }
    const cleanFields = fields
      .filter((f) => f.label.trim())
      .map((f) => ({
        ...f,
        label: f.label.trim(),
        options: f.type === 'select'
          ? (f.options ?? []).map((o) => o.trim()).filter(Boolean)
          : undefined,
      }))
    if (!cleanFields.some((f) => f.key === 'phone')) {
      toast.error('At least one Phone field is required (leads come in by phone)')
      return
    }
    if (!cleanFields.some((f) => f.key === 'full_name')) {
      toast.error('A Name field is required')
      return
    }

    setSaving(true)
    const payload = {
      slug: finalSlug,
      title: title.trim(),
      subtitle: subtitle.trim() || null,
      fields: cleanFields,
      success_message: successMsg.trim() || DEFAULT_SUCCESS,
      source: 'meta_ads',
      is_active: form.is_active,
    }

    try {
      if (isNew) {
        const { data: { user } } = await supabase.auth.getUser()
        const { data, error } = await supabase.from('lead_capture_forms')
          .insert({ ...payload, created_by: user?.id } as never).select().single()
        if (error) throw error
        toast.success('Form created! Copy the link into your Meta ad')
        onSaved(data as unknown as LeadForm)
      } else {
        const { data, error } = await supabase.from('lead_capture_forms')
          .update(payload as never).eq('id', form.id).select().single()
        if (error) throw error
        toast.success('Form updated')
        onSaved(data as unknown as LeadForm)
      }
    } catch (e: any) {
      toast.error(e?.message ?? 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  // Live preview mirrors exactly what the public page will show
  const previewForm: PublicForm = {
    slug: slug || 'preview',
    title: title || 'Your form title',
    subtitle: subtitle || null,
    fields: fields
      .filter((f) => f.label.trim())
      .map((f) => ({
        ...f,
        options: f.type === 'select' ? (f.options ?? []).map((o) => o.trim()).filter(Boolean) : undefined,
      })) as PublicForm['fields'],
    success_message: successMsg || DEFAULT_SUCCESS,
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="w-[calc(100%-1rem)] sm:max-w-4xl h-[92vh] p-0 gap-0 overflow-hidden rounded-2xl flex flex-col">
        <DialogHeader className="px-5 py-3 border-b flex-row items-center justify-between space-y-0">
          <DialogTitle>{isNew ? 'New Lead Form' : 'Edit Form'}</DialogTitle>
          {/* Small-screen Edit/Preview toggle */}
          <div className="lg:hidden inline-flex rounded-lg border bg-slate-100 p-0.5 mr-8">
            <button
              onClick={() => setView('edit')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${view === 'edit' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}
            >Edit</button>
            <button
              onClick={() => setView('preview')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1 ${view === 'preview' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}
            ><Eye className="w-3 h-3" /> Preview</button>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 grid lg:grid-cols-[1fr_380px]">
          {/* ── Builder column ── */}
          <div className={`overflow-y-auto px-5 py-4 space-y-5 ${view === 'preview' ? 'hidden lg:block' : ''}`}>
            {/* Basic details */}
            <div className="space-y-3">
              <div>
                <Label>Form Title *</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. NIOS Admission 2026 — Apply Now" />
              </div>
              <div>
                <Label>Subtitle (optional)</Label>
                <Input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="e.g. Fill this and we'll call you back" />
              </div>
              <div>
                <Label>Public Link (slug)</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-400 font-mono flex-shrink-0">/f/</span>
                  <Input
                    value={slug}
                    onChange={(e) => { setSlug(e.target.value); setSlugTouched(true) }}
                    placeholder="nios-admission"
                    className="font-mono"
                  />
                </div>
                <p className="text-[11px] text-gray-400 mt-1">This link will be used in your Meta ad. Keep it short and simple.</p>
              </div>
            </div>

            {/* Fields builder */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-semibold">Form Fields</Label>
                <Button size="sm" variant="outline" onClick={addField}><Plus className="w-3.5 h-3.5 mr-1" /> Add Field</Button>
              </div>
              <div className="space-y-2">
                {fields.map((f, i) => (
                  <div key={i} className="border rounded-xl p-3 bg-slate-50/60 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col">
                        <button onClick={() => move(i, -1)} disabled={i === 0} className="text-gray-300 hover:text-gray-600 disabled:opacity-30"><ArrowUp className="w-3.5 h-3.5" /></button>
                        <button onClick={() => move(i, 1)} disabled={i === fields.length - 1} className="text-gray-300 hover:text-gray-600 disabled:opacity-30"><ArrowDown className="w-3.5 h-3.5" /></button>
                      </div>
                      <Input
                        value={f.label}
                        onChange={(e) => setFieldLabel(i, e.target.value)}
                        placeholder="Field label (e.g. WhatsApp Number)"
                        className="flex-1 h-9 bg-white"
                      />
                      <button onClick={() => removeField(i)} className="text-red-400 hover:text-red-600 flex-shrink-0"><Trash2 className="w-4 h-4" /></button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pl-7">
                      <div>
                        <label className="text-[11px] text-gray-500">Input type</label>
                        <Select value={f.type} onValueChange={(v) => updateField(i, { type: (v || 'text') as FormField['type'] })}>
                          <SelectTrigger className="h-8 text-xs bg-white"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {INPUT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-[11px] text-gray-500">Saves as</label>
                        <Select value={saveTargetOf(f)} onValueChange={(v) => setFieldTarget(i, v || 'extra')}>
                          <SelectTrigger className="h-8 text-xs bg-white"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {SAVE_TARGETS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    {f.type === 'select' && (
                      <div className="pl-7">
                        <label className="text-[11px] text-gray-500">Options (comma separated)</label>
                        <Input
                          value={(f.options ?? []).join(', ')}
                          onChange={(e) => updateField(i, { options: e.target.value.split(',').map((o) => o.trim()) })}
                          placeholder="NIOS 10th, NIOS 12th, BA, MBA"
                          className="h-8 text-xs bg-white"
                        />
                      </div>
                    )}
                    <div className="flex items-center gap-2 pl-7">
                      <Switch checked={!!f.required} onCheckedChange={(v) => updateField(i, { required: v })} />
                      <span className="text-xs text-gray-600">Required</span>
                      {RESERVED.has(f.key) && <Badge variant="outline" className="text-[10px] ml-auto text-blue-600 border-blue-200">→ {f.key}</Badge>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Success message */}
            <div>
              <Label>Thank-you Message (shown after submit)</Label>
              <Textarea value={successMsg} onChange={(e) => setSuccessMsg(e.target.value)} rows={2} placeholder={DEFAULT_SUCCESS} />
            </div>
          </div>

          {/* ── Live preview column ── */}
          <div className={`bg-slate-200/50 border-l overflow-y-auto ${view === 'edit' ? 'hidden lg:block' : ''}`}>
            <div className="sticky top-0 z-10 bg-slate-100/95 backdrop-blur border-b px-4 py-2 flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Live Preview — how it will look</span>
            </div>
            <div className="scale-[0.92] origin-top">
              <PublicLeadForm form={previewForm} preview />
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="border-t px-5 py-3 flex justify-end gap-2 bg-white">
          <Button variant="outline" onClick={onClose}><X className="w-4 h-4 mr-1" /> Cancel</Button>
          <Button onClick={save} disabled={saving}>
            <Check className="w-4 h-4 mr-1" /> {saving ? 'Saving...' : isNew ? 'Create Form' : 'Save Changes'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
