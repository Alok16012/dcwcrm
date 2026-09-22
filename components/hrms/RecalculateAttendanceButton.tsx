'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { RefreshCw, Loader2 } from 'lucide-react'

/** Rebuilds attendance for the shown range from the biometric punches. */
export default function RecalculateAttendanceButton({ from, to }: { from: string; to: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function run() {
    setBusy(true)
    try {
      const res = await fetch('/api/hrms/attendance/recalculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Recalculation failed'); return }
      toast.success(json.updated > 0
        ? `${json.updated} din dobara calculate hue`
        : 'Is range me koi biometric punch nahi mila')
      router.refresh()
    } catch {
      toast.error('Recalculation failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={run} disabled={busy} className="gap-1.5 h-9">
      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
      Recalculate from punches
    </Button>
  )
}
