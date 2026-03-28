'use client'
import { useState, useEffect, useCallback } from 'react'
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
  const [courses, setCourses] = useState<Course[]>([])
  const [telecallers, setTelecallers] = useState<Profile[]>([])
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null)
  const { filters } = useLeadStore()
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setCurrentProfile(profile as unknown as Profile)
    })

    Promise.all([
      supabase.from('courses').select('*').eq('is_active', true).order('name'),
      supabase.from('profiles').select('*').eq('role', 'lead').eq('is_active', true),
    ]).then(([{ data: c }, { data: t }]) => {
      setCourses(c ?? [])
      setTelecallers(t ?? [])
    })
  }, [])

  const fetchLeads = useCallback(async () => {
    if (!currentProfile) return
    setLoading(true)
    try {
      const isTelecaller = (currentProfile.role as string) === 'lead' || (currentProfile.role as string) === 'telecaller'

      let query = supabase
        .from('leads')
        .select(`
          *,
          course:courses(id, name, is_active, created_at),
          sub_course:sub_courses(id, name, is_active, created_at, course_id),
          department:departments(id, name, is_active, created_at),
          sub_section:department_sub_sections(id, name, is_active, created_at, department_id),
          assigned_user:profiles!leads_assigned_to_fkey(id, email, full_name, role, is_active, created_at)
        `)
        .order('updated_at', { ascending: false })

      // Telecallers only see their own assigned leads
      if (isTelecaller) {
        query = query.eq('assigned_to', currentProfile.id)
      }

      if (filters.status?.length) query = query.in('status', filters.status)
      if (filters.source?.length) query = query.in('source', filters.source)
      if (!isTelecaller && filters.assigned_to?.length) query = query.in('assigned_to', filters.assigned_to)
      if (filters.course_id?.length) query = query.in('course_id', filters.course_id)
      if (filters.city) query = query.ilike('city', `%${filters.city}%`)
      if (filters.created_from) query = query.gte('created_at', filters.created_from)
      if (filters.created_to) query = query.lte('created_at', filters.created_to + 'T23:59:59')
      if (filters.followup_from) query = query.gte('next_followup_date', filters.followup_from)
      if (filters.followup_to) query = query.lte('next_followup_date', filters.followup_to)
      if (filters.payment_status === 'paid') query = query.gt('amount_paid', 0).filter('amount_paid', 'gte', 'total_fee')
      if (filters.payment_status === 'unpaid') query = query.eq('amount_paid', 0)
      if (filters.mode) query = query.eq('mode', filters.mode)
      if (filters.import_batch_id) query = query.eq('import_batch_id', filters.import_batch_id)

      const { data, error } = await query
      if (error) throw error
      setLeads((data as Lead[]) ?? [])

      const today = format(new Date(), 'yyyy-MM-dd')
      // Stats scoped to assigned leads for telecallers
      const base = isTelecaller
        ? supabase.from('leads').select('*', { count: 'exact', head: true }).eq('assigned_to', currentProfile.id)
        : supabase.from('leads').select('*', { count: 'exact', head: true })

      const [{ count: totalCount }, { count: newTodayCount }, { count: convertedCount }, { count: followupCount }] = await Promise.all([
        (isTelecaller ? supabase.from('leads').select('*', { count: 'exact', head: true }).eq('assigned_to', currentProfile.id) : supabase.from('leads').select('*', { count: 'exact', head: true })),
        (isTelecaller ? supabase.from('leads').select('*', { count: 'exact', head: true }).eq('assigned_to', currentProfile.id).gte('created_at', today) : supabase.from('leads').select('*', { count: 'exact', head: true }).gte('created_at', today)),
        (isTelecaller ? supabase.from('leads').select('*', { count: 'exact', head: true }).eq('assigned_to', currentProfile.id).eq('status', 'converted') : supabase.from('leads').select('*', { count: 'exact', head: true }).eq('status', 'converted')),
        (isTelecaller ? supabase.from('leads').select('*', { count: 'exact', head: true }).eq('assigned_to', currentProfile.id).eq('next_followup_date', today) : supabase.from('leads').select('*', { count: 'exact', head: true }).eq('next_followup_date', today)),
      ])
      void base
      setStats({ total: totalCount ?? 0, newToday: newTodayCount ?? 0, converted: convertedCount ?? 0, followupDue: followupCount ?? 0 })
    } catch (err: unknown) {
      const e = err as { message?: string }
      console.error('Failed to fetch leads:', e?.message)
    } finally {
      setLoading(false)
    }
  }, [filters, currentProfile])

  useEffect(() => { if (currentProfile) fetchLeads() }, [fetchLeads, currentProfile])

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Leads</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage and track all your leads</p>
        </div>
        {!['lead', 'telecaller'].includes(currentProfile?.role ?? '') && (
          <Button onClick={() => setShowForm(true)} className="gap-1.5">
            <Plus className="w-4 h-4" /> Add Lead
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total Leads" value={stats.total} icon={Users} color="bg-blue-100 text-blue-600" />
        <StatCard label="New Today" value={stats.newToday} icon={TrendingUp} color="bg-violet-100 text-violet-600" />
        <StatCard label="Converted" value={stats.converted} icon={CheckCircle} color="bg-emerald-100 text-emerald-600" />
        <StatCard label="Followup Due" value={stats.followupDue} icon={Clock} color="bg-amber-100 text-amber-600" />
      </div>

      {/* Table — full width, filters inside */}
      <LeadTable
        leads={leads}
        isLoading={loading}
        onRefresh={fetchLeads}
        courses={courses}
        telecallers={['lead', 'telecaller'].includes(currentProfile?.role ?? '') ? [] : telecallers}
        isTelecaller={['lead', 'telecaller'].includes(currentProfile?.role ?? '')}
      />

      {/* Add Lead Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
          <DialogHeader><DialogTitle>Add Lead</DialogTitle></DialogHeader>
          <Tabs defaultValue="single" className="w-full">
            <TabsList className="w-full mb-4">
              <TabsTrigger value="single" className="flex-1">Single Lead</TabsTrigger>
              <TabsTrigger value="bulk" className="flex-1">Bulk Import (Excel)</TabsTrigger>
            </TabsList>
            <TabsContent value="single" className="mt-0 outline-none h-[600px] overflow-y-auto pr-2">
              <LeadForm onSuccess={() => { setShowForm(false); fetchLeads() }} onCancel={() => setShowForm(false)} />
            </TabsContent>
            <TabsContent value="bulk" className="mt-0 outline-none h-[600px] overflow-y-auto pr-2">
              <BulkImportLeads onSuccess={() => { setShowForm(false); fetchLeads() }} onCancel={() => setShowForm(false)} />
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  )
}
