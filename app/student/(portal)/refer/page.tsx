'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Gift, Send, CheckCircle2, Users, Phone, User, BookOpen } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

interface Referral {
  id: string
  name: string
  phone: string
  interested_in: string | null
  created_at: string
}

export default function ReferPage() {
  const supabase = createClient() as any
  const [studentId, setStudentId] = useState('')
  const [studentName, setStudentName] = useState('')
  const [studentEnroll, setStudentEnroll] = useState('')
  const [referrals, setReferrals] = useState<Referral[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({ name: '', phone: '', interested_in: '' })

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { window.location.href = '/student/login'; return }

    const { data: s } = await supabase
      .from('students')
      .select('id, full_name, enrollment_number')
      .eq('portal_user_id', user.id)
      .single()
    if (!s) { window.location.href = '/student/login'; return }

    setStudentId(s.id)
    setStudentName(s.full_name)
    setStudentEnroll(s.enrollment_number)

    const { data: refs } = await supabase
      .from('student_referrals')
      .select('id, name, phone, interested_in, created_at')
      .eq('referred_by_student_id', s.id)
      .order('created_at', { ascending: false })
    setReferrals((refs ?? []) as Referral[])
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  async function submit() {
    if (!form.name.trim() || !form.phone.trim()) {
      toast.error('Name and phone are required')
      return
    }
    if (!/^\d{10}$/.test(form.phone.replace(/\D/g, ''))) {
      toast.error('Enter a valid 10-digit phone number')
      return
    }
    setSubmitting(true)
    try {
      const { error } = await supabase.from('student_referrals').insert({
        referred_by_student_id: studentId,
        referred_by_name: studentName,
        referred_by_enrollment: studentEnroll,
        name: form.name.trim(),
        phone: form.phone.trim(),
        interested_in: form.interested_in.trim() || null,
      })
      if (error) throw error
      toast.success('Referral submitted! We will contact them soon.')
      setForm({ name: '', phone: '', interested_in: '' })
      load()
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to submit referral')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="relative bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-6 text-white overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '18px 18px' }} />
        <div className="relative flex items-start gap-4">
          <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center shrink-0">
            <Gift className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold">Refer & Earn</h1>
            <p className="text-blue-200 text-sm mt-1">Know someone who wants to study? Refer them and earn rewards when they take admission!</p>
            <div className="flex gap-2 mt-3 flex-wrap">
              {['Refer a Friend', 'They Get Admission', 'You Earn Reward'].map((s, i) => (
                <span key={i} className="text-xs bg-white/20 px-2.5 py-1 rounded-full font-medium">{s}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Refer form */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Users className="h-4 w-4 text-blue-600" /> Refer Someone
        </h2>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-600 flex items-center gap-1">
                <User className="h-3 w-3" /> Full Name *
              </Label>
              <Input
                placeholder="Their full name"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-600 flex items-center gap-1">
                <Phone className="h-3 w-3" /> Phone Number *
              </Label>
              <Input
                placeholder="10-digit mobile number"
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                maxLength={10}
                className="h-9 text-sm"
                type="tel"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-gray-600 flex items-center gap-1">
              <BookOpen className="h-3 w-3" /> Interested In (Course / Program)
            </Label>
            <Textarea
              placeholder="e.g. 12th (Open School), B.A., Graduation, NIOS, IGNOU — what they want to study..."
              value={form.interested_in}
              onChange={e => setForm(f => ({ ...f, interested_in: e.target.value }))}
              rows={2}
              className="text-sm resize-none"
            />
          </div>
          <Button
            onClick={submit}
            disabled={submitting || !form.name.trim() || !form.phone.trim()}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white gap-2"
          >
            {submitting
              ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Submitting...</>
              : <><Send className="h-4 w-4" /> Submit Referral</>
            }
          </Button>
        </div>
      </div>

      {/* Past referrals */}
      {referrals.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-50 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <h2 className="font-semibold text-gray-900">My Referrals</h2>
            <span className="ml-auto text-xs text-gray-400">{referrals.length} submitted</span>
          </div>
          <div className="divide-y divide-gray-50">
            {referrals.map(r => (
              <div key={r.id} className="px-5 py-3.5 flex items-center gap-3">
                <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center shrink-0 text-blue-600 font-bold text-sm">
                  {r.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800">{r.name}</p>
                  <p className="text-xs text-gray-400 font-mono">{r.phone}</p>
                  {r.interested_in && <p className="text-xs text-blue-600 mt-0.5 truncate">{r.interested_in}</p>}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-gray-400">{new Date(r.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                  <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">Pending</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
        <p className="text-xs font-semibold text-blue-800 mb-1">📋 How it works</p>
        <p className="text-xs text-blue-700">Submit your friend's details. Our team will contact them. Once they take admission, you earn your reward. For reward details, contact your counsellor.</p>
      </div>
    </div>
  )
}
