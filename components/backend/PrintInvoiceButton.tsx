'use client'
import { withBase } from '@/lib/base-path'
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
    const [logoBase64, setLogoBase64] = useState<string>('')
    const [ready, setReady] = useState(false)
    const supabase = createClient()

    async function handlePrepare() {
        setLoading(true)
        try {
            const [paymentsRes, logoRes] = await Promise.all([
                supabase.from('payments').select('*').eq('student_id', student.id).order('payment_date', { ascending: true }),
                fetch(withBase('/brand-logo.png')).then(r => r.blob()).then(blob => new Promise<string>((resolve) => {
                    const reader = new FileReader()
                    reader.onloadend = () => resolve(reader.result as string)
                    reader.readAsDataURL(blob)
                })).catch(() => ''),
            ])
            if (paymentsRes.error) throw paymentsRes.error
            setPayments(paymentsRes.data ?? [])
            setLogoBase64(logoRes)
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
                document={<InvoicePDF student={student} payments={payments} logoBase64={logoBase64} />}
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
