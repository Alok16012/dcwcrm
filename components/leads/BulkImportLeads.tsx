'use client'
import { useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Upload, FileSpreadsheet, ChevronDown, ChevronUp, X } from 'lucide-react'

const LEAD_FIELDS = [
  { key: 'full_name', label: 'Full Name', required: true },
  { key: 'phone', label: 'Phone', required: true },
  { key: 'email', label: 'Email', required: false },
  { key: 'city', label: 'City', required: false },
  { key: 'state', label: 'State', required: false },
  { key: 'source', label: 'Source', required: false },
  { key: 'status', label: 'Status', required: false },
  { key: 'department', label: 'Department', required: false },
  { key: 'course', label: 'Course', required: false },
  { key: 'standard', label: 'Standard', required: false },
]

const SOURCE_VALUES = ['website', 'walk_in', 'referral', 'whatsapp', 'phone', 'excel_import', 'social_media', 'other']
const STATUS_VALUES = ['new', 'contacted', 'interested', 'counselled', 'application_sent', 'converted', 'cold', 'lost']

interface BulkImportLeadsProps {
  onSuccess: () => void
  onCancel: () => void
}

export function BulkImportLeads({ onSuccess, onCancel }: BulkImportLeadsProps) {
  const [rows, setRows] = useState<Record<string, string>[]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [importing, setImporting] = useState(false)
  const [fileName, setFileName] = useState('')
  const [showMapping, setShowMapping] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (ev) => {
      const data = new Uint8Array(ev.target?.result as ArrayBuffer)
      const wb = XLSX.read(data, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const json = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '' })
      if (!json.length) { toast.error('File is empty'); return }
      const hdrs = Object.keys(json[0])
      setHeaders(hdrs)
      setRows(json)
      const autoMap: Record<string, string> = {}
      LEAD_FIELDS.forEach(({ key }) => {
        const match = hdrs.find((h) =>
          h.toLowerCase().replace(/\s/g, '_') === key ||
          h.toLowerCase().includes(key.replace('_', ' ')) ||
          h.toLowerCase().includes(key)
        )
        if (match) autoMap[key] = match
      })
      setMapping(autoMap)
    }
    reader.readAsArrayBuffer(file)
  }

  function clearFile() {
    setRows([])
    setHeaders([])
    setMapping({})
    setFileName('')
    setShowMapping(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  function downloadSample() {
    const sampleData = [
      { 'Full Name': 'Rahul Kumar', 'Phone': '9876543210', 'Email': 'rahul@example.com', 'City': 'Delhi', 'State': 'Delhi', 'Source': 'phone', 'Status': 'new', 'Course': 'MBA', 'Standard': 'Full Time', 'Department': 'Management' },
      { 'Full Name': 'Priya Singh', 'Phone': '8765432109', 'Email': 'priya@example.com', 'City': 'Mumbai', 'State': 'Maharashtra', 'Source': 'website', 'Status': 'interested', 'Course': 'Class 10', 'Standard': '10th', 'Department': 'Schooling' },
    ]
    const ws = XLSX.utils.json_to_sheet(sampleData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Leads')
    XLSX.writeFile(wb, 'leads_import_sample.xlsx')
  }

  async function handleImport() {
    if (!mapping.full_name || !mapping.phone) {
      toast.error('Full Name aur Phone column map karna zaroori hai')
      return
    }
    setImporting(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      interface LookupItem { id: string; name: string; course_id?: string }
      const [deptRes, courseRes, subCourseRes] = await Promise.all([
        supabase.from('departments').select('id, name').returns<LookupItem[]>(),
        supabase.from('courses').select('id, name').returns<LookupItem[]>(),
        supabase.from('sub_courses').select('id, name, course_id').returns<LookupItem[]>(),
      ])
      const deptMap = new Map((deptRes.data ?? []).map(d => [d.name.toLowerCase(), d.id]))
      const courseMap = new Map((courseRes.data ?? []).map(c => [c.name.toLowerCase(), c.id]))

      const leads = rows.map((row) => {
        const source = row[mapping.source ?? '']?.toLowerCase().trim()
        const status = row[mapping.status ?? '']?.toLowerCase().trim()
        const deptName = mapping.department ? row[mapping.department]?.trim() : null
        const courseName = mapping.course ? row[mapping.course]?.trim() : null
        const standardName = mapping.standard ? row[mapping.standard]?.trim() : null
        let department_id: string | null = null
        let course_id: string | null = null
        let sub_course_id: string | null = null
        if (deptName) { const id = deptMap.get(deptName.toLowerCase()); if (id) department_id = id }
        if (courseName) { const id = courseMap.get(courseName.toLowerCase()); if (id) course_id = id }
        if (standardName && course_id) {
          const sc = (subCourseRes.data ?? []).find(s => s.name.toLowerCase() === standardName.toLowerCase() && s.course_id === course_id)
          if (sc) sub_course_id = sc.id
        }
        return {
          full_name: row[mapping.full_name]?.trim() || '',
          phone: String(row[mapping.phone] ?? '').trim(),
          email: mapping.email ? row[mapping.email]?.trim() || null : null,
          city: mapping.city ? row[mapping.city]?.trim() || null : null,
          state: mapping.state ? row[mapping.state]?.trim() || null : null,
          source: SOURCE_VALUES.includes(source) ? source : 'other',
          status: STATUS_VALUES.includes(status) ? status : 'new',
          department_id, course_id, sub_course_id,
          created_by: user?.id,
        }
      }).filter((l) => l.full_name && l.phone)

      if (!leads.length) { toast.error('Valid leads nahi mile'); return }
      const { data: insertedLeads, error } = await supabase.from('leads').insert(leads as never).select()
      if (error) throw error
      if (insertedLeads && (insertedLeads as any[]).length > 0) {
        const activities = (insertedLeads as any[]).map((l) => ({
          lead_id: l.id, activity_type: 'created', performed_by: user?.id, new_value: l.status
        }))
        await supabase.from('lead_activities').insert(activities as never)
      }
      toast.success(`${leads.length} leads import ho gaye!`)
      onSuccess()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  const mappedCount = LEAD_FIELDS.filter(f => mapping[f.key]).length

  return (
    <div className="flex flex-col gap-4">

      {/* Upload Area */}
      {!fileName ? (
        <div
          onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed border-gray-300 rounded-xl p-10 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
        >
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />
          <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
          <p className="font-semibold text-gray-700 mb-1">Excel ya CSV file yahan drop karo</p>
          <p className="text-sm text-gray-400 mb-4">Click karke select karo (.xlsx, .xls, .csv)</p>
          <button
            onClick={(e) => { e.stopPropagation(); downloadSample() }}
            className="inline-flex items-center gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" /> Sample File Download Karo
          </button>
        </div>
      ) : (
        /* File Loaded State */
        <div className="flex flex-col gap-3">
          {/* File Info Bar */}
          <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
            <FileSpreadsheet className="w-8 h-8 text-green-600 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-green-800 truncate text-sm">{fileName}</p>
              <p className="text-xs text-green-600">{rows.length} rows ready to import</p>
            </div>
            <button onClick={clearFile} className="p-1 rounded-lg hover:bg-green-100 text-green-600 flex-shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Mapping toggle */}
          <button
            onClick={() => setShowMapping(v => !v)}
            className="flex items-center justify-between w-full px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl transition-colors"
          >
            <span>
              Column Mapping
              <span className={`ml-2 text-xs font-normal px-2 py-0.5 rounded-full ${mappedCount >= 2 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                {mappedCount}/{LEAD_FIELDS.length} matched
              </span>
            </span>
            {showMapping ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {/* Mapping grid (collapsible) */}
          {showMapping && (
            <div className="border border-gray-200 rounded-xl p-3 bg-gray-50 grid grid-cols-2 gap-2 max-h-52 overflow-y-auto">
              {LEAD_FIELDS.map(({ key, label, required }) => (
                <div key={key} className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">
                    {label}{required && <span className="text-red-500 ml-0.5">*</span>}
                  </label>
                  <Select
                    value={mapping[key] ?? '__none__'}
                    onValueChange={(v) => setMapping(p => ({ ...p, [key]: v === '__none__' ? '' : v } as Record<string, string>))}
                  >
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue placeholder="Select column..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— Skip —</SelectItem>
                      {headers.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex justify-end gap-2 pt-1 border-t border-gray-100">
        <Button variant="outline" onClick={onCancel} disabled={importing}>Cancel</Button>
        <Button
          onClick={handleImport}
          disabled={!rows.length || importing}
          className="bg-green-600 hover:bg-green-700 text-white min-w-[140px]"
        >
          {importing ? 'Importing...' : rows.length ? `Import ${rows.length} Leads` : 'File Select Karo'}
        </Button>
      </div>
    </div>
  )
}
