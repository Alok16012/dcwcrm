'use client'
import { useState, useCallback, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FileDown, Plus, X, RefreshCw } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────
interface PaperPrice { label: string; price: string }
interface PlanConfig {
  name: string; icon: string; tagline: string; featuresLabel: string
  papers: PaperPrice[]; features: string[]; guarantee: string; highlighted: boolean
}
interface FeeState {
  title: string; subtitle: string; sessionTag: string; boardTag: string
  website: string; ctaTitle: string; ctaSubtitle: string
  terms: string[]; plans: { basic: PlanConfig; standard: PlanConfig; premium: PlanConfig }
}

// ── Defaults ──────────────────────────────────────────────────────
const DEFAULT: FeeState = {
  title: '12th Admission Fee Plans',
  subtitle: 'Open School — Senior Secondary Program',
  sessionTag: 'July Session 2026',
  boardTag: 'BOSSE Board',
  website: 'distancecourseswala.in',
  ctaTitle: 'Admission Open Now',
  ctaSubtitle: 'Limited Time — Seats Filling Fast',
  terms: [
    'Fees are non-refundable (except guaranteed refund cases)',
    'Admission confirmed after full payment',
    'Limited seats available',
    'Documents required for final enrollment',
  ],
  plans: {
    basic: {
      name: 'Basic Plan', icon: '📋', tagline: 'Best for budget students — pass focus',
      featuresLabel: 'INCLUDED', highlighted: false, guarantee: '',
      papers: [{ label: '1 Paper', price: '' }, { label: '2 Papers', price: '' }, { label: '3 Papers', price: '' }],
      features: ['Confirm admission', 'WhatsApp updates', 'Call updates'],
    },
    standard: {
      name: 'Standard Plan', icon: '🎯', tagline: 'Best for proper guidance & safe results',
      featuresLabel: 'INCLUDED', highlighted: true, guarantee: '3 chance guarantee — else full refund',
      papers: [{ label: '1 Paper', price: '' }, { label: '2 Papers', price: '' }, { label: '3 Papers', price: '' }],
      features: ['Confirm admission', 'WhatsApp updates', 'Call updates by mentor', 'Dedicated mentor support', 'Practical support', 'Assignment support', 'Exam support', 'College admission support', 'Assured result', 'Document dispatch'],
    },
    premium: {
      name: 'Premium Plan', icon: '👑', tagline: 'Complete support — everything by DCW',
      featuresLabel: 'EVERYTHING IN STANDARD, PLUS', highlighted: false, guarantee: '3 chance guarantee — else full refund',
      papers: [{ label: '1 Paper', price: '' }, { label: '2 Papers', price: '' }, { label: '3 Papers', price: '' }],
      features: ['Confirm admission', 'WhatsApp updates', 'Call updates by mentor', 'Dedicated mentor support', 'Practical support — by DCW', 'Assignment support — by DCW', 'Exam support — by DCW', 'College admission support', 'Assured result', 'Document dispatch'],
    },
  },
}

// ── Lazy-load PDF document (client-only) ──────────────────────────
const FeePlanDocument = dynamic(() => import('./FeePlanDocument'), { ssr: false })

