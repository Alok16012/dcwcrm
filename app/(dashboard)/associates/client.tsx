'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import {
  CheckCircle2, XCircle, Clock, Eye, RefreshCw,
  Copy, UserCheck, Wallet,
} from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AssociateManager } from '@/app/(dashboard)/admin/tabs/AssociateManager'
import { PageHeader } from '@/components/shared/PageHeader'

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)

type AStatus = 'pending' | 'approved' | 'rejected'

interface Associate {
  id: string; name: string; phone: string; father_phone: string | null
  email: string; aadhar_number: string | null; pan_number: string | null
  current_address: string | null; current_city: string | null
  current_state: string | null; current_pincode: string | null
  permanent_address: string | null; permanent_city: string | null
  permanent_state: string | null; permanent_pincode: string | null
  same_as_current: boolean; bank_name: string | null
  account_number: string | null; ifsc_code: string | null
  account_holder_name: string | null; status: AStatus
  associate_code: string | null; created_at: string
  aadhar_doc_url: string | null; pan_doc_url: string | null; cheque_doc_url: string | null
}

interface RechargeRequest {
  id: string
  associate_id: string
  amount: number
  receipt_url: string | null
  status: 'pending' | 'approved' | 'rejected'
  rejection_reason: string | null
  created_at: string
  associate?: { name: string; associate_code: string | null; wallet_balance: number }
}

interface Credentials { associate_code: string; email: string; password: string }

