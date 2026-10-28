import { createHmac, randomInt, timingSafeEqual } from 'crypto'
import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'
import { createServerClient } from '@/lib/supabase/server'

export const OTP_TTL_MIN = 10
export const OTP_MAX_ATTEMPTS = 5
export const OTP_RESEND_SECONDS = 60
export const OTP_MAX_PER_HOUR = 5

/** Service-role client: student_password_otps has no RLS policies. */
export function adminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export interface PortalStudent { id: string; full_name: string; email: string | null; enrollment_number: string; userId: string }

/** The signed-in portal student, from the session cookie. */
export async function currentPortalStudent(): Promise<PortalStudent | null> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await adminClient()
    .from('students')
    .select('id, full_name, email, enrollment_number')
    .eq('portal_user_id', user.id)
    .maybeSingle()
  if (!data) return null
  return { ...(data as Omit<PortalStudent, 'userId'>), userId: user.id }
}

export function newOtp(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0')
}

export function hashOtp(code: string, studentId: string): string {
  return createHmac('sha256', `${process.env.SUPABASE_SERVICE_ROLE_KEY}:${studentId}`).update(code).digest('hex')
}

export function otpMatches(code: string, studentId: string, storedHash: string): boolean {
  const a = Buffer.from(hashOtp(code, studentId), 'hex')
  const b = Buffer.from(storedHash, 'hex')
  return a.length === b.length && timingSafeEqual(a, b)
}

/** "ra****sh@gmail.com" — enough for the student to recognise, not enough to harvest. */
export function maskEmail(email: string): string {
  const [user = '', domain = ''] = email.split('@')
  const keep = user.length <= 2 ? 1 : 2
  return `${user.slice(0, keep)}${'*'.repeat(Math.max(2, user.length - keep * 2))}${user.length > 4 ? user.slice(-2) : ''}@${domain}`
}

export const smtpConfigured = () => Boolean(process.env.SMTP_USER && process.env.SMTP_PASS)

export async function sendOtpEmail(to: string, name: string, code: string) {
  const smtpUser = process.env.SMTP_USER!
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT || 465),
    secure: (process.env.SMTP_PORT || '465') === '465',
    auth: { user: smtpUser, pass: process.env.SMTP_PASS! },
  })
  const first = (name.split(' ')[0] ?? '').replace(/[<>&"]/g, '')
  await transporter.sendMail({
    from: process.env.SMTP_FROM || `Distance Courses Wala <${smtpUser}>`,
    to,
    subject: `${code} is your DCW Portal verification code`,
    text:
      `Hi ${first},\n\n` +
      `Your code to change your DCW Student Portal password is: ${code}\n\n` +
      `It expires in ${OTP_TTL_MIN} minutes. If you didn't ask to change your password, ignore this email ` +
      `and contact Distance Courses Wala support.\n`,
    html:
      `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;color:#0f172a">` +
      `<h2 style="color:#2563eb;margin-bottom:4px">DCW Student Portal</h2>` +
      `<p>Hi ${first},</p><p>Use this code to change your portal password:</p>` +
      `<p style="font-size:32px;font-weight:700;letter-spacing:8px;background:#eff6ff;padding:14px;text-align:center;border-radius:10px">${code}</p>` +
      `<p style="color:#64748b;font-size:13px">It expires in ${OTP_TTL_MIN} minutes. If you didn't ask to change your password, ` +
      `ignore this email and contact Distance Courses Wala support.</p></div>`,
  })
}
