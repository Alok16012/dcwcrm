'use client'
import { useState, useTransition, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { ArrowLeft, Edit, ArrowRightLeft, ExternalLink, CalendarClock } from 'lucide-react'
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
  const [associates, setAssociates] = useState<{ id: string; name: string; associate_code: string | null }[]>([])
  const [assigningAssoc, setAssigningAssoc] = useState(false)
  const supabase2 = createClient()

  useEffect(() => {
    ;(supabase2 as any).from('associates').select('id, name, associate_code').eq('status', 'approved').order('name')
      .then(({ data }: any) => setAssociates(data ?? []))
  }, [supabase2])

  async function assignToAssociate(associateId: string) {
    setAssigningAssoc(true)
    const { error } = await (supabase2 as any).from('leads').update({ referred_by_associate: associateId || null }).eq('id', lead.id)
    setAssigningAssoc(false)
    if (error) { toast.error(error.message); return }
    toast.success(associateId ? 'Lead assigned to associate' : 'Associate removed')
  }
  const router = useRouter()
  const [lead, setLead] = useState(initialLead)
  const [activities, setActivities] = useState(initialActivities)
  const [showEdit, setShowEdit] = useState(false)
  const [showTransfer, setShowTransfer] = useState(false)
  const [confirmConvert, setConfirmConvert] = useState(false)
  const [pendingStatus, setPendingStatus] = useState<LeadStatus | null>(null)
  const [, startTransition] = useTransition()
  const [showFollowupPicker, setShowFollowupPicker] = useState(false)
  const [followupDate, setFollowupDate] = useState(lead.next_followup_date ?? '')
  const [followupTime, setFollowupTime] = useState((lead as any).extra_data?.followup_time ?? '')
  const supabase = createClient()
  const followupRef = useRef<HTMLInputElement>(null)

  async function saveFollowup(date: string, time: string) {
    if (!date) return
    const existingExtra = (lead as any).extra_data ?? {}
    const newExtra = time ? { ...existingExtra, followup_time: time } : { ...existingExtra, followup_time: null }
    const { error } = await supabase.from('leads').update({
      next_followup_date: date,
      extra_data: newExtra,
    } as never).eq('id', lead.id)
    if (error) { toast.error('Failed to update followup'); return }
    setLead(prev => ({ ...prev, next_followup_date: date, extra_data: newExtra }))
    const label = time ? `${format(new Date(date), 'dd MMM yyyy')} at ${time}` : format(new Date(date), 'dd MMM yyyy')
    toast.success(`Followup set for ${label}`)
    setShowFollowupPicker(false)
  }

  async function clearFollowup() {
    const { error } = await supabase.from('leads').update({ next_followup_date: null } as never).eq('id', lead.id)
    if (error) { toast.error('Failed to clear followup'); return }
    setLead(prev => ({ ...prev, next_followup_date: undefined }))
    setFollowupDate('')
    setFollowupTime('')
    setShowFollowupPicker(false)
    toast.success('Followup cleared')
  }

  async function handleFollowupChange(date: string) {
    const { error } = await supabase.from('leads').update({ next_followup_date: date || null } as never).eq('id', lead.id)
    if (error) { toast.error('Failed to update followup'); return }
    setLead(prev => ({ ...prev, next_followup_date: date || undefined }))
    toast.success(date ? `Followup set for ${format(new Date(date), 'dd MMM yyyy')}` : 'Followup cleared')
  }

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
      <div className="flex items-center gap-2 mb-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="px-2">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h1 className="text-lg font-bold flex-1 truncate">{lead.full_name}</h1>
        <Button variant="outline" size="sm" onClick={() => setShowTransfer(true)} className="px-2 sm:px-3">
          <ArrowRightLeft className="w-4 h-4" /><span className="hidden sm:inline ml-1">Transfer</span>
        </Button>
        <Button size="sm" onClick={() => setShowEdit(true)} className="px-2 sm:px-3">
          <Edit className="w-4 h-4" /><span className="hidden sm:inline ml-1">Edit</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Lead info */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <CardTitle className="text-base">Lead Information</CardTitle>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={`${LEAD_STATUS_COLORS[lead.status]} border-0`}>
                    {LEAD_STATUS_LABELS[lead.status]}
                  </Badge>
                  {lead.status === 'converted' && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      onClick={() => {
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
                    <SelectTrigger className="h-8 w-full sm:w-36 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(LEAD_STATUS_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Followup quick-set */}
                  {!showFollowupPicker ? (
                    <button
                      onClick={() => setShowFollowupPicker(true)}
                      className={`flex items-center gap-1 h-8 px-2.5 rounded-md border text-xs font-medium transition-colors whitespace-nowrap
                        ${lead.next_followup_date
                          ? 'bg-orange-50 border-orange-300 text-orange-700 hover:bg-orange-100'
                          : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                    >
                      <CalendarClock className="w-3.5 h-3.5" />
                      {lead.next_followup_date
                        ? `${format(new Date(lead.next_followup_date), 'dd MMM')}${(lead as any).extra_data?.followup_time ? ` ${(lead as any).extra_data.followup_time}` : ''}`
                        : 'Set Followup'}
                    </button>
                  ) : (
                    <div className="flex flex-col gap-1.5 bg-orange-50 border border-orange-200 rounded-lg p-2.5 min-w-[220px]">
                      <p className="text-[11px] font-semibold text-orange-700 flex items-center gap-1">
                        <CalendarClock className="w-3 h-3" /> Set Followup
                      </p>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="date"
                          value={followupDate}
                          autoFocus
                          onChange={(e) => setFollowupDate(e.target.value)}
                          className="h-7 px-2 text-xs border border-orange-300 rounded-md focus:outline-none focus:ring-1 focus:ring-orange-400 bg-white flex-1"
                        />
                        <input
                          type="time"
                          value={followupTime}
                          onChange={(e) => setFollowupTime(e.target.value)}
                          className="h-7 px-2 text-xs border border-orange-300 rounded-md focus:outline-none focus:ring-1 focus:ring-orange-400 bg-white w-24"
                        />
                      </div>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => saveFollowup(followupDate, followupTime)}
                          disabled={!followupDate}
                          className="flex-1 h-7 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white text-xs rounded-md font-medium transition-colors"
                        >
                          Save
                        </button>
                        {lead.next_followup_date && (
                          <button onClick={clearFollowup} className="h-7 px-2 text-xs text-red-500 hover:text-red-700 border border-red-200 rounded-md">
                            Clear
                          </button>
                        )}
                        <button onClick={() => setShowFollowupPicker(false)} className="h-7 px-2 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-md">
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
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
                <div>
                  <p className="text-gray-500 mb-1">Assign to Associate</p>
                  <select
                    defaultValue={(lead as any).referred_by_associate ?? ''}
                    onChange={e => assignToAssociate(e.target.value)}
                    disabled={assigningAssoc}
                    className="w-full border border-gray-200 rounded-lg px-2 py-1 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                  >
                    <option value="">— None —</option>
                    {associates.map(a => (
                      <option key={a.id} value={a.id}>{a.name}{a.associate_code ? ` (${a.associate_code})` : ''}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <p className="text-gray-500 flex items-center gap-1"><CalendarClock className="w-3 h-3" /> Next Followup</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <input
                      ref={followupRef}
                      type="date"
                      defaultValue={lead.next_followup_date ?? ''}
                      onChange={(e) => handleFollowupChange(e.target.value)}
                      className="text-sm font-medium border border-gray-200 rounded-md px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white w-full max-w-[160px]"
                    />
                    {lead.next_followup_date && (
                      <button onClick={() => { handleFollowupChange(''); if (followupRef.current) followupRef.current.value = '' }}
                        className="text-gray-400 hover:text-red-500 text-xs">✕</button>
                    )}
                  </div>
                </div>
                <div><p className="text-gray-500">Created On</p><p className="font-medium">{format(new Date(lead.created_at), 'dd MMM yyyy')}</p></div>
              </div>
            </CardContent>
          </Card>

          {/* Social Media Lead Data */}
          {lead.metadata && Object.keys(lead.metadata).length > 0 && (
            <Card className="bg-blue-50/20 border-blue-100 shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-blue-800">Extra Form Data (Meta)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {Object.entries(lead.metadata).map(([key, value]) => (
                    <div key={key}>
                      <span className="text-[10px] uppercase text-blue-500 font-bold tracking-wider">{key.replace(/_/g, ' ')}</span>
                      <p className="text-sm font-medium text-slate-700">{String(value)}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Payment summary */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Payment Summary</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-sm mb-4">
                <div><p className="text-gray-500">Discussed Amount</p><p className="font-bold text-lg">{lead.total_fee ? formatCurrency(lead.total_fee) : '-'}</p></div>
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
