'use client'
import { withBase } from '@/lib/base-path'
import { Document, Page, Text, View, StyleSheet, Image, pdf } from '@react-pdf/renderer'

// Certificate of Association, issued when an associate is approved.
// Same visual family as the invoice and the application form: navy ink,
// DCW letterhead, tabular details and an authorised signatory line.

export interface AssociateCertificateData {
  name: string
  associate_code?: string | null
  father_name?: string | null
  phone?: string | null
  email?: string | null
  city?: string | null
  district?: string | null
  state?: string | null
  institution_name?: string | null
  coordinator_name?: string | null
  /** Approval date; defaults to today */
  issued_on?: string | null
}

const BRAND = '#1e3a5f'
const ACCENT = '#2563eb'
const GOLD = '#b8860b'
const MUTED = '#64748b'
const LINE = '#e2e8f0'

const s = StyleSheet.create({
  page: { fontFamily: 'Helvetica', backgroundColor: '#ffffff', padding: 18 },
  frame: { borderWidth: 2, borderColor: BRAND, borderRadius: 4, flexGrow: 1, padding: 2 },
  inner: { borderWidth: 0.8, borderColor: GOLD, borderRadius: 2, flexGrow: 1, paddingHorizontal: 30, paddingTop: 18, paddingBottom: 14 },
  content: { flexGrow: 1, justifyContent: 'center' },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            borderBottomWidth: 1, borderBottomColor: LINE, paddingBottom: 10, marginBottom: 14 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: { width: 46, height: 46, objectFit: 'contain' },
  companyName: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: BRAND, letterSpacing: 0.6 },
  companyDetail: { fontSize: 8, color: MUTED, marginTop: 2 },
  certNo: { fontSize: 8.5, color: MUTED, textAlign: 'right' },
  certNoStrong: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#0f172a', textAlign: 'right' },

  title: { fontSize: 24, fontFamily: 'Helvetica-Bold', color: BRAND, textAlign: 'center', letterSpacing: 3 },
  titleRule: { alignSelf: 'center', width: 150, height: 2, backgroundColor: GOLD, marginTop: 6, marginBottom: 4 },
  subtitle: { fontSize: 9, color: MUTED, textAlign: 'center', letterSpacing: 1.4, marginBottom: 14 },

  lead: { fontSize: 10, color: '#334155', textAlign: 'center' },
  name: { fontSize: 22, fontFamily: 'Helvetica-Bold', color: '#0f172a', textAlign: 'center', marginTop: 6 },
  nameRule: { alignSelf: 'center', width: 300, borderBottomWidth: 1, borderBottomColor: '#cbd5e1', marginTop: 4, marginBottom: 10 },
  body: { fontSize: 10, color: '#334155', textAlign: 'center', lineHeight: 1.6, marginHorizontal: 30 },
  code: { fontFamily: 'Helvetica-Bold', color: ACCENT },

  detailRow: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginTop: 16 },
  detailBox: { borderWidth: 1, borderColor: LINE, borderRadius: 4, paddingVertical: 7, paddingHorizontal: 12, minWidth: 120 },
  detailLabel: { fontSize: 7, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2, textAlign: 'center' },
  detailValue: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#0f172a', textAlign: 'center' },

  signRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 26 },
  signBox: { width: 180 },
  signLine: { borderTopWidth: 1, borderTopColor: '#94a3b8', paddingTop: 4 },
  signText: { fontSize: 8.5, color: MUTED, textAlign: 'center' },
  sealNote: { fontSize: 7.5, color: '#94a3b8', textAlign: 'center', width: 150 },

  footer: { borderTopWidth: 1, borderTopColor: LINE, marginTop: 12, paddingTop: 6,
            flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 7, color: '#94a3b8' },
})

const dash = (v?: string | null) => (v && String(v).trim()) || '—'

