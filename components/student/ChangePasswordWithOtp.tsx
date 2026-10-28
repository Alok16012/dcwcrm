'use client'
import { useEffect, useState } from 'react'
import { Lock, Eye, EyeOff, MailCheck, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import { withBase } from '@/lib/base-path'

async function post(path: string, body?: unknown) {
  const res = await fetch(withBase(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => ({}))
  return { ok: res.ok, ...json } as { ok: boolean; error?: string; [k: string]: unknown }
}

/** Two steps: choose the new password, then confirm with a code emailed to the student. */
export function ChangePasswordWithOtp() {
  const [newPass, setNewPass] = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [step, setStep] = useState<'password' | 'otp'>('password')
  const [otp, setOtp] = useState('')
  const [sentTo, setSentTo] = useState('')
  const [busy, setBusy] = useState(false)
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (cooldown <= 0) return
    const id = setTimeout(() => setCooldown(c => c - 1), 1000)
    return () => clearTimeout(id)
  }, [cooldown])

  const passwordOk = newPass.length >= 6 && newPass === confirmPass

  async function sendCode() {
    if (newPass.length < 6) { toast.error('Password must be at least 6 characters'); return }
    if (newPass !== confirmPass) { toast.error('Passwords do not match'); return }
    setBusy(true)
    const r = await post('/api/student/password-otp')
    setBusy(false)
    if (!r.ok) {
      if (typeof r.retryAfter === 'number') setCooldown(r.retryAfter)
      toast.error(r.error ?? 'Could not send the code')
      return
    }
    setSentTo(String(r.sentTo ?? 'your email'))
    setCooldown(Number(r.resendAfter ?? 60))
    setOtp('')
    setStep('otp')
    toast.success(`Code sent to ${r.sentTo}`)
  }

  async function verifyAndChange() {
    if (!/^\d{6}$/.test(otp)) { toast.error('Enter the 6-digit code'); return }
    setBusy(true)
    const r = await post('/api/student/change-password', { otp, newPassword: newPass })
    if (!r.ok) {
      setBusy(false)
      toast.error(r.error ?? 'Could not change the password')
      if (r.expired) setOtp('')
      return
    }
    toast.success('Password changed. Please log in with your new password.')
    await createClient().auth.signOut()
    window.location.replace(withBase('/student/login'))
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-4">
      <h3 className="font-semibold text-gray-900 flex items-center gap-2"><Lock className="h-4 w-4 text-blue-500" /> Change Password</h3>

      {step === 'password' ? (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs font-medium text-gray-600">New Password</Label>
            <div className="relative">
              <Input className="h-9 text-sm pr-10" type={showNew ? 'text' : 'password'} placeholder="Min. 6 characters"
                value={newPass} onChange={e => setNewPass(e.target.value)} autoComplete="new-password" />
              <button type="button" aria-label={showNew ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" onClick={() => setShowNew(v => !v)}>
                {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-medium text-gray-600">Confirm Password</Label>
            <Input className="h-9 text-sm" type="password" placeholder="Repeat new password"
              value={confirmPass} onChange={e => setConfirmPass(e.target.value)} autoComplete="new-password" />
            {confirmPass && newPass !== confirmPass && <p className="text-xs text-red-500">Passwords do not match</p>}
          </div>
          <Button onClick={sendCode} disabled={busy || !passwordOk || cooldown > 0} className="w-full h-9 text-sm">
            <MailCheck className="h-3.5 w-3.5 mr-1.5" />
            {busy ? 'Sending code…' : cooldown > 0 ? `Send code again in ${cooldown}s` : 'Send verification code'}
          </Button>
          <p className="text-[11px] text-gray-400 text-center">We&apos;ll email a 6-digit code to your registered email to confirm it&apos;s you.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-xl bg-blue-50 border border-blue-100 px-3 py-2.5 text-xs text-blue-800">
            We sent a 6-digit code to <b>{sentTo}</b>. It expires in 10 minutes.
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-medium text-gray-600">Verification code</Label>
            <Input className="h-11 text-center text-lg font-semibold tracking-[0.5em]" inputMode="numeric" autoComplete="one-time-code"
              maxLength={6} placeholder="••••••" autoFocus value={otp}
              onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              onKeyDown={e => { if (e.key === 'Enter') verifyAndChange() }} />
          </div>
          <Button onClick={verifyAndChange} disabled={busy || otp.length !== 6} className="w-full h-9 text-sm">
            <Lock className="h-3.5 w-3.5 mr-1.5" />{busy ? 'Changing…' : 'Verify & change password'}
          </Button>
          <div className="flex items-center justify-between text-xs">
            <button type="button" onClick={() => setStep('password')} className="inline-flex items-center gap-1 text-gray-500 hover:text-gray-800">
              <ArrowLeft className="h-3 w-3" /> Change password
            </button>
            <button type="button" onClick={sendCode} disabled={busy || cooldown > 0}
              className="text-blue-600 font-medium disabled:text-gray-400">
              {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
            </button>
          </div>
          <p className="text-[11px] text-gray-400">Didn&apos;t get it? Check spam, or contact support if your registered email is wrong.</p>
        </div>
      )}

      <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-3 text-xs text-yellow-700">
        After changing your password, you will need to log in again with the new password. Your login ID (enrollment number) remains the same.
      </div>
    </div>
  )
}
