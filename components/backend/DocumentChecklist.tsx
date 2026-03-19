'use client'
import { useState, useTransition } from 'react'
import { Upload, FileText, CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { FileUpload } from '@/components/shared/FileUpload'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { DOC_TYPE_LABELS, type DocType } from '@/types/app.types'

interface DocRecord {
  id: string
  student_id: string
  doc_type: DocType
  status: 'pending' | 'received' | 'verified' | 'rejected'
  file_url: string | null
  notes: string | null
  expiry_date: string | null
}

interface DocumentChecklistProps {
  studentId: string
  documents: DocRecord[]
  onUpdate: () => void
}

const DOC_STATUS_CONFIG = {
  pending: { label: 'Pending', icon: Clock, color: 'bg-gray-100 text-gray-700' },
  received: { label: 'Received', icon: FileText, color: 'bg-blue-100 text-blue-700' },
  verified: { label: 'Verified', icon: CheckCircle, color: 'bg-green-100 text-green-700' },
  rejected: { label: 'Rejected', icon: XCircle, color: 'bg-red-100 text-red-700' },
}

const DOC_TYPES_WITH_EXPIRY: DocType[] = ['passport', 'visa', 'ielts_scorecard', 'pte_scorecard', 'offer_letter']

export function DocumentChecklist({ studentId, documents, onUpdate }: DocumentChecklistProps) {
  const [editDoc, setEditDoc] = useState<{ type: DocType; existing?: DocRecord } | null>(null)
  const [fileUrl, setFileUrl] = useState('')
  const [notes, setNotes] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [status, setStatus] = useState<DocRecord['status']>('received')
  const [isPending, startTransition] = useTransition()
  const supabase = createClient()

  function openEdit(type: DocType) {
    const existing = documents.find((d) => d.doc_type === type)
    setEditDoc({ type, existing })
    setFileUrl(existing?.file_url ?? '')
    setNotes(existing?.notes ?? '')
    setExpiryDate(existing?.expiry_date ?? '')
    setStatus(existing?.status ?? 'received')
  }

  async function handleSave() {
    startTransition(async () => {
      if (!editDoc) return
      try {
        const { data: { user } } = await supabase.auth.getUser()
        const payload = {
          student_id: studentId,
          doc_type: editDoc.type,
          status,
          file_url: fileUrl || null,
          notes: notes || null,
          expiry_date: expiryDate || null,
          uploaded_by: user?.id,
          updated_at: new Date().toISOString(),
        }

        if (editDoc.existing) {
          const { error } = await supabase.from('student_documents').update(payload as never).eq('id', editDoc.existing.id)
          if (error) throw error
        } else {
          const { error } = await supabase.from('student_documents').insert(payload as never)
          if (error) throw error
        }

        toast.success('Document updated')
        setEditDoc(null)
        onUpdate()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to save')
      }
    })
  }

  const docTypes = Object.keys(DOC_TYPE_LABELS) as DocType[]

  return (
    <div>
      <div className="space-y-2">
        {docTypes.map((type) => {
          const doc = documents.find((d) => d.doc_type === type)
          const statusConfig = doc ? DOC_STATUS_CONFIG[doc.status] : DOC_STATUS_CONFIG.pending
          const StatusIcon = statusConfig.icon
          return (
            <div key={type} className="flex items-center justify-between p-3 bg-white rounded-lg border hover:border-blue-300 transition-colors">
              <div className="flex items-center gap-3">
                <StatusIcon className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm font-medium">{DOC_TYPE_LABELS[type]}</p>
                  {doc?.expiry_date && <p className="text-xs text-gray-500">Expiry: {doc.expiry_date}</p>}
                  {doc?.notes && <p className="text-xs text-gray-500">{doc.notes}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={`${statusConfig.color} border-0 text-xs`}>{statusConfig.label}</Badge>
                {doc?.file_url && (
                  <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">View</a>
                )}
                <Button variant="outline" size="sm" onClick={() => openEdit(type)}>
                  <Upload className="w-3 h-3 mr-1" /> Update
                </Button>
              </div>
            </div>
          )
        })}
      </div>

      <Dialog open={!!editDoc} onOpenChange={(o) => { if (!o) setEditDoc(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editDoc ? DOC_TYPE_LABELS[editDoc.type] : ''} — Update Document
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as DocRecord['status'])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(DOC_STATUS_CONFIG).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Upload File</Label>
              <FileUpload
                bucket="student-documents"
                onUploadComplete={(url) => setFileUrl(url)}
                accept=".pdf,.jpg,.jpeg,.png"
              />
              {fileUrl && <p className="text-xs text-green-600 mt-1">File uploaded ✓</p>}
            </div>
            {editDoc && DOC_TYPES_WITH_EXPIRY.includes(editDoc.type) && (
              <div>
                <Label>Expiry Date</Label>
                <Input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
              </div>
            )}
            <div>
              <Label>Notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditDoc(null)}>Cancel</Button>
              <Button onClick={handleSave} disabled={isPending}>{isPending ? 'Saving...' : 'Save'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
