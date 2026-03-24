'use client'
import { useRouter } from 'next/navigation'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export default function PayrollMonthSelector({ month, year }: { month: number; year: number }) {
  const router = useRouter()
  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i)

  return (
    <div className="flex items-center gap-2">
      <Select value={String(month)} onValueChange={(v) => router.push(`?month=${v}&year=${year}`)}>
        <SelectTrigger className="w-36 h-9 text-sm">
          <span className="text-sm">{MONTHS[month - 1]}</span>
        </SelectTrigger>
        <SelectContent>
          {MONTHS.map((m, i) => (
            <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={String(year)} onValueChange={(v) => router.push(`?month=${month}&year=${v}`)}>
        <SelectTrigger className="w-24 h-9 text-sm">
          <span className="text-sm">{year}</span>
        </SelectTrigger>
        <SelectContent>
          {years.map((y) => (
            <SelectItem key={y} value={String(y)}>{y}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
