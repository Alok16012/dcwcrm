'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { Plus, Users, TrendingUp, CheckCircle, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { LeadTable } from '@/components/leads/LeadTable'
import { LeadForm } from '@/components/leads/LeadForm'
import { BulkImportLeads } from '@/components/leads/BulkImportLeads'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { createClient } from '@/lib/supabase/client'
import { useLeadStore } from '@/store/useLeadStore'
import { format } from 'date-fns'
import type { Lead, Course, Profile } from '@/types/app.types'

function StatCard({ label, value, icon: Icon, color }: { label: string; value: number; icon: React.ElementType; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value.toLocaleString()}</p>
        <p className="text-xs text-gray-500">{label}</p>
      </div>
    </div>
  )
}

export function LeadsClient() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ total: 0, newToday: 0, converted: 0, followupDue: 0 })
  const [showForm, setShowForm] = useState(false)

  // Server-side pagination / search / sort — only one page is loaded at a time
  // so the table stays fast even with thousands of leads.
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [searchTerm, setSearchTerm] = useState('')
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc')
  const [totalCount, setTotalCount] = useState(0)

  const [courses, setCourses] = useState<Course[]>([])
  const [telecallers, setTelecallers] = useState<Profile[]>([])
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null)
  const { filters, setFilters } = useLeadStore()
  const searchParams = useSearchParams()

  // Apply URL params as initial filters (from dashboard quick-cards)
  useEffect(() => {
    const status = searchParams.get('status')
    const followup = searchParams.get('followup')
    const today = new Date().toISOString().slice(0, 10)
    if (status) setFilters({ status: [status as any] })
    if (followup === 'today') setFilters({ followup_from: today, followup_to: today })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setCurrentProfile(profile as unknown as Profile)
    })

    Promise.all([
      supabase.from('courses').select('*').eq('is_active', true).order('name'),
      supabase.from('profiles').select('*').in('role', ['lead', 'telecaller', 'counselor']).eq('is_active', true),
    ]).then(([{ data: c }, { data: t }]) => {
      setCourses(c ?? [])
      setTelecallers(t ?? [])
    })
  }, [])

  // Builds the filtered + sorted leads query (without a row range). Shared by
  // the paginated on-screen fetch and the "export all" path.
  const buildLeadsQuery = useCallback((withCount: boolean) => {
    const role = (currentProfile?.role as string) ?? ''
    const isTelecaller = role === 'lead' || role === 'telecaller' || role === 'counselor'
    const isAdmin = role === 'admin'

    let query = supabase
      .from('leads')
      .select(`
        *,
        course:courses(id, name, is_active, created_at),
        sub_course:sub_courses(id, name, is_active, created_at, course_id),
        department:departments(id, name, is_active, created_at),
        sub_section:department_sub_sections(id, name, is_active, created_at, department_id),
        assigned_user:profiles!leads_assigned_to_fkey(id, email, full_name, role, is_active, created_at)
      `, withCount ? { count: 'exact' } : undefined)
      .order('updated_at', { ascending: sortDir === 'asc', nullsFirst: sortDir === 'asc' })
      .order('created_at', { ascending: sortDir === 'asc' })

    // Telecallers only see their own assigned leads, Admins see ALL
    if (isTelecaller && !isAdmin && currentProfile) query = query.eq('assigned_to', currentProfile.id)

    if (filters.status?.length) query = query.in('status', filters.status)
    if (filters.source?.length) query = query.in('source', filters.source)
    if (isAdmin && filters.assigned_to?.length) query = query.in('assigned_to', filters.assigned_to)
    if (filters.course_id?.length) query = query.in('course_id', filters.course_id)
    if (filters.form) query = query.eq('metadata->>form', filters.form)
    if (filters.city) query = query.ilike('city', `%${filters.city}%`)
    if (filters.mode) query = query.eq('mode', filters.mode)
    // Created-date range. created_at is a timestamp, so make the "to" bound
    // inclusive of the whole selected day (up to 23:59:59).
    if (filters.created_from) query = query.gte('created_at', filters.created_from)
    if (filters.created_to) query = query.lte('created_at', `${filters.created_to}T23:59:59`)
    if (filters.followup_from) query = query.gte('next_followup_date', filters.followup_from)
    if (filters.followup_to) query = query.lte('next_followup_date', filters.followup_to)

    // Server-side text search across name / phone / email
    const term = searchTerm.trim().replace(/[,()*]/g, ' ').trim()
    if (term) query = query.or(`full_name.ilike.%${term}%,phone.ilike.%${term}%,email.ilike.%${term}%`)

    return query
  }, [filters, currentProfile, sortDir, searchTerm])

  const fetchLeads = useCallback(async () => {
    if (!currentProfile) return
    setLoading(true)
    try {
      const fromIdx = (page - 1) * pageSize
      const { data, count, error } = await buildLeadsQuery(true).range(fromIdx, fromIdx + pageSize - 1)
      if (error) {
        console.error('Database Error:', error)
        throw error
      }
      setLeads((data as Lead[]) ?? [])
      setTotalCount(count ?? 0)

      const today = format(new Date(), 'yyyy-MM-dd')
      // Overall stats — independent of the current filter/page
      const [{ count: totalAll }, { count: newTodayCount }] = await Promise.all([
        supabase.from('leads').select('*', { count: 'exact', head: true }),
        supabase.from('leads').select('*', { count: 'exact', head: true }).gte('created_at', today),
      ])
      setStats(prev => ({ ...prev, total: totalAll ?? 0, newToday: newTodayCount ?? 0 }))
    } catch (err: unknown) {
      console.error('Fetch Leads Error:', err)
    } finally {
      setLoading(false)
    }
  }, [buildLeadsQuery, page, pageSize, currentProfile])

  // Loads every matching lead (in 1000-row chunks) for CSV export, regardless
  // of which page is on screen.
  const exportAllLeads = useCallback(async (): Promise<Lead[]> => {
    const CHUNK = 1000
    let from = 0
    let all: Lead[] = []
    for (let guard = 0; guard < 50; guard++) {
      const { data, error } = await buildLeadsQuery(false).range(from, from + CHUNK - 1)
      if (error) throw error
      const batch = (data as Lead[]) ?? []
      all = all.concat(batch)
      if (batch.length < CHUNK) break
      from += CHUNK
    }
    return all
  }, [buildLeadsQuery])

  // Any change that reshapes the result set sends us back to page 1.
  useEffect(() => { setPage(1) }, [filters, searchTerm, sortDir, pageSize])

  useEffect(() => { if (currentProfile) fetchLeads() }, [fetchLeads, currentProfile])

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Leads</h1>
          <p className="text-xs text-gray-400 mt-0.5">Manage and track all your leads</p>
        </div>
        <Button onClick={() => setShowForm(true)} size="sm" className="gap-1.5 h-9">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Add Lead</span>
          <span className="sm:hidden">Add</span>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <StatCard label="Total Leads" value={stats.total} icon={Users} color="bg-blue-100 text-blue-600" />
        <StatCard label="New Today" value={stats.newToday} icon={TrendingUp} color="bg-blue-100 text-blue-600" />
        <StatCard label="Converted" value={stats.converted} icon={CheckCircle} color="bg-emerald-100 text-emerald-600" />
        <StatCard label="Followup Due" value={stats.followupDue} icon={Clock} color="bg-amber-100 text-amber-600" />
      </div>

      {/* Table — full width, filters inside */}
      <LeadTable
        leads={leads}
        totalCount={totalCount}
        isLoading={loading}
        page={page}
        pageSize={pageSize}
        sortDir={sortDir}
        searchValue={searchTerm}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        onSortChange={setSortDir}
        onSearchChange={setSearchTerm}
        onExportAll={exportAllLeads}
        onRefresh={fetchLeads}
        onLeadUpdate={(id, update) => setLeads(prev => prev.map(l => l.id === id ? { ...l, ...update } : l))}
        courses={courses}
        telecallers={['lead', 'telecaller', 'counselor'].includes(currentProfile?.role ?? '') ? [] : telecallers}
        isTelecaller={['lead', 'telecaller', 'counselor'].includes(currentProfile?.role ?? '')}
      />

      {/* Add Lead Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Add Lead</DialogTitle></DialogHeader>
          <Tabs defaultValue="single" className="w-full">
            <TabsList className="w-full mb-4">
              <TabsTrigger value="single" className="flex-1">Single Lead</TabsTrigger>
              <TabsTrigger value="bulk" className="flex-1">Bulk Import (Excel)</TabsTrigger>
            </TabsList>
            <TabsContent value="single" className="mt-0 outline-none">
              <LeadForm onSuccess={() => { setShowForm(false); fetchLeads() }} onCancel={() => setShowForm(false)} />
            </TabsContent>
            <TabsContent value="bulk" className="mt-0 outline-none">
              <BulkImportLeads onSuccess={() => { setShowForm(false); fetchLeads() }} onCancel={() => setShowForm(false)} />
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

    </div>
  )
}
