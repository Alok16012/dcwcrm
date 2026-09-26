'use client'
import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import Image from 'next/image'
import { Briefcase, GraduationCap, ArrowLeft, ArrowRight } from 'lucide-react'
import { isBbRole } from '@/lib/bb/constants'

const loginSchema = z.object({
  email: z.string().email('Valid email required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

type LoginFormData = z.infer<typeof loginSchema>

type Brand = 'dcw' | 'bb'

/**
 * The two businesses share one login screen but not one account. A DCW login
 * cannot open Berojgar Bharat and the reverse is equally refused — picking the
 * wrong side here is caught after authentication and the session is dropped,
 * so a mis-click never lands someone in the other company's data.
 */
const BRANDS = {
  dcw: {
    name: 'Distance Courses Wala',
    short: 'DCW',
    tagline: 'Admissions, fees and student lifecycle',
    logo: '/brand-logo.png',
    mark: '/brand-logo.png',
    /** A white glyph — reads correctly straight on the brand colour. */
    logoOnLight: false,
    icon: GraduationCap,
    panel: 'from-blue-700 to-indigo-900',
    panelBase: 'bg-blue-600',
    button: 'bg-blue-600 hover:bg-blue-700 shadow-blue-200',
    ring: 'focus:border-blue-500 focus:ring-blue-500',
    accent: 'text-blue-600',
    cardHover: 'hover:border-blue-500 hover:shadow-blue-100',
    chip: 'bg-blue-50 text-blue-700',
    home: '/dashboard',
  },
  bb: {
    name: 'Berojgar Bharat',
    short: 'BB',
    tagline: 'Jobs, candidates and placements',
    /** Full lockup, emblem over wordmark — only legible at panel size. */
    logo: '/bb-logo.png',
    /** Emblem alone, for tiles too small for the wordmark. */
    mark: '/bb-mark.png',
    /** Full-colour artwork on transparency — needs a light tile behind it. */
    logoOnLight: true,
    icon: Briefcase,
    panel: 'from-emerald-700 to-teal-900',
    panelBase: 'bg-emerald-600',
    button: 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200',
    ring: 'focus:border-emerald-500 focus:ring-emerald-500',
    accent: 'text-emerald-600',
    cardHover: 'hover:border-emerald-500 hover:shadow-emerald-100',
    chip: 'bg-emerald-50 text-emerald-700',
    home: '/bb/dashboard',
  },
} as const

export default function LoginPage() {
  const [brand, setBrand] = useState<Brand | null>(null)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  // Most people work for one company; remember which so they choose once.
  useEffect(() => {
    try {
      const saved = localStorage.getItem('dcw.brand')
      if (saved === 'dcw' || saved === 'bb') setBrand(saved)
    } catch {}
  }, [])

  function choose(next: Brand) {
    setBrand(next)
    try {
      localStorage.setItem('dcw.brand', next)
    } catch {}
  }

  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  async function onSubmit(data: LoginFormData) {
    if (!brand) return
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      })
      if (error) {
        toast.error(error.message)
        return
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast.error('Could not read your account')
        return
      }

      const { data: profile } = await supabase
        .from('profiles').select('role').eq('id', user.id).single() as { data: { role: string } | null }

      const role = profile?.role ?? null
      const belongsToBb = isBbRole(role)

      // Wrong door: end the session rather than bouncing them around, so no
      // half-authenticated state is left behind.
      if (brand === 'bb' && !belongsToBb) {
        await supabase.auth.signOut()
        toast.error('This account is not a Berojgar Bharat account')
        return
      }
      if (brand === 'dcw' && belongsToBb) {
        await supabase.auth.signOut()
        toast.error('This is a Berojgar Bharat account — choose Berojgar Bharat to sign in')
        return
      }

      if (belongsToBb) { window.location.replace('/bb/dashboard'); return }
      if (role === 'associate') { window.location.replace('/associate'); return }
      window.location.replace('/dashboard')
    } catch {
      toast.error('Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  // ------------------------------------------------------ brand chooser ---
  if (!brand) {
    return (
      <Card className="w-full max-w-4xl shadow-2xl border-none mx-4 p-8 md:p-12 bg-white">
        <div className="text-center max-w-lg mx-auto">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Choose your workspace</h1>
          <p className="text-gray-500 mt-2 text-sm">
            Two businesses, two sets of accounts. Pick the one you work for.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 mt-10 max-w-3xl mx-auto">
          {(Object.keys(BRANDS) as Brand[]).map(key => {
            const b = BRANDS[key]
            const Icon = b.icon
            return (
              <button
                key={key}
                onClick={() => choose(key)}
                className={`group text-left rounded-2xl border-2 border-gray-200 bg-white p-6 transition-all hover:shadow-xl ${b.cardHover}`}
              >
                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center overflow-hidden ${
                    b.logoOnLight ? 'bg-white border border-gray-200 p-1' : b.panelBase
                  }`}
                >
                  {b.mark ? (
                    <Image
                      src={b.mark}
                      alt=""
                      width={56}
                      height={56}
                      className={b.logoOnLight ? 'w-full h-full object-contain' : 'w-11 h-11 object-contain'}
                    />
                  ) : (
                    <Icon className="w-7 h-7 text-white" />
                  )}
                </div>

                <h2 className="mt-5 text-xl font-bold text-gray-900">{b.name}</h2>
                <p className="text-sm text-gray-500 mt-1">{b.tagline}</p>

                <span
                  className={`mt-5 inline-flex items-center gap-1.5 text-sm font-semibold ${b.accent}`}
                >
                  Sign in
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </button>
            )
          })}
        </div>

        <p className="text-center text-sm text-gray-500 mt-10">
          Developed by{' '}
          <a href="https://blinks-ai.com" target="_blank" rel="noopener noreferrer" className="font-semibold text-blue-600 hover:text-blue-700">
            Blinks AI
          </a>
        </p>
      </Card>
    )
  }

  // ------------------------------------------------------- login form ----
  const b = BRANDS[brand]
  const Icon = b.icon

  return (
    <Card className="w-full max-w-5xl shadow-2xl overflow-hidden border-none mx-4">
      <div className="flex flex-col md:flex-row min-h-[600px]">
        {/* Left Side - Brand & Visuals */}
        <div className={`w-full md:w-5/12 ${b.panelBase} p-12 text-white flex-col justify-between relative overflow-hidden hidden md:flex`}>
          <div className={`absolute inset-0 bg-gradient-to-br ${b.panel} opacity-90 z-0`}></div>

          <div className="relative z-10 flex flex-col items-center justify-center h-full text-center">
            {b.logo ? (
              b.logoOnLight ? (
                <div className="w-36 h-36 rounded-3xl bg-white flex items-center justify-center p-4 shadow-lg">
                  <Image src={b.logo} alt={`${b.name} logo`} width={144} height={144} className="w-full h-full object-contain" priority />
                </div>
              ) : (
                <Image src={b.logo} alt={`${b.name} logo`} width={96} height={96} className="w-24 h-24 object-contain" priority />
              )
            ) : (
              <div className="w-24 h-24 rounded-3xl bg-white/15 backdrop-blur flex items-center justify-center">
                <Icon className="w-12 h-12 text-white" />
              </div>
            )}
            <h1 className="text-3xl font-bold tracking-tight mt-5">{b.name}</h1>
            <p className="text-white/70 text-sm mt-2">{b.tagline}</p>
          </div>

          <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-white rounded-full mix-blend-overlay filter blur-3xl opacity-20 z-0 animate-pulse"></div>
          <div className="absolute top-1/4 -right-24 w-64 h-64 bg-white rounded-full mix-blend-overlay filter blur-3xl opacity-20 z-0"></div>
        </div>

        {/* Right Side - Login Form */}
        <div className="w-full md:w-7/12 p-8 md:p-16 bg-white flex flex-col justify-center relative">
          <button
            onClick={() => setBrand(null)}
            className="absolute top-6 left-6 inline-flex items-center gap-1.5 text-sm font-medium text-gray-400 hover:text-gray-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Change workspace
          </button>

          <div className="flex md:hidden items-center gap-3 mb-8 mt-8 justify-center">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center overflow-hidden ${
              b.logoOnLight ? 'bg-white border border-gray-200 p-0.5' : b.panelBase
            }`}>
              {b.mark ? (
                <Image
                  src={b.mark}
                  alt=""
                  width={48}
                  height={48}
                  className={b.logoOnLight ? 'w-full h-full object-contain' : 'w-10 h-10 object-contain'}
                />
              ) : (
                <Icon className="w-6 h-6 text-white" />
              )}
            </div>
            <h1 className="text-xl font-bold tracking-tight text-gray-900">{b.name}</h1>
          </div>

          <div className="max-w-md w-full mx-auto space-y-8">
            <div className="text-center md:text-left">
              <span className={`inline-block text-xs font-bold px-2.5 py-1 rounded-full ${b.chip}`}>
                {b.short}
              </span>
              <h3 className="text-3xl font-bold text-gray-900 tracking-tight mt-3">Welcome back</h3>
              <p className="text-gray-500 mt-2 text-sm">Please enter your details to sign in.</p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium text-gray-700">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@company.com"
                  className={`rounded-xl h-11 border-gray-300 transition-shadow ${b.ring}`}
                  {...register('email')}
                  autoComplete="email"
                />
                {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-sm font-medium text-gray-700">Password</Label>
                  <a href="#" className={`text-sm font-medium ${b.accent} hover:opacity-80 transition-opacity`}>
                    Forgot password?
                  </a>
                </div>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  className={`rounded-xl h-11 border-gray-300 transition-shadow ${b.ring}`}
                  {...register('password')}
                  autoComplete="current-password"
                />
                {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>}
              </div>

              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  className="h-4 w-4 focus:ring-gray-400 border-gray-300 rounded cursor-pointer"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-700 cursor-pointer">
                  Remember me for 30 days
                </label>
              </div>

              <Button
                type="submit"
                className={`w-full rounded-xl h-12 shadow-lg text-white transition-all font-semibold ${b.button}`}
                disabled={loading}
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  'Sign in'
                )}
              </Button>
            </form>

            <p className="text-center text-sm text-gray-500 mt-8">
              Developed by{' '}
              <a href="https://blinks-ai.com" target="_blank" rel="noopener noreferrer" className="font-semibold text-blue-600 hover:text-blue-700 transition-colors">
                Blinks AI
              </a>
            </p>
          </div>
        </div>
      </div>
    </Card>
  )
}
