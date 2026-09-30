import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import nodemailer from 'nodemailer'

type Body = {
  associate_id?: string
  pdf_base64?: string   // certificate PDF generated on the client
  file_name?: string
}

const esc = (v: string) =>
  v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// Emails an approved associate their login ID, password and Certificate of
// Association. Same SMTP setup as the salary slip mail:
//   SMTP_USER, SMTP_PASS, optional SMTP_HOST (default smtp.gmail.com), SMTP_FROM
// CRM_PUBLIC_URL overrides the login link (default distancecourseswala.com/crm).
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

    const { associate_id, pdf_base64, file_name } = await req.json() as Body
    if (!associate_id || !pdf_base64) {
      return NextResponse.json({ error: 'Missing associate_id or certificate' }, { status: 400 })
    }

    const { data: assoc } = await supabase
      .from('associates')
      .select('id, name, email, status, associate_code, temp_password')
      .eq('id', associate_id)
      .maybeSingle() as { data: { id: string; name: string; email: string | null; status: string; associate_code: string | null; temp_password: string | null } | null }

    if (!assoc) return NextResponse.json({ error: 'Associate not found' }, { status: 404 })
    if (assoc.status !== 'approved') return NextResponse.json({ error: 'Associate approved nahi hai' }, { status: 400 })
    if (!assoc.email) return NextResponse.json({ error: 'Associate ka email registered nahi hai' }, { status: 400 })
    if (!assoc.temp_password) {
      return NextResponse.json({ error: 'Password stored nahi hai — pehle Reset Password karein' }, { status: 400 })
    }

    const loginUrl = `${(process.env.CRM_PUBLIC_URL || 'https://distancecourseswala.com/crm').replace(/\/+$/, '')}/login?brand=dcw`
    const code = assoc.associate_code ?? '—'

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT || 465),
      secure: (process.env.SMTP_PORT || '465') === '465',
      auth: { user: smtpUser, pass: smtpPass },
    })

    const row = (label: string, value: string) =>
      `<tr><td style="padding:6px 12px;color:#64748b;font-size:13px">${label}</td>` +
      `<td style="padding:6px 12px;font-weight:600;font-size:14px;color:#0f172a">${esc(value)}</td></tr>`

    await transporter.sendMail({
      from: process.env.SMTP_FROM || `Distance Courses Wala <${smtpUser}>`,
      to: assoc.email,
      subject: 'Welcome to Distance Courses Wala — your Associate login',
      text:
        `Dear ${assoc.name},\n\n` +
        `Welcome to Distance Courses Wala! Your associate account has been approved.\n\n` +
        `Associate ID: ${code}\n` +
        `Login Email: ${assoc.email}\n` +
        `Password: ${assoc.temp_password}\n\n` +
        `Login here: ${loginUrl}\n` +
        `Please change your password after your first login.\n\n` +
        `Your Certificate of Association is attached.\n\n` +
        `Regards,\nDistance Courses Wala`,
      html:
        `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#334155">` +
        `<h2 style="color:#1e3a5f;margin-bottom:4px">Welcome to Distance Courses Wala</h2>` +
        `<p>Dear ${esc(assoc.name)},</p>` +
        `<p>Your associate account has been <b>approved</b>. Here are your login details:</p>` +
        `<table style="border:1px solid #e2e8f0;border-radius:8px;border-collapse:separate;background:#f8fafc">` +
        row('Associate ID', code) + row('Login Email', assoc.email) + row('Password', assoc.temp_password) +
        `</table>` +
        `<p style="margin:20px 0"><a href="${esc(loginUrl)}" style="background:#2563eb;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600">Login to your portal</a></p>` +
        `<p style="font-size:13px">Please change your password after your first login.</p>` +
        `<p style="font-size:13px">Your <b>Certificate of Association</b> is attached to this email.</p>` +
        `<p>Regards,<br/>Distance Courses Wala</p></div>`,
      attachments: [{
        filename: file_name || `Associate_Certificate_${code}.pdf`,
        content: Buffer.from(pdf_base64, 'base64'),
        contentType: 'application/pdf',
      }],
    })

    return NextResponse.json({ ok: true, sent_to: assoc.email })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Internal server error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
