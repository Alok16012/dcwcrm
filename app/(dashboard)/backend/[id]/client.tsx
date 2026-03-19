'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StudentRecord } from '@/components/backend/StudentRecord'
import { FeeTracker } from '@/components/backend/FeeTracker'
import { DocumentChecklist } from '@/components/backend/DocumentChecklist'
import { ExamTracker } from '@/components/backend/ExamTracker'
import { createClient } from '@/lib/supabase/client'
import type { Student, Payment } from '@/types/app.types'

interface DocRecord {
  id: string
  student_id: string
  doc_type: string
  status: 'pending' | 'received' | 'verified' | 'rejected'
  file_url: string | null
  notes: string | null
  expiry_date: string | null
}

interface ExamRecord {
  id: string
  student_id: string
  exam_type: string
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

interface Props {
  student: Student
  payments: Payment[]
  documents: DocRecord[]
  exams: ExamRecord[]
}

export function StudentDetailClient({ student: initialStudent, payments: initialPayments, documents: initialDocs, exams: initialExams }: Props) {
  const router = useRouter()
  const [student] = useState(initialStudent)
  const [payments, setPayments] = useState(initialPayments)
  const [documents, setDocuments] = useState(initialDocs)
  const [exams, setExams] = useState(initialExams)
  const supabase = createClient()

  async function refreshPayments() {
    const { data } = await supabase
      .from('payments')
      .select('*, recorder:profiles(id, email, full_name, role, is_active, created_at)')
      .eq('student_id', student.id)
      .order('payment_date', { ascending: false })
    setPayments((data ?? []) as never)
  }

  async function refreshDocuments() {
    const { data } = await supabase.from('student_documents').select('*').eq('student_id', student.id)
    setDocuments((data ?? []) as never)
  }

  async function refreshExams() {
    const { data } = await supabase.from('student_exams').select('*').eq('student_id', student.id).order('created_at', { ascending: false })
    setExams((data ?? []) as never)
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <h1 className="text-xl font-bold flex-1">{student.full_name}</h1>
        <span className="text-sm text-gray-500 font-mono">{student.enrollment_number}</span>
      </div>

      <Tabs defaultValue="profile">
        <TabsList className="mb-4">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="fees">Fee Tracker</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="exams">Exams & Results</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card>
            <CardHeader><CardTitle>Student Profile</CardTitle></CardHeader>
            <CardContent>
              <StudentRecord student={student} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fees">
          <FeeTracker
            student={student}
            payments={payments as never}
            onPaymentAdded={refreshPayments}
          />
        </TabsContent>

        <TabsContent value="documents">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Document Checklist</CardTitle>
                <Button variant="ghost" size="sm" onClick={refreshDocuments}>
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <DocumentChecklist
                studentId={student.id}
                documents={documents as never}
                onUpdate={refreshDocuments}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="exams">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Exams & Results</CardTitle>
                <Button variant="ghost" size="sm" onClick={refreshExams}>
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <ExamTracker
                studentId={student.id}
                exams={exams as never}
                onUpdate={refreshExams}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
