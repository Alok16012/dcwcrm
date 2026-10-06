'use client'
import { useRef, useState } from 'react'
import { Upload, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { LMS_BUCKET } from '@/lib/lms/shared'

/** Uploads one file to the lms-content bucket and hands back its public URL. */
export function LmsUploadButton({
  onUploaded, accept = '*/*', maxSizeMB = 50, label = 'Upload file', folder = 'lessons',
}: {
  onUploaded: (url: string, file: File) => void
  accept?: string
  maxSizeMB?: number
  label?: string
  folder?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  async function handle(file: File) {
    if (file.size > maxSizeMB * 1024 * 1024) {
      toast.error(`File must be under ${maxSizeMB} MB`)
      return
    }
    setBusy(true)
    try {
      const supabase = createClient()
      const ext = file.name.includes('.') ? file.name.split('.').pop() : 'bin'
      const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
      const { error } = await supabase.storage.from(LMS_BUCKET).upload(path, file, { contentType: file.type || undefined })
      if (error) throw error
      const { data } = supabase.storage.from(LMS_BUCKET).getPublicUrl(path)
      onUploaded(data.publicUrl, file)
      toast.success('File uploaded')
    } catch (err) {
      toast.error(err instanceof Error ? `Upload failed: ${err.message}` : 'Upload failed')
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <>
      <input ref={inputRef} type="file" accept={accept} className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handle(f) }} />
      <button type="button" disabled={busy} onClick={() => inputRef.current?.click()}
        className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-blue-300 bg-blue-50/50 px-3 h-9 text-xs font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-60 whitespace-nowrap">
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
        {busy ? 'Uploading…' : label}
      </button>
    </>
  )
}
