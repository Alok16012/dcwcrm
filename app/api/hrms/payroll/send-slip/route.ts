import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import nodemailer from 'nodemailer'

type Body = {
    payroll_id?: string
    pdf_base64?: string   // salary slip PDF generated on the client
    file_name?: string
}

// Emails the salary slip PDF to the employee's registered email.
// Needs SMTP env vars on the server (e.g. Gmail with an app password):
//   SMTP_USER, SMTP_PASS, optional SMTP_HOST (default smtp.gmail.com), SMTP_FROM
export async function POST(req: NextRequest) {
    try {
        const supabase = await createServerClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single() as { data: { role: string } | null }
        if (!['admin', 'backend'].includes(profile?.role ?? '')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const smtpUser = process.env.SMTP_USER
        const smtpPass = process.env.SMTP_PASS
        if (!smtpUser || !smtpPass) {
            return NextResponse.json({
                error: 'Email not configured. Vercel me SMTP_USER aur SMTP_PASS (Gmail app password) env vars set karein.',
            }, { status: 400 })
        }

        const { payroll_id, pdf_base64, file_name } = await req.json() as Body
        if (!payroll_id || !pdf_base64) {
            return NextResponse.json({ error: 'Missing payroll_id or pdf' }, { status: 400 })
        }

        const { data: pay } = await supabase
            .from('payroll')
            .select('id, month, year, net, employee_id')
            .eq('id', payroll_id)
            .maybeSingle() as { data: { id: string; month: number; year: number; net: number; employee_id: string } | null }
        if (!pay) return NextResponse.json({ error: 'Payroll not found' }, { status: 404 })

        const { data: emp } = await supabase
            .from('employees')
            .select('profile_id')
            .eq('id', pay.employee_id)
            .single() as { data: { profile_id: string } | null }

        const { data: empProfile } = emp
            ? await supabase.from('profiles').select('full_name, email').eq('id', emp.profile_id).single() as { data: { full_name: string; email: string | null } | null }
            : { data: null }

        if (!empProfile?.email) {
            return NextResponse.json({ error: 'Employee ka email registered nahi hai' }, { status: 400 })
        }

        const monthName = new Date(pay.year, pay.month - 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })

        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: Number(process.env.SMTP_PORT || 465),
            secure: (process.env.SMTP_PORT || '465') === '465',
            auth: { user: smtpUser, pass: smtpPass },
        })

        await transporter.sendMail({
            from: process.env.SMTP_FROM || `Distance Courses Wala <${smtpUser}>`,
            to: empProfile.email,
            subject: `Salary Slip — ${monthName}`,
            text:
                `Dear ${empProfile.full_name},\n\n` +
                `Please find attached your salary slip for ${monthName}.\n\n` +
                `Regards,\nDistance Courses Wala`,
            attachments: [{
                filename: file_name || `Salary_Slip_${monthName.replace(' ', '_')}.pdf`,
                content: Buffer.from(pdf_base64, 'base64'),
                contentType: 'application/pdf',
            }],
        })

        return NextResponse.json({ ok: true, sent_to: empProfile.email })
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'Internal server error'
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}
