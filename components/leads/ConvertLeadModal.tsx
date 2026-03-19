'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { IndianRupee, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { Lead, LeadStatus } from '@/types/app.types'

interface ConvertLeadModalProps {
  open: boolean
  onClose: () => void
  lead: Lead
  onSuccess: () => void
}

export function ConvertLeadModal({ open, onClose, lead, onSuccess }: ConvertLeadModalProps) {
  const [loading, setLoading] = useState(false)
  const [totalFee, setTotalFee] = useState(lead.total_fee?.toString() ?? '')
  const [amountPaid, setAmountPaid] = useState(lead.amount_paid?.toString() ?? '0')
  const router = useRouter()
  const supabase = createClient()

  async function handleConvert() {
    setLoading(true)
    try {
      const fee = totalFee ? parseFloat(totalFee) : null
      const paid = amountPaid ? parseFloat(amountPaid) : 0

      const { error } = await supabase.from('leads').update({
        status: 'converted' as LeadStatus,
        total_fee: fee,
        amount_paid: paid,
      } as never).eq('id', lead.id)

      if (error) throw error

      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from('lead_activities').insert({
        lead_id: lead.id,
        activity_type: 'converted',
        performed_by: user?.id,
        new_value: `Fee: ${fee}, Paid: ${paid}`
      } as never)

      toast.success('Lead converted to student!')
      onSuccess()
      router.push(`/backend`)
    } catch (err) {
      toast.error('Failed to convert lead')
    } finally {
      setLoading(false)
    }
  }

  const pending = totalFee && amountPaid
    ? Math.max(0, parseFloat(totalFee) - parseFloat(amountPaid))
    : 0

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            Convert to Student
          </DialogTitle>
          <DialogDescription>
            Enter fee details for <span className="font-semibold text-gray-900">{lead.full_name}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Total Course Fee</Label>
            <div className="relative">
              <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                type="number"
                placeholder="e.g. 50000"
                value={totalFee}
                onChange={(e) => setTotalFee(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Amount Paid Now</Label>
            <div className="relative">
              <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                type="number"
                placeholder="e.g. 10000"
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {totalFee && amountPaid && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex justify-between items-center">
              <span className="text-sm text-amber-800">Pending Amount</span>
              <span className="font-bold text-amber-700">₹{pending.toLocaleString()}</span>
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs text-blue-700">
              Student record will be created with these fee details. You can add more payments later.
            </p>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button onClick={handleConvert} disabled={loading} className="flex-1 bg-green-600 hover:bg-green-700">
            {loading ? 'Converting...' : 'Convert to Student'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
