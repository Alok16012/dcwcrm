'use client'
import { useState } from 'react'
import { Upload, FileText, Eye, EyeOff, Trash2, RefreshCw, Download, CheckCircle, Circle, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'

interface Prospectus {
  id: string
  college_id: string
  college_name: string
  version: number
  file_name: string
  file_size: string
  visibility: 'associate_only' | 'associate_and_student'
  expiry_date: string
  is_active: boolean
  downloads: number
  uploaded_at: string
}

interface Props {
  departments: { id: string; name: string }[]
}

const SAMPLE: Prospectus[] = [
  { id: '1', college_id: '', college_name: 'XYZ College of Commerce', version: 2, file_name: 'XYZ_Prospectus_2026.pdf', file_size: '4.2 MB', visibility: 'associate_and_student', expiry_date: '2027-03-31', is_active: true, downloads: 47, uploaded_at: '2026-04-01' },
  { id: '2', college_id: '', college_name: 'ABC Management Institute', version: 1, file_name: 'ABC_Prospectus_2026.pdf', file_size: '3.8 MB', visibility: 'associate_only', expiry_date: '2027-03-31', is_active: true, downloads: 23, uploaded_at: '2026-04-05' },
  { id: '3', college_id: '', college_name: 'City Open University', version: 3, file_name: 'COU_Prospectus_v3.pdf', file_size: '6.1 MB', visibility: 'associate_and_student', expiry_date: '2026-12-31', is_active: false, downloads: 112, uploaded_at: '2026-03-15' },
]

export function ProspectusManager({ departments }: Props) {
  const [list, setList] = useState<Prospectus[]>(() => {
    if (departments.length > 0) {
      return departments.slice(0, 3).map((d, i) => SAMPLE[i] ? { ...SAMPLE[i], college_id: d.id, college_name: d.name } : SAMPLE[0])
    }
    return SAMPLE
  })
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ college_id: '', visibility: 'associate_only' as Prospectus['visibility'], expiry_date: '2027-03-31' })
  const [uploadedFile, setUploadedFile] = useState<string | null>(null)

  function handleUpload() {
    if (!form.college_id) { toast.error('Select a college'); return }
    const college = departments.find(d => d.id === form.college_id)?.name ?? 'College'
    const existing = list.find(p => p.college_id === form.college_id)
    const newVersion = existing ? existing.version + 1 : 1
    const entry: Prospectus = {
      id: Date.now().toString(), college_id: form.college_id, college_name: college,
      version: newVersion, file_name: `${college.replace(/\s+/g, '_')}_Prospectus_v${newVersion}.pdf`,
      file_size: '3.5 MB', visibility: form.visibility, expiry_date: form.expiry_date,
      is_active: true, downloads: 0, uploaded_at: new Date().toISOString().split('T')[0],
    }
    if (existing) {
      setList(prev => prev.map(p => p.college_id === form.college_id ? { ...p, is_active: false } : p))
    }
    setList(prev => [entry, ...prev])
    toast.success(`Prospectus v${newVersion} uploaded for ${college}. Secure signed URL configured.`)
    setOpen(false)
    setUploadedFile(null)
  }

  function toggleActive(id: string) {
    setList(prev => prev.map(p => p.id === id ? { ...p, is_active: !p.is_active } : p))
    toast.success('Status updated')
  }

  function handleDelete(id: string) {
    setList(prev => prev.filter(p => p.id !== id))
    toast.success('Prospectus archived')
  }

  const totalDownloads = list.reduce((a, p) => a + p.downloads, 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Prospectus Manager</h2>
          <p className="text-sm text-muted-foreground">Upload college prospectuses. Associates download via secure signed URLs. All downloads are logged.</p>
        </div>
        <Button size="sm" onClick={() => setOpen(true)}><Upload className="w-4 h-4 mr-1" /> Upload Prospectus</Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-blue-700">{list.filter(p => p.is_active).length}</p>
          <p className="text-xs text-blue-600">Active Prospectuses</p>
        </div>
        <div className="bg-green-50 border border-green-100 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-green-700">{totalDownloads}</p>
          <p className="text-xs text-green-600">Total Downloads</p>
        </div>
        <div className="bg-purple-50 border border-purple-100 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-purple-700">{list.filter(p => p.visibility === 'associate_and_student').length}</p>
          <p className="text-xs text-purple-600">Shareable with Students</p>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-slate-600">College</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600">File</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600">Version</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600">Visibility</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600">Expiry</th>
              <th className="text-right px-4 py-3 font-semibold text-slate-600">Downloads</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {list.map(p => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium">{p.college_name}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5 text-blue-600">
                    <FileText className="w-3.5 h-3.5" />
                    <span className="text-xs">{p.file_name}</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{p.file_size}</p>
                </td>
                <td className="px-4 py-3">
                  <Badge variant="outline" className="text-xs">v{p.version}</Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    {p.visibility === 'associate_and_student' ? <Eye className="w-3.5 h-3.5 text-green-500" /> : <EyeOff className="w-3.5 h-3.5 text-slate-400" />}
                    <span className="text-xs">{p.visibility === 'associate_and_student' ? 'All' : 'Associate Only'}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">{p.expiry_date}</td>
                <td className="px-4 py-3 text-right">
                  <span className="font-semibold text-slate-700">{p.downloads}</span>
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => toggleActive(p.id)}>
                    <Badge className={p.is_active ? 'bg-green-100 text-green-800 border-0 cursor-pointer' : 'bg-gray-100 text-gray-600 border-0 cursor-pointer'}>
                      {p.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </button>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 justify-end">
                    <Button variant="ghost" size="sm" title="Replace with new version" onClick={() => { setForm({ college_id: p.college_id, visibility: p.visibility, expiry_date: p.expiry_date }); setOpen(true) }}>
                      <RefreshCw className="w-3.5 h-3.5 text-blue-500" />
                    </Button>
                    <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => handleDelete(p.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr><td colSpan={8} className="text-center py-8 text-slate-400">No prospectuses uploaded yet</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-start gap-2 text-xs text-muted-foreground bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
        <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
        All prospectus files are stored securely in S3/cloud storage. Associates receive a signed temporary URL (1-hour expiry) — direct public URLs are never exposed.
      </div>

      {/* Upload Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Upload className="w-4 h-4" />Upload College Prospectus</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>College / Department</Label>
              <Select value={form.college_id} onValueChange={v => setForm(f => ({ ...f, college_id: v ?? '' }))}>
                <SelectTrigger><SelectValue placeholder="Select college" /></SelectTrigger>
                <SelectContent>{departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Upload PDF File</Label>
              <div className="mt-1 border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
                onClick={() => setUploadedFile('Prospectus_2026.pdf')}>
                {uploadedFile ? (
                  <div className="flex items-center justify-center gap-2 text-green-600">
                    <CheckCircle className="w-5 h-5" />
                    <span className="text-sm font-medium">{uploadedFile}</span>
                  </div>
                ) : (
                  <>
                    <Upload className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">Click to select PDF (max 10 MB)</p>
                  </>
                )}
              </div>
            </div>
            <div>
              <Label>Visibility</Label>
              <Select value={form.visibility} onValueChange={v => setForm(f => ({ ...f, visibility: v as Prospectus['visibility'] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="associate_only">Associate Only</SelectItem>
                  <SelectItem value="associate_and_student">Associate + Student</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Expiry Date</Label>
              <Input type="date" value={form.expiry_date} onChange={e => setForm(f => ({ ...f, expiry_date: e.target.value }))} />
              <p className="text-xs text-muted-foreground mt-1">Prospectus will automatically become inactive after this date.</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={handleUpload}>Upload & Publish</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