function certificateNo(d: AssociateCertificateData, date: Date) {
  if (d.associate_code) return `DCW/AC/${d.associate_code}`
  const ymd = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`
  return `DCW/AC/${ymd}`
}

function CertificateDoc({ d, logo }: { d: AssociateCertificateData; logo: string | null }) {
  const date = d.issued_on ? new Date(d.issued_on) : new Date()
  const dateText = date.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
  const placeParts = [d.city, d.district, d.state]
    .map(x => (x ?? '').trim())
    .filter((x, i, arr) => x && arr.findIndex(y => y.toLowerCase() === x.toLowerCase()) === i)
  const place = placeParts.join(', ')

  return (
    <Document title={`Associate Certificate - ${d.name}`}>
      <Page size="A4" orientation="landscape" style={s.page}>
        <View style={s.frame}>
          <View style={s.inner}>
            {/* Letterhead */}
            <View style={s.header}>
              <View style={s.logoRow}>
                {logo ? <Image src={logo} style={s.logo} /> : null}
                <View>
                  <Text style={s.companyName}>DISTANCE COURSES WALA</Text>
                  <Text style={s.companyDetail}>K-212, Near SBI ATM, Kankarbagh, Hanuman Nagar, Patna, Bihar – 800020</Text>
                  <Text style={s.companyDetail}>Ph: 099395 87009  ·  info@distancecourseswala.in  ·  distancecourseswala.in</Text>
                </View>
              </View>
              <View>
                <Text style={s.certNo}>Certificate No.</Text>
                <Text style={s.certNoStrong}>{certificateNo(d, date)}</Text>
                <Text style={s.certNo}>Date: {dateText}</Text>
              </View>
            </View>

            <View style={s.content}>
            {/* Title */}
            <Text style={s.title}>CERTIFICATE</Text>
            <View style={s.titleRule} />
            <Text style={s.subtitle}>OF ASSOCIATION</Text>

            {/* Body */}
            <Text style={s.lead}>This is to certify that</Text>
            <Text style={s.name}>{d.name}</Text>
            <View style={s.nameRule} />
            <Text style={s.body}>
              {d.father_name ? `S/o · D/o ${d.father_name}, ` : ''}
              {place ? `resident of ${place}, ` : ''}
              {d.institution_name ? `associated with ${d.institution_name}, ` : ''}
              has been duly approved and appointed as an{' '}
              <Text style={s.code}>Authorised Associate Partner</Text> of Distance Courses Wala
              {d.associate_code ? <> with Associate Code <Text style={s.code}>{d.associate_code}</Text></> : null}.
              {'\n'}
              The holder is authorised to counsel and refer students for admissions, subject to the
              terms and policies of Distance Courses Wala.
            </Text>

            {/* Key details */}
            <View style={s.detailRow}>
              <View style={s.detailBox}>
                <Text style={s.detailLabel}>Associate Code</Text>
                <Text style={s.detailValue}>{dash(d.associate_code)}</Text>
              </View>
              <View style={s.detailBox}>
                <Text style={s.detailLabel}>Date of Issue</Text>
                <Text style={s.detailValue}>{dateText}</Text>
              </View>
              <View style={s.detailBox}>
                <Text style={s.detailLabel}>Coordinator</Text>
                <Text style={s.detailValue}>{dash(d.coordinator_name)}</Text>
              </View>
              <View style={s.detailBox}>
                <Text style={s.detailLabel}>Contact</Text>
                <Text style={s.detailValue}>{dash(d.phone)}</Text>
              </View>
            </View>

            </View>

            {/* Signatures */}
            <View style={s.signRow}>
              <Text style={s.sealNote}>Seal / Stamp</Text>
              <View style={s.signBox}>
                <View style={s.signLine}>
                  <Text style={s.signText}>Authorised Signatory</Text>
                  <Text style={s.signText}>Distance Courses Wala</Text>
                </View>
              </View>
            </View>

            {/* Footer */}
            <View style={s.footer}>
              <Text style={s.footerText}>
                This certificate is issued electronically and is valid while the association remains active.
              </Text>
              <Text style={s.footerText}>distancecourseswala.in</Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  )
}

async function toDataUrl(src: string): Promise<string | null> {
  try {
    const blob = await fetch(src).then(r => { if (!r.ok) throw new Error('not ok'); return r.blob() })
    if (!/image\/(png|jpe?g)/.test(blob.type)) return null
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

/** Builds the certificate and triggers a download. */
export async function downloadAssociateCertificatePdf(d: AssociateCertificateData) {
  const logo = await toDataUrl(withBase('/brand-logo.png'))
  const blob = await pdf(<CertificateDoc d={d} logo={logo} />).toBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `Associate_Certificate_${(d.associate_code || d.name).trim().replace(/\s+/g, '_')}.pdf`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
