'use client'
import { useState } from 'react'
import { toast } from 'sonner'
import { Building2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { APP_URL } from '@/lib/branding'

export default function WalkInForm() {
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [city, setCity] = useState('')
  const [courseInterest, setCourseInterest] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [counselorName, setCounselorName] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const res = await fetch(`${APP_URL}/api/walkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: fullName, phone, email, city, course_interest: courseInterest, notes }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Something went wrong')
        return
      }
      setCounselorName(data.counselorName ?? null)
      setSubmitted(true)
      toast.success(data.message || 'Welcome to DCW!')
    } catch {
      toast.error('Network error — please try again')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-8 pb-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">✓</span>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Welcome to DCW!</h2>
            <p className="text-sm text-gray-600 mb-1">Your details have been saved. A counselor will meet you shortly.</p>
            {counselorName && (
              <p className="text-sm text-blue-700 font-medium mt-2">Assigned counselor: {counselorName}</p>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center pb-4">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
              <Building2 className="w-6 h-6 text-white" />
            </div>
          </div>
          <CardTitle className="text-xl">Walk-In Registration</CardTitle>
          <p className="text-sm text-gray-500 mt-1">Fill in your details and a counselor will assist you right away.</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label className="mb-1.5 block">Full Name <span className="text-red-500">*</span></Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Enter your full name" required />
            </div>
            <div>
              <Label className="mb-1.5 block">Phone Number <span className="text-red-500">*</span></Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="10-digit mobile number" type="tel" required />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="mb-1.5 block">Email (optional)</Label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" type="email" />
              </div>
              <div>
                <Label className="mb-1.5 block">City</Label>
                <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Your city" />
              </div>
            </div>
            <div>
              <Label className="mb-1.5 block">Course Interest (optional)</Label>
              <Input value={courseInterest} onChange={(e) => setCourseInterest(e.target.value)} placeholder="e.g. BCA, MCA, MBA" />
            </div>
            <div>
              <Label className="mb-1.5 block">Any notes (optional)</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="How did you hear about us, specific queries, etc." className="min-h-16" />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Registering…' : 'Register & Meet Counselor'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
