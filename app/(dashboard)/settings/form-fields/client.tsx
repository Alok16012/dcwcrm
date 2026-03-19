'use client'
import { useState } from 'react'
import { Plus, Trash2, GripVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/shared/PageHeader'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

interface FormField {
  id: string
  field_key: string
  label: string
  field_type: string
  is_required: boolean
  is_active: boolean
  is_system: boolean
  options: string[] | null
  display_order: number
}

const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'textarea', label: 'Textarea' },
  { value: 'select', label: 'Dropdown' },
  { value: 'date', label: 'Date' },
]

const TYPE_COLORS: Record<string, string> = {
  text: 'bg-blue-100 text-blue-700',
  number: 'bg-purple-100 text-purple-700',
  email: 'bg-green-100 text-green-700',
  phone: 'bg-yellow-100 text-yellow-700',
  textarea: 'bg-orange-100 text-orange-700',
  select: 'bg-pink-100 text-pink-700',
  date: 'bg-cyan-100 text-cyan-700',
}

export function FormFieldsClient({ fields: initial }: { fields: FormField[] }) {
  const [fields, setFields] = useState(initial)
  const [showAdd, setShowAdd] = useState(false)
  const [newField, setNewField] = useState({ label: '', field_type: 'text', is_required: false, options: '' })
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  async function toggleActive(field: FormField) {
    if (field.field_key === 'full_name' || field.field_key === 'phone') {
      toast.error('Full Name aur Phone hamesha required hain')
      return
    }
    const { error } = await supabase
      .from('lead_form_fields')
      .update({ is_active: !field.is_active } as never)
      .eq('id', field.id)
    if (error) { toast.error('Failed'); return }
    setFields((prev) => prev.map((f) => f.id === field.id ? { ...f, is_active: !f.is_active } : f))
    toast.success(field.is_active ? 'Field hide kar diya' : 'Field show kar diya')
  }

  async function toggleRequired(field: FormField) {
    if (field.is_system && field.field_key === 'full_name' || field.field_key === 'phone') {
      toast.error('Ye field hamesha required rehega')
      return
    }
    const { error } = await supabase
      .from('lead_form_fields')
      .update({ is_required: !field.is_required } as never)
      .eq('id', field.id)
    if (error) { toast.error('Failed'); return }
    setFields((prev) => prev.map((f) => f.id === field.id ? { ...f, is_required: !f.is_required } : f))
  }

  async function deleteField(field: FormField) {
    if (field.field_key === 'full_name' || field.field_key === 'phone') {
      toast.error('Full Name aur Phone delete nahi ho sakte')
      return
    }
    const { error } = await supabase.from('lead_form_fields').delete().eq('id', field.id)
    if (error) { toast.error('Failed'); return }
    setFields((prev) => prev.filter((f) => f.id !== field.id))
    toast.success('Field delete ho gaya')
  }

  async function addField() {
    if (!newField.label.trim()) { toast.error('Label required hai'); return }
    setSaving(true)
    const field_key = newField.label.toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
    const options = newField.field_type === 'select' && newField.options
      ? newField.options.split(',').map((o) => o.trim()).filter(Boolean)
      : null

    const { data, error } = await supabase
      .from('lead_form_fields')
      .insert({
        field_key: `custom_${field_key}`,
        label: newField.label.trim(),
        field_type: newField.field_type,
        is_required: newField.is_required,
        is_system: false,
        options,
        display_order: fields.length + 1,
      } as never)
      .select()
      .single()

    setSaving(false)
    if (error) { toast.error(error.message); return }
    setFields((prev) => [...prev, data])
    setNewField({ label: '', field_type: 'text', is_required: false, options: '' })
    setShowAdd(false)
    toast.success('Field add ho gaya!')
  }

  const activeFields = fields.filter((f) => f.is_active)
  const hiddenFields = fields.filter((f) => !f.is_active)

  return (
    <div>
      <PageHeader
        title="Lead Form Fields"
        description="Add, hide ya delete karo lead form ke fields"
        action={
          <Button size="sm" onClick={() => setShowAdd(true)}>
            <Plus className="w-4 h-4 mr-1" /> Add Field
          </Button>
        }
      />

      {/* Active Fields */}
      <div className="space-y-2 mb-6">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
          Active Fields ({activeFields.length})
        </h3>
        {activeFields.map((field) => (
          <div key={field.id} className="bg-white border rounded-lg px-4 py-3 flex items-center gap-3 shadow-sm">
            <GripVertical className="w-4 h-4 text-gray-300 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{field.label}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${TYPE_COLORS[field.field_type] ?? 'bg-gray-100 text-gray-600'}`}>
                  {field.field_type}
                </span>
                {field.is_required && (
                  <Badge variant="outline" className="text-xs text-red-500 border-red-200">Required</Badge>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-0.5">key: {field.field_key}</p>
            </div>

            <div className="flex items-center gap-4">
              {/* Required toggle */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-500">Required</span>
                <Switch
                  checked={field.is_required}
                  onCheckedChange={() => toggleRequired(field)}
                  disabled={field.field_key === 'full_name' || field.field_key === 'phone'}
                />
              </div>
              {/* Active toggle */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-500">Show</span>
                <Switch
                  checked={field.is_active}
                  onCheckedChange={() => toggleActive(field)}
                />
              </div>
              {/* Delete */}
              {field.field_key !== 'full_name' && field.field_key !== 'phone' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteField(field)}
                  className="text-red-500 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Hidden Fields */}
      {hiddenFields.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
            Hidden Fields ({hiddenFields.length})
          </h3>
          {hiddenFields.map((field) => (
            <div key={field.id} className="bg-gray-50 border border-dashed rounded-lg px-4 py-3 flex items-center gap-3 opacity-60">
              <GripVertical className="w-4 h-4 text-gray-300 flex-shrink-0" />
              <div className="flex-1">
                <span className="font-medium text-sm text-gray-400">{field.label}</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-gray-400">Show</span>
                  <Switch checked={false} onCheckedChange={() => toggleActive(field)} />
                </div>
                {field.field_key !== 'full_name' && field.field_key !== 'phone' && (
                  <Button variant="ghost" size="sm" onClick={() => deleteField(field)} className="text-red-400">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Field Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Naya Field Add Karo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Field Label *</Label>
              <Input
                placeholder="e.g. WhatsApp Number"
                value={newField.label}
                onChange={(e) => setNewField((p) => ({ ...p, label: e.target.value }))}
              />
            </div>
            <div>
              <Label>Field Type</Label>
              <Select
                value={newField.field_type}
                onValueChange={(v) => setNewField((p) => ({ ...p, field_type: v || 'text' }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FIELD_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {newField.field_type === 'select' && (
              <div>
                <Label>Options (comma separated)</Label>
                <Input
                  placeholder="e.g. Option 1, Option 2, Option 3"
                  value={newField.options}
                  onChange={(e) => setNewField((p) => ({ ...p, options: e.target.value }))}
                />
              </div>
            )}
            <div className="flex items-center gap-3">
              <Switch
                checked={newField.is_required}
                onCheckedChange={(v) => setNewField((p) => ({ ...p, is_required: v }))}
              />
              <Label>Required field</Label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button onClick={addField} disabled={saving}>
                {saving ? 'Saving...' : 'Add Field'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
