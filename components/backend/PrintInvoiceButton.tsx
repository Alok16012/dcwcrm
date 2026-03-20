'use client'
import { useState } from 'react'
import { PDFDownloadLink } from '@react-pdf/renderer'
import { FileText, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { InvoicePDF } from './InvoicePDF'
import { Student, Payment } from '@/types/app.types'
import { toast } from 'sonner'

interface PrintInvoiceButtonProps {
    student: Student
}

export function PrintInvoiceButton({ student }: PrintInvoiceButtonProps) {
    const [loading, setLoading] = useState(false)
    const [payments, setPayments] = useState<Payment[]>([])
    const [ready, setReady] = useState(false)
    const supabase = createClient()

    async function handlePrepare() {
        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('payments')
                .select('*')
                .eq('student_id', student.id)
                .order('payment_date', { ascending: true })

            if (error) throw error
            setPayments(data ?? [])
            setReady(true)
        } catch (err) {
            toast.error('Failed to load payment history')
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    if (ready) {
        return (
            <PDFDownloadLink
                document={<InvoicePDF student={student} payments={payments} />}
                fileName={`Invoice_${student.full_name.replace(/\s+/g, '_')}.pdf`}
                className="flex items-center"
            >
                {({ loading: pdfLoading }) => (
                    <Button variant="outline" size="sm" className="w-full flex justify-start pl-2" disabled={pdfLoading}>
                        {pdfLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                        {pdfLoading ? 'Generating...' : 'Download Invoice'}
                    </Button>
                )}
            </PDFDownloadLink>
        )
    }

    return (
        <Button
            variant="ghost"
            size="sm"
            className="w-full flex justify-start pl-2"
            disabled={loading}
            onClick={(e) => {
                e.stopPropagation()
                handlePrepare()
            }}
        >
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
            Print Invoice
        </Button>
    )
}
