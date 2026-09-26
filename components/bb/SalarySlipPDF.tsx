'use client'

import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import { format } from 'date-fns'
import { amountInWords } from '@/lib/bb/words'

/** Monthly salary slip for Berojgar Bharat staff. */

const BRAND = '#047857'
const INK = '#111827'
const MUTED = '#6b7280'
const LINE = '#e5e7eb'

const s = StyleSheet.create({
  page: { padding: 0, fontSize: 9.5, color: INK, fontFamily: 'Helvetica', backgroundColor: '#fff' },
  bar: { backgroundColor: BRAND, height: 6 },
  body: { padding: 36 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: LINE },
  logo: { width: 48, height: 48, objectFit: 'contain' },
  brandName: { fontSize: 15, fontFamily: 'Helvetica-Bold', color: BRAND },
  brandSub: { fontSize: 8.5, color: MUTED, marginTop: 2 },
  title: { fontSize: 15, fontFamily: 'Helvetica-Bold' },
  period: { fontSize: 9, color: MUTED, marginTop: 2, textAlign: 'right' },

  grid: { marginTop: 18, flexDirection: 'row', flexWrap: 'wrap' },
  gridCell: { width: '50%', marginBottom: 10 },
  label: { fontSize: 7.5, color: MUTED, fontFamily: 'Helvetica-Bold', letterSpacing: 0.5 },
  value: { fontSize: 10, marginTop: 2 },

  attendance: { marginTop: 8, flexDirection: 'row', backgroundColor: '#f9fafb', borderWidth: 1, borderColor: LINE, borderRadius: 4, padding: 10 },
  attCell: { flex: 1, alignItems: 'center' },
  attNum: { fontSize: 13, fontFamily: 'Helvetica-Bold' },
  attLabel: { fontSize: 7, color: MUTED, marginTop: 2 },

  cols: { marginTop: 18, flexDirection: 'row', gap: 12 },
  col: { flex: 1, borderWidth: 1, borderColor: LINE, borderRadius: 4 },
  colHead: { paddingVertical: 7, paddingHorizontal: 10, backgroundColor: '#f9fafb', borderBottomWidth: 1, borderBottomColor: LINE },
  colHeadText: { fontSize: 8, fontFamily: 'Helvetica-Bold', letterSpacing: 0.5, color: MUTED },
  line: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, paddingHorizontal: 10 },
  lineTotal: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, paddingHorizontal: 10, borderTopWidth: 1, borderTopColor: LINE, backgroundColor: '#f9fafb' },
  bold: { fontFamily: 'Helvetica-Bold' },

  net: { marginTop: 18, backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#a7f3d0', borderRadius: 4, padding: 14 },
  netRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  netBig: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: BRAND },
  words: { fontSize: 8.5, color: '#065f46', marginTop: 4, fontFamily: 'Helvetica-Oblique' },

  footer: { position: 'absolute', bottom: 28, left: 36, right: 36, borderTopWidth: 1, borderTopColor: LINE, paddingTop: 10 },
  footerText: { fontSize: 7.5, color: MUTED, textAlign: 'center' },
})

export interface SlipData {
  employeeName: string
  employeeCode: string
  designation: string | null
  joiningDate: string | null
  bankAccount: string | null
  bankName: string | null
  month: number
  year: number
  basic: number
  hra: number
  allowances: number
  placementCount: number
  placementIncentive: number
  presentDays: number
  absentDays: number
  halfDays: number
  leaveDays: number
  lopDays: number
  leaveDeduction: number
  pf: number
  tds: number
  otherDeductions: number
  gross: number
  net: number
}

const money = (n: number) => `Rs. ${Math.round(Number(n ?? 0)).toLocaleString('en-IN')}`