// ── Main component ────────────────────────────────────────────────
export function FeePlanBuilder() {
  const db = createClient() as any
  const [state, setState] = useState<FeeState>(DEFAULT)
  const [depts, setDepts] = useState<{ id: string; name: string }[]>([])
  const [courses, setCourses] = useState<{ id: string; name: string }[]>([])
  const [sessions, setSessions] = useState<{ id: string; name: string }[]>([])
  const [selDept, setSelDept] = useState('')
  const [selCourse, setSelCourse] = useState('')
  const [selSession, setSelSession] = useState('')
  const [showPDF, setShowPDF] = useState(false)

  useEffect(() => {
    Promise.all([
      db.from('departments').select('id,name').eq('is_active', true).order('name'),
      db.from('courses').select('id,name').eq('is_active', true).order('name'),
      db.from('sessions').select('id,name').eq('is_active', true).order('name'),
    ]).then(([d, c, s]) => {
      setDepts(d.data ?? [])
      setCourses(c.data ?? [])
      setSessions(s.data ?? [])
    })
  }, [])

  // Auto-fill prices from fee_structures when all three are selected
  const autoFill = useCallback(async (deptId: string, courseId: string, sessionId: string) => {
    if (!deptId || !courseId || !sessionId) return
    const { data } = await db.from('fee_structures')
      .select('*').eq('department_id', deptId).eq('course_id', courseId).eq('session_id', sessionId).single()
    if (!data) return
    const calc = (pct: number) => Math.round(data.actual_fee + data.actual_fee * pct / 100)
    setState(prev => ({
      ...prev,
      plans: {
        ...prev.plans,
        basic: { ...prev.plans.basic, papers: prev.plans.basic.papers.map((p, i) => i === 2 ? { ...p, price: String(calc(data.basic_percent)) } : p) },
        standard: { ...prev.plans.standard, papers: prev.plans.standard.papers.map((p, i) => i === 2 ? { ...p, price: String(calc(data.standard_percent)) } : p) },
        premium: { ...prev.plans.premium, papers: prev.plans.premium.papers.map((p, i) => i === 2 ? { ...p, price: String(calc(data.premium_percent)) } : p) },
      },
    }))
  }, [db])

  function set<K extends keyof FeeState>(key: K, val: FeeState[K]) {
    setState(prev => ({ ...prev, [key]: val }))
  }

  function setPlan(plan: keyof FeeState['plans'], key: keyof PlanConfig, val: any) {
    setState(prev => ({ ...prev, plans: { ...prev.plans, [plan]: { ...prev.plans[plan], [key]: val } } }))
  }

  function setPaperPrice(plan: keyof FeeState['plans'], idx: number, val: string) {
    setState(prev => {
      const papers = [...prev.plans[plan].papers]
      papers[idx] = { ...papers[idx], price: val }
      return { ...prev, plans: { ...prev.plans, [plan]: { ...prev.plans[plan], papers } } }
    })
  }

  function setPaperLabel(plan: keyof FeeState['plans'], idx: number, val: string) {
    setState(prev => {
      const papers = [...prev.plans[plan].papers]
      papers[idx] = { ...papers[idx], label: val }
      return { ...prev, plans: { ...prev.plans, [plan]: { ...prev.plans[plan], papers } } }
    })
  }

  function addPaper(plan: keyof FeeState['plans']) {
    setState(prev => ({
      ...prev,
      plans: { ...prev.plans, [plan]: { ...prev.plans[plan], papers: [...prev.plans[plan].papers, { label: '', price: '' }] } }
    }))
  }

  function removePaper(plan: keyof FeeState['plans'], idx: number) {
    setState(prev => {
      const papers = prev.plans[plan].papers.filter((_, i) => i !== idx)
      return { ...prev, plans: { ...prev.plans, [plan]: { ...prev.plans[plan], papers } } }
    })
  }

  function addFeature(plan: keyof FeeState['plans']) {
    setPlan(plan, 'features', [...state.plans[plan].features, ''])
  }

  function setFeature(plan: keyof FeeState['plans'], idx: number, val: string) {
    const features = [...state.plans[plan].features]
    features[idx] = val
    setPlan(plan, 'features', features)
  }

  function removeFeature(plan: keyof FeeState['plans'], idx: number) {
    setPlan(plan, 'features', state.plans[plan].features.filter((_, i) => i !== idx))
  }

  const fmtPrice = (p: string) => p ? `₹${Number(p).toLocaleString('en-IN')}` : '₹—'

  const planKeys = ['basic', 'standard', 'premium'] as const
  const planColors: Record<string, string> = { basic: '#60a5fa', standard: '#facc15', premium: '#c084fc' }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Fee Plan PDF Builder</h2>
          <p className="text-xs text-slate-500 mt-0.5">Design and download a branded fee plan PDF</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setState(DEFAULT)} className="gap-1.5 h-8">
            <RefreshCw className="w-3.5 h-3.5" /> Reset
          </Button>
          <Button size="sm" onClick={() => setShowPDF(true)} className="gap-1.5 h-8 bg-blue-600 hover:bg-blue-700">
            <FileDown className="w-3.5 h-3.5" /> Download PDF
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* ── LEFT: Form ── */}
        <div className="space-y-4">

          {/* Auto-fill from fee structure */}
          <div className="border rounded-xl p-4 bg-blue-50 border-blue-200 space-y-3">
            <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Auto-fill prices from Fee Structure</p>
            <div className="grid grid-cols-3 gap-2">
              <select value={selDept} onChange={e => { setSelDept(e.target.value); autoFill(e.target.value, selCourse, selSession) }}
                className="border rounded-lg px-2 h-8 text-xs bg-white">
                <option value="">Department</option>
                {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <select value={selCourse} onChange={e => { setSelCourse(e.target.value); autoFill(selDept, e.target.value, selSession) }}
                className="border rounded-lg px-2 h-8 text-xs bg-white">
                <option value="">Course</option>
                {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select value={selSession} onChange={e => { setSelSession(e.target.value); autoFill(selDept, selCourse, e.target.value) }}
                className="border rounded-lg px-2 h-8 text-xs bg-white">
                <option value="">Session</option>
                {sessions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <p className="text-[10px] text-blue-500">Fills the 3-paper price for each tier. You can still edit manually.</p>
          </div>

          {/* Header info */}
          <Section title="Header">
            <F label="Main Title"><Input value={state.title} onChange={e => set('title', e.target.value)} /></F>
            <F label="Subtitle"><Input value={state.subtitle} onChange={e => set('subtitle', e.target.value)} /></F>
            <div className="grid grid-cols-2 gap-3">
              <F label="Session Tag"><Input value={state.sessionTag} onChange={e => set('sessionTag', e.target.value)} placeholder="July Session 2026" /></F>
              <F label="Board Tag"><Input value={state.boardTag} onChange={e => set('boardTag', e.target.value)} placeholder="BOSSE Board" /></F>
            </div>
          </Section>

          {/* Plans */}
          {planKeys.map(key => {
            const plan = state.plans[key]
            const color = planColors[key]
            return (
              <Section key={key} title={`${plan.icon} ${plan.name}`} accentColor={color}>
                <div className="grid grid-cols-2 gap-3">
                  <F label="Plan Name"><Input value={plan.name} onChange={e => setPlan(key, 'name', e.target.value)} /></F>
                  <F label="Icon"><Input value={plan.icon} onChange={e => setPlan(key, 'icon', e.target.value)} className="text-center text-lg" /></F>
                  <F label="Tagline" className="col-span-2"><Input value={plan.tagline} onChange={e => setPlan(key, 'tagline', e.target.value)} /></F>
                </div>

                <div className="space-y-2 mt-2">
                  <p className="text-[11px] font-semibold text-slate-500 uppercase">Paper Prices</p>
                  {plan.papers.map((p, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <Input value={p.label} onChange={e => setPaperLabel(key, i, e.target.value)} placeholder="1 Paper" className="flex-1 h-8 text-xs" />
                      <Input value={p.price} onChange={e => setPaperPrice(key, i, e.target.value)} placeholder="₹0" type="number" className="flex-1 h-8 text-xs" />
                      <button onClick={() => removePaper(key, i)} className="text-slate-400 hover:text-red-500"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                  <button onClick={() => addPaper(key)} className="text-xs text-blue-600 hover:underline flex items-center gap-1"><Plus className="w-3 h-3" />Add row</button>
                </div>

                <div className="space-y-1.5 mt-2">
                  <p className="text-[11px] font-semibold text-slate-500 uppercase">Features</p>
                  <F label="Section Label"><Input value={plan.featuresLabel} onChange={e => setPlan(key, 'featuresLabel', e.target.value)} className="h-8 text-xs" /></F>
                  {plan.features.map((f, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <Input value={f} onChange={e => setFeature(key, i, e.target.value)} className="flex-1 h-8 text-xs" />
                      <button onClick={() => removeFeature(key, i)} className="text-slate-400 hover:text-red-500"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                  <button onClick={() => addFeature(key)} className="text-xs text-blue-600 hover:underline flex items-center gap-1"><Plus className="w-3 h-3" />Add feature</button>
                </div>

                <F label="Guarantee Text (optional)" className="mt-2">
                  <Input value={plan.guarantee} onChange={e => setPlan(key, 'guarantee', e.target.value)} placeholder="3 chance guarantee — else full refund" />
                </F>
              </Section>
            )
          })}

          {/* Terms */}
          <Section title="Terms & Conditions">
            {state.terms.map((t, i) => (
              <div key={i} className="flex gap-2 items-center">
                <Input value={t} onChange={e => { const terms = [...state.terms]; terms[i] = e.target.value; set('terms', terms) }} className="flex-1 h-8 text-xs" />
                <button onClick={() => set('terms', state.terms.filter((_, j) => j !== i))} className="text-slate-400 hover:text-red-500"><X className="w-3.5 h-3.5" /></button>
              </div>
            ))}
            <button onClick={() => set('terms', [...state.terms, ''])} className="text-xs text-blue-600 hover:underline flex items-center gap-1"><Plus className="w-3 h-3" />Add term</button>
          </Section>

          {/* CTA */}
          <Section title="Call to Action">
            <F label="Title"><Input value={state.ctaTitle} onChange={e => set('ctaTitle', e.target.value)} /></F>
            <F label="Website"><Input value={state.website} onChange={e => set('website', e.target.value)} /></F>
            <F label="Subtitle"><Input value={state.ctaSubtitle} onChange={e => set('ctaSubtitle', e.target.value)} /></F>
          </Section>
        </div>

        {/* ── RIGHT: Preview ── */}
        <div className="sticky top-4">
          <div className="rounded-xl overflow-hidden border border-slate-700 shadow-2xl" style={{ background: '#0f172a', fontFamily: 'system-ui,sans-serif', padding: '24px', minHeight: 560 }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 8, background: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: '#fff', fontSize: 14 }}>DCW</div>
                <div>
                  <div style={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>
                    <span style={{ color: '#60a5fa' }}>Distance</span> Courses Wala
                  </div>
                  <div style={{ color: '#94a3b8', fontSize: 10 }}>{state.website}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {state.sessionTag && <span style={{ background: '#facc15', color: '#000', borderRadius: 20, padding: '3px 10px', fontSize: 10, fontWeight: 700 }}>{state.sessionTag}</span>}
                {state.boardTag && <span style={{ border: '1px solid #475569', color: '#cbd5e1', borderRadius: 20, padding: '3px 10px', fontSize: 10 }}>{state.boardTag}</span>}
              </div>
            </div>

            {/* Title */}
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <h2 style={{ color: '#fff', fontSize: 18, fontWeight: 800, margin: 0 }}>{state.title}</h2>
              <p style={{ color: '#94a3b8', fontSize: 11, margin: '4px 0 0' }}>{state.subtitle}</p>
            </div>

            {/* Plans */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
              {planKeys.map(key => {
                const plan = state.plans[key]
                const isStd = plan.highlighted
                return (
                  <div key={key} style={{
                    border: isStd ? '2px solid #2563eb' : '1px solid #1e293b',
                    borderRadius: 10, padding: 12, background: isStd ? '#0f1e3a' : '#1e293b', position: 'relative'
                  }}>
                    {isStd && <div style={{ position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)', background: '#facc15', color: '#000', fontSize: 9, fontWeight: 700, borderRadius: 10, padding: '2px 8px' }}>Most Popular</div>}
                    <div style={{ color: '#fff', fontWeight: 700, fontSize: 12, marginBottom: 2 }}>{plan.icon} {plan.name}</div>
                    <div style={{ color: '#94a3b8', fontSize: 9, marginBottom: 10 }}>{plan.tagline}</div>
                    {plan.papers.map((p, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', color: '#cbd5e1', fontSize: 10, marginBottom: 3 }}>
                        <span>{p.label}</span>
                        <span style={{ color: '#fff', fontWeight: 600 }}>{fmtPrice(p.price)}</span>
                      </div>
                    ))}
                    {plan.features.length > 0 && (
                      <>
                        <div style={{ color: planColors[key], fontSize: 8, fontWeight: 700, marginTop: 8, marginBottom: 4, letterSpacing: 1 }}>{plan.featuresLabel}</div>
                        {plan.features.slice(0, 5).map((f, i) => (
                          <div key={i} style={{ color: '#94a3b8', fontSize: 9, marginBottom: 2 }}>✓ {f}</div>
                        ))}
                        {plan.features.length > 5 && <div style={{ color: '#64748b', fontSize: 8 }}>+{plan.features.length - 5} more…</div>}
                      </>
                    )}
                    {plan.guarantee && (
                      <div style={{ background: isStd ? '#1e3a5f' : '#0f2027', border: `1px solid ${planColors[key]}55`, borderRadius: 6, padding: '4px 8px', marginTop: 8, color: planColors[key], fontSize: 9, fontWeight: 600 }}>
                        {plan.guarantee}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Bottom row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <div style={{ color: '#facc15', fontSize: 10, fontWeight: 700, marginBottom: 6 }}>Terms & Conditions</div>
                {state.terms.map((t, i) => <div key={i} style={{ color: '#94a3b8', fontSize: 9, marginBottom: 3 }}>• {t}</div>)}
              </div>
              <div style={{ background: '#facc15', borderRadius: 10, padding: '12px 16px', textAlign: 'center' }}>
                <div style={{ fontWeight: 800, fontSize: 13, color: '#000' }}>{state.ctaTitle}</div>
                <div style={{ fontWeight: 700, fontSize: 11, color: '#000', margin: '2px 0' }}>{state.website}</div>
                <div style={{ fontSize: 9, color: '#1a1a1a' }}>{state.ctaSubtitle}</div>
              </div>
            </div>

            {/* Footer */}
            <div style={{ marginTop: 12, borderTop: '1px solid #1e293b', paddingTop: 8, textAlign: 'center', color: '#475569', fontSize: 8 }}>
              Distance Courses Wala — {state.boardTag} | {state.subtitle} | {state.sessionTag}
            </div>
          </div>

          {/* PDF Download — lazy loaded */}
          {showPDF && (
            <div className="mt-3">
              <FeePlanDocument state={state} onDone={() => setShowPDF(false)} />
            </div>
          )}
          {!showPDF && (
            <Button className="w-full mt-3 gap-2 bg-blue-600 hover:bg-blue-700" onClick={() => setShowPDF(true)}>
              <FileDown className="w-4 h-4" /> Download PDF
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

function Section({ title, children, accentColor }: { title: string; children: React.ReactNode; accentColor?: string }) {
  return (
    <div className="border rounded-xl p-4 space-y-3 bg-white">
      <h4 className="text-xs font-bold uppercase tracking-wide" style={{ color: accentColor ?? '#3b82f6' }}>{title}</h4>
      {children}
    </div>
  )
}

function F({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1 ${className ?? ''}`}>
      <Label className="text-xs font-medium text-slate-500">{label}</Label>
      {children}
    </div>
  )
}
