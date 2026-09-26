/**
 * Rupees in words, Indian system — a receipt is a legal-ish document and the
 * written amount is what stops a figure being altered after the fact.
 *
 *   1234  -> "One Thousand Two Hundred Thirty Four Rupees Only"
 *   150000 -> "One Lakh Fifty Thousand Rupees Only"
 */

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen',
]
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

function twoDigits(n: number): string {
  if (n < 20) return ONES[n]
  const t = Math.floor(n / 10)
  const o = n % 10
  return TENS[t] + (o ? ` ${ONES[o]}` : '')
}

function threeDigits(n: number): string {
  const h = Math.floor(n / 100)
  const rest = n % 100
  return [h ? `${ONES[h]} Hundred` : '', rest ? twoDigits(rest) : ''].filter(Boolean).join(' ')
}

export function amountInWords(amount: number): string {
  const rupees = Math.floor(Math.abs(amount))
  const paise = Math.round((Math.abs(amount) - rupees) * 100)

  if (rupees === 0 && paise === 0) return 'Zero Rupees Only'

  // Indian grouping: crore, lakh, thousand, then the last three digits.
  const parts: string[] = []
  const crore = Math.floor(rupees / 10000000)
  const lakh = Math.floor((rupees % 10000000) / 100000)
  const thousand = Math.floor((rupees % 100000) / 1000)
  const hundred = rupees % 1000

  if (crore) parts.push(`${threeDigits(crore)} Crore`)
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`)
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`)
  if (hundred) parts.push(threeDigits(hundred))

  let words = parts.join(' ').replace(/\s+/g, ' ').trim()
  if (rupees > 0) words += rupees === 1 ? ' Rupee' : ' Rupees'
  if (paise > 0) words += `${rupees > 0 ? ' and ' : ''}${twoDigits(paise)} Pais${paise === 1 ? 'a' : 'e'}`

  return `${words} Only`
}
