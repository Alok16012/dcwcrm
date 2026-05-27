'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import {
  CheckCircle2, Clock, XCircle, Search, Plus, ChevronDown,
  ChevronUp, Phone, BookOpen, Calendar, MessageSquare, Filter,
} from 'lucide-react'

const STATUS_CFG: Record<string, { label: string; color: string; icon: any }> = {
  new:           { label: 'New',            color: 'bg-blue-100 text-blue-800 border-blue-200',     icon: Clock },
  contacted:     { label: 'Contacted',      color: 'bg-indigo-100 text-indigo-800 border-indigo-200',icon: Phone },
  interested:    { label: 'Interested',     color: 'bg-purple-100 text-purple-800 border-purple-200',icon: CheckCircle2 },
  not_interested:{ label: 'Not Interested', color: 'bg-gray-100 text-gray-600 border-gray-200',      icon: XCircle },
  follow_up:     { label: 'Follow-up',      color: 'bg-amber-100 text-amber-800 border-amber-200',   icon: Clock },
  converted:     { label: 'Converted',      color: 'bg-green-100 text-green-800 border-green-200',   icon: CheckCircle2 },
  lost:          { label: 'Lost',           color: 'bg-red-100 text-red-800 border-red-200',         icon: XCircle },
}

interface Lead {
  id: string
  full_name: string
  phone: string
  email: string | null
  status: string
  created_at: string
  remarks: string | null
  course?: { name: string } | null
}

