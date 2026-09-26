'use client'
import { withBase } from '@/lib/base-path'
import { Document, Page, Text, View, StyleSheet, Image, pdf } from '@react-pdf/renderer'

// "Application Form" PDF shared with the associate after registration — styled
// like the student invoice (navy top bar, company block, badge on the right).

export interface AssociateFormData {
  name: string
  phone: string
  father_name?: string | null
  email: string
  aadhar_number?: string | null
  pan_number?: string | null
  state?: string | null
  district?: string | null
  city?: string | null
  pincode?: string | null
  institution_name?: string | null
  institution_address?: string | null
  account_holder_name?: string | null
  bank_name?: string | null
  account_number?: string | null
  ifsc_code?: string | null
  coordinator_name?: string | null
  associate_code?: string | null
  status?: string | null
  created_at?: string | null
  aadhar_doc_url?: string | null
  pan_doc_url?: string | null
  cheque_doc_url?: string | null
}

const BRAND = '#1e3a5f'
const ACCENT = '#2563eb'
const MUTED = '#64748b'
const LINE = '#e2e8f0'

const s = StyleSheet.create({
  // Vertical padding lives on the page so an overflow page also starts below the top bar
  page: { fontSize: 9.5, color: '#1e293b', fontFamily: 'Helvetica', backgroundColor: '#ffffff', paddingTop: 22, paddingBottom: 42 },
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: BRAND, height: 6 },
  content: { paddingHorizontal: 36 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
            paddingBottom: 10, marginBottom: 10, borderBottomWidth: 1, borderBottomColor: LINE },
  logo: { width: 72, height: 38, objectFit: 'contain', marginBottom: 4 },
  companyName: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: BRAND, marginBottom: 2 },
  companyDetail: { fontSize: 8.5, color: MUTED, marginBottom: 1.5 },
  badge: { backgroundColor: BRAND, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 4, marginBottom: 8 },
  badgeText: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#ffffff', letterSpacing: 1.5 },
  meta: { fontSize: 8.5, color: MUTED, marginBottom: 2, textAlign: 'right' },
  metaStrong: { fontSize: 9.5, fontFamily: 'Helvetica-Bold', color: '#0f172a', marginBottom: 3, textAlign: 'right' },

  title: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: BRAND, textAlign: 'center', marginBottom: 2 },
  subtitle: { fontSize: 8.5, color: MUTED, textAlign: 'center', marginBottom: 10 },

  section: { marginBottom: 8, borderWidth: 1, borderColor: LINE, borderRadius: 4 },
  sectionHead: { backgroundColor: '#f1f5f9', paddingHorizontal: 10, paddingVertical: 5,
                 borderBottomWidth: 1, borderBottomColor: LINE },
  sectionTitle: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: ACCENT, letterSpacing: 0.8 },
  sectionBody: { paddingHorizontal: 10, paddingTop: 7, paddingBottom: 3 },

  personalRow: { flexDirection: 'row', gap: 12 },
  // No flex:1 here — inside a column section it collapses the wrapped rows to one line's height
  grid: { flexDirection: 'row', flexWrap: 'wrap', width: '100%' },
  gridBesidePhoto: { flexDirection: 'row', flexWrap: 'wrap', flex: 1 },
  cell: { width: '50%', marginBottom: 5, paddingRight: 8 },
  cellFull: { width: '100%', marginBottom: 5 },
  label: { fontSize: 7.5, color: MUTED, marginBottom: 1.5, textTransform: 'uppercase' },
  value: { fontSize: 9.5, color: '#0f172a', fontFamily: 'Helvetica-Bold' },

  photoBox: { width: 88, height: 108, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 3,
              alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc' },
  photo: { width: 86, height: 106, objectFit: 'cover', borderRadius: 2 },
  photoHint: { fontSize: 7, color: '#94a3b8', textAlign: 'center' },

  docRow: { flexDirection: 'row', gap: 16, marginBottom: 4 },
  docItem: { fontSize: 9, color: '#0f172a' },

  declaration: { fontSize: 8.5, color: '#334155', lineHeight: 1.5, marginTop: 4, marginBottom: 24 },
  signRow: { flexDirection: 'row', justifyContent: 'space-between' },
  signBox: { width: '42%', borderTopWidth: 1, borderTopColor: '#94a3b8', paddingTop: 4 },
  signText: { fontSize: 8, color: MUTED, textAlign: 'center' },

  footer: { position: 'absolute', bottom: 20, left: 36, right: 36, flexDirection: 'row',
            justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: LINE, paddingTop: 6 },
  footerText: { fontSize: 7.5, color: '#94a3b8' },
})

const dash = (v?: string | null) => (v && String(v).trim()) || '—'

