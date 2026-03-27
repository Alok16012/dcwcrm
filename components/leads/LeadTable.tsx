'use client'
import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import {
  MoreHorizontal, Search, ChevronLeft, ChevronRight,
  ChevronDown, X, SlidersHorizontal, ArrowUpDown
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { LeadTransferModal } from './LeadTransferModal'
import { LeadForm } from './LeadForm'
import { ConvertLeadModal } from './ConvertLeadModal'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { createClient } from '@/lib/supabase/client'
import { useLeadStore } from '@/store/useLeadStore'
import { toast } from 'sonner'
import {
  LEAD_STATUS_LABELS, LEAD_STATUS_COLORS, LEAD_SOURCE_LABELS,
  type Lead, type LeadStatus, type LeadSource, type Course, type Profile
} from '@/types/app.types'

const AVATAR_COLORS = [
  'bg-blue-500', 'bg-violet-500', 'bg-pink-500', 'bg-emerald-500',
  'bg-orange-500', 'bg-cyan-500', 'bg-rose-500', 'bg-indigo-500',
]

function getAvatarColor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function getInitials(name: string) {
  const parts = name.trim().split(' ')
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-50 text-blue-700 border-blue-200',
  contacted: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  interested: 'bg-purple-50 text-purple-700 border-purple-200',
  counselled: 'bg-orange-50 text-orange-700 border-orange-200',
  application_sent: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  converted: 'bg-green-50 text-green-700 border-green-200',
  cold: 'bg-gray-50 text-gray-600 border-gray-200',
  lost: 'bg-red-50 text-red-700 border-red-200',
}

interface LeadTableProps {
  leads: Lead[]
  isLoading?: boolean
  onRefresh: () => void
  courses?: Course[]
  telecallers?: Profile[]
  isTelecaller?: boolean
}

const PAGE_SIZE_OPTIONS = [10, 20, 30, 50]

export function LeadTable({ leads, isLoading, onRefresh, courses = [], telecallers = [], isTelecaller = false }: LeadTableProps) {
  const router = useRouter()
  const { filters, setFilters, clearFilters } = useLeadStore()
  const [search, setSearch] = useState(filters.search ?? '')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [transferLeadIds, setTransferLeadIds] = useState<string[]>([])
  const [editLead, setEditLead] = useState<Lead | null>(null)
  const [statusLead, setStatusLead] = useState<Lead | null>(null)
  const [showBulkDelete, setShowBulkDelete] = useState(false)
  const [deleteLead, setDeleteLead] = useState<Lead | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [showFilters, setShowFilters] = useState(false)
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc')
  const [mounted, setMounted] = useState(false)
  const [isPending, startTransition] = useTransition()
  const supabase = createClient()

  useEffect(() => {
    setMounted(true)
  }, [])

  // Local search filter
  const searchLower = search.toLowerCase()
  const filtered = leads.filter((l) => {
    if (!searchLower) return true
    return (
      l.full_name.toLowerCase().includes(searchLower) ||
      l.phone.includes(searchLower) ||
      (l.email ?? '').toLowerCase().includes(searchLower)
    )
  })

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    const aDate = new Date(a.created_at).getTime()
    const bDate = new Date(b.created_at).getTime()
    return sortDir === 'desc' ? bDate - aDate : aDate - bDate
  })

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const paginated = sorted.slice((page - 1) * pageSize, page * pageSize)

  // Selection
  const allSelected = paginated.length > 0 && paginated.every((l) => selected.has(l.id))
  function toggleAll() {
    if (allSelected) {
      setSelected((prev) => { const s = new Set(prev); paginated.forEach((l) => s.delete(l.id)); return s })
    } else {
      setSelected((prev) => { const s = new Set(prev); paginated.forEach((l) => s.add(l.id)); return s })
    }
  }
  function toggleOne(id: string) {
    setSelected((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  }

  const activeFilters = filters.status?.length || filters.source?.length || filters.assigned_to?.length || filters.course_id?.length

  function toggleStatus(s: LeadStatus) {
    const cur = filters.status ?? []
    setFilters({ status: cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s] })
    setPage(1)
  }
  function toggleSource(s: LeadSource) {
    const cur = filters.source ?? []
    setFilters({ source: cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s] })
    setPage(1)
  }

  async function handleStatusChange(lead: Lead, newStatus: LeadStatus) {
    if (newStatus === 'converted') { setStatusLead(lead); return }
    startTransition(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase.from('leads').update({ status: newStatus } as never).eq('id', lead.id)
      if (error) { toast.error('Failed to update status'); return }

      await supabase.from('lead_activities').insert({
        lead_id: lead.id,
        activity_type: 'status_changed',
        old_value: lead.status,
        new_value: newStatus,
        performed_by: user?.id
      } as never)

      toast.success('Status updated')
      onRefresh()
    })
  }

  async function handleBulkDelete() {
    startTransition(async () => {
      const { error } = await supabase.from('leads').delete().in('id', Array.from(selected))
      if (error) { toast.error('Failed to delete leads'); return }

      toast.success(`Deleted ${selected.size} lead(s) successfully`)
      setSelected(new Set())
      setShowBulkDelete(false)
      onRefresh()
    })
  }
  async function handleDeleteLead(lead: Lead) {
    startTransition(async () => {
      const { error } = await supabase.from('leads').delete().eq('id', lead.id)
      if (error) { toast.error('Failed to delete lead'); return }

      toast.success('Lead deleted successfully')
      setDeleteLead(null)
      onRefresh()
    })
  }

  if (!mounted) return <div className="bg-white rounded-xl border border-gray-200 shadow-sm min-h-[400px] animate-pulse" />

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Top toolbar */}
      <div className="px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search name, phone, email..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {search && (
              <button onClick={() => { setSearch(''); setPage(1) }} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Status filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border transition-colors ${filters.status?.length ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                Status {filters.status?.length ? `(${filters.status.length})` : ''}
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              {(Object.entries(LEAD_STATUS_LABELS) as [LeadStatus, string][]).map(([k, v]) => (
                <DropdownMenuItem key={k} onClick={() => toggleStatus(k)} className="flex items-center gap-2">
                  <div className={`w-4 h-4 rounded border flex items-center justify-center ${filters.status?.includes(k) ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}>
                    {filters.status?.includes(k) && <span className="text-white text-[10px]">✓</span>}
                  </div>
                  {v}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Source filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border transition-colors ${filters.source?.length ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                Source {filters.source?.length ? `(${filters.source.length})` : ''}
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-44">
              {(Object.entries(LEAD_SOURCE_LABELS) as [LeadSource, string][]).map(([k, v]) => (
                <DropdownMenuItem key={k} onClick={() => toggleSource(k)} className="flex items-center gap-2">
                  <div className={`w-4 h-4 rounded border flex items-center justify-center ${filters.source?.includes(k) ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}>
                    {filters.source?.includes(k) && <span className="text-white text-[10px]">✓</span>}
                  </div>
                  {v}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Assigned to filter */}
          {telecallers.length > 0 && (
            <Select value={filters.assigned_to?.[0] ?? ''} onValueChange={(v) => { setFilters({ assigned_to: v ? [v] : undefined }); setPage(1) }}>
              <SelectTrigger className={`w-36 h-9 text-sm ${filters.assigned_to?.length ? 'border-blue-300 bg-blue-50 text-blue-700' : ''}`}>
                <SelectValue placeholder="Assigned to" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All assignees</SelectItem>
                {telecallers.map((t) => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}

          {/* Course filter */}
          {courses.length > 0 && (
            <Select value={filters.course_id?.[0] ?? ''} onValueChange={(v) => { setFilters({ course_id: v ? [v] : undefined }); setPage(1) }}>
              <SelectTrigger className={`w-36 h-9 text-sm ${filters.course_id?.length ? 'border-blue-300 bg-blue-50 text-blue-700' : ''}`}>
                <SelectValue placeholder="Course" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All courses</SelectItem>
                {courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}

          {/* Clear filters */}
          {activeFilters ? (
            <button onClick={() => { clearFilters(); setPage(1) }} className="flex items-center gap-1 text-sm text-red-500 hover:text-red-700 px-2 py-2">
              <X className="w-3.5 h-3.5" /> Clear
            </button>
          ) : null}

          {/* Right side */}
          <div className="ml-auto flex items-center gap-2">
            <span className="text-sm text-gray-500 font-medium">{filtered.length} Leads</span>
            <button
              onClick={() => setSortDir((d) => d === 'desc' ? 'asc' : 'desc')}
              className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
              {sortDir === 'desc' ? 'Newest first' : 'Oldest first'}
            </button>
          </div>
        </div>
      </div>

      {/* Bulk action bar — shows when rows are selected */}
      {selected.size > 0 && (
        <div className="px-4 py-2.5 bg-blue-600 border-b border-blue-700 flex items-center gap-3">
          <span className="text-white text-sm font-semibold">{selected.size} lead{selected.size > 1 ? 's' : ''} selected</span>
          <div className="flex items-center gap-2 ml-2">
            <Button
              size="sm"
              variant="secondary"
              className="h-7 text-xs bg-white text-blue-700 hover:bg-blue-50 border-0"
              onClick={() => setTransferLeadIds(Array.from(selected))}
            >
              Transfer
            </Button>
            <Button
              size="sm"
              className="h-7 text-xs bg-red-500 hover:bg-red-600 text-white border-0"
              onClick={() => setShowBulkDelete(true)}
            >
              Delete
            </Button>
          </div>
          <button
            className="ml-auto text-blue-200 hover:text-white"
            onClick={() => setSelected(new Set())}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        {isLoading ? (
          <div className="py-16 text-center text-gray-400 text-sm">Loading leads...</div>
        ) : paginated.length === 0 ? (
          <div className="py-16 text-center text-gray-400 text-sm">No leads found</div>
        ) : (
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <th className="pl-4 pr-2 py-3 w-10">
                  <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Phone</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Email</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Mode</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Dept</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Course</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Standard</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Assigned To</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Date Added</th>
                <th className="px-3 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {paginated.map((lead) => (
                <tr
                  key={lead.id}
                  onClick={() => router.push(`/leads/${lead.id}`)}
                  className="hover:bg-blue-50/30 cursor-pointer transition-colors group"
                >
                  <td className="pl-4 pr-2 py-3" onClick={(e) => e.stopPropagation()}>
                    <Checkbox checked={selected.has(lead.id)} onCheckedChange={() => toggleOne(lead.id)} />
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold ${getAvatarColor(lead.full_name)}`}>
                        {getInitials(lead.full_name)}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{lead.full_name}</p>
                        {lead.city && <p className="text-xs text-gray-400">{lead.city}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-gray-700 font-mono text-xs">{lead.phone}</td>
                  <td className="px-3 py-3 text-gray-500 text-xs max-w-[160px] truncate">{lead.email ?? <span className="text-gray-300">—</span>}</td>
                  <td className="px-3 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLORS[lead.status] ?? 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                      {LEAD_STATUS_LABELS[lead.status]}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    {lead.mode ? (
                      <Badge variant="outline" className="capitalize text-[10px] font-normal border-gray-200 text-gray-500">
                        {lead.mode}
                      </Badge>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-gray-600 text-[10px]">{lead.department?.name ?? <span className="text-gray-300">—</span>}</td>
                  <td className="px-3 py-3 text-gray-600 text-xs">{lead.course?.name ?? <span className="text-gray-300">—</span>}</td>
                  <td className="px-3 py-3 text-gray-600 text-xs">{lead.sub_course?.name ?? <span className="text-gray-300">—</span>}</td>
                  <td className="px-3 py-3">
                    {lead.assigned_user ? (
                      <div className="flex items-center gap-2">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold ${getAvatarColor(lead.assigned_user.full_name)}`}>
                          {getInitials(lead.assigned_user.full_name)}
                        </div>
                        <span className="text-xs text-gray-600">{lead.assigned_user.full_name}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-300">Unassigned</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-gray-400 text-xs whitespace-nowrap">
                    {format(new Date(lead.created_at), 'dd MMM yyyy')}
                  </td>
                  <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem onClick={() => router.push(`/leads/${lead.id}`)}>View Details</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setEditLead(lead)}>Update Details</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setTransferLeadIds([lead.id])}>Transfer Lead</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {(Object.entries(LEAD_STATUS_LABELS) as [LeadStatus, string][])
                          .filter(([k]) => k !== lead.status)
                          .map(([k, v]) => (
                            <DropdownMenuItem key={k} onClick={() => handleStatusChange(lead, k)}>
                              Mark as {v}
                            </DropdownMenuItem>
                          ))}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-red-600 focus:text-red-700 focus:bg-red-50"
                          onClick={() => setDeleteLead(lead)}
                        >
                          Delete Lead
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination footer */}
      {!isLoading && sorted.length > 0 && (
        <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>Rows per page:</span>
            <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1) }}>
              <SelectTrigger className="w-16 h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-3 text-sm text-gray-500">
            <span>
              {((page - 1) * pageSize) + 1}–{Math.min(page * pageSize, sorted.length)} of {sorted.length}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2 text-xs font-medium">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {transferLeadIds.length > 0 && (
        <LeadTransferModal
          open={transferLeadIds.length > 0}
          onClose={() => setTransferLeadIds([])}
          leadIds={transferLeadIds}
          onSuccess={() => { setTransferLeadIds([]); setSelected(new Set()); onRefresh() }}
        />
      )}

      <Dialog open={!!editLead} onOpenChange={(open) => !open && setEditLead(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Update Lead Details</DialogTitle>
          </DialogHeader>
          {editLead && (
            <LeadForm
              lead={editLead}
              onSuccess={() => { setEditLead(null); onRefresh() }}
              onCancel={() => setEditLead(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={showBulkDelete}
        onCancel={() => setShowBulkDelete(false)}
        title="Delete Leads"
        description={`Are you sure you want to delete ${selected.size} selected lead(s)? This action cannot be undone.`}
        onConfirm={handleBulkDelete}
        destructive
      />

      <ConfirmDialog
        open={!!deleteLead}
        onCancel={() => setDeleteLead(null)}
        title="Delete Lead"
        description={`Are you sure you want to delete ${deleteLead?.full_name}? This action cannot be undone.`}
        onConfirm={() => deleteLead && handleDeleteLead(deleteLead)}
        destructive
      />
    </div>
  )
}
