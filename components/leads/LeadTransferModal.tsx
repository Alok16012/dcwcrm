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
  leadIds: string[]
  currentAssignee?: string | null
  onSuccess: () => void
}

export function LeadTransferModal({ open, onClose, leadIds, currentAssignee, onSuccess }: LeadTransferModalProps) {
  const [telecallers, setTelecallers] = useState<Profile[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [reason, setReason] = useState('')
  const [isPending, startTransition] = useTransition()
  const supabase = createClient()

  useEffect(() => {
    if (!open) return
    supabase.from('profiles').select('*').in('role', ['lead', 'telecaller', 'counselor']).eq('is_active', true)
      .then(({ data }) => setTelecallers((data ?? []) as any[]))
  }, [open, currentAssignee])

  async function handleTransfer() {
    if (!selectedId) { toast.error('Select a lead agent'); return }
    if (!leadIds || leadIds.length === 0) { toast.error('No leads selected'); return }

    startTransition(async () => {
      try {
        const { error } = await supabase.from('leads').update({
          assigned_to: selectedId,
          assigned_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as never).in('id', leadIds)
        if (error) throw error

        const { data: { user } } = await supabase.auth.getUser()

        const activities = leadIds.map(id => ({
          lead_id: id,
          activity_type: 'transferred',
          new_value: telecallers.find((t) => t.id === selectedId)?.full_name,
          note: reason || null,
          performed_by: user?.id
        }))

        await supabase.from('lead_activities').insert(activities as never)

        toast.success(`Successfully transferred ${leadIds.length} lead${leadIds.length > 1 ? 's' : ''}`)
        onSuccess()
        onClose()
      } catch {
        toast.error('Failed to transfer lead(s)')
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
              <SelectTrigger><SelectValue placeholder="Select agent" /></SelectTrigger>
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
