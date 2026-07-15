'use client'
import { useState } from 'react'
import { pdf } from '@react-pdf/renderer'
import { MessageCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { InvoicePDF } from './InvoicePDF'
import { Student, Payment } from '@/types/app.types'
import { toast } from 'sonner'

const SENDER_NUMBER = '7654711784'

interface SendInvoiceWhatsAppButtonProps {
    student: Student
}

function normalizePhone(raw?: string): string | null {
    if (!raw) return null
    let digits = raw.replace(/\D/g, '')
    if (digits.length === 10) digits = '91' + digits
    else if (digits.length === 12 && digits.startsWith('91')) { /* already ok */ }
    else if (digits.length === 11 && digits.startsWith('0')) digits = '91' + digits.slice(1)
    return digits.length >= 11 ? digits : null
}

export function SendInvoiceWhatsAppButton({ student }: SendInvoiceWhatsAppButtonProps) {
    const [loading, setLoading] = useState(false)
    const supabase = createClient()

    async function handleSend(e: React.MouseEvent) {
        e.stopPropagation()

        const phone = normalizePhone(student.phone)
        if (!phone) {
            toast.error('Student ka valid phone number nahi hai')
            return
        }

        setLoading(true)
        try {
            const [paymentsRes, logoBase64] = await Promise.all([
                supabase.from('payments').select('*').eq('student_id', student.id).order('payment_date', { ascending: true }),
                fetch('/brand-logo.png').then(r => r.blob()).then(blob => new Promise<string>((resolve) => {
                    const reader = new FileReader()
                    reader.onloadend = () => resolve(reader.result as string)
                    reader.readAsDataURL(blob)
                })).catch(() => ''),
            ])
            if (paymentsRes.error) throw paymentsRes.error
            const payments = (paymentsRes.data ?? []) as Payment[]

            const blob = await pdf(
                <InvoicePDF student={student} payments={payments} logoBase64={logoBase64} />
            ).toBlob()

            const safeName = student.full_name.replace(/\s+/g, '_')
            const path = `invoices/${student.id}/Invoice_${safeName}_${Date.now()}.pdf`
            const { error: upErr } = await supabase.storage
                .from('student-documents')
                .upload(path, blob, { upsert: true, contentType: 'application/pdf' })
            if (upErr) throw upErr

            const { data: urlData } = supabase.storage.from('student-documents').getPublicUrl(path)
            const invoiceUrl = urlData.publicUrl

            const course = student.course?.name
            const standard = student.sub_course?.name
            const courseLine = course
                ? standard ? `${course} (${standard})` : course
                : 'apne course'

            const message =
                `Dear ${student.full_name}, 🙏\n\n` +
                `Thank you for taking admission in ${courseLine} at Distance Courses Wala. ` +
                `We truly appreciate your trust in us!\n\n` +
                `You can download your invoice here:\n${invoiceUrl}\n\n` +
                `- Team Distance Courses Wala`

            const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
            window.open(waUrl, '_blank', 'noopener,noreferrer')
            toast.success('WhatsApp khul gaya — Send dabana baaki hai')
        } catch (err) {
            toast.error('Invoice bhejne me dikkat aayi')
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    return (
        <Button
            variant="ghost"
            size="sm"
            className="w-full flex justify-start pl-2 text-green-600 hover:text-green-700 hover:bg-green-50"
            disabled={loading}
            onClick={handleSend}
        >
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageCircle className="mr-2 h-4 w-4" />}
            Send Invoice
        </Button>
    )
}