export default function AssociateAdmissionsPage() {
  const supabase = createClient()
  const db = supabase as any
  const searchParams = useSearchParams()

  const [assocId, setAssocId] = useState<string | null>(null)
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  // New lead dialog
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState({ full_name: '', phone: '', email: '', remarks: '' })
  const [courses, setCourses] = useState<{ id: string; name: string }[]>([])
  const [courseId, setCourseId] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const { data: assoc } = await db.from('associates').select('id').eq('user_id', user.id).single()
    if (!assoc) { setLoading(false); return }
    setAssocId(assoc.id)

    const [leadRes, courseRes] = await Promise.all([
      supabase.from('leads')
        .select('id, full_name, phone, email, status, created_at, remarks, course:courses(name)')
        .eq('referred_by_associate', assoc.id)
        .order('created_at', { ascending: false }),
      supabase.from('courses').select('id, name').eq('is_active', true).order('name'),
    ])
    setLeads((leadRes.data ?? []) as Lead[])
    setCourses((courseRes.data ?? []) as { id: string; name: string }[])
    setLoading(false)
  }, [supabase, db])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (searchParams.get('new') === '1') setDialogOpen(true)
  }, [searchParams])

  const filtered = leads.filter(l => {
    const matchSearch = !search || l.full_name.toLowerCase().includes(search.toLowerCase()) || l.phone.includes(search)
    const matchStatus = !filterStatus || l.status === filterStatus
    return matchSearch && matchStatus
  })

  // Status counts for filter pills
  const counts = Object.keys(STATUS_CFG).reduce((acc, s) => {
    acc[s] = leads.filter(l => l.status === s).length
    return acc
  }, {} as Record<string, number>)

  async function handleAddLead() {
    if (!form.full_name.trim() || !form.phone.trim()) { toast.error('Name and phone are required'); return }
    if (!assocId) return
    setSubmitting(true)
    try {
      const { error } = await supabase.from('leads').insert({
        full_name: form.full_name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || null,
        remarks: form.remarks.trim() || null,
        course_id: courseId || null,
        referred_by_associate: assocId,
        status: 'new',
      })
      if (error) { toast.error(error.message); return }
      toast.success('Lead added successfully!')
      setDialogOpen(false)
      setForm({ full_name: '', phone: '', email: '', remarks: '' })
      setCourseId('')
      load()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Leads</h1>
          <p className="text-sm text-gray-400 mt-0.5">{leads.length} total referrals</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="gap-2" size="sm">
          <Plus className="w-4 h-4" /> Add New Lead
        </Button>
      </div>

      {/* Search + Filter */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input placeholder="Search name or phone…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <Filter className="w-3.5 h-3.5 text-gray-400" />
          <button
            onClick={() => setFilterStatus('')}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${!filterStatus ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            All ({leads.length})
          </button>
          {Object.entries(STATUS_CFG).map(([k, v]) => counts[k] > 0 && (
            <button
              key={k}
              onClick={() => setFilterStatus(f => f === k ? '' : k)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${filterStatus === k ? v.color : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            >
              {v.label} ({counts[k]})
            </button>
          ))}
        </div>
      </div>

      {/* Leads List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-7 h-7 border-4 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 border rounded-2xl bg-white">
          <Search className="w-10 h-10 mx-auto mb-3 text-gray-200" />
          <p className="font-semibold text-gray-500">{leads.length === 0 ? 'No leads yet' : 'No matches found'}</p>
          <p className="text-xs text-gray-400 mt-1">{leads.length === 0 ? 'Add your first lead to get started' : 'Try a different search or filter'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(l => {
            const st = STATUS_CFG[l.status] ?? STATUS_CFG['new']!
            const Icon = st.icon
            const isExpanded = expanded === l.id
            return (
              <div key={l.id} className="bg-white border border-gray-100 rounded-2xl overflow-hidden hover:shadow-sm transition-all">
                <button
                  className="w-full flex items-center gap-4 px-5 py-4 text-left"
                  onClick={() => setExpanded(isExpanded ? null : l.id)}
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${st.color.split(' ')[0]}`}>
                    <Icon className={`w-4 h-4 ${st.color.split(' ')[1]}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm truncate">{l.full_name}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-xs text-gray-400">{l.phone}</span>
                      {l.course && <span className="text-xs text-gray-400">· {l.course.name}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${st.color}`}>{st.label}</span>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </div>
                </button>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="px-5 pb-4 border-t border-gray-50 bg-gray-50/50">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-3">
                      <InfoCell icon={Phone} label="Phone" value={l.phone} />
                      <InfoCell icon={BookOpen} label="Course" value={l.course?.name ?? '—'} />
                      <InfoCell icon={Calendar} label="Added On" value={new Date(l.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} />
                      {l.email && <InfoCell icon={MessageSquare} label="Email" value={l.email} />}
                    </div>
                    {l.remarks && (
                      <div className="mt-3 bg-white border border-gray-100 rounded-xl px-4 py-3">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Counselor Remarks</p>
                        <p className="text-sm text-gray-700 leading-relaxed">{l.remarks}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Add Lead Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-4 h-4 text-blue-600" /> Add New Lead
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label>Full Name *</Label>
                <Input placeholder="Student name" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Phone *</Label>
                <Input placeholder="10-digit number" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input placeholder="Optional" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Course Interested In</Label>
                <select
                  value={courseId}
                  onChange={e => setCourseId(e.target.value)}
                  className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm"
                >
                  <option value="">Select course…</option>
                  {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Remarks / Notes</Label>
                <textarea
                  className="w-full min-h-[80px] rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none"
                  placeholder="Any notes about this lead…"
                  value={form.remarks}
                  onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))}
                />
              </div>
            </div>
            <p className="text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2">
              This lead will be registered under your associate code and tracked by our counselors.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setDialogOpen(false)} disabled={submitting}>Cancel</Button>
              <Button className="flex-1" onClick={handleAddLead} disabled={submitting}>
                {submitting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Submit Lead'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function InfoCell({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div>
      <div className="flex items-center gap-1 mb-0.5">
        <Icon className="w-3 h-3 text-gray-400" />
        <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">{label}</p>
      </div>
      <p className="text-sm font-medium text-gray-800">{value}</p>
    </div>
  )
}
