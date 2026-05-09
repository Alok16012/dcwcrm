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
  address: string; phone: string
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
  address: 'Patna, Bihar',
  phone: '+91 98765 43210',
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
              <div className="space-y-1"><Label className="text-xs text-slate-500">Mobile Number</Label><Input value={state.phone} onChange={e => set('phone', e.target.value)} placeholder="+91 98765 43210" /></div>
              <div className="col-span-2 space-y-1"><Label className="text-xs text-slate-500">Address (footer)</Label><Input value={state.address} onChange={e => set('address', e.target.value)} placeholder="New Delhi, India" /></div>
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
          <div className="rounded-xl overflow-hidden border border-slate-200 shadow-xl"
            style={{ background: '#ffffff', fontFamily: 'system-ui,sans-serif', padding: '18px' }}>

            {/* Header — dark navy band */}
            <div style={{ background: '#0f172a', borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <img src="/brand-logo.png" alt="DCW" style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
                <div>
                  <div style={{ color: '#fff', fontWeight: 700, fontSize: 12, lineHeight: 1.3 }}>
                    <span style={{ color: '#60a5fa' }}>Distance</span> Courses Wala
                  </div>
                  <div style={{ color: '#94a3b8', fontSize: 9 }}>{state.website}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {state.sessionTag && <span style={{ background: '#facc15', color: '#000', borderRadius: 20, padding: '2px 9px', fontSize: 9, fontWeight: 700 }}>{state.sessionTag}</span>}
                {state.boardTag && <span style={{ border: '1px solid #475569', color: '#cbd5e1', borderRadius: 20, padding: '2px 9px', fontSize: 9 }}>{state.boardTag}</span>}
              </div>
            </div>

            {/* Title */}
            <div style={{ textAlign: 'center', marginBottom: 14 }}>
              <div style={{ color: '#0f172a', fontSize: 16, fontWeight: 800 }}>{state.title}</div>
              <div style={{ color: '#64748b', fontSize: 10, marginTop: 3 }}>{state.subtitle}</div>
            </div>

            {/* Plans — invoice style with colored headers */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
              {planKeys.map(key => {
                const plan = state.plans[key]
                const hdrBg = { basic: '#1d4ed8', standard: '#b45309', premium: '#6d28d9' }[key]
                const lightBg = { basic: '#eff6ff', standard: '#fffbeb', premium: '#f5f3ff' }[key]
                const borderColor = { basic: '#bfdbfe', standard: '#fde68a', premium: '#ddd6fe' }[key]
                const accentColor = { basic: '#1d4ed8', standard: '#b45309', premium: '#6d28d9' }[key]
                const papers = plan.papers.filter(p => p.label)
                const regular = papers.slice(0, papers.length - 1)
                const full = papers[papers.length - 1]
                return (
                  <div key={key} style={{
                    border: plan.highlighted ? `2px solid ${hdrBg}` : '1px solid #e2e8f0',
                    borderRadius: 8, overflow: 'hidden',
                  }}>
                    {/* Solid color header bar */}
                    <div style={{ background: hdrBg, padding: '8px 10px' }}>
                      {plan.highlighted && (
                        <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 4, padding: '1px 6px', display: 'inline-block', marginBottom: 4 }}>
                          <span style={{ color: '#fff', fontSize: 8, fontWeight: 700 }}>MOST POPULAR</span>
                        </div>
                      )}
                      <div style={{ color: '#fff', fontWeight: 700, fontSize: 11 }}>{plan.name}</div>
                      <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 8, marginTop: 2 }}>{plan.tagline}</div>
                    </div>
                    {/* White body */}
                    <div style={{ padding: '9px 10px', background: '#fff' }}>
                      {regular.map((p, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: 3, marginBottom: 3 }}>
                          <span style={{ color: '#64748b', fontSize: 9 }}>{p.label}</span>
                          <span style={{ color: '#1e293b', fontWeight: 600, fontSize: 9 }}>{fmtPrice(p.price)}</span>
                        </div>
                      ))}
                      {full && (
                        <div style={{ background: lightBg, border: `1px solid ${borderColor}`, borderRadius: 4, padding: '3px 6px', display: 'flex', justifyContent: 'space-between', marginTop: 3, marginBottom: 6 }}>
                          <span style={{ color: '#1e293b', fontWeight: 700, fontSize: 9 }}>{full.label}</span>
                          <span style={{ color: accentColor, fontWeight: 800, fontSize: 10 }}>{fmtPrice(full.price)}</span>
                        </div>
                      )}
                      {plan.features.length > 0 && (
                        <>
                          <div style={{ color: accentColor, fontSize: 7.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 3 }}>{plan.featuresLabel}</div>
                          {plan.features.slice(0, 5).map((f, i) => (
                            <div key={i} style={{ color: '#475569', fontSize: 8, marginBottom: 1.5 }}>- {f}</div>
                          ))}
                          {plan.features.length > 5 && <div style={{ color: '#94a3b8', fontSize: 7.5 }}>+{plan.features.length - 5} more…</div>}
                        </>
                      )}
                      {plan.guarantee && (
                        <div style={{ background: lightBg, border: `1px solid ${borderColor}`, borderRadius: 4, padding: '4px 7px', marginTop: 6, color: accentColor, fontSize: 8, fontWeight: 600 }}>
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
                <div style={{ color: '#0f172a', fontSize: 9, fontWeight: 700, marginBottom: 5 }}>Terms & Conditions</div>
                {state.terms.map((t, i) => <div key={i} style={{ color: '#64748b', fontSize: 8, marginBottom: 2.5 }}>- {t}</div>)}
              </div>
              <div style={{ background: '#facc15', borderRadius: 8, padding: '12px 14px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ fontWeight: 800, fontSize: 14, color: '#000' }}>{state.ctaTitle}</div>
                <div style={{ fontWeight: 700, fontSize: 10, color: '#1e293b', margin: '2px 0' }}>{state.website}</div>
                <div style={{ fontSize: 8, color: '#374151' }}>{state.ctaSubtitle}</div>
              </div>
            </div>

            {/* Footer */}
            <div style={{ marginTop: 10, borderTop: '1px solid #e2e8f0', paddingTop: 7, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ color: '#94a3b8', fontSize: 8 }}>Distance Courses Wala | {state.boardTag} | {state.sessionTag}</div>
              <div style={{ display: 'flex', gap: 12 }}>
                {state.address && <span style={{ color: '#64748b', fontSize: 8 }}>Addr: {state.address}</span>}
                {state.phone && <span style={{ color: '#64748b', fontSize: 8 }}>Ph: {state.phone}</span>}
              </div>
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
