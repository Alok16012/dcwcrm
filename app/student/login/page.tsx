'use client'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { GraduationCap, BookOpen, Award, Users } from 'lucide-react'
import Image from 'next/image'

const loginSchema = z.object({
  username: z.string().min(1, 'Enrollment number required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})
type LoginForm = z.infer<typeof loginSchema>

export default function StudentLoginPage() {
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  })

  async function onSubmit(data: LoginForm) {
    setLoading(true)
    try {
      // Convert enrollment number to the internal portal email format
      const rawUsername = data.username.trim()
      // Try as direct email first, then fall back to portal email format
      const portalEmail = rawUsername.includes('@')
        ? rawUsername
        : `${rawUsername.toLowerCase().replace(/[^a-z0-9]/g, '')}@dcwportal.in`

      const { error } = await supabase.auth.signInWithPassword({
        email: portalEmail,
        password: data.password,
      })
      if (error) {
        toast.error('Invalid enrollment number or password')
        return
      }
      window.location.replace('/student/dashboard')
    } catch {
      toast.error('Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 flex items-center justify-center p-4">
      <div className="w-full max-w-5xl">
        <Card className="overflow-hidden shadow-2xl border-none">
          <div className="flex flex-col md:flex-row min-h-[580px]">
            {/* Left — Brand */}
            <div className="hidden md:flex w-5/12 bg-gradient-to-br from-blue-700 to-indigo-900 p-10 flex-col justify-between relative overflow-hidden">
              <div className="absolute inset-0 bg-black/10 z-0" />
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                    <GraduationCap className="h-7 w-7 text-white" />
                  </div>
                  <div>
                    <h1 className="text-white font-bold text-lg leading-tight">Distance Courses Wala</h1>
                    <p className="text-blue-200 text-xs">Student Portal</p>
                  </div>
                </div>

                <h2 className="text-3xl font-extrabold text-white leading-snug mb-4">
                  Your Academic<br />Journey Starts<br />Here
                </h2>
                <p className="text-blue-200 text-sm leading-relaxed">
                  Track your admission, check exam status, access study materials, and stay updated — all in one place.
                </p>
              </div>

              <div className="relative z-10 space-y-3">
                {[
                  { icon: BookOpen, text: 'Study Materials & E-Books' },
                  { icon: Award, text: 'Admission & Result Tracking' },
                  { icon: Users, text: '24/7 Help & Support' },
                ].map(({ icon: Icon, text }) => (
                  <div key={text} className="flex items-center gap-3 bg-white/10 rounded-lg px-4 py-2.5">
                    <Icon className="h-4 w-4 text-blue-200 shrink-0" />
                    <span className="text-sm text-white">{text}</span>
                  </div>
                ))}
              </div>

              <div className="absolute -bottom-20 -left-20 w-56 h-56 bg-blue-500 rounded-full opacity-20 blur-3xl z-0" />
              <div className="absolute top-1/3 -right-16 w-48 h-48 bg-indigo-400 rounded-full opacity-20 blur-3xl z-0" />
            </div>

            {/* Right — Login Form */}
            <div className="flex-1 bg-white p-8 md:p-12 flex flex-col justify-center">
              <div className="max-w-sm w-full mx-auto">
                {/* Mobile header */}
                <div className="md:hidden flex items-center gap-3 mb-8 justify-center">
                  <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
                    <GraduationCap className="h-6 w-6 text-white" />
                  </div>
                  <h1 className="text-xl font-bold text-gray-900">Student Portal</h1>
                </div>

                <div className="mb-8">
                  <h3 className="text-2xl font-bold text-gray-900">Student Login</h3>
                  <p className="text-gray-500 text-sm mt-1">Enter your enrollment number and password</p>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                  <div className="space-y-1.5">
                    <Label htmlFor="username" className="text-sm font-medium text-gray-700">
                      Enrollment Number
                    </Label>
                    <Input
                      id="username"
                      placeholder="e.g. ENR-123456"
                      className="h-11 rounded-xl border-gray-300 focus:border-blue-500"
                      {...register('username')}
                      autoComplete="username"
                    />
                    {errors.username && <p className="text-xs text-red-500">{errors.username.message}</p>}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="password" className="text-sm font-medium text-gray-700">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      className="h-11 rounded-xl border-gray-300 focus:border-blue-500"
                      {...register('password')}
                      autoComplete="current-password"
                    />
                    {errors.password && <p className="text-xs text-red-500">{errors.password.message}</p>}
                  </div>

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow"
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : 'Sign In to Portal'}
                  </Button>
                </form>

                <div className="mt-8 p-4 bg-blue-50 rounded-xl border border-blue-100">
                  <p className="text-xs text-blue-700 font-medium mb-1">Need help logging in?</p>
                  <p className="text-xs text-blue-600">
                    Contact your counsellor or write to us on WhatsApp. Your enrollment number is your login ID.
                  </p>
                </div>

                <p className="text-center text-xs text-gray-400 mt-6">
                  Powered by{' '}
                  <a href="https://blinks-ai.com" target="_blank" rel="noopener noreferrer" className="text-blue-500 font-medium">
                    Blinks AI
                  </a>
                </p>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
