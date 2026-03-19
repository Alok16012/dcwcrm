'use client'
import { useState, useRef } from 'react'
import { Upload, X, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

interface FileUploadProps {
  bucket: 'student-documents' | 'expense-bills' | 'admit-cards'
  onUploadComplete: (url: string) => void
  accept?: string
  maxSizeMB?: number
}

export function FileUpload({
  bucket,
  onUploadComplete,
  accept = '*/*',
  maxSizeMB = 10,
}: FileUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [uploaded, setUploaded] = useState(false)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  async function handleFile(file: File) {
    if (file.size > maxSizeMB * 1024 * 1024) {
      toast.error(`File size must be less than ${maxSizeMB}MB`)
      return
    }

    setUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error } = await supabase.storage.from(bucket).upload(path, file)
      if (error) throw error

      const { data } = supabase.storage.from(bucket).getPublicUrl(path)
      onUploadComplete(data.publicUrl)
      setUploaded(true)
      toast.success('File uploaded successfully')
    } catch (err) {
      toast.error('Upload failed')
      console.error(err)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        const file = e.dataTransfer.files[0]
        if (file) handleFile(file)
      }}
      className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
        dragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
        }}
      />
      {uploaded ? (
        <div className="flex flex-col items-center gap-2 text-green-600">
          <Check className="w-8 h-8" />
          <p className="text-sm">File uploaded</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <Upload className="w-8 h-8 text-gray-400" />
          <p className="text-sm text-gray-500">Drag & drop or</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? 'Uploading...' : 'Choose file'}
          </Button>
          <p className="text-xs text-gray-400">Max {maxSizeMB}MB</p>
        </div>
      )}
    </div>
  )
}
