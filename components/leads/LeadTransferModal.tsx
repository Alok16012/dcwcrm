'use client'
import { useEffect, useState, useTransition } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { Profile } from '@/types/app.types'

interface LeadTransferModalProps {
  open: boolean
  onClose: () => void
  leadId: string
  currentAssignee?: string | null
  onSuccess: () => void
}

export function LeadTransferModal({ open, onClose, leadId, currentAssignee, onSuccess }: LeadTransferModalProps) {
  const [telecallers, setTelecallers] = useState<Profile[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [reason, setReason] = useState('')
  const [isPending, startTransition] = useTransition()
  const supabase = createClient()

  useEffect(() => {
    if (!open) return
    supabase.from('profiles').select('*').eq('role', 'telecaller').eq('is_active', true)
      .then(({ data }) => setTelecallers((data ?? []) as any[]))
  }, [open, currentAssignee])

  async function handleTransfer() {
    if (!selectedId) { toast.error('Select a telecaller'); return }
    startTransition(async () => {
      try {
        const { error } = await supabase.from('leads').update({
          assigned_to: selectedId,
          assigned_at: new Date().toISOString(),
        } as never).eq('id', leadId)
        if (error) throw error

        const { data: { user } } = await supabase.auth.getUser()
        await supabase.from('lead_activities').insert({
          lead_id: leadId,
          activity_type: 'transferred',
          new_value: telecallers.find((t) => t.id === selectedId)?.full_name,
          note: reason || null,
          performed_by: user?.id
        } as never)

        toast.success('Lead transferred successfully')
        onSuccess()
        onClose()
      } catch {
        toast.error('Failed to transfer lead')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Transfer Lead</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Transfer to</Label>
            <Select value={selectedId} onValueChange={(v) => setSelectedId(v || '')}>
              <SelectTrigger><SelectValue placeholder="Select telecaller" /></SelectTrigger>
              <SelectContent>
                {telecallers.map((t) => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Reason (optional)</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason for transfer..."
              rows={3}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleTransfer} disabled={isPending || !selectedId}>
              {isPending ? 'Transferring...' : 'Transfer'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