export default function AssociatesClient() {
  const supabase = createClient()
  const db = supabase as any

  const [isAdmin, setIsAdmin] = useState(false)
  const [activeTab, setActiveTab] = useState<'all' | 'approvals' | 'recharges'>('all')

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }: any) => {
      if (!user) return
      ;(supabase as any).from('profiles').select('role').eq('id', user.id).single()
        .then(({ data }: any) => setIsAdmin(data?.role === 'admin'))
    })
  }, [supabase])

  // ── Associate Approvals state ──
  const [associates, setAssociates] = useState<Associate[]>([])
  const [assocLoading, setAssocLoading] = useState(false)
  const [assocFilter, setAssocFilter] = useState<'pending' | 'all'>('pending')
  const [selected, setSelected] = useState<Associate | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [approving, setApproving] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectOpen, setRejectOpen] = useState(false)
  const [credOpen, setCredOpen] = useState(false)
  const [credentials, setCredentials] = useState<Credentials | null>(null)

  // ── Wallet Recharges state ──
  const [recharges, setRecharges] = useState<RechargeRequest[]>([])
  const [rechargeLoading, setRechargeLoading] = useState(false)
  const [rechargeFilter, setRechargeFilter] = useState<'pending' | 'all'>('pending')
  const [rechargeSelected, setRechargeSelected] = useState<RechargeRequest | null>(null)
  const [rechargeDetailOpen, setRechargeDetailOpen] = useState(false)
  const [rechargeRejecting, setRechargeRejecting] = useState(false)
  const [rechargeRejectReason, setRechargeRejectReason] = useState('')
  const [rechargeRejectOpen, setRechargeRejectOpen] = useState(false)
  const [rechargeApproving, setRechargeApproving] = useState(false)

  const loadAssociates = useCallback(async () => {
    setAssocLoading(true)
    const q = db.from('associates').select('*').order('created_at', { ascending: false })
    if (assocFilter === 'pending') q.eq('status', 'pending')
    const { data } = await q
    setAssociates((data ?? []) as Associate[])
    setAssocLoading(false)
  }, [db, assocFilter])

  const loadRecharges = useCallback(async () => {
    setRechargeLoading(true)
    const q = db
      .from('wallet_recharge_requests')
      .select('*, associate:associates(name, associate_code, wallet_balance)')
      .order('created_at', { ascending: false })
    if (rechargeFilter === 'pending') q.eq('status', 'pending')
    const { data } = await q
    setRecharges((data ?? []) as RechargeRequest[])
    setRechargeLoading(false)
  }, [db, rechargeFilter])

  useEffect(() => { if (activeTab === 'approvals') loadAssociates() }, [activeTab, loadAssociates])
  useEffect(() => { if (activeTab === 'recharges') loadRecharges() }, [activeTab, loadRecharges])

  // Pre-load pending counts on mount for badges
  const [pendingApprovalCount, setPendingApprovalCount] = useState(0)
  const [pendingRechargeCount, setPendingRechargeCount] = useState(0)
  useEffect(() => {
    db.from('associates').select('id', { count: 'exact', head: true }).eq('status', 'pending')
      .then(({ count }: any) => setPendingApprovalCount(count ?? 0))
    db.from('wallet_recharge_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending')
      .then(({ count }: any) => setPendingRechargeCount(count ?? 0))
  }, [db])

  async function handleApproveAssoc(assoc: Associate) {
    setApproving(true)
    try {
      const res = await fetch('/api/associates/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ associate_id: assoc.id }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Failed'); return }
      setCredentials(data as Credentials)
      setDetailOpen(false)
      setCredOpen(true)
      toast.success(`${assoc.name} approved`)
      setPendingApprovalCount(p => Math.max(0, p - 1))
      loadAssociates()
    } finally { setApproving(false) }
  }

  async function handleRejectAssoc() {
    if (!selected || !rejectReason.trim()) { toast.error('Provide a reason'); return }
    setRejecting(true)
    try {
      const { error } = await db.from('associates').update({ status: 'rejected', rejection_reason: rejectReason.trim() }).eq('id', selected.id)
      if (error) { toast.error(error.message); return }
      toast.success('Application rejected')
      setRejectOpen(false); setDetailOpen(false); setRejectReason('')
      setPendingApprovalCount(p => Math.max(0, p - 1))
      loadAssociates()
    } finally { setRejecting(false) }
  }

  async function handleApproveRecharge(r: RechargeRequest) {
    setRechargeApproving(true)
    try {
      const res = await fetch('/api/associates/approve-recharge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: r.id, action: 'approve' }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Failed'); return }
      toast.success(`${fmt(r.amount)} approved — balance updated`)
      setRechargeDetailOpen(false)
      setPendingRechargeCount(p => Math.max(0, p - 1))
      loadRecharges()
    } finally { setRechargeApproving(false) }
  }

  async function handleRejectRecharge() {
    if (!rechargeSelected || !rechargeRejectReason.trim()) { toast.error('Provide a reason'); return }
    setRechargeRejecting(true)
    try {
      const res = await fetch('/api/associates/approve-recharge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: rechargeSelected.id, action: 'reject', rejection_reason: rechargeRejectReason }),
      })
      if (!res.ok) { toast.error('Failed'); return }
      toast.success('Recharge request rejected')
      setRechargeRejectOpen(false); setRechargeDetailOpen(false); setRechargeRejectReason('')
      loadRecharges()
    } finally { setRechargeRejecting(false) }
  }

  const sBadge = (s: AStatus) => {
    if (s === 'approved') return <Badge className="bg-green-100 text-green-800 border-0 gap-1"><CheckCircle2 className="w-3 h-3" />Approved</Badge>
    if (s === 'rejected') return <Badge className="bg-red-100 text-red-800 border-0 gap-1"><XCircle className="w-3 h-3" />Rejected</Badge>
    return <Badge className="bg-amber-100 text-amber-800 border-0 gap-1"><Clock className="w-3 h-3" />Pending</Badge>
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Associates" description="Manage associates, approvals and wallet recharges" />

      {/* Tab switcher */}
      <div className="flex gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('all')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'all' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          All Associates
        </button>
        {isAdmin && (
          <>
            <button
              onClick={() => setActiveTab('approvals')}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === 'approvals' ? 'border-amber-500 text-amber-700' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <UserCheck className="w-4 h-4" /> Approvals
              {pendingApprovalCount > 0 && (
                <span className="bg-amber-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {pendingApprovalCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('recharges')}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === 'recharges' ? 'border-green-600 text-green-700' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Wallet className="w-4 h-4" /> Wallet Recharges
              {pendingRechargeCount > 0 && (
                <span className="bg-green-600 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {pendingRechargeCount}
                </span>
              )}
            </button>
          </>
        )}
      </div>

      {/* ── ALL ASSOCIATES ── */}
      {activeTab === 'all' && <AssociateManager />}

      {/* ── APPROVALS ── */}
      {activeTab === 'approvals' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex gap-1.5">
              {(['pending', 'all'] as const).map(f => (
                <Button key={f} size="sm" variant={assocFilter === f ? 'default' : 'outline'} className="h-8 text-xs" onClick={() => setAssocFilter(f)}>
                  {f === 'pending' ? 'Pending Only' : 'All'}
                </Button>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={loadAssociates} className="gap-1.5 h-8 ml-auto">
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </Button>
          </div>

          {assocLoading ? (
            <div className="text-center py-16 text-muted-foreground text-sm">Loading…</div>
          ) : associates.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <UserCheck className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">{assocFilter === 'pending' ? 'No pending applications' : 'No associates found'}</p>
            </div>
          ) : (
            <div className="rounded-xl border overflow-hidden bg-white">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Name</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600 hidden sm:table-cell">Phone</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600 hidden md:table-cell">Email</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600 hidden lg:table-cell">Applied On</th>
                    <th className="text-center px-4 py-3 font-semibold text-slate-600">Status</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-600">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {associates.map(a => (
                    <tr key={a.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{a.name}</td>
                      <td className="px-4 py-3 text-slate-600 hidden sm:table-cell">{a.phone}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs hidden md:table-cell">{a.email}</td>
                      <td className="px-4 py-3 text-slate-400 text-xs hidden lg:table-cell">
                        {new Date(a.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3 text-center">{sBadge(a.status)}</td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => { setSelected(a); setDetailOpen(true) }}>
                          <Eye className="w-3.5 h-3.5" /> Review
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── WALLET RECHARGES ── */}
      {activeTab === 'recharges' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex gap-1.5">
              {(['pending', 'all'] as const).map(f => (
                <Button key={f} size="sm" variant={rechargeFilter === f ? 'default' : 'outline'} className="h-8 text-xs" onClick={() => setRechargeFilter(f)}>
                  {f === 'pending' ? 'Pending Only' : 'All'}
                </Button>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={loadRecharges} className="gap-1.5 h-8 ml-auto">
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </Button>
          </div>

          {rechargeLoading ? (
            <div className="text-center py-16 text-muted-foreground text-sm">Loading…</div>
          ) : recharges.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Wallet className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">{rechargeFilter === 'pending' ? 'No pending recharge requests' : 'No requests found'}</p>
            </div>
          ) : (
            <div className="rounded-xl border overflow-hidden bg-white">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Associate</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600 hidden sm:table-cell">Code</th>
                    <th className="text-right px-4 py-3 font-semibold text-slate-600">Amount</th>
                    <th className="text-center px-4 py-3 font-semibold text-slate-600 hidden md:table-cell">Receipt</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600 hidden lg:table-cell">Date</th>
                    <th className="text-center px-4 py-3 font-semibold text-slate-600">Status</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-600">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {recharges.map(r => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{r.associate?.name ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-500 font-mono text-xs hidden sm:table-cell">{r.associate?.associate_code ?? '—'}</td>
                      <td className="px-4 py-3 text-right font-bold font-mono text-gray-900">{fmt(r.amount)}</td>
                      <td className="px-4 py-3 text-center hidden md:table-cell">
                        {r.receipt_url
                          ? <a href={r.receipt_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 text-xs hover:underline">View</a>
                          : <span className="text-slate-400 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs hidden lg:table-cell">
                        {new Date(r.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {r.status === 'approved' && <Badge className="bg-green-100 text-green-800 border-0 text-xs gap-1"><CheckCircle2 className="w-3 h-3" />Approved</Badge>}
                        {r.status === 'rejected' && <Badge className="bg-red-100 text-red-800 border-0 text-xs gap-1"><XCircle className="w-3 h-3" />Rejected</Badge>}
                        {r.status === 'pending' && <Badge className="bg-amber-100 text-amber-800 border-0 text-xs gap-1"><Clock className="w-3 h-3" />Pending</Badge>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {r.status === 'pending' && (
                          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => { setRechargeSelected(r); setRechargeDetailOpen(true) }}>
                            <Eye className="w-3.5 h-3.5" /> Review
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Associate Detail Dialog ── */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">Review — {selected?.name} {selected && sBadge(selected.status)}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <D label="Full Name" value={selected.name} /><D label="Phone" value={selected.phone} />
                <D label="Father's Phone" value={selected.father_phone} /><D label="Email" value={selected.email} />
                <D label="Aadhaar" value={selected.aadhar_number} /><D label="PAN" value={selected.pan_number} />
                <div className="col-span-2 border-t pt-2 text-xs font-semibold text-slate-500 uppercase">Current Address</div>
                <D label="Address" value={selected.current_address} /><D label="City" value={selected.current_city} />
                <D label="State" value={selected.current_state} /><D label="Pincode" value={selected.current_pincode} />
                <div className="col-span-2 border-t pt-2 text-xs font-semibold text-slate-500 uppercase">
                  Permanent Address {selected.same_as_current && <span className="text-green-600 normal-case">(same)</span>}
                </div>
                <D label="Address" value={selected.permanent_address} /><D label="City" value={selected.permanent_city} />
                <D label="State" value={selected.permanent_state} /><D label="Pincode" value={selected.permanent_pincode} />
                <div className="col-span-2 border-t pt-2 text-xs font-semibold text-slate-500 uppercase">Bank Details</div>
                <D label="Account Holder" value={selected.account_holder_name} /><D label="Bank" value={selected.bank_name} />
                <D label="Account No." value={selected.account_number} /><D label="IFSC" value={selected.ifsc_code} />
                {(selected.aadhar_doc_url || selected.pan_doc_url || selected.cheque_doc_url) && (
                  <>
                    <div className="col-span-2 border-t pt-2 text-xs font-semibold text-slate-500 uppercase">Documents</div>
                    {selected.aadhar_doc_url && (
                      <div><p className="text-xs text-muted-foreground">Aadhaar Card</p>
                        <a href={selected.aadhar_doc_url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-blue-600 hover:underline">View ↗</a></div>
                    )}
                    {selected.pan_doc_url && (
                      <div><p className="text-xs text-muted-foreground">PAN Card</p>
                        <a href={selected.pan_doc_url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-blue-600 hover:underline">View ↗</a></div>
                    )}
                    {selected.cheque_doc_url && (
                      <div><p className="text-xs text-muted-foreground">Cancelled Cheque</p>
                        <a href={selected.cheque_doc_url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-blue-600 hover:underline">View ↗</a></div>
                    )}
                  </>
                )}
              </div>
              {selected.status === 'pending' && (
                <div className="flex gap-3 pt-2 border-t">
                  <Button className="flex-1 bg-green-600 hover:bg-green-700 gap-2" onClick={() => handleApproveAssoc(selected)} disabled={approving}>
                    {approving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><CheckCircle2 className="w-4 h-4" /> Approve & Generate ID</>}
                  </Button>
                  <Button variant="outline" className="flex-1 text-red-600 border-red-200 hover:bg-red-50 gap-2" onClick={() => setRejectOpen(true)} disabled={approving}>
                    <XCircle className="w-4 h-4" /> Reject
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Recharge Detail Dialog ── */}
      <Dialog open={rechargeDetailOpen} onOpenChange={setRechargeDetailOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Wallet Recharge — {rechargeSelected?.associate?.name}</DialogTitle>
          </DialogHeader>
          {rechargeSelected && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Associate Code</span>
                  <span className="font-mono font-semibold">{rechargeSelected.associate?.associate_code ?? '—'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Requested Amount</span>
                  <span className="font-bold text-blue-700 text-lg">{fmt(rechargeSelected.amount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Current Balance</span>
                  <span className="font-semibold">{fmt(rechargeSelected.associate?.wallet_balance ?? 0)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Balance After Approval</span>
                  <span className="font-bold text-green-700">{fmt((rechargeSelected.associate?.wallet_balance ?? 0) + rechargeSelected.amount)}</span>
                </div>
              </div>
              {rechargeSelected.receipt_url && (
                <a href={rechargeSelected.receipt_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 text-blue-600 text-sm hover:underline border border-blue-200 rounded-lg px-3 py-2 bg-blue-50">
                  View Payment Receipt →
                </a>
              )}
              <div className="flex gap-3">
                <Button className="flex-1 bg-green-600 hover:bg-green-700 gap-2" onClick={() => handleApproveRecharge(rechargeSelected)} disabled={rechargeApproving}>
                  {rechargeApproving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><CheckCircle2 className="w-4 h-4" /> Approve</>}
                </Button>
                <Button variant="outline" className="flex-1 text-red-600 border-red-200 hover:bg-red-50 gap-2" onClick={() => setRechargeRejectOpen(true)} disabled={rechargeApproving}>
                  <XCircle className="w-4 h-4" /> Reject
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Associate Reject Dialog ── */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="text-red-600">Reject Application</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Rejecting <strong>{selected?.name}</strong>. Please provide a reason.</p>
            <div className="space-y-1.5">
              <Label>Rejection Reason</Label>
              <Input placeholder="e.g. Incomplete documents..." value={rejectReason} onChange={e => setRejectReason(e.target.value)} />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setRejectOpen(false)} disabled={rejecting}>Cancel</Button>
              <Button className="bg-red-600 hover:bg-red-700" onClick={handleRejectAssoc} disabled={rejecting}>
                {rejecting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Confirm Reject'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Recharge Reject Dialog ── */}
      <Dialog open={rechargeRejectOpen} onOpenChange={setRechargeRejectOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="text-red-600">Reject Recharge</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Rejecting {fmt(rechargeSelected?.amount ?? 0)} recharge for <strong>{rechargeSelected?.associate?.name}</strong>.
            </p>
            <div className="space-y-1.5">
              <Label>Rejection Reason</Label>
              <Input placeholder="e.g. Invalid receipt, amount mismatch..." value={rechargeRejectReason} onChange={e => setRechargeRejectReason(e.target.value)} />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setRechargeRejectOpen(false)} disabled={rechargeRejecting}>Cancel</Button>
              <Button className="bg-red-600 hover:bg-red-700" onClick={handleRejectRecharge} disabled={rechargeRejecting}>
                {rechargeRejecting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Confirm Reject'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Credentials Dialog ── */}
      <Dialog open={credOpen} onOpenChange={setCredOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-700">
              <CheckCircle2 className="w-5 h-5" /> Associate Approved!
            </DialogTitle>
          </DialogHeader>
          {credentials && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Share these credentials. Password shown only once.</p>
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-3">
                <CredRow label="Associate Code" value={credentials.associate_code} />
                <CredRow label="Login Email" value={credentials.email} />
                <CredRow label="Password" value={credentials.password} />
              </div>
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-3">
                Save this password now — it cannot be retrieved later.
              </p>
              <Button className="w-full" onClick={() => setCredOpen(false)}>Done</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function D({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium text-gray-900 mt-0.5 text-sm">{value || '—'}</p>
    </div>
  )
}

function CredRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-xs text-green-700 font-medium">{label}</p>
        <p className="font-bold text-gray-900 font-mono text-sm break-all">{value}</p>
      </div>
      <Button variant="ghost" size="sm" className="h-7 shrink-0"
        onClick={() => { navigator.clipboard.writeText(value); toast.success(`${label} copied`) }}>
        <Copy className="w-3.5 h-3.5" />
      </Button>
    </div>
  )
}
