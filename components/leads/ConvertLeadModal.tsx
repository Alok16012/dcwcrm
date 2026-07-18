import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { IndianRupee, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { Lead } from '@/types/app.types'

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
  const [mode, setMode] = useState(lead.mode ?? '')
  const [departmentId, setDepartmentId] = useState(lead.department_id ?? '')
  const [subSectionId, setSubSectionId] = useState(lead.sub_section_id ?? '')
  const [departments, setDepartments] = useState<any[]>([])
  const [subSections, setSubSections] = useState<any[]>([])
  const router = useRouter()
  const supabase = createClient()

  // Load departments
  useEffect(() => {
    supabase.from('departments').select('*').order('name')
      .then(({ data }) => setDepartments(data ?? []))
  }, [])

  // Load sub-sections when department changes
  useEffect(() => {
    if (departmentId) {
      supabase.from('department_sub_sections').select('*').eq('department_id', departmentId).order('name')
        .then(({ data }) => setSubSections(data ?? []))
    } else {
      setSubSections([])
    }
  }, [departmentId])

  async function handleConvert() {
    setLoading(true)
    try {
      const fee = totalFee ? parseFloat(totalFee) : null
      const paid = amountPaid ? parseFloat(amountPaid) : 0

      const res = await fetch('/api/leads/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: lead.id,
          total_fee: fee,
          amount_paid: paid,
          mode: mode || null,
          department_id: departmentId || null,
          sub_section_id: subSectionId || null,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Failed to convert')
      }

      toast.success('Lead converted! Awaiting admin approval in New Students.')
      onSuccess()
      router.push('/backend')
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to convert lead')
    } finally {
      setLoading(false)
    }
  }

  const pending = totalFee && amountPaid
    ? Math.max(0, parseFloat(totalFee) - parseFloat(amountPaid))
    : 0

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            Convert to Student
          </DialogTitle>
          <DialogDescription>
            Enter details for <span className="font-semibold text-gray-900">{lead.full_name}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-gray-600">Mode</Label>
              <Select value={mode} onValueChange={(v) => setMode(v ?? '')}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="attending">Attending</SelectItem>
                  <SelectItem value="non-attending">Non-Attending</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold text-gray-600">Department</Label>
              <Select value={departmentId} onValueChange={(v) => { setDepartmentId(v ?? ''); setSubSectionId('') }}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select dept">
                    {departmentId ? departments.find((d) => d.id === departmentId)?.name ?? null : null}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold text-gray-600">University/Board</Label>
            <Select value={subSectionId} onValueChange={(v) => setSubSectionId(v ?? '')} disabled={!departmentId}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select university/board">
                  {subSectionId ? subSections.find((s) => s.id === subSectionId)?.name ?? null : null}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {subSections.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="pt-2 border-t border-gray-100"></div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold text-gray-600">Fixed/Discussed Amount</Label>
            <div className="relative">
              <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                type="number"
                placeholder="e.g. 50000"
                value={totalFee}
                onChange={(e) => setTotalFee(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold text-gray-600">Initial Deposit</Label>
            <div className="relative">
              <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                type="number"
                placeholder="e.g. 10000"
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
                className="pl-9 h-9"
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
            <p className="text-[10px] text-blue-700 leading-tight">
              Student record will be created with these details. You can update them later in the backend.
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