export function SalarySlipPDF({ data, logoBase64 }: { data: SlipData; logoBase64?: string }) {
  const deductions = Number(data.leaveDeduction) + Number(data.pf) + Number(data.tds) + Number(data.otherDeductions)

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
            <View>
              <Text style={s.title}>SALARY SLIP</Text>
              <Text style={s.period}>{format(new Date(data.year, data.month - 1), 'MMMM yyyy')}</Text>
            </View>
          </View>

          <View style={s.grid}>
            <View style={s.gridCell}>
              <Text style={s.label}>EMPLOYEE</Text>
              <Text style={[s.value, s.bold]}>{data.employeeName}</Text>
            </View>
            <View style={s.gridCell}>
              <Text style={s.label}>EMPLOYEE CODE</Text>
              <Text style={s.value}>{data.employeeCode}</Text>
            </View>
            <View style={s.gridCell}>
              <Text style={s.label}>DESIGNATION</Text>
              <Text style={s.value}>{data.designation || '—'}</Text>
            </View>
            <View style={s.gridCell}>
              <Text style={s.label}>DATE OF JOINING</Text>
              <Text style={s.value}>
                {data.joiningDate ? format(new Date(data.joiningDate), 'dd MMM yyyy') : '—'}
              </Text>
            </View>
            <View style={s.gridCell}>
              <Text style={s.label}>BANK</Text>
              <Text style={s.value}>{data.bankName || '—'}</Text>
            </View>
            <View style={s.gridCell}>
              <Text style={s.label}>ACCOUNT</Text>
              <Text style={s.value}>{data.bankAccount || '—'}</Text>
            </View>
          </View>

          <View style={s.attendance}>
            {[
              { n: data.presentDays, l: 'PRESENT' },
              { n: data.absentDays, l: 'ABSENT' },
              { n: data.halfDays, l: 'HALF DAY' },
              { n: data.leaveDays, l: 'LEAVE' },
              { n: data.lopDays, l: 'LOP DAYS' },
              { n: data.placementCount, l: 'PLACEMENTS' },
            ].map(a => (
              <View key={a.l} style={s.attCell}>
                <Text style={s.attNum}>{a.n}</Text>
                <Text style={s.attLabel}>{a.l}</Text>
              </View>
            ))}
          </View>

          <View style={s.cols}>
            <View style={s.col}>
              <View style={s.colHead}><Text style={s.colHeadText}>EARNINGS</Text></View>
              <View style={s.line}><Text>Basic</Text><Text>{money(data.basic)}</Text></View>
              <View style={s.line}><Text>HRA</Text><Text>{money(data.hra)}</Text></View>
              <View style={s.line}><Text>Allowances</Text><Text>{money(data.allowances)}</Text></View>
              <View style={s.line}>
                <Text>Placement incentive{data.placementCount ? ` (${data.placementCount})` : ''}</Text>
                <Text>{money(data.placementIncentive)}</Text>
              </View>
              <View style={s.lineTotal}>
                <Text style={s.bold}>Gross</Text><Text style={s.bold}>{money(data.gross)}</Text>
              </View>
            </View>

            <View style={s.col}>
              <View style={s.colHead}><Text style={s.colHeadText}>DEDUCTIONS</Text></View>
              <View style={s.line}>
                <Text>Loss of pay{data.lopDays ? ` (${data.lopDays}d)` : ''}</Text>
                <Text>{money(data.leaveDeduction)}</Text>
              </View>
              <View style={s.line}><Text>PF</Text><Text>{money(data.pf)}</Text></View>
              <View style={s.line}><Text>TDS</Text><Text>{money(data.tds)}</Text></View>
              <View style={s.line}><Text>Other</Text><Text>{money(data.otherDeductions)}</Text></View>
              <View style={s.lineTotal}>
                <Text style={s.bold}>Total</Text><Text style={s.bold}>{money(deductions)}</Text>
              </View>
            </View>
          </View>

          <View style={s.net}>
            <View style={s.netRow}>
              <Text style={{ fontSize: 9, color: '#065f46', fontFamily: 'Helvetica-Bold' }}>NET PAYABLE</Text>
              <Text style={s.netBig}>{money(data.net)}</Text>
            </View>
            <Text style={s.words}>{amountInWords(data.net)}</Text>
          </View>
        </View>

        <View style={s.footer} fixed>
          <Text style={s.footerText}>
            Berojgar Bharat · Computer-generated salary slip, valid without a signature.
          </Text>
        </View>
      </Page>
    </Document>
  )
}
