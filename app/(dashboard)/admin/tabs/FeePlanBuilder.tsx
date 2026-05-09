'use client'
import { useState, useCallback, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FileDown, RefreshCw } from 'lucide-react'

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

const ALL_FEATURES = [
  'Confirm Admission',
  'WhatsApp Updates',
  'Call Updates',
  'Call Updates by Mentor',
  'Dedicated Mentor Support',
  'Practical Support',
  'Practical Support by DCW',
  'Assignment Support',
  'Assignment Support by DCW',
  'Exam Support',
  'Exam Support by DCW',
  'College Admission Support',
  'Assured Result',
  'Document Dispatch',
]

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
      papers: [{ label: '1 Paper', price: '' }, { label: '2 Papers', price: '' }, { label: '3 Papers', price: '' }, { label: 'Full Subject', price: '' }],
      features: ['Confirm Admission', 'WhatsApp Updates', 'Call Updates'],
    },
    standard: {
      name: 'Standard Plan', icon: '🎯', tagline: 'Best for proper guidance & safe results',
      featuresLabel: 'INCLUDED', highlighted: true, guarantee: '3 chance guarantee — else full refund',
      papers: [{ label: '1 Paper', price: '' }, { label: '2 Papers', price: '' }, { label: '3 Papers', price: '' }, { label: 'Full Subject', price: '' }],
      features: ['Confirm Admission', 'WhatsApp Updates', 'Call Updates by Mentor', 'Dedicated Mentor Support', 'Practical Support', 'Assignment Support', 'Exam Support', 'College Admission Support', 'Assured Result', 'Document Dispatch'],
    },
    premium: {
      name: 'Premium Plan', icon: '👑', tagline: 'Complete support — everything by DCW',
      featuresLabel: 'EVERYTHING IN STANDARD, PLUS', highlighted: false, guarantee: '3 chance guarantee — else full refund',
      papers: [{ label: '1 Paper', price: '' }, { label: '2 Papers', price: '' }, { label: '3 Papers', price: '' }, { label: 'Full Subject', price: '' }],
      features: ['Confirm Admission', 'WhatsApp Updates', 'Call Updates by Mentor', 'Dedicated Mentor Support', 'Practical Support by DCW', 'Assignment Support by DCW', 'Exam Support by DCW', 'College Admission Support', 'Assured Result', 'Document Dispatch'],
    },
  },
}

const FeePlanDocument = dynamic(() => import('./FeePlanDocument'), { ssr: false })

