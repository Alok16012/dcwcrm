'use client'
import { useState, useRef, useTransition } from 'react'
import { Download, Upload, AlertCircle, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { PageHeader } from '@/components/shared/PageHeader'
import { DataTable } from '@/components/shared/DataTable'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { read, utils, writeFileXLSX } from 'xlsx'
import type { ColumnDef } from '@tanstack/react-table'
import { LEAD_STATUS_LABELS, LEAD_SOURCE_LABELS } from '@/types/app.types'

interface ImportRow {
  full_name: string
  phone: string
  email?: string
  city?: string
  status?: string
  source?: string
  course?: string
  _valid: boolean
  _error?: string
  _row: number
}

const TEMPLATE_HEADERS = ['full_name', 'phone', 'email', 'city', 'state', 'status', 'source', 'notes']
const VALID_STATUSES = Object.keys(LEAD_STATUS_LABELS)
const VALID_SOURCES = Object.keys(LEAD_SOURCE_LABELS)

function downloadTemplate() {
  const ws = utils.aoa_to_sheet([
    TEMPLATE_HEADERS,
    ['John Doe', '9876543210', 'john@example.com', 'Delhi', 'Delhi', 'new', 'phone', ''],
  ])
  const wb = utils.book_new()
  utils.book_append_sheet(wb, ws, 'Leads')
  writeFileXLSX(wb, 'lead_import_template.xlsx')
}

export default function LeadImportPage() {
  const [rows, setRows] = useState<ImportRow[]>([])
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<{ success: number; failed: number } | null>(null)
  const [failedRows, setFailedRows] = useState<ImportRow[]>([])
  const [, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  function parseFile(file: File) {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = read(data, { type: 'array' })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        const jsonData = utils.sheet_to_json<Record<string, string>>(sheet, { defval: '' })

        const parsed: ImportRow[] = jsonData.map((row, idx) => {
          const errors: string[] = []
          if (!row.full_name?.trim()) errors.push('Name required')
          if (!row.phone?.trim() || row.phone.trim().length < 10) errors.push('Valid phone required')
          if (row.status && !VALID_STATUSES.includes(row.status)) errors.push(`Invalid status: ${row.status}`)
          if (row.source && !VALID_SOURCES.includes(row.source)) errors.push(`Invalid source: ${row.source}`)

          return {
            full_name: row.full_name?.trim() ?? '',
            phone: row.phone?.trim() ?? '',
            email: row.email?.trim() || undefined,
            city: row.city?.trim() || undefined,
            status: row.status?.trim() || 'new',
            source: row.source?.trim() || 'other',
            _valid: errors.length === 0,
            _error: errors.join('; '),
            _row: idx + 2,
          }
        })
        setRows(parsed)
        setResult(null)
      } catch {
        toast.error('Failed to parse file')
      }
    }
    reader.readAsArrayBuffer(file)
  }

  async function handleImport() {
    const validRows = rows.filter((r) => r._valid)
    if (!validRows.length) { toast.error('No valid rows to import'); return }

    setImporting(true)
    setProgress(0)
    const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user ?? null
    const batchId = `import-${Date.now()}`
    let success = 0
    const failed: ImportRow[] = []
    const chunkSize = 100

    for (let i = 0; i < validRows.length; i += chunkSize) {
      const chunk = validRows.slice(i, i + chunkSize).map((r) => ({
        full_name: r.full_name,
        phone: r.phone,
        email: r.email ?? null,
        city: r.city ?? null,
        status: r.status ?? 'new',
        source: r.source ?? 'excel_import',
        import_batch_id: batchId,
        created_by: user?.id,
      }))

      const { data, error } = await supabase.from('leads').insert(chunk as never).select()
      if (error) {
        failed.push(...validRows.slice(i, i + chunkSize))
      } else {
        success += data?.length ?? 0
      }
      setProgress(Math.round(((i + chunkSize) / validRows.length) * 100))
    }

    setResult({ success, failed: failed.length })
    setFailedRows(failed)
    setImporting(false)
    toast.success(`Import complete: ${success} records imported`)
  }

  function downloadFailed() {
    const ws = utils.json_to_sheet(failedRows.map(({ _valid, _error, _row, ...r }) => ({ ...r, error: _error })))
    const wb = utils.book_new()
    utils.book_append_sheet(wb, ws, 'Failed Rows')
    writeFileXLSX(wb, 'import_failed.xlsx')
  }

  const previewColumns: ColumnDef<ImportRow>[] = [
    { id: 'row', header: 'Row', cell: ({ row }) => <span className="text-gray-400">#{row.original._row}</span> },
    { accessorKey: 'full_name', header: 'Name' },
    { accessorKey: 'phone', header: 'Phone' },
    { accessorKey: 'status', header: 'Status' },
    { accessorKey: 'source', header: 'Source' },
    { id: 'valid', header: 'Valid?', cell: ({ row }) => row.original._valid
      ? <CheckCircle className="w-4 h-4 text-green-600" />
      : <span className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{row.original._error}</span>
    },
  ]

  const validCount = rows.filter((r) => r._valid).length
  const invalidCount = rows.filter((r) => !r._valid).length

  return (
    <div>
      <PageHeader title="Bulk Import Leads" description="Import leads from Excel or CSV file" />

      <div className="space-y-6">
        {/* Step 1 */}
        <div className="bg-white rounded-lg border p-6">
          <h3 className="font-semibold mb-3">Step 1: Download Template</h3>
          <Button variant="outline" onClick={downloadTemplate}>
            <Download className="w-4 h-4 mr-2" /> Download Template
          </Button>
          <p className="text-xs text-gray-500 mt-2">
            Required columns: full_name, phone. Optional: email, city, state, status, source, notes
          </p>
        </div>

        {/* Step 2 */}
        <div className="bg-white rounded-lg border p-6">
          <h3 className="font-semibold mb-3">Step 2: Upload File</h3>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.csv"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) parseFile(f) }}
          />
          <Button variant="outline" onClick={() => inputRef.current?.click()}>
            <Upload className="w-4 h-4 mr-2" /> Choose File (.xlsx or .csv)
          </Button>
        </div>

        {/* Preview */}
        {rows.length > 0 && (
          <div className="bg-white rounded-lg border p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Preview</h3>
              <div className="flex gap-4 text-sm">
                <span className="text-green-700 font-medium">{validCount} valid</span>
                {invalidCount > 0 && <span className="text-red-600 font-medium">{invalidCount} errors</span>}
                <span className="text-gray-500">Total: {rows.length}</span>
              </div>
            </div>
            <DataTable data={rows.slice(0, 10)} columns={previewColumns} />
            {rows.length > 10 && <p className="text-xs text-gray-500 mt-2">Showing first 10 of {rows.length} rows</p>}

            {importing && (
              <div className="mt-4 space-y-2">
                <p className="text-sm text-gray-600">Importing... {progress}%</p>
                <Progress value={progress} />
              </div>
            )}

            <div className="flex gap-2 mt-4">
              <Button onClick={handleImport} disabled={importing || validCount === 0}>
                {importing ? 'Importing...' : `Import ${validCount} Records`}
              </Button>
            </div>
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="bg-white rounded-lg border p-6">
            <h3 className="font-semibold mb-3">Import Result</h3>
            <div className="flex gap-6 text-sm">
              <span className="text-green-700">{result.success} imported successfully</span>
              {result.failed > 0 && <span className="text-red-600">{result.failed} failed</span>}
            </div>
            {failedRows.length > 0 && (
              <Button variant="outline" size="sm" onClick={downloadFailed} className="mt-3">
                <Download className="w-4 h-4 mr-1" /> Download Failed Rows
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
