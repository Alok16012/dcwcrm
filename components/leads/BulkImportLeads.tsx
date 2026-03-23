'use client'
import { useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle } from 'lucide-react'

const LEAD_FIELDS = [
  { key: 'full_name', label: 'Full Name', required: true },
  { key: 'phone', label: 'Phone', required: true },
  { key: 'email', label: 'Email', required: false },
  { key: 'city', label: 'City', required: false },
  { key: 'state', label: 'State', required: false },
  { key: 'source', label: 'Source', required: false },
  { key: 'status', label: 'Status', required: false },
  { key: 'notes', label: 'Notes', required: false },
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

      // Auto-map columns by name similarity
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

  function downloadSample() {
    const sampleData = [
      {
        'Full Name': 'Rahul Kumar',
        'Phone': '9876543210',
        'Email': 'rahul@example.com',
        'City': 'Delhi',
        'State': 'Delhi',
        'Source': 'phone',
        'Status': 'new',
        'Course': 'MBA',
        'Standard': 'Full Time',
        'Department': 'Management',
        'University/Board': 'Delhi University',
        'Notes': 'Interested in autumn intake'
      },
      {
        'Full Name': 'Priya Singh',
        'Phone': '8765432109',
        'Email': 'priya@example.com',
        'City': 'Mumbai',
        'State': 'Maharashtra',
        'Source': 'website',
        'Status': 'interested',
        'Course': 'Class 10',
        'Standard': '10th',
        'Department': 'Schooling',
        'University/Board': 'CBSE',
        'Notes': 'Looking for science stream'
      }
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
      const leads = rows.map((row) => {
        const source = row[mapping.source ?? '']?.toLowerCase().trim()
        const status = row[mapping.status ?? '']?.toLowerCase().trim()
        return {
          full_name: row[mapping.full_name]?.trim() || '',
          phone: String(row[mapping.phone] ?? '').trim(),
          email: mapping.email ? row[mapping.email]?.trim() || null : null,
          city: mapping.city ? row[mapping.city]?.trim() || null : null,
          state: mapping.state ? row[mapping.state]?.trim() || null : null,
          source: SOURCE_VALUES.includes(source) ? source : 'other',
          status: STATUS_VALUES.includes(status) ? status : 'new',
          notes: mapping.notes ? row[mapping.notes]?.trim() || null : null,
          created_by: user?.id,
        }
      }).filter((l) => l.full_name && l.phone)

      if (!leads.length) { toast.error('Valid leads nahi mile'); return }

      const { data: insertedLeads, error } = await supabase.from('leads').insert(leads as never).select()
      if (error) throw error

      if (insertedLeads && (insertedLeads as any[]).length > 0) {
        const activities = (insertedLeads as any[]).map((l) => ({
          lead_id: l.id,
          activity_type: 'created',
          performed_by: user?.id,
          new_value: l.status
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

  return (
    <div className="space-y-5">
      {/* Upload Area */}
      <div
        className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
        onClick={() => fileRef.current?.click()}
      >
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />
        {fileName ? (
          <div className="flex flex-col items-center gap-2 text-green-600">
            <FileSpreadsheet className="w-10 h-10" />
            <p className="font-medium">{fileName}</p>
            <p className="text-sm text-gray-500">{rows.length} rows mili</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-gray-400">
            <Upload className="w-10 h-10" />
            <p className="font-medium">Excel ya CSV file yahan drop karo</p>
            <p className="text-sm">ya click karke select karo (.xlsx, .xls, .csv)</p>
          </div>
        )}
      </div>

      {/* Sample Format */}
      {!rows.length && (
        <div className="bg-blue-50 rounded-lg p-4 text-sm text-blue-700">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
            <p className="font-semibold">Expected columns (sample format):</p>
            <button
              onClick={downloadSample}
              className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" /> Sample Download Karo
            </button>
          </div>
          <p className="font-mono text-[10px] sm:text-xs overflow-x-auto whitespace-nowrap bg-white/50 p-2 rounded-md border border-blue-100 w-full">Full Name | Phone | Email | City | State | Source | Status | Course | Standard | Department | University/Board | Notes</p>
          <p className="text-xs mt-2 text-blue-600 font-medium bg-blue-100/50 p-2 rounded-md">Auto-mapping: <span className="font-normal text-blue-500 italic">Hamara system automatically columns ko recognize kr lega agar labels match krte hain.</span></p>
        </div>
      )}

      {/* Column Mapping */}
      {rows.length > 0 && (
        <div className="space-y-3 w-full overflow-hidden">
          <p className="font-medium text-sm">Column Mapping — Excel column ko lead field se match karo:</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-64 overflow-y-auto pr-1">
            {LEAD_FIELDS.map(({ key, label, required }) => (
              <div key={key} className="space-y-1">
                <label className="text-xs font-medium text-gray-600">
                  {label} {required && <span className="text-red-500">*</span>}
                  {mapping[key] ? (
                    <CheckCircle2 className="inline w-3 h-3 ml-1 text-green-500" />
                  ) : required ? (
                    <AlertCircle className="inline w-3 h-3 ml-1 text-red-400" />
                  ) : null}
                </label>
                <Select
                  value={mapping[key] ?? '__none__'}
                  onValueChange={(v) => setMapping((prev) => ({ ...prev, [key]: (v === '__none__' ? '' : v) || '' }))}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select column..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Skip —</SelectItem>
                    {headers.map((h) => (
                      <SelectItem key={h} value={h}>{h}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>

          {/* Preview */}
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-3 py-2 text-xs font-medium text-gray-500">Preview (first 3 rows)</div>
            <div className="overflow-x-auto">
              <table className="text-xs w-full">
                <thead className="bg-gray-100">
                  <tr>
                    {LEAD_FIELDS.filter((f) => mapping[f.key]).map((f) => (
                      <th key={f.key} className="px-3 py-1.5 text-left text-gray-600">{f.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 3).map((row, i) => (
                    <tr key={i} className="border-t">
                      {LEAD_FIELDS.filter((f) => mapping[f.key]).map((f) => (
                        <td key={f.key} className="px-3 py-1.5 truncate max-w-[120px]">{row[mapping[f.key]] || '—'}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button
          onClick={handleImport}
          disabled={!rows.length || importing}
          className="bg-green-600 hover:bg-green-700"
        >
          {importing ? 'Importing...' : `Import ${rows.length} Leads`}
        </Button>
      </div>
    </div>
  )
}