const PLAN_COLOR: Record<string, string> = { basic: '#60a5fa', standard: '#facc15', premium: '#c084fc' }
const PLAN_TEXT: Record<string, string> = { basic: 'text-blue-700', standard: 'text-yellow-700', premium: 'text-purple-700' }
const PLAN_BORDER: Record<string, string> = { basic: 'border-blue-200 bg-blue-50', standard: 'border-yellow-200 bg-yellow-50', premium: 'border-purple-200 bg-purple-50' }

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
    ]).then(([d, c, s]: any[]) => {
      setDepts(d.data ?? [])
      setCourses(c.data ?? [])
      setSessions(s.data ?? [])
    })
  }, [])

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
        basic: { ...prev.plans.basic, papers: prev.plans.basic.papers.map((p, i, arr) => i === arr.length - 1 ? { ...p, price: String(calc(data.basic_percent)) } : p) },
        standard: { ...prev.plans.standard, papers: prev.plans.standard.papers.map((p, i, arr) => i === arr.length - 1 ? { ...p, price: String(calc(data.standard_percent)) } : p) },
        premium: { ...prev.plans.premium, papers: prev.plans.premium.papers.map((p, i, arr) => i === arr.length - 1 ? { ...p, price: String(calc(data.premium_percent)) } : p) },
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
  function toggleFeature(plan: keyof FeeState['plans'], feat: string) {
    const features = state.plans[plan].features
    setPlan(plan, 'features', features.includes(feat) ? features.filter(f => f !== feat) : [...features, feat])
  }

  const fmtPrice = (p: string) => p ? `₹${Number(p).toLocaleString('en-IN')}` : '₹—'
  const planKeys = ['basic', 'standard', 'premium'] as const

  return (
    <div className="space-y-5">
      {/* Top bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Fee Plan PDF Builder</h2>
          <p className="text-xs text-slate-500 mt-0.5">Design and download a branded DCW fee plan PDF</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { setState(DEFAULT); setShowPDF(false) }} className="gap-1.5 h-8">
            <RefreshCw className="w-3.5 h-3.5" /> Reset
          </Button>
          <Button size="sm" onClick={() => setShowPDF(true)} className="gap-1.5 h-8 bg-blue-600 hover:bg-blue-700">
            <FileDown className="w-3.5 h-3.5" /> Download PDF
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_460px] gap-6 items-start">

        {/* ── LEFT: Form ── */}
        <div className="space-y-4">

          {/* Auto-fill */}
          <div className="border rounded-xl p-4 bg-blue-50 border-blue-200 space-y-3">
            <p className="text-xs font-bold text-blue-700 uppercase tracking-wide">Auto-fill Prices from Fee Structure</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Department', val: selDept, items: depts, set: (v: string) => { setSelDept(v); autoFill(v, selCourse, selSession) } },
                { label: 'Course', val: selCourse, items: courses, set: (v: string) => { setSelCourse(v); autoFill(selDept, v, selSession) } },
                { label: 'Session', val: selSession, items: sessions, set: (v: string) => { setSelSession(v); autoFill(selDept, selCourse, v) } },
              ].map(({ label, val, items, set: onChange }) => (
                <div key={label} className="space-y-1">
                  <label className="text-[10px] font-semibold text-blue-600">{label}</label>
                  <select value={val} onChange={e => onChange(e.target.value)}
                    className="w-full border border-blue-200 rounded-lg px-2 h-8 text-xs bg-white">
                    <option value="">Select…</option>
                    {items.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-blue-500">Select all 3 → auto-fills "Full Subject" price per tier. 1/2/3 Paper rows stay manual.</p>
          </div>

          {/* Header */}
          <div className="border rounded-xl p-4 bg-white space-y-3">
            <p className="text-xs font-bold text-blue-600 uppercase tracking-wide">Document Header</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1"><Label className="text-xs text-slate-500">Main Title</Label><Input value={state.title} onChange={e => set('title', e.target.value)} /></div>
              <div className="col-span-2 space-y-1"><Label className="text-xs text-slate-500">Subtitle</Label><Input value={state.subtitle} onChange={e => set('subtitle', e.target.value)} /></div>
              <div className="space-y-1"><Label className="text-xs text-slate-500">Session Tag</Label><Input value={state.sessionTag} onChange={e => set('sessionTag', e.target.value)} placeholder="July Session 2026" /></div>
              <div className="space-y-1"><Label className="text-xs text-slate-500">Board Tag</Label><Input value={state.boardTag} onChange={e => set('boardTag', e.target.value)} placeholder="BOSSE Board" /></div>
              <div className="space-y-1"><Label className="text-xs text-slate-500">Website</Label><Input value={state.website} onChange={e => set('website', e.target.value)} /></div>
            </div>
          </div>

          {/* Plan prices */}
          <div className="border rounded-xl p-4 bg-white space-y-4">
            <p className="text-xs font-bold text-blue-600 uppercase tracking-wide">Plan Prices & Settings</p>
            <div className="grid grid-cols-3 gap-3">
              {planKeys.map(key => {
                const plan = state.plans[key]
                return (
                  <div key={key} className={`border rounded-xl p-3 space-y-2.5 ${PLAN_BORDER[key]}`}>
                    <div className="flex items-center gap-1.5">
                      <Input value={plan.icon} onChange={e => setPlan(key, 'icon', e.target.value)} className="w-10 h-7 text-sm text-center bg-white/80 px-1" />
                      <Input value={plan.name} onChange={e => setPlan(key, 'name', e.target.value)} className="flex-1 h-7 text-xs font-bold bg-white/80" />
                    </div>
                    <Input value={plan.tagline} onChange={e => setPlan(key, 'tagline', e.target.value)} placeholder="Tagline…" className="h-7 text-[10px] bg-white/80" />
                    <div className="space-y-1.5">
                      <p className={`text-[9px] font-bold uppercase ${PLAN_TEXT[key]}`}>Prices</p>
                      {plan.papers.map((p, i) => (
                        <div key={i} className="flex gap-1.5">
                          <Input value={p.label}
                            onChange={e => { const papers = [...plan.papers]; papers[i] = { ...p, label: e.target.value }; setPlan(key, 'papers', papers) }}
                            placeholder="1 Paper" className="flex-1 h-7 text-[10px] bg-white/80" />
                          <Input value={p.price} onChange={e => setPaperPrice(key, i, e.target.value)}
                            type="number" placeholder="0" className="w-20 h-7 text-[10px] bg-white/80" />
                        </div>
                      ))}
                    </div>
                    <div className="space-y-1">
                      <Label className={`text-[9px] font-bold uppercase ${PLAN_TEXT[key]}`}>Guarantee</Label>
                      <Input value={plan.guarantee} onChange={e => setPlan(key, 'guarantee', e.target.value)} placeholder="3 chance guarantee…" className="h-7 text-[10px] bg-white/80" />
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={plan.highlighted} onChange={e => setPlan(key, 'highlighted', e.target.checked)} className="w-3.5 h-3.5 rounded" />
                      <span className="text-[10px] font-medium text-slate-600">Mark "Most Popular"</span>
                    </label>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Features checkboxes */}
          <div className="border rounded-xl p-4 bg-white space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-blue-600 uppercase tracking-wide">Plan Features</p>
              <p className="text-[10px] text-slate-400">Tick which features each plan includes</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[400px]">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left text-slate-500 font-medium pb-2.5 pr-3 w-48">Feature</th>
                    {planKeys.map(key => (
                      <th key={key} className={`text-center pb-2.5 px-4 font-semibold ${PLAN_TEXT[key]}`}>
                        {state.plans[key].icon} {state.plans[key].name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ALL_FEATURES.map(feat => (
                    <tr key={feat} className="hover:bg-slate-50">
                      <td className="py-2 pr-3 text-slate-700 text-xs">{feat}</td>
                      {planKeys.map(key => (
                        <td key={key} className="py-2 px-4 text-center">
                          <input
                            type="checkbox"
                            checked={state.plans[key].features.includes(feat)}
                            onChange={() => toggleFeature(key, feat)}
                            className="w-4 h-4 rounded accent-blue-600 cursor-pointer"
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="grid grid-cols-3 gap-3 pt-2 border-t border-slate-100">
              {planKeys.map(key => (
                <div key={key} className="space-y-1">
                  <label className={`text-[9px] font-bold uppercase ${PLAN_TEXT[key]}`}>Section Label</label>
                  <Input value={state.plans[key].featuresLabel} onChange={e => setPlan(key, 'featuresLabel', e.target.value)} className="h-7 text-[10px]" />
                </div>
              ))}
            </div>
          </div>

          {/* Terms */}
          <div className="border rounded-xl p-4 bg-white space-y-3">
            <p className="text-xs font-bold text-blue-600 uppercase tracking-wide">Terms & Conditions</p>
            {state.terms.map((t, i) => (
              <div key={i} className="flex gap-2">
                <Input value={t} onChange={e => { const terms = [...state.terms]; terms[i] = e.target.value; set('terms', terms) }} className="flex-1 h-8 text-xs" />
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-400 hover:text-red-600 flex-shrink-0"
                  onClick={() => set('terms', state.terms.filter((_, j) => j !== i))}>✕</Button>
              </div>
            ))}
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => set('terms', [...state.terms, ''])}>+ Add Term</Button>
          </div>

          {/* CTA */}
          <div className="border rounded-xl p-4 bg-white space-y-3">
            <p className="text-xs font-bold text-blue-600 uppercase tracking-wide">Call to Action Box</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-xs text-slate-500">Title</Label><Input value={state.ctaTitle} onChange={e => set('ctaTitle', e.target.value)} /></div>
              <div className="space-y-1"><Label className="text-xs text-slate-500">Subtitle</Label><Input value={state.ctaSubtitle} onChange={e => set('ctaSubtitle', e.target.value)} /></div>
            </div>
          </div>
        </div>

        {/* ── RIGHT: Preview ── */}
        <div className="sticky top-4 space-y-3">
          <div className="rounded-xl overflow-hidden border border-slate-700 shadow-2xl"
            style={{ background: '#0f172a', fontFamily: 'system-ui,sans-serif', padding: '20px' }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <img src="/brand-logo.png" alt="DCW" style={{ width: 42, height: 42, borderRadius: 8, objectFit: 'cover', display: 'block', flexShrink: 0 }} />
                <div>
                  <div style={{ color: '#fff', fontWeight: 700, fontSize: 13, lineHeight: 1.3 }}>
                    <span style={{ color: '#60a5fa' }}>Distance</span> Courses Wala
                  </div>
                  <div style={{ color: '#94a3b8', fontSize: 10 }}>{state.website}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {state.sessionTag && <span style={{ background: '#facc15', color: '#000', borderRadius: 20, padding: '3px 10px', fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap' }}>{state.sessionTag}</span>}
                {state.boardTag && <span style={{ border: '1px solid #475569', color: '#cbd5e1', borderRadius: 20, padding: '3px 10px', fontSize: 10, whiteSpace: 'nowrap' }}>{state.boardTag}</span>}
              </div>
            </div>

            {/* Title */}
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <h2 style={{ color: '#fff', fontSize: 16, fontWeight: 800, margin: 0, lineHeight: 1.3 }}>{state.title}</h2>
              <p style={{ color: '#94a3b8', fontSize: 10, margin: '4px 0 0' }}>{state.subtitle}</p>
            </div>

            {/* Plans — NO absolute positioning, badge is in flow */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
              {planKeys.map(key => {
                const plan = state.plans[key]
                const isHighlighted = plan.highlighted
                return (
                  <div key={key} style={{
                    border: isHighlighted ? '2px solid #2563eb' : '1px solid #334155',
                    borderRadius: 8,
                    background: isHighlighted ? '#0f1e3a' : '#1e293b',
                    overflow: 'hidden',
                  }}>
                    {/* Badge in flow — no absolute */}
                    {isHighlighted && (
                      <div style={{ background: '#facc15', color: '#000', fontSize: 8, fontWeight: 700, padding: '4px 0', textAlign: 'center' }}>
                        ★ Most Popular
                      </div>
                    )}
                    <div style={{ padding: '10px' }}>
                      <div style={{ color: '#fff', fontWeight: 700, fontSize: 11, marginBottom: 2 }}>{plan.icon} {plan.name}</div>
                      <div style={{ color: '#94a3b8', fontSize: 9, marginBottom: 8 }}>{plan.tagline}</div>
                      {plan.papers.filter(p => p.label).map((p, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                          <span style={{ color: '#cbd5e1', fontSize: 9 }}>{p.label}</span>
                          <span style={{ color: '#fff', fontWeight: 600, fontSize: 9 }}>{fmtPrice(p.price)}</span>
                        </div>
                      ))}
                      {plan.features.length > 0 && (
                        <>
                          <div style={{ color: PLAN_COLOR[key], fontSize: 7, fontWeight: 700, marginTop: 7, marginBottom: 3, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                            {plan.featuresLabel}
                          </div>
                          {plan.features.slice(0, 5).map((f, i) => (
                            <div key={i} style={{ color: '#94a3b8', fontSize: 8, marginBottom: 2 }}>✓ {f}</div>
                          ))}
                          {plan.features.length > 5 && (
                            <div style={{ color: '#64748b', fontSize: 7 }}>+{plan.features.length - 5} more…</div>
                          )}
                        </>
                      )}
                      {plan.guarantee && (
                        <div style={{
                          background: isHighlighted ? '#1e3a5f' : '#0f2027',
                          border: `1px solid ${PLAN_COLOR[key]}55`,
                          borderRadius: 5, padding: '4px 7px', marginTop: 7,
                          color: PLAN_COLOR[key], fontSize: 8, fontWeight: 600,
                        }}>
                          {plan.guarantee}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Bottom */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <div style={{ color: '#facc15', fontSize: 9, fontWeight: 700, marginBottom: 5 }}>Terms & Conditions</div>
                {state.terms.map((t, i) => <div key={i} style={{ color: '#94a3b8', fontSize: 8, marginBottom: 3 }}>• {t}</div>)}
              </div>
              <div style={{ background: '#facc15', borderRadius: 8, padding: '12px 14px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ fontWeight: 800, fontSize: 13, color: '#000' }}>{state.ctaTitle}</div>
                <div style={{ fontWeight: 700, fontSize: 10, color: '#000', margin: '2px 0' }}>{state.website}</div>
                <div style={{ fontSize: 8, color: '#1a1a1a' }}>{state.ctaSubtitle}</div>
              </div>
            </div>

            {/* Footer */}
            <div style={{ marginTop: 10, borderTop: '1px solid #1e293b', paddingTop: 7, textAlign: 'center', color: '#475569', fontSize: 7 }}>
              Distance Courses Wala — {state.boardTag} | {state.subtitle} | {state.sessionTag}
            </div>
          </div>

          {showPDF && <FeePlanDocument state={state} onDone={() => setShowPDF(false)} />}
          {!showPDF && (
            <Button className="w-full gap-2 bg-blue-600 hover:bg-blue-700" onClick={() => setShowPDF(true)}>
              <FileDown className="w-4 h-4" /> Download PDF
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