function applicationNo(d: AssociateFormData) {
  if (d.associate_code) return d.associate_code
  const date = d.created_at ? new Date(d.created_at) : new Date()
  const ymd = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`
  return `DCW/ASC/${ymd}-${(d.phone ?? '').replace(/\D/g, '').slice(-4) || '0000'}`
}

function Field({ label, value, style = s.cell }: { label: string; value?: string | null; style?: React.ComponentProps<typeof View>['style'] }) {
  return (
    <View style={style}>
      <Text style={s.label}>{label}</Text>
      <Text style={s.value}>{dash(value)}</Text>
    </View>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={s.section} wrap={false}>
      <View style={s.sectionHead}><Text style={s.sectionTitle}>{title}</Text></View>
      <View style={s.sectionBody}>{children}</View>
    </View>
  )
}

function ApplicationDoc({ d, photo, logo }: { d: AssociateFormData; photo: string | null; logo: string | null }) {
  const date = d.created_at ? new Date(d.created_at) : new Date()
  const dateText = date.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
  const status = d.status ? d.status.charAt(0).toUpperCase() + d.status.slice(1) : 'Submitted'
  const tick = (url?: string | null) => (url ? '[x]' : '[ ]')

  return (
    <Document title={`Associate Application - ${d.name}`}>
      <Page size="A4" style={s.page}>
        <View style={s.topBar} fixed />
        <View style={s.content}>
          {/* Header */}
          <View style={s.header}>
            <View>
              {logo ? <Image src={logo} style={s.logo} /> : null}
              <Text style={s.companyName}>DISTANCE COURSES WALA</Text>
              <Text style={s.companyDetail}>K-212, Near SBI ATM, Kankarbagh</Text>
              <Text style={s.companyDetail}>Hanuman Nagar, Patna, Bihar – 800020</Text>
              <Text style={s.companyDetail}>Ph: 099395 87009</Text>
              <Text style={s.companyDetail}>Email: info@distancecourseswala.in</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <View style={s.badge}><Text style={s.badgeText}>APPLICATION FORM</Text></View>
              <Text style={s.metaStrong}>{applicationNo(d)}</Text>
              <Text style={s.meta}>Date: {dateText}</Text>
              <Text style={s.meta}>Status: {status}</Text>
            </View>
          </View>

          <Text style={s.title}>Associate Partner Application</Text>
          <Text style={s.subtitle}>Details as registered with Distance Courses Wala</Text>

          <Section title="PERSONAL DETAILS">
            <View style={s.personalRow}>
              <View style={s.gridBesidePhoto}>
                <Field label="Full Name" value={d.name} />
                <Field label="Father's Name" value={d.father_name} />
                <Field label="Mobile" value={d.phone} />
                <Field label="Email" value={d.email} />
                <Field label="Aadhaar Number" value={d.aadhar_number} />
                <Field label="PAN Number" value={d.pan_number?.toUpperCase()} />
              </View>
              <View style={s.photoBox}>
                {photo ? <Image src={photo} style={s.photo} /> : <Text style={s.photoHint}>Passport size{'\n'}photo</Text>}
              </View>
            </View>
          </Section>

          <Section title="ADDRESS">
            <View style={s.grid}>
              <Field label="State" value={d.state} />
              <Field label="District" value={d.district} />
              <Field label="City" value={d.city} />
              <Field label="Pincode" value={d.pincode} />
            </View>
          </Section>

          <Section title="INSTITUTION DETAILS">
            <View style={s.grid}>
              <Field label="Institution Name" value={d.institution_name} style={s.cellFull} />
              <Field label="Institution Address" value={d.institution_address} style={s.cellFull} />
            </View>
          </Section>

          <Section title="BANK DETAILS">
            <View style={s.grid}>
              <Field label="Account Holder Name" value={d.account_holder_name} />
              <Field label="Bank Name" value={d.bank_name} />
              <Field label="Account Number" value={d.account_number} />
              <Field label="IFSC Code" value={d.ifsc_code?.toUpperCase()} />
            </View>
          </Section>

          <Section title="COORDINATOR & DOCUMENTS">
            <View style={s.grid}>
              <Field label="Coordinator" value={d.coordinator_name} style={s.cellFull} />
            </View>
            <View style={s.docRow}>
              <Text style={s.docItem}>{tick(d.aadhar_doc_url)} Aadhaar Card</Text>
              <Text style={s.docItem}>{tick(d.pan_doc_url)} PAN Card</Text>
              <Text style={s.docItem}>{tick(d.cheque_doc_url)} Cancelled Cheque</Text>
              <Text style={s.docItem}>{tick(photo)} Photograph</Text>
            </View>
          </Section>

          <View wrap={false}>
            <Text style={s.declaration}>
              I hereby declare that the information given above is true and correct to the best of my knowledge.
              I agree to work as an Associate Partner of Distance Courses Wala and to follow its policies and guidelines.
            </Text>
            <View style={s.signRow}>
              <View style={s.signBox}><Text style={s.signText}>Applicant Signature</Text></View>
              <View style={s.signBox}><Text style={s.signText}>Authorised Signatory (DCW)</Text></View>
            </View>
          </View>
        </View>

        <View style={s.footer} fixed>
          <Text style={s.footerText}>Distance Courses Wala  |  distancecourseswala.in</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}

async function toDataUrl(src: Blob | string | null | undefined): Promise<string | null> {
  if (!src) return null
  try {
    const blob = typeof src === 'string' ? await fetch(src).then(r => { if (!r.ok) throw new Error(); return r.blob() }) : src
    // react-pdf only renders JPG/PNG
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

/** Builds the application form and triggers a download. `photo` may be the just-picked File or a stored URL. */
export async function downloadAssociateApplicationPdf(d: AssociateFormData, photo?: Blob | string | null) {
  const [photoUrl, logo] = await Promise.all([toDataUrl(photo), toDataUrl(withBase('/brand-logo.png'))])
  const blob = await pdf(<ApplicationDoc d={d} photo={photoUrl} logo={logo} />).toBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `Application_Form_${d.name.trim().replace(/\s+/g, '_') || 'Associate'}.pdf`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
