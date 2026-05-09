'use client'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { FileDown, Loader2 } from 'lucide-react'
import { Document, Page, Text, View, StyleSheet, pdf, Image } from '@react-pdf/renderer'

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

const TIER_BG: Record<string, string>     = { basic: '#1d4ed8', standard: '#b45309', premium: '#6d28d9' }
const TIER_LIGHT: Record<string, string>  = { basic: '#eff6ff', standard: '#fffbeb', premium: '#f5f3ff' }
const TIER_BORDER: Record<string, string> = { basic: '#bfdbfe', standard: '#fde68a', premium: '#ddd6fe' }
const TIER_TEXT: Record<string, string>   = { basic: '#1e3a8a', standard: '#78350f', premium: '#4c1d95' }

const s = StyleSheet.create({
  page: { backgroundColor: '#ffffff', padding: 24, fontFamily: 'Helvetica' },

  // ── Header ──
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            backgroundColor: '#0f172a', borderRadius: 8, padding: '10 14', marginBottom: 12 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: { width: 34, height: 34, borderRadius: 6 },
  brandName: { color: '#ffffff', fontSize: 11, fontFamily: 'Helvetica-Bold' },
  brandBlue: { color: '#60a5fa' },
  brandSub: { color: '#94a3b8', fontSize: 7, marginTop: 1 },
  tagRow: { flexDirection: 'row', gap: 6 },
  tagYellow: { backgroundColor: '#facc15', borderRadius: 20, paddingHorizontal: 9, paddingVertical: 2 },
  tagYellowText: { color: '#000', fontSize: 7, fontFamily: 'Helvetica-Bold' },
  tagBorder: { borderWidth: 1, borderColor: '#475569', borderRadius: 20, paddingHorizontal: 9, paddingVertical: 2 },
  tagBorderText: { color: '#cbd5e1', fontSize: 7 },

  // ── Title ──
  mainTitle: { color: '#0f172a', fontSize: 17, fontFamily: 'Helvetica-Bold', textAlign: 'center', marginBottom: 2 },
  mainSub: { color: '#64748b', fontSize: 9, textAlign: 'center', marginBottom: 12 },

  // ── Plans ──
  plansRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  card: { flex: 1, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, overflow: 'hidden' },
  cardHL: { flex: 1, borderWidth: 2, borderRadius: 8, overflow: 'hidden' },

  // Card header bar (solid color)
  cardHdr: { paddingHorizontal: 9, paddingVertical: 7 },
  popularRow: { flexDirection: 'row', marginBottom: 4 },
  popularBadge: { backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 4,
                  paddingHorizontal: 5, paddingVertical: 1 },
  popularText: { color: '#ffffff', fontSize: 6, fontFamily: 'Helvetica-Bold' },
  planName: { color: '#ffffff', fontSize: 10, fontFamily: 'Helvetica-Bold', marginBottom: 1 },
  planTag: { color: 'rgba(255,255,255,0.78)', fontSize: 7 },

  // Card body
  cardBody: { padding: 9, backgroundColor: '#ffffff' },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
              paddingVertical: 2.5, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  priceLabel: { color: '#64748b', fontSize: 7.5 },
  priceVal: { color: '#1e293b', fontSize: 7.5, fontFamily: 'Helvetica-Bold' },

  // Full-subject highlighted row
  fullRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
             borderRadius: 4, paddingHorizontal: 5, paddingVertical: 4, marginTop: 3 },
  fullLabel: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#0f172a' },
  fullVal: { fontSize: 9, fontFamily: 'Helvetica-Bold' },

  // Features
  featTitle: { fontSize: 6.5, fontFamily: 'Helvetica-Bold', letterSpacing: 0.4, marginTop: 7, marginBottom: 2 },
  feat: { color: '#475569', fontSize: 7, marginBottom: 1.5 },

  // Guarantee
  gBox: { borderRadius: 4, padding: 5, marginTop: 5, borderWidth: 1 },
  gText: { fontSize: 7, fontFamily: 'Helvetica-Bold' },

  // ── Bottom ──
  bottomRow: { flexDirection: 'row', gap: 10 },
  termsBox: { flex: 1 },
  termsTitle: { color: '#0f172a', fontSize: 8, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  term: { color: '#64748b', fontSize: 7, marginBottom: 2.5 },
  ctaBox: { flex: 1, backgroundColor: '#facc15', borderRadius: 8, padding: 12,
            alignItems: 'center', justifyContent: 'center' },
  ctaTitle: { color: '#000', fontSize: 14, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  ctaWeb: { color: '#1e293b', fontSize: 9, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  ctaSub: { color: '#374151', fontSize: 7 },

  // ── Footer ──
  footer: { borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 7, marginTop: 10,
            flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footerLeft: { color: '#94a3b8', fontSize: 6.5 },
  footerRight: { flexDirection: 'row', gap: 12 },
  footerItem: { color: '#64748b', fontSize: 6.5 },
})

const fmtPrice = (p: string) => p ? `Rs.${Number(p).toLocaleString('en-IN')}` : '-'

function PlanCard({ planKey, plan }: { planKey: string; plan: PlanConfig }) {
  const bg = TIER_BG[planKey]
  const light = TIER_LIGHT[planKey]
  const border = TIER_BORDER[planKey]
  const textColor = TIER_TEXT[planKey]
  const papers = plan.papers.filter(p => p.label)
  const regular = papers.slice(0, papers.length - 1)
  const full = papers[papers.length - 1]

  return (
    <View style={plan.highlighted ? [s.cardHL, { borderColor: bg }] : s.card}>
      {/* Solid color header */}
      <View style={[s.cardHdr, { backgroundColor: bg }]}>
        {plan.highlighted && (
          <View style={s.popularRow}>
            <View style={s.popularBadge}><Text style={s.popularText}>MOST POPULAR</Text></View>
          </View>
        )}
        <Text style={s.planName}>{plan.name}</Text>
        <Text style={s.planTag}>{plan.tagline}</Text>
      </View>

      {/* White body */}
      <View style={s.cardBody}>
        {regular.map((p, i) => (
          <View key={i} style={s.priceRow}>
            <Text style={s.priceLabel}>{p.label}</Text>
            <Text style={s.priceVal}>{fmtPrice(p.price)}</Text>
          </View>
        ))}
        {full && (
          <View style={[s.fullRow, { backgroundColor: light, borderWidth: 1, borderColor: border }]}>
            <Text style={s.fullLabel}>{full.label}</Text>
            <Text style={[s.fullVal, { color: bg }]}>{fmtPrice(full.price)}</Text>
          </View>
        )}
        {plan.features.length > 0 && (
          <>
            <Text style={[s.featTitle, { color: bg }]}>{plan.featuresLabel}</Text>
            {plan.features.map((f, i) => <Text key={i} style={s.feat}>-  {f}</Text>)}
          </>
        )}
        {plan.guarantee ? (
          <View style={[s.gBox, { backgroundColor: light, borderColor: border }]}>
            <Text style={[s.gText, { color: textColor }]}>{plan.guarantee}</Text>
          </View>
        ) : null}
      </View>
    </View>
  )
}

function FeePDF({ state, logoUrl }: { state: FeeState; logoUrl: string }) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={s.page}>
        {/* Header */}
        <View style={s.header}>
          <View style={s.logoRow}>
            <Image src={logoUrl} style={s.logo} />
            <View>
              <Text style={s.brandName}><Text style={s.brandBlue}>Distance</Text> Courses Wala</Text>
              <Text style={s.brandSub}>{state.website}</Text>
            </View>
          </View>
          <View style={s.tagRow}>
            {state.sessionTag ? <View style={s.tagYellow}><Text style={s.tagYellowText}>{state.sessionTag}</Text></View> : null}
            {state.boardTag ? <View style={s.tagBorder}><Text style={s.tagBorderText}>{state.boardTag}</Text></View> : null}
          </View>
        </View>

        {/* Title */}
        <Text style={s.mainTitle}>{state.title}</Text>
        <Text style={s.mainSub}>{state.subtitle}</Text>

        {/* Plans */}
        <View style={s.plansRow}>
          {(['basic', 'standard', 'premium'] as const).map(k => (
            <PlanCard key={k} planKey={k} plan={state.plans[k]} />
          ))}
        </View>

        {/* Bottom */}
        <View style={s.bottomRow}>
          <View style={s.termsBox}>
            <Text style={s.termsTitle}>Terms & Conditions</Text>
            {state.terms.map((t, i) => <Text key={i} style={s.term}>-  {t}</Text>)}
          </View>
          <View style={s.ctaBox}>
            <Text style={s.ctaTitle}>{state.ctaTitle}</Text>
            <Text style={s.ctaWeb}>{state.website}</Text>
            <Text style={s.ctaSub}>{state.ctaSubtitle}</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={s.footer}>
          <Text style={s.footerLeft}>
            Distance Courses Wala  |  {state.boardTag}  |  {state.sessionTag}
          </Text>
          <View style={s.footerRight}>
            {state.address ? <Text style={s.footerItem}>Addr: {state.address}</Text> : null}
            {state.phone ? <Text style={s.footerItem}>Ph: {state.phone}</Text> : null}
            <Text style={s.footerItem}>Web: {state.website}</Text>
          </View>
        </View>
      </Page>
    </Document>
  )
}

export default function FeePlanDocument({ state, onDone }: { state: FeeState; onDone: () => void }) {
  const [loading, setLoading] = useState(false)

  async function download() {
    setLoading(true)
    try {
      const logoUrl = window.location.origin + '/brand-logo.png'
      const blob = await pdf(<FeePDF state={state} logoUrl={logoUrl} />).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `DCW_Fee_Plan_${state.sessionTag || 'plan'}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setLoading(false)
      onDone()
    }
  }

  useEffect(() => { download() }, [])

  return (
    <Button className="w-full gap-2 bg-blue-600 hover:bg-blue-700" disabled={loading}>
      {loading
        ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating PDF…</>
        : <><FileDown className="w-4 h-4" /> Download PDF</>}
    </Button>
  )
}
