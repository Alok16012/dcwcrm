'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { User, Phone, Mail, MapPin, GraduationCap, Users, Lock, Save, Eye, EyeOff, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

interface StudentProfile {
  id: string
  full_name: string
  phone: string
  email: string | null
  enrollment_number: string
  dob: string | null
  gender: string | null
  address: string | null
  city: string | null
  state: string | null
  pincode: string | null
  father_name: string | null
  guardian_name: string | null
  guardian_phone: string | null
  guardian_relationship: string | null
  university_name: string | null
  board_name: string | null
  course?: { name: string } | null
  sub_course?: { name: string } | null
  department?: { name: string } | null
  sub_section?: { name: string } | null
  session?: { name: string } | null
  portal_username: string | null
}

export default function ProfilePage() {
  const supabase = createClient()
  const [student, setStudent] = useState<StudentProfile | null>(null)
  const [tab, setTab] = useState<'personal' | 'course' | 'contact' | 'security'>('personal')
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<Partial<StudentProfile>>({})

  // Password change
  const [oldPass, setOldPass] = useState('')
  const [newPass, setNewPass] = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [showOld, setShowOld] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [changingPass, setChangingPass] = useState(false)

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await (supabase as any)
      .from('students')
      .select(`
        id, full_name, phone, email, enrollment_number, dob, gender,
        address, city, state, pincode, father_name, guardian_name,
        guardian_phone, guardian_relationship, university_name, board_name, portal_username,
        course:courses(name), sub_course:sub_courses(name),
        department:departments(name), sub_section:department_sub_sections(name),
        session:sessions(name)
      `)
      .eq('portal_user_id', user.id)
      .single()
    if (data) {
      setStudent(data as unknown as StudentProfile)
      setForm({
        phone: (data as unknown as StudentProfile).phone,
        email: (data as unknown as StudentProfile).email,
        address: (data as unknown as StudentProfile).address,
        city: (data as unknown as StudentProfile).city,
        state: (data as unknown as StudentProfile).state,
        pincode: (data as unknown as StudentProfile).pincode,
      })
    }
  }, [supabase])

  useEffect(() => { load() }, [load])

  async function saveContactInfo() {
    if (!student) return
    setSaving(true)
    const { error } = await (supabase as any)
      .from('students')
      .update({ phone: form.phone, email: form.email, address: form.address, city: form.city, state: form.state, pincode: form.pincode })
      .eq('id', student.id)
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success('Contact information updated')
    load()
  }

  async function changePassword() {
    if (!newPass || newPass.length < 6) { toast.error('Password must be at least 6 characters'); return }
    if (newPass !== confirmPass) { toast.error('Passwords do not match'); return }
    setChangingPass(true)
    const { error } = await supabase.auth.updateUser({ password: newPass })
    setChangingPass(false)
    if (error) { toast.error(error.message); return }
    toast.success('Password changed successfully!')
    setOldPass(''); setNewPass(''); setConfirmPass('')
  }

  if (!student) return (
    <div className="flex items-center justify-center h-48">
      <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const TABS = [
    { key: 'personal', label: 'Personal', icon: User },
    { key: 'course', label: 'Course', icon: GraduationCap },
    { key: 'contact', label: 'Contact', icon: Phone },
    { key: 'security', label: 'Security', icon: Lock },
  ] as const

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold text-gray-900">My Profile</h1>
        <p className="text-sm text-gray-500 mt-0.5">View and update your personal information</p>
      </div>

      {/* Avatar + basic info */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-5 text-white flex items-center gap-4">
        <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center text-2xl font-bold shrink-0">
          {student.full_name.charAt(0).toUpperCase()}
        </div>
        <div>
          <h2 className="text-lg font-bold">{student.full_name}</h2>
          <p className="text-blue-100 text-sm">{student.enrollment_number}</p>
          {student.portal_username && (
            <p className="text-blue-200 text-xs mt-0.5">Login ID: {student.portal_username}</p>
          )}
        </div>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key as typeof tab)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all ${tab === key ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Personal details */}
      {tab === 'personal' && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-4">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2"><User className="h-4 w-4 text-blue-500" /> Personal Details</h3>
          <div className="grid grid-cols-2 gap-x-6 gap-y-3">
            {[
              { label: 'Full Name', value: student.full_name },
              { label: 'Date of Birth', value: student.dob ? new Date(student.dob).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '—' },
              { label: 'Gender', value: student.gender ? student.gender.charAt(0).toUpperCase() + student.gender.slice(1) : '—' },
              { label: 'Phone', value: student.phone },
              { label: 'Email', value: student.email ?? '—' },
              { label: 'Father\'s Name', value: student.father_name ?? '—' },
              { label: 'Guardian Name', value: student.guardian_name ?? '—' },
              { label: 'Guardian Phone', value: student.guardian_phone ?? '—' },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-xs text-gray-400">{label}</p>
                <p className="text-sm font-medium text-gray-800 mt-0.5">{value}</p>
              </div>
            ))}
          </div>
          <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-700">
            To update your personal details (name, DOB, gender), please contact your counsellor.
          </div>
        </div>
      )}

      {/* Course details */}
      {tab === 'course' && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-4">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2"><GraduationCap className="h-4 w-4 text-blue-500" /> Course & Board Information</h3>
          <div className="grid grid-cols-2 gap-x-6 gap-y-3">
            {[
              { label: 'Course', value: student.course?.name ?? '—' },
              { label: 'Standard / Level', value: student.sub_course?.name ?? '—' },
              { label: 'Board / University', value: student.department?.name ?? '—' },
              { label: 'University Name', value: student.university_name ?? student.sub_section?.name ?? '—' },
              { label: 'Board Name', value: student.board_name ?? '—' },
              { label: 'Session', value: student.session?.name ?? '—' },
              { label: 'Enrollment No.', value: student.enrollment_number },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-xs text-gray-400">{label}</p>
                <p className="text-sm font-medium text-gray-800 mt-0.5">{value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Contact info — editable */}
      {tab === 'contact' && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-4">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2"><Phone className="h-4 w-4 text-blue-500" /> Contact Information</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-medium text-gray-600">Phone Number</Label>
              <Input className="h-9 text-sm" value={form.phone ?? ''} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-gray-600">Email Address</Label>
              <Input className="h-9 text-sm" type="email" value={form.email ?? ''} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="space-y-1 col-span-2">
              <Label className="text-xs font-medium text-gray-600">Address</Label>
              <Input className="h-9 text-sm" value={form.address ?? ''} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-gray-600">City</Label>
              <Input className="h-9 text-sm" value={form.city ?? ''} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-gray-600">State</Label>
              <Input className="h-9 text-sm" value={form.state ?? ''} onChange={e => setForm(f => ({ ...f, state: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-gray-600">Pincode</Label>
              <Input className="h-9 text-sm" value={form.pincode ?? ''} onChange={e => setForm(f => ({ ...f, pincode: e.target.value }))} />
            </div>
          </div>
          <Button onClick={saveContactInfo} disabled={saving} className="w-full h-9 text-sm">
            <Save className="h-3.5 w-3.5 mr-1.5" />
            {saving ? 'Saving...' : 'Save Contact Info'}
          </Button>
        </div>
      )}

      {/* Security */}
      {tab === 'security' && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-4">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2"><Lock className="h-4 w-4 text-blue-500" /> Change Password</h3>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs font-medium text-gray-600">New Password</Label>
              <div className="relative">
                <Input
                  className="h-9 text-sm pr-10"
                  type={showNew ? 'text' : 'password'}
                  placeholder="Min. 6 characters"
                  value={newPass}
                  onChange={e => setNewPass(e.target.value)}
                />
                <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" onClick={() => setShowNew(v => !v)}>
                  {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-gray-600">Confirm Password</Label>
              <Input
                className="h-9 text-sm"
                type="password"
                placeholder="Repeat new password"
                value={confirmPass}
                onChange={e => setConfirmPass(e.target.value)}
              />
              {confirmPass && newPass !== confirmPass && (
                <p className="text-xs text-red-500">Passwords do not match</p>
              )}
            </div>
            <Button onClick={changePassword} disabled={changingPass || !newPass || newPass !== confirmPass} className="w-full h-9 text-sm">
              <Lock className="h-3.5 w-3.5 mr-1.5" />
              {changingPass ? 'Changing...' : 'Change Password'}
            </Button>
          </div>
          <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-3 text-xs text-yellow-700">
            After changing your password, you will need to log in again with the new password. Your login ID (enrollment number) remains the same.
          </div>
        </div>
      )}
    </div>
  )
}
