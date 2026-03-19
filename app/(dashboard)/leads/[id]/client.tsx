'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { ArrowLeft, Edit, ArrowRightLeft, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { LeadTimeline } from '@/components/leads/LeadTimeline'
import { LeadTransferModal } from '@/components/leads/LeadTransferModal'
import { ConvertLeadModal } from '@/components/leads/ConvertLeadModal'
import { LeadForm } from '@/components/leads/LeadForm'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  LEAD_STATUS_LABELS, LEAD_STATUS_COLORS, LEAD_SOURCE_LABELS,
  PAYMENT_MODE_LABELS, formatCurrency,
  type Lead, type LeadActivity, type Payment, type LeadStatus
} from '@/types/app.types'

interface LeadDetailClientProps {
  lead: Lead
  activities: LeadActivity[]
  payments: Payment[]
}

export function LeadDetailClient({ lead: initialLead, activities: initialActivities, payments }: LeadDetailClientProps) {
  const router = useRouter()
  const [lead, setLead] = useState(initialLead)
  const [activities, setActivities] = useState(initialActivities)
  const [showEdit, setShowEdit] = useState(false)
  const [showTransfer, setShowTransfer] = useState(false)
  const [confirmConvert, setConfirmConvert] = useState(false)
  const [pendingStatus, setPendingStatus] = useState<LeadStatus | null>(null)
  const [, startTransition] = useTransition()
  const supabase = createClient()

  async function handleStatusChange(newStatus: LeadStatus) {
    if (newStatus === 'converted') {
      setPendingStatus(newStatus)
      setConfirmConvert(true)
      return
    }
    applyStatusChange(newStatus)
  }

  function applyStatusChange(newStatus: LeadStatus) {
    startTransition(async () => {
      const { error } = await supabase.from('leads').update({ status: newStatus } as never).eq('id', lead.id)
      if (error) { toast.error('Failed to update status'); return }
      setLead((prev) => ({ ...prev, status: newStatus }))
      toast.success('Status updated')
      // Reload activities
      const { data } = await supabase
        .from('lead_activities')
        .select('*, performer:profiles!performed_by(id, email, full_name, role, is_active, created_at)')
        .eq('lead_id', lead.id)
        .order('created_at', { ascending: false })
      setActivities((data ?? []) as never)
    })
  }

  async function handleEditSuccess() {
    setShowEdit(false)
    // Refresh lead data
    const { data } = await supabase
      .from('leads')
      .select('*, course:courses(id, name, is_active, created_at), sub_course:sub_courses(id, name, is_active, created_at, course_id), assigned_user:profiles!leads_assigned_to_fkey(id, email, full_name, role, is_active, created_at)')
      .eq('id', lead.id)
      .single()
    if (data) setLead(data as Lead)
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <h1 className="text-xl font-bold flex-1">{lead.full_name}</h1>
        <Button variant="outline" size="sm" onClick={() => setShowTransfer(true)}>
          <ArrowRightLeft className="w-4 h-4 mr-1" /> Transfer
        </Button>
        <Button size="sm" onClick={() => setShowEdit(true)}>
          <Edit className="w-4 h-4 mr-1" /> Edit
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Lead info */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Lead Information</CardTitle>
                <div className="flex items-center gap-2">
                  <Badge className={`${LEAD_STATUS_COLORS[lead.status]} border-0`}>
                    {LEAD_STATUS_LABELS[lead.status]}
                  </Badge>
                  {lead.status === 'converted' && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      onClick={() => {
                        // Find student by lead_id
                        supabase.from('students').select('id').eq('lead_id', lead.id).then(({ data }) => {
                          if (data && data.length > 0) {
                            router.push(`/backend/${(data[0] as any).id}`)
                          } else {
                            alert('Student record not found. Please check if conversion was successful.')
                          }
                        })
                      }}
                    >
                      View Student <ExternalLink className="w-3 h-3" />
                    </Button>
                  )}
                  <Select value={lead.status} onValueChange={(v) => handleStatusChange(v as LeadStatus)}>
                    <SelectTrigger className="h-7 w-32 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(LEAD_STATUS_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><p className="text-gray-500">Phone</p><p className="font-medium">{lead.phone}</p></div>
                <div><p className="text-gray-500">Email</p><p className="font-medium">{lead.email ?? '-'}</p></div>
                <div><p className="text-gray-500">City</p><p className="font-medium">{lead.city ?? '-'}</p></div>
                <div><p className="text-gray-500">State</p><p className="font-medium">{lead.state ?? '-'}</p></div>
                <div><p className="text-gray-500">Course</p><p className="font-medium">{lead.course?.name ?? '-'}</p></div>
                <div><p className="text-gray-500">Sub-course</p><p className="font-medium">{lead.sub_course?.name ?? '-'}</p></div>
                <div><p className="text-gray-500">Source</p><p className="font-medium">{LEAD_SOURCE_LABELS[lead.source]}</p></div>
                <div><p className="text-gray-500">Assigned To</p><p className="font-medium">{lead.assigned_user?.full_name ?? 'Unassigned'}</p></div>
                <div><p className="text-gray-500">Next Followup</p><p className="font-medium">{lead.next_followup_date ? format(new Date(lead.next_followup_date), 'dd MMM yyyy') : '-'}</p></div>
                <div><p className="text-gray-500">Created On</p><p className="font-medium">{format(new Date(lead.created_at), 'dd MMM yyyy')}</p></div>
              </div>
            </CardContent>
          </Card>

          {/* Payment summary */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Payment Summary</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-sm mb-4">
                <div><p className="text-gray-500">Total Fee</p><p className="font-bold text-lg">{lead.total_fee ? formatCurrency(lead.total_fee) : '-'}</p></div>
                <div><p className="text-gray-500">Paid</p><p className="font-bold text-lg text-green-700">{formatCurrency(lead.amount_paid ?? 0)}</p></div>
                <div><p className="text-gray-500">Pending</p><p className="font-bold text-lg text-red-600">{lead.total_fee ? formatCurrency(Math.max(0, lead.total_fee - (lead.amount_paid ?? 0))) : '-'}</p></div>
              </div>
              {payments.length > 0 && (
                <table className="w-full text-xs">
                  <thead><tr className="text-gray-500"><th className="text-left py-1">Date</th><th className="text-left py-1">Amount</th><th className="text-left py-1">Mode</th><th className="text-left py-1">Receipt</th></tr></thead>
                  <tbody>
                    {payments.map((p) => (
                      <tr key={p.id} className="border-t">
                        <td className="py-1">{format(new Date(p.payment_date), 'dd MMM yyyy')}</td>
                        <td className="py-1">{formatCurrency(p.amount)}</td>
                        <td className="py-1">{PAYMENT_MODE_LABELS[p.payment_mode]}</td>
                        <td className="py-1">{p.receipt_number ?? '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Timeline */}
        <div>
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Activity Timeline</CardTitle></CardHeader>
            <CardContent>
              <LeadTimeline activities={activities as never} />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Edit dialog */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Edit Lead</DialogTitle></DialogHeader>
          <LeadForm lead={lead} onSuccess={handleEditSuccess} onCancel={() => setShowEdit(false)} />
        </DialogContent>
      </Dialog>

      {/* Transfer modal */}
      <LeadTransferModal
        open={showTransfer}
        onClose={() => setShowTransfer(false)}
        leadIds={[lead.id]}
        currentAssignee={lead.assigned_to}
        onSuccess={async () => {
          setShowTransfer(false)
          const { data } = await supabase
            .from('leads')
            .select('*, course:courses(id, name, is_active, created_at), sub_course:sub_courses(id, name, is_active, created_at, course_id), assigned_user:profiles!leads_assigned_to_fkey(id, email, full_name, role, is_active, created_at)')
            .eq('id', lead.id)
            .single()
          if (data) setLead(data as Lead)
        }}
      />

      {/* Convert modal with fee details */}
      {confirmConvert && pendingStatus && (
        <ConvertLeadModal
          open={true}
          onClose={() => { setConfirmConvert(false); setPendingStatus(null) }}
          lead={lead}
          onSuccess={() => {
            setConfirmConvert(false)
            setPendingStatus(null)
            setLead((prev) => ({ ...prev, status: 'converted' }))
          }}
        />
      )}
    </div>
  )
}
