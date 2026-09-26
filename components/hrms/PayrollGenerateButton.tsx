'use client'
import { withBase } from '@/lib/base-path'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Calculator, Loader2 } from 'lucide-react'

/** Rebuilds the month's payroll from the attendance already on the calendar. */
export default function PayrollGenerateButton({ month, year }: { month: number; year: number }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function run() {
    setBusy(true)
    try {
      const res = await fetch(withBase('/api/hrms/payroll/generate'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month, year }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Generate failed'); return }
      toast.success(
        `${json.generated} employees ka payroll attendance se bana` +
        (json.skippedLocked ? ` · ${json.skippedLocked} locked rows chhode gaye` : ''),
      )
      // No attendance row means no deduction, so an empty calendar quietly pays
      // in full — say so loudly before anyone approves the month.
      if (json.employeesWithGaps > 0) {
        toast.warning(
          `${json.employeesWithGaps} employees ke ${json.unmarkedDays} working days bina attendance ke hain — ` +
          'un dino ka koi deduction nahi laga. Approve karne se pehle attendance check karo.',
          { duration: 10000 },
        )
      }
      router.refresh()
    } catch {
      toast.error('Generate failed')
    } finally { setBusy(false) }
  }

  return (
    <Button onClick={run} disabled={busy} className="gap-1.5">
      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />}
      Generate from attendance
    </Button>
  )
}
