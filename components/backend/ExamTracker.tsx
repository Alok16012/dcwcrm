'use client'
import { useState, useTransition } from 'react'
import { Plus, Upload } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { FileUpload } from '@/components/shared/FileUpload'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { EXAM_TYPE_LABELS, type ExamType } from '@/types/app.types'

interface ExamRecord {
  id: string
  student_id: string
  exam_type: ExamType
  exam_name: string
  exam_date: string | null
  centre: string | null
  hall_ticket_number: string | null
  admit_card_url: string | null
  score: string | null
  is_passed: boolean | null
  remarks: string | null
  created_at: string
}

const examSchema = z.object({
  exam_type: z.enum(['ielts', 'pte', 'toefl', 'practical', 'final_exam', 'mock_test', 'other']),
  exam_name: z.string().min(1, 'Exam name required'),
  exam_date: z.string().optional(),
  centre: z.string().optional(),
  hall_ticket_number: z.string().optional(),
})

const resultSchema = z.object({
  score: z.string().min(1, 'Score required'),
  is_passed: z.boolean(),
  remarks: z.string().optional(),
})

type ExamFormData = z.infer<typeof examSchema>
type ResultFormData = z.infer<typeof resultSchema>

interface ExamTrackerProps {
  studentId: string
  exams: ExamRecord[]
  onUpdate: () => void
}

export function ExamTracker({ studentId, exams, onUpdate }: ExamTrackerProps) {
  const [showAddExam, setShowAddExam] = useState(false)
  const [resultExam, setResultExam] = useState<ExamRecord | null>(null)
  const [admitCardExam, setAdmitCardExam] = useState<ExamRecord | null>(null)
  const [isPending, startTransition] = useTransition()
  const supabase = createClient()

  const examForm = useForm<ExamFormData>({ resolver: zodResolver(examSchema) })
  const resultForm = useForm<ResultFormData>({ resolver: zodResolver(resultSchema) })

  async function onAddExam(data: ExamFormData) {
    startTransition(async () => {
      try {
        const { error } = await supabase.from('student_exams').insert({
          student_id: studentId,
          ...data,
          exam_date: data.exam_date || null,
          centre: data.centre || null,
          hall_ticket_number: data.hall_ticket_number || null,
        } as never)
        if (error) throw error
        toast.success('Exam added')
        examForm.reset()
        setShowAddExam(false)
        onUpdate()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to add exam')
      }
    })
  }

  async function onAddResult(data: ResultFormData) {
    if (!resultExam) return
    startTransition(async () => {
      try {
        const { error } = await supabase.from('student_exams').update({
          score: data.score,
          is_passed: data.is_passed,
          remarks: data.remarks || null,
        } as never).eq('id', resultExam.id)
        if (error) throw error
        toast.success('Result added')
        resultForm.reset()
        setResultExam(null)
        onUpdate()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to add result')
      }
    })
  }

  async function handleAdmitCardUpload(examId: string, url: string) {
    const { error } = await supabase.from('student_exams').update({ admit_card_url: url } as never).eq('id', examId)
    if (error) { toast.error('Failed to save admit card'); return }
    toast.success('Admit card uploaded')
    setAdmitCardExam(null)
    onUpdate()
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setShowAddExam(true)}>
          <Plus className="w-4 h-4 mr-1" /> Add Exam
        </Button>
      </div>

      {exams.length === 0 ? (
        <p className="text-center text-gray-500 py-8 text-sm">No exams recorded yet</p>
      ) : (
        <div className="space-y-3">
          {exams.map((exam) => (
            <div key={exam.id} className="bg-white rounded-lg border p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{exam.exam_name}</span>
                    <Badge variant="outline" className="text-xs">{EXAM_TYPE_LABELS[exam.exam_type]}</Badge>
                    {exam.is_passed !== null && (
                      <Badge className={exam.is_passed ? 'bg-green-100 text-green-800 border-0' : 'bg-red-100 text-red-800 border-0'}>
                        {exam.is_passed ? 'Passed' : 'Failed'}
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 mt-1 space-x-4">
                    {exam.exam_date && <span>Date: {format(new Date(exam.exam_date), 'dd MMM yyyy')}</span>}
                    {exam.centre && <span>Centre: {exam.centre}</span>}
                    {exam.hall_ticket_number && <span>Hall Ticket: {exam.hall_ticket_number}</span>}
                  </div>
                  {exam.score && <p className="text-sm mt-1">Score: <span className="font-medium">{exam.score}</span></p>}
                  {exam.remarks && <p className="text-xs text-gray-500 mt-1">{exam.remarks}</p>}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setAdmitCardExam(exam)}>
                    <Upload className="w-3 h-3 mr-1" />
                    {exam.admit_card_url ? 'Re-upload Card' : 'Admit Card'}
                  </Button>
                  {exam.admit_card_url && (
                    <a href={exam.admit_card_url} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" size="sm">View Card</Button>
                    </a>
                  )}
                  {!exam.score && (
                    <Button size="sm" onClick={() => setResultExam(exam)}>Add Result</Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Exam */}
      <Dialog open={showAddExam} onOpenChange={setShowAddExam}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Exam</DialogTitle></DialogHeader>
          <form onSubmit={examForm.handleSubmit(onAddExam)} className="space-y-4">
            <div>
              <Label>Exam Type *</Label>
              <Select onValueChange={(v) => examForm.setValue('exam_type', v as ExamType)}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(EXAM_TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Exam Name *</Label>
              <Input {...examForm.register('exam_name')} />
              {examForm.formState.errors.exam_name && <p className="text-xs text-red-500">{examForm.formState.errors.exam_name.message}</p>}
            </div>
            <div><Label>Exam Date</Label><Input type="date" {...examForm.register('exam_date')} /></div>
            <div><Label>Centre</Label><Input {...examForm.register('centre')} /></div>
            <div><Label>Hall Ticket Number</Label><Input {...examForm.register('hall_ticket_number')} /></div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowAddExam(false)}>Cancel</Button>
              <Button type="submit" disabled={isPending}>{isPending ? 'Adding...' : 'Add Exam'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Result */}
      <Dialog open={!!resultExam} onOpenChange={(o) => { if (!o) setResultExam(null) }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Result — {resultExam?.exam_name}</DialogTitle></DialogHeader>
          <form onSubmit={resultForm.handleSubmit(onAddResult)} className="space-y-4">
            <div><Label>Score *</Label><Input {...resultForm.register('score')} placeholder="e.g. 7.5" />{resultForm.formState.errors.score && <p className="text-xs text-red-500">{resultForm.formState.errors.score.message}</p>}</div>
            <div>
              <Label>Result *</Label>
              <Select onValueChange={(v) => resultForm.setValue('is_passed', v === 'true')}>
                <SelectTrigger><SelectValue placeholder="Pass or Fail?" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Passed</SelectItem>
                  <SelectItem value="false">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Remarks</Label><Textarea {...resultForm.register('remarks')} rows={2} /></div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setResultExam(null)}>Cancel</Button>
              <Button type="submit" disabled={isPending}>{isPending ? 'Saving...' : 'Save Result'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Admit Card upload */}
      <Dialog open={!!admitCardExam} onOpenChange={(o) => { if (!o) setAdmitCardExam(null) }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Upload Admit Card — {admitCardExam?.exam_name}</DialogTitle></DialogHeader>
          <FileUpload
            bucket="admit-cards"
            onUploadComplete={(url) => admitCardExam && handleAdmitCardUpload(admitCardExam.id, url)}
            accept=".pdf,.jpg,.jpeg,.png"
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
