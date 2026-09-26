'use client'

import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import { format, parseISO } from 'date-fns'
import { amountInWords } from '@/lib/bb/words'

/**
 * The receipt a candidate is handed after paying.
 *
 * It is the only proof either side has, so it carries the things a dispute
 * turns on: a unique receipt number, the exact amount in figures *and* words,
 * what the payment was for, how it was paid, and what is still outstanding on
 * that charge.
 */

const BRAND = '#047857'
const INK = '#111827'
const MUTED = '#6b7280'
const LINE = '#e5e7eb'

const s = StyleSheet.create({
  page: { padding: 0, fontSize: 10, color: INK, fontFamily: 'Helvetica', backgroundColor: '#fff' },
  bar: { backgroundColor: BRAND, height: 6 },
  body: { padding: 36 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: 18, borderBottomWidth: 1, borderBottomColor: LINE },
  logo: { width: 54, height: 54, objectFit: 'contain' },
  brandName: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: BRAND },
  brandSub: { fontSize: 9, color: MUTED, marginTop: 2 },

  titleBlock: { alignItems: 'flex-end' },
  title: { fontSize: 18, fontFamily: 'Helvetica-Bold', letterSpacing: 1 },
  receiptNo: { fontSize: 10, fontFamily: 'Helvetica-Bold', marginTop: 4 },
  date: { fontSize: 9, color: MUTED, marginTop: 2 },

  sectionLabel: { fontSize: 8, color: MUTED, letterSpacing: 1, marginBottom: 4, fontFamily: 'Helvetica-Bold' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  col: { flexDirection: 'column' },

  party: { marginTop: 22, flexDirection: 'row', justifyContent: 'space-between' },
  partyName: { fontSize: 12, fontFamily: 'Helvetica-Bold' },
  partyLine: { fontSize: 9, color: MUTED, marginTop: 2 },

  table: { marginTop: 24, borderWidth: 1, borderColor: LINE, borderRadius: 4 },
  th: { flexDirection: 'row', backgroundColor: '#f9fafb', paddingVertical: 8, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: LINE },
  td: { flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 12 },
  thText: { fontSize: 8, color: MUTED, fontFamily: 'Helvetica-Bold', letterSpacing: 0.5 },

  amountBox: { marginTop: 18, backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#a7f3d0', borderRadius: 4, padding: 14 },
  amountBig: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: BRAND },
  words: { fontSize: 9, color: '#065f46', marginTop: 4, fontFamily: 'Helvetica-Oblique' },

  meta: { marginTop: 20, flexDirection: 'row', justifyContent: 'space-between' },
  metaLabel: { fontSize: 8, color: MUTED, fontFamily: 'Helvetica-Bold', letterSpacing: 0.5 },
  metaValue: { fontSize: 10, marginTop: 2 },

  outstanding: { marginTop: 18, padding: 10, borderRadius: 4, borderWidth: 1 },

  sign: { marginTop: 48, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  signLine: { borderTopWidth: 1, borderTopColor: '#9ca3af', width: 150, paddingTop: 4, fontSize: 8, color: MUTED, textAlign: 'center' },

  footer: { position: 'absolute', bottom: 28, left: 36, right: 36, borderTopWidth: 1, borderTopColor: LINE, paddingTop: 10 },
  footerText: { fontSize: 7.5, color: MUTED, textAlign: 'center', lineHeight: 1.5 },
})

export interface ReceiptData {
  receiptNumber: string
  paymentDate: string
  amount: number
  paymentMode: string
  referenceNo: string | null
  notes: string | null
  candidateName: string
  candidatePhone: string
  candidateCity: string | null
  chargeType: string
  chargeAmount: number
  chargeReceived: number
  chargeNotes: string | null
  jobTitle: string | null
  companyName: string | null
  recordedBy: string
}

const CHARGE_LABEL: Record<string, string> = {
  registration: 'Registration / File Charge',
  placement: 'Placement Fee',
  other: 'Other Charge',
}

const MODE_LABEL: Record<string, string> = {
  cash: 'Cash', upi: 'UPI', card: 'Card', neft: 'NEFT',
  rtgs: 'RTGS', cheque: 'Cheque', other: 'Other',
}

const money = (n: number) => `Rs. ${Math.round(n).toLocaleString('en-IN')}`

export function ReceiptPDF({ data, logoBase64 }: { data: ReceiptData; logoBase64?: string }) {
  const balance = Math.max(0, Number(data.chargeAmount) - Number(data.chargeReceived))
  const settled = balance <= 1

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.bar} />
        <View style={s.body}>

          <View style={s.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {logoBase64 ? <Image src={logoBase64} style={s.logo} /> : null}
              <View style={{ marginLeft: logoBase64 ? 12 : 0 }}>
                <Text style={s.brandName}>Berojgar Bharat</Text>
                <Text style={s.brandSub}>Recruitment &amp; Placement Services</Text>
              </View>
            </View>

            <View style={s.titleBlock}>
              <Text style={s.title}>RECEIPT</Text>
              <Text style={s.receiptNo}>{data.receiptNumber}</Text>
              <Text style={s.date}>{format(parseISO(data.paymentDate), 'dd MMMM yyyy')}</Text>
            </View>
          </View>

          <View style={s.party}>
            <View style={s.col}>
              <Text style={s.sectionLabel}>RECEIVED FROM</Text>
              <Text style={s.partyName}>{data.candidateName}</Text>
              <Text style={s.partyLine}>{data.candidatePhone}</Text>
              {data.candidateCity ? <Text style={s.partyLine}>{data.candidateCity}</Text> : null}
            </View>
            {data.jobTitle ? (
              <View style={[s.col, { alignItems: 'flex-end' }]}>
                <Text style={s.sectionLabel}>AGAINST</Text>
                <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold' }}>{data.jobTitle}</Text>
                {data.companyName ? <Text style={s.partyLine}>{data.companyName}</Text> : null}
              </View>
            ) : null}
          </View>

          <View style={s.table}>
            <View style={s.th}>
              <Text style={[s.thText, { flex: 3 }]}>PARTICULARS</Text>
              <Text style={[s.thText, { flex: 1, textAlign: 'right' }]}>AMOUNT</Text>
            </View>
            <View style={s.td}>
              <View style={{ flex: 3 }}>
                <Text style={{ fontFamily: 'Helvetica-Bold' }}>
                  {CHARGE_LABEL[data.chargeType] ?? data.chargeType}
                </Text>
                {data.chargeNotes ? (
                  <Text style={{ fontSize: 8.5, color: MUTED, marginTop: 3 }}>{data.chargeNotes}</Text>
                ) : null}
                <Text style={{ fontSize: 8.5, color: MUTED, marginTop: 3 }}>
                  Total charge {money(data.chargeAmount)} · paid so far {money(data.chargeReceived)}
                </Text>
              </View>
              <Text style={{ flex: 1, textAlign: 'right', fontFamily: 'Helvetica-Bold', fontSize: 12 }}>
                {money(data.amount)}
              </Text>
            </View>
          </View>

          <View style={s.amountBox}>
            <View style={s.row}>
              <Text style={{ fontSize: 9, color: '#065f46', fontFamily: 'Helvetica-Bold' }}>
                AMOUNT RECEIVED
              </Text>
              <Text style={s.amountBig}>{money(data.amount)}</Text>
            </View>
            <Text style={s.words}>{amountInWords(data.amount)}</Text>
          </View>

          <View style={s.meta}>
            <View>
              <Text style={s.metaLabel}>PAID BY</Text>
              <Text style={s.metaValue}>{MODE_LABEL[data.paymentMode] ?? data.paymentMode}</Text>
            </View>
            <View>
              <Text style={s.metaLabel}>REFERENCE</Text>
              <Text style={s.metaValue}>{data.referenceNo || '—'}</Text>
            </View>
            <View>
              <Text style={s.metaLabel}>RECEIVED BY</Text>
              <Text style={s.metaValue}>{data.recordedBy}</Text>
            </View>
          </View>

          <View
            style={[
              s.outstanding,
              settled
                ? { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }
                : { backgroundColor: '#fffbeb', borderColor: '#fde68a' },
            ]}
          >
            <Text style={{ fontSize: 9.5, fontFamily: 'Helvetica-Bold', color: settled ? '#166534' : '#92400e' }}>
              {settled
                ? 'This charge is fully settled. Nothing further is due.'
                : `Balance still due on this charge: ${money(balance)}`}
            </Text>
          </View>

          {data.notes ? (
            <View style={{ marginTop: 14 }}>
              <Text style={s.metaLabel}>NOTE</Text>
              <Text style={{ fontSize: 9, marginTop: 2, color: MUTED }}>{data.notes}</Text>
            </View>
          ) : null}

          <View style={s.sign}>
            <Text style={{ fontSize: 8, color: MUTED, width: 240, lineHeight: 1.5 }}>
              Please keep this receipt. It is required for any query, adjustment or refund
              relating to this payment.
            </Text>
            <Text style={s.signLine}>Authorised Signatory</Text>
          </View>
        </View>

        <View style={s.footer} fixed>
          <Text style={s.footerText}>
            Berojgar Bharat · This is a computer-generated receipt and is valid without a physical
            signature when issued from the system.
          </Text>
          <Text style={s.footerText}>Receipt No. {data.receiptNumber}</Text>
        </View>
      </Page>
    </Document>
  )
}
