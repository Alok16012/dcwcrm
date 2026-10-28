import { NextResponse } from 'next/server'
import {
  adminClient, currentPortalStudent, hashOtp, maskEmail, newOtp, sendOtpEmail, smtpConfigured,
  OTP_MAX_PER_HOUR, OTP_RESEND_SECONDS, OTP_TTL_MIN,
} from '@/lib/student-otp'

// Emails a 6-digit code to the student's registered email before a password
// change. Uses the same SMTP env vars as the other CRM mails (SMTP_USER, SMTP_PASS,
// optional SMTP_HOST / SMTP_PORT / SMTP_FROM).
export async function POST() {
  try {
    const student = await currentPortalStudent()
    if (!student) return NextResponse.json({ error: 'Please log in again' }, { status: 401 })

    const email = student.email?.trim()
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({
        error: 'No valid email on your record. Please contact Distance Courses Wala support to add your email, then try again.',
      }, { status: 400 })
    }

    const dev = process.env.NODE_ENV === 'development'
    if (!smtpConfigured() && !dev) {
      return NextResponse.json({ error: 'Email service is not set up yet. Please contact support.' }, { status: 503 })
    }

    const db = adminClient()
    const { data: existing } = await db.from('student_password_otps').select('sent_at').eq('student_id', student.id).maybeSingle()
    const now = Date.now()
    const recent = ((existing?.sent_at ?? []) as string[]).map(t => new Date(t).getTime()).filter(t => now - t < 3600_000)
    const last = Math.max(0, ...recent)
    if (now - last < OTP_RESEND_SECONDS * 1000) {
      const wait = Math.ceil((OTP_RESEND_SECONDS * 1000 - (now - last)) / 1000)
      return NextResponse.json({ error: `Please wait ${wait}s before requesting another code`, retryAfter: wait }, { status: 429 })
    }
    if (recent.length >= OTP_MAX_PER_HOUR) {
      return NextResponse.json({ error: 'Too many codes requested. Please try again in an hour.' }, { status: 429 })
    }

    const code = newOtp()
    const { error } = await db.from('student_password_otps').upsert({
      student_id: student.id,
      code_hash: hashOtp(code, student.id),
      expires_at: new Date(now + OTP_TTL_MIN * 60_000).toISOString(),
      attempts: 0,
      sent_at: [...recent.map(t => new Date(t).toISOString()), new Date(now).toISOString()],
    })
    if (error) return NextResponse.json({ error: 'Could not create a code. Please try again.' }, { status: 500 })

    if (smtpConfigured()) {
      await sendOtpEmail(email, student.full_name, code)
    } else {
      // Local development without SMTP: print the code instead of mailing it.
      console.log(`[dev] Password OTP for ${student.enrollment_number}: ${code}`)
    }

    return NextResponse.json({ sentTo: maskEmail(email), expiresInMin: OTP_TTL_MIN, resendAfter: OTP_RESEND_SECONDS })
  } catch (err) {
    console.error('password-otp send failed', err)
    return NextResponse.json({ error: 'Could not send the code. Please try again.' }, { status: 500 })
  }
}
