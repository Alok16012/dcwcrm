import { NextRequest, NextResponse } from 'next/server'
import { adminClient, currentPortalStudent, otpMatches, OTP_MAX_ATTEMPTS } from '@/lib/student-otp'

// Changes a portal student's password once the emailed OTP checks out.
export async function POST(req: NextRequest) {
  try {
    const student = await currentPortalStudent()
    if (!student) return NextResponse.json({ error: 'Please log in again' }, { status: 401 })

    const { otp, newPassword } = await req.json() as { otp?: string; newPassword?: string }
    const code = String(otp ?? '').trim()
    if (!/^\d{6}$/.test(code)) return NextResponse.json({ error: 'Enter the 6-digit code from your email' }, { status: 400 })
    if (!newPassword || newPassword.length < 6) return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })

    const db = adminClient()
    const { data: row } = await db.from('student_password_otps')
      .select('code_hash, expires_at, attempts').eq('student_id', student.id).maybeSingle()

    if (!row || !row.code_hash) return NextResponse.json({ error: 'Request a new code first' }, { status: 400 })
    if (new Date(row.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: 'This code has expired. Request a new one.', expired: true }, { status: 400 })
    }
    if (row.attempts >= OTP_MAX_ATTEMPTS) {
      return NextResponse.json({ error: 'Too many wrong attempts. Request a new code.', expired: true }, { status: 400 })
    }

    if (!otpMatches(code, student.id, row.code_hash)) {
      const attempts = row.attempts + 1
      await db.from('student_password_otps').update({ attempts }).eq('student_id', student.id)
      const left = OTP_MAX_ATTEMPTS - attempts
      return NextResponse.json({
        error: left > 0 ? `Wrong code. ${left} attempt${left > 1 ? 's' : ''} left.` : 'Too many wrong attempts. Request a new code.',
        expired: left <= 0,
      }, { status: 400 })
    }

    const { error } = await db.auth.admin.updateUserById(student.userId, { password: newPassword })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    // The code is single-use; keep sent_at so the hourly limit still applies.
    await db.from('student_password_otps').update({ code_hash: '', expires_at: new Date().toISOString() }).eq('student_id', student.id)
    // Keep the copy staff see in the admin panel's Access tab in step (as before).
    await db.from('students').update({ portal_temp_password: newPassword }).eq('id', student.id)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('change-password failed', err)
    return NextResponse.json({ error: 'Could not change the password. Please try again.' }, { status: 500 })
  }
}
