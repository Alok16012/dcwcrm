'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import {
  UserPlus, Users, CheckCircle2, Clock, XCircle,
  ChevronRight, Eye, RefreshCw, KeyRound, Copy, Pencil, Trash2,
} from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { CreateAssociateDialog } from '@/components/associates/CreateAssociateDialog'

type AssociateStatus = 'pending' | 'approved' | 'rejected'

interface Associate {
  id: string
  name: string
  phone: string
  father_phone: string | null
  email: string
  aadhar_number: string | null
  pan_number: string | null
  aadhar_doc_url: string | null
  pan_doc_url: string | null
  cheque_doc_url: string | null
  current_address: string | null
  current_city: string | null
  current_state: string | null
  current_pincode: string | null
  permanent_address: string | null
  permanent_city: string | null
  permanent_state: string | null
  permanent_pincode: string | null
  same_as_current: boolean
  bank_name: string | null
  account_number: string | null
  ifsc_code: string | null
  account_holder_name: string | null
  status: AssociateStatus
  associate_code: string | null
  wallet_balance: number
  coordinator_name: string | null
  temp_password: string | null
  created_at: string
}

export function AssociateManager() {
  const supabase = createClient()
  const db = supabase as any
  const [isAdmin, setIsAdmin] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [associates, setAssociates] = useState<Associate[]>([])
  const [loading, setLoading] = useState(true)
  const [detailOpen, setDetailOpen] = useState(false)
  const [selected, setSelected] = useState<Associate | null>(null)
  const [credOpen, setCredOpen] = useState(false)
  const [credAssoc, setCredAssoc] = useState<Associate | null>(null)

  // Edit state
  const [editOpen, setEditOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Associate | null>(null)
  const [editForm, setEditForm] = useState<Partial<Associate>>({})
  const [saving, setSaving] = useState(false)

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<Associate | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data } = await (supabase as any).from('profiles').select('role').eq('id', user.id).single()
      if ((data as any)?.role === 'admin') setIsAdmin(true)
    })
  }, [supabase])

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await db
      .from('associates')
      .select('*')
      .order('created_at', { ascending: false })
    setAssociates((data ?? []) as Associate[])
    setLoading(false)
  }, [db])

  useEffect(() => { load() }, [load])

  function openEdit(a: Associate) {
    setEditTarget(a)
    setEditForm({
      name: a.name, phone: a.phone, father_phone: a.father_phone ?? '',
      email: a.email, aadhar_number: a.aadhar_number ?? '', pan_number: a.pan_number ?? '',
      current_address: a.current_address ?? '', current_city: a.current_city ?? '',
      current_state: a.current_state ?? '', current_pincode: a.current_pincode ?? '',
      same_as_current: a.same_as_current,
      permanent_address: a.permanent_address ?? '', permanent_city: a.permanent_city ?? '',
      permanent_state: a.permanent_state ?? '', permanent_pincode: a.permanent_pincode ?? '',
      bank_name: a.bank_name ?? '', account_number: a.account_number ?? '',
      ifsc_code: a.ifsc_code ?? '', account_holder_name: a.account_holder_name ?? '',
    })
    setEditOpen(true)
  }

  async function handleSaveEdit() {
    if (!editTarget) return
    setSaving(true)
    try {
      const { error } = await db.from('associates').update({
        ...editForm,
        updated_at: new Date().toISOString(),
      }).eq('id', editTarget.id)
      if (error) { toast.error(error.message); return }
      toast.success('Associate updated')
      setEditOpen(false)
      load()
    } finally { setSaving(false) }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const { error } = await db.from('associates').delete().eq('id', deleteTarget.id)
      if (error) { toast.error(error.message); return }
      toast.success(`${deleteTarget.name} deleted`)
      setDeleteOpen(false)
      load()
    } finally { setDeleting(false) }
  }

  const statusBadge = (s: AssociateStatus) => {
    if (s === 'approved') return <Badge className="bg-green-100 text-green-800 border-0 gap-1"><CheckCircle2 className="w-3 h-3" />Approved</Badge>
    if (s === 'rejected') return <Badge className="bg-red-100 text-red-800 border-0 gap-1"><XCircle className="w-3 h-3" />Rejected</Badge>
    return <Badge className="bg-amber-100 text-amber-800 border-0 gap-1"><Clock className="w-3 h-3" />Pending</Badge>
  }

  const pending = associates.filter(a => a.status === 'pending').length
  const approved = associates.filter(a => a.status === 'approved').length

  const ef = (k: keyof typeof editForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setEditForm(p => ({ ...p, [k]: e.target.value }))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-3">
          <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-2 text-center">
            <p className="text-xl font-bold text-amber-700">{pending}</p>
            <p className="text-xs text-amber-600">Pending</p>
          </div>
          <div className="bg-green-50 border border-green-100 rounded-xl px-4 py-2 text-center">
            <p className="text-xl font-bold text-green-700">{approved}</p>
            <p className="text-xs text-green-600">Approved</p>
          </div>
          <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-2 text-center">
            <p className="text-xl font-bold text-blue-700">{associates.length}</p>
            <p className="text-xs text-blue-600">Total</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} className="gap-1.5 h-8">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5 h-8">
            <UserPlus className="w-3.5 h-3.5" /> Add Associate
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-muted-foreground text-sm">Loading…</div>
      ) : associates.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No associates yet</p>
          <p className="text-xs mt-1">Click "Add Associate" to register one</p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Name</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 hidden sm:table-cell">Phone</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 hidden md:table-cell">Email</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 hidden lg:table-cell">Code</th>
                <th className="text-center px-4 py-3 font-semibold text-slate-600">Status</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-600">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {associates.map(a => (
                <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">{a.name}</td>
                  <td className="px-4 py-3 text-slate-600 hidden sm:table-cell">{a.phone}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs hidden md:table-cell">{a.email}</td>
                  <td className="px-4 py-3 text-slate-500 font-mono text-xs hidden lg:table-cell">
                    {a.associate_code ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-center">{statusBadge(a.status)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {a.status === 'approved' && a.temp_password && (
                        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-green-600 hover:text-green-700 hover:bg-green-50"
                          onClick={() => { setCredAssoc(a); setCredOpen(true) }}>
                          <KeyRound className="w-3.5 h-3.5" /> Credentials
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" className="h-7 text-xs gap-1"
                        onClick={() => { setSelected(a); setDetailOpen(true) }}>
                        <Eye className="w-3.5 h-3.5" /> View <ChevronRight className="w-3 h-3" />
                      </Button>
                      {isAdmin && (
                        <>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                            onClick={() => openEdit(a)} title="Edit">
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-500 hover:text-red-600 hover:bg-red-50"
                            onClick={() => { setDeleteTarget(a); setDeleteOpen(true) }} title="Delete">
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Associate Details — {selected?.name}
              {selected && statusBadge(selected.status)}
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm mt-2">
              <Detail label="Name" value={selected.name} />
              <Detail label="Phone" value={selected.phone} />
              <Detail label="Father's Phone" value={selected.father_phone} />
              <Detail label="Email" value={selected.email} />
              <Detail label="Aadhaar Number" value={selected.aadhar_number} />
              <Detail label="PAN Number" value={selected.pan_number} />
              <div className="col-span-2 border-t pt-2 mt-1 font-semibold text-slate-600">Current Address</div>
              <Detail label="Address" value={selected.current_address} />
              <Detail label="City" value={selected.current_city} />
              <Detail label="State" value={selected.current_state} />
              <Detail label="Pincode" value={selected.current_pincode} />
              <div className="col-span-2 border-t pt-2 mt-1 font-semibold text-slate-600">
                Permanent Address {selected.same_as_current && <span className="text-xs font-normal text-green-600">(Same as current)</span>}
              </div>
              <Detail label="Address" value={selected.permanent_address} />
              <Detail label="City" value={selected.permanent_city} />
              <Detail label="State" value={selected.permanent_state} />
              <Detail label="Pincode" value={selected.permanent_pincode} />
              <div className="col-span-2 border-t pt-2 mt-1 font-semibold text-slate-600">Bank Details</div>
              <Detail label="Bank Name" value={selected.bank_name} />
              <Detail label="Account Holder" value={selected.account_holder_name} />
              <Detail label="Account Number" value={selected.account_number} />
              <Detail label="IFSC Code" value={selected.ifsc_code} />
              {(selected.aadhar_doc_url || selected.pan_doc_url || selected.cheque_doc_url) && (
                <>
                  <div className="col-span-2 border-t pt-2 mt-1 font-semibold text-slate-600">Documents</div>
                  {selected.aadhar_doc_url && <DocLink label="Aadhaar Card" url={selected.aadhar_doc_url} />}
                  {selected.pan_doc_url && <DocLink label="PAN Card" url={selected.pan_doc_url} />}
                  {selected.cheque_doc_url && <DocLink label="Cancelled Cheque" url={selected.cheque_doc_url} />}
                </>
              )}
              {selected.associate_code && (
                <>
                  <div className="col-span-2 border-t pt-2 mt-1 font-semibold text-slate-600">Login Info</div>
                  <Detail label="Associate Code" value={selected.associate_code} />
                  <Detail label="Wallet Balance" value={`₹${selected.wallet_balance.toLocaleString('en-IN')}`} />
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog — admin only */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-4 h-4 text-blue-600" /> Edit Associate — {editTarget?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 mt-2">
            <Sec title="Personal Details">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <F label="Full Name"><Input value={editForm.name ?? ''} onChange={ef('name')} /></F>
                <F label="Mobile"><Input value={editForm.phone ?? ''} onChange={ef('phone')} /></F>
                <F label="Father's Mobile"><Input value={editForm.father_phone ?? ''} onChange={ef('father_phone')} /></F>
                <F label="Email"><Input type="email" value={editForm.email ?? ''} onChange={ef('email')} /></F>
                <F label="Aadhaar Number"><Input value={editForm.aadhar_number ?? ''} onChange={ef('aadhar_number')} /></F>
                <F label="PAN Number"><Input value={editForm.pan_number ?? ''} onChange={ef('pan_number')} className="uppercase" /></F>
              </div>
            </Sec>
            <Sec title="Current Address">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <F label="Full Address" className="lg:col-span-3"><Input value={editForm.current_address ?? ''} onChange={ef('current_address')} /></F>
                <F label="City"><Input value={editForm.current_city ?? ''} onChange={ef('current_city')} /></F>
                <F label="State"><Input value={editForm.current_state ?? ''} onChange={ef('current_state')} /></F>
                <F label="Pincode"><Input value={editForm.current_pincode ?? ''} onChange={ef('current_pincode')} /></F>
              </div>
            </Sec>
            <Sec title="Permanent Address">
              <label className="flex items-center gap-2 mb-3 cursor-pointer w-fit">
                <input type="checkbox" className="w-4 h-4 rounded"
                  checked={editForm.same_as_current ?? false}
                  onChange={e => setEditForm(p => ({ ...p, same_as_current: e.target.checked }))} />
                <span className="text-sm font-medium text-slate-700">Same as current address</span>
              </label>
              {!editForm.same_as_current && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <F label="Full Address" className="lg:col-span-3"><Input value={editForm.permanent_address ?? ''} onChange={ef('permanent_address')} /></F>
                  <F label="City"><Input value={editForm.permanent_city ?? ''} onChange={ef('permanent_city')} /></F>
                  <F label="State"><Input value={editForm.permanent_state ?? ''} onChange={ef('permanent_state')} /></F>
                  <F label="Pincode"><Input value={editForm.permanent_pincode ?? ''} onChange={ef('permanent_pincode')} /></F>
                </div>
              )}
            </Sec>
            <Sec title="Bank Details">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <F label="Account Holder Name"><Input value={editForm.account_holder_name ?? ''} onChange={ef('account_holder_name')} /></F>
                <F label="Bank Name"><Input value={editForm.bank_name ?? ''} onChange={ef('bank_name')} /></F>
                <F label="Account Number"><Input value={editForm.account_number ?? ''} onChange={ef('account_number')} /></F>
                <F label="IFSC Code"><Input value={editForm.ifsc_code ?? ''} onChange={ef('ifsc_code')} className="uppercase" /></F>
              </div>
            </Sec>
            <div className="flex gap-3 justify-end pt-1">
              <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>Cancel</Button>
              <Button onClick={handleSaveEdit} disabled={saving} className="min-w-28">
                {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Save Changes'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog — admin only */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <Trash2 className="w-4 h-4" /> Delete Associate
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This cannot be undone.
            </p>
            {deleteTarget?.status === 'approved' && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                This associate has a login account. Their Supabase auth user will remain — remove it manually from Supabase Auth if needed.
              </p>
            )}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>Cancel</Button>
              <Button className="bg-red-600 hover:bg-red-700" onClick={handleDelete} disabled={deleting}>
                {deleting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Yes, Delete'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Credentials Dialog */}
      <Dialog open={credOpen} onOpenChange={setCredOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-700">
              <KeyRound className="w-5 h-5" /> Login Credentials — {credAssoc?.name}
            </DialogTitle>
          </DialogHeader>
          {credAssoc && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Share these credentials with the associate so they can log in.</p>
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-3">
                <CredRow label="Associate Code" value={credAssoc.associate_code ?? ''} />
                <CredRow label="Login Email" value={credAssoc.email} />
                <CredRow label="Password" value={credAssoc.temp_password ?? ''} />
              </div>
              <Button className="w-full" onClick={() => setCredOpen(false)}>Done</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <CreateAssociateDialog open={createOpen} onOpenChange={setCreateOpen} onSuccess={load} />
    </div>
  )
}

function Sec({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border rounded-xl p-4 space-y-3 bg-slate-50/60">
      <h4 className="text-xs font-semibold text-blue-700 uppercase tracking-wide">{title}</h4>
      {children}
    </div>
  )
}

function F({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1.5 ${className ?? ''}`}>
      <Label className="text-xs font-medium text-slate-600">{label}</Label>
      {children}
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium text-gray-900 mt-0.5">{value || '—'}</p>
    </div>
  )
}

function DocLink({ label, url }: { label: string; url: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <a href={url} target="_blank" rel="noopener noreferrer"
        className="text-sm font-medium text-blue-600 hover:underline mt-0.5 block">
        View Document ↗
      </a>
    </div>
  )
}

function CredRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-xs text-green-600 font-medium">{label}</p>
        <p className="font-mono text-sm font-semibold text-gray-900">{value || '—'}</p>
      </div>
      {value && (
        <button
          onClick={() => { navigator.clipboard.writeText(value); toast.success(`${label} copied`) }}
          className="p-1.5 rounded hover:bg-green-100 text-green-600 transition-colors flex-shrink-0"
          title="Copy"
        >
          <Copy className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}
