'use client'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { FileDown, Loader2 } from 'lucide-react'
import {
  Document, Page, Text, View, StyleSheet, pdf, Font, Image,
} from '@react-pdf/renderer'

// ── Shared type (keep in sync with FeePlanBuilder) ──────────────
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

// ── Styles ───────────────────────────────────────────────────────
const s = StyleSheet.create({
  page: { backgroundColor: '#0f172a', padding: 28, fontFamily: 'Helvetica' },
  row: { flexDirection: 'row' },
  // Header
  logo: { width: 36, height: 36, borderRadius: 6 },
  brandName: { color: '#ffffff', fontSize: 11, fontFamily: 'Helvetica-Bold', marginBottom: 1 },
  brandBlue: { color: '#60a5fa' },
  brandSub: { color: '#94a3b8', fontSize: 7 },
  tagYellow: { backgroundColor: '#facc15', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  tagYellowText: { color: '#000', fontSize: 7, fontFamily: 'Helvetica-Bold' },
  tagBorder: { borderWidth: 1, borderColor: '#475569', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  tagBorderText: { color: '#cbd5e1', fontSize: 7 },
  // Title
  mainTitle: { color: '#ffffff', fontSize: 16, fontFamily: 'Helvetica-Bold', textAlign: 'center', marginBottom: 3 },
  mainSubtitle: { color: '#94a3b8', fontSize: 9, textAlign: 'center' },
  // Plan card
  card: { flex: 1, borderWidth: 1, borderColor: '#1e293b', borderRadius: 8, padding: 10, backgroundColor: '#1e293b' },
  cardHighlighted: { flex: 1, borderWidth: 2, borderColor: '#2563eb', borderRadius: 8, padding: 10, backgroundColor: '#0f1e3a' },
  popularBadge: { backgroundColor: '#facc15', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1, alignSelf: 'center', marginBottom: 6 },
  popularText: { color: '#000', fontSize: 6, fontFamily: 'Helvetica-Bold' },
  planName: { color: '#ffffff', fontSize: 10, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  planTagline: { color: '#94a3b8', fontSize: 7, marginBottom: 8 },
  paperRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  paperLabel: { color: '#cbd5e1', fontSize: 8 },
  paperPrice: { color: '#ffffff', fontSize: 8, fontFamily: 'Helvetica-Bold' },
  featLabel: { fontSize: 7, fontFamily: 'Helvetica-Bold', letterSpacing: 0.5, marginTop: 6, marginBottom: 3 },
  feature: { color: '#94a3b8', fontSize: 7, marginBottom: 2 },
  guaranteeBox: { borderRadius: 5, padding: 5, marginTop: 6 },
  guaranteeText: { fontSize: 7, fontFamily: 'Helvetica-Bold' },
  // Bottom
  termsTitle: { color: '#facc15', fontSize: 8, fontFamily: 'Helvetica-Bold', marginBottom: 5 },
  term: { color: '#94a3b8', fontSize: 7, marginBottom: 3 },
  ctaBox: { flex: 1, backgroundColor: '#facc15', borderRadius: 8, padding: 12, alignItems: 'center', justifyContent: 'center' },
  ctaTitle: { color: '#000000', fontSize: 13, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  ctaWeb: { color: '#000000', fontSize: 10, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  ctaSub: { color: '#1a1a1a', fontSize: 7 },
  footer: { borderTopWidth: 1, borderTopColor: '#1e293b', paddingTop: 6, marginTop: 10 },
  footerText: { color: '#475569', fontSize: 6, textAlign: 'center' },
})

const planColors: Record<string, string> = { basic: '#60a5fa', standard: '#facc15', premium: '#c084fc' }
const planGuaranteeColors: Record<string, string> = { basic: '#1e3a5f', standard: '#1e3a5f', premium: '#1a0f2e' }

const fmtPrice = (p: string) => p ? `₹${Number(p).toLocaleString('en-IN')}` : '—'

function PlanCard({ planKey, plan }: { planKey: string; plan: PlanConfig }) {
  const color = planColors[planKey]
  return (
    <View style={plan.highlighted ? s.cardHighlighted : s.card}>
      {plan.highlighted && (
        <View style={s.popularBadge}><Text style={s.popularText}>Most Popular</Text></View>
      )}
      <Text style={s.planName}>{plan.icon}  {plan.name}</Text>
      <Text style={s.planTagline}>{plan.tagline}</Text>
      {plan.papers.filter(p => p.label).map((p, i) => (
        <View key={i} style={s.paperRow}>
          <Text style={s.paperLabel}>{p.label}</Text>
          <Text style={s.paperPrice}>{fmtPrice(p.price)}</Text>
        </View>
      ))}
      {plan.features.length > 0 && (
        <>
          <Text style={[s.featLabel, { color }]}>{plan.featuresLabel}</Text>
          {plan.features.map((f, i) => <Text key={i} style={s.feature}>✓  {f}</Text>)}
        </>
      )}
      {plan.guarantee ? (
        <View style={[s.guaranteeBox, { backgroundColor: planGuaranteeColors[planKey], borderWidth: 1, borderColor: color + '55' }]}>
          <Text style={[s.guaranteeText, { color }]}>{plan.guarantee}</Text>
        </View>
      ) : null}
    </View>
  )
}

function FeePDF({ state, logoUrl }: { state: FeeState; logoUrl: string }) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={s.page}>
        {/* Header */}
        <View style={[s.row, { alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }]}>
          <View style={[s.row, { alignItems: 'center', gap: 10 }]}>
            <Image src={logoUrl} style={s.logo} />
            <View>
              <Text style={s.brandName}>
                <Text style={s.brandBlue}>Distance</Text> Courses Wala
              </Text>
              <Text style={s.brandSub}>{state.website}</Text>
            </View>
          </View>
          <View style={[s.row, { gap: 6 }]}>
            {state.sessionTag ? <View style={s.tagYellow}><Text style={s.tagYellowText}>{state.sessionTag}</Text></View> : null}
            {state.boardTag ? <View style={s.tagBorder}><Text style={s.tagBorderText}>{state.boardTag}</Text></View> : null}
          </View>
        </View>

        {/* Title */}
        <Text style={s.mainTitle}>{state.title}</Text>
        <Text style={[s.mainSubtitle, { marginBottom: 16 }]}>{state.subtitle}</Text>

        {/* Plans */}
        <View style={[s.row, { gap: 10, marginBottom: 14 }]}>
          {(['basic', 'standard', 'premium'] as const).map(k => (
            <PlanCard key={k} planKey={k} plan={state.plans[k]} />
          ))}
        </View>

        {/* Bottom */}
        <View style={[s.row, { gap: 10 }]}>
          <View style={{ flex: 1 }}>
            <Text style={s.termsTitle}>Terms & Conditions</Text>
            {state.terms.map((t, i) => <Text key={i} style={s.term}>•  {t}</Text>)}
          </View>
          <View style={s.ctaBox}>
            <Text style={s.ctaTitle}>{state.ctaTitle}</Text>
            <Text style={s.ctaWeb}>{state.website}</Text>
            <Text style={s.ctaSub}>{state.ctaSubtitle}</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={s.footer}>
          <Text style={s.footerText}>
            Distance Courses Wala — {state.boardTag}  |  {state.subtitle}  |  {state.sessionTag}
          </Text>
        </View>
      </Page>
    </Document>
  )
}

// ── Export trigger component ─────────────────────────────────────
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
      {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating PDF…</> : <><FileDown className="w-4 h-4" /> Download PDF</>}
    </Button>
  )
}
