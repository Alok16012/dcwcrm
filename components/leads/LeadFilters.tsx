'use client'
import { useEffect, useState } from 'react'
import { X, Filter } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import { useLeadStore } from '@/store/useLeadStore'
import {
  LEAD_STATUS_LABELS, LEAD_SOURCE_LABELS,
  type Course, type Profile, type LeadStatus, type LeadSource
} from '@/types/app.types'

export function LeadFilters() {
  const { filters, setFilters, clearFilters } = useLeadStore()
  const [courses, setCourses] = useState<Course[]>([])
  const [telecallers, setTelecallers] = useState<Profile[]>([])
  const [search, setSearch] = useState(filters.search ?? '')
  const supabase = createClient()

  useEffect(() => {
    Promise.all([
      supabase.from('courses').select('*').eq('is_active', true).order('name'),
      supabase.from('profiles').select('*').in('role', ['lead', 'telecaller', 'counselor']).eq('is_active', true),
    ]).then(([{ data: c }, { data: t }]) => {
      setCourses(c ?? [])
      setTelecallers(t ?? [])
    })
  }, [])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => setFilters({ search: search || undefined }), 300)
    return () => clearTimeout(timer)
  }, [search])

  function toggleStatus(s: LeadStatus) {
    const current = filters.status ?? []
    const updated = current.includes(s) ? current.filter((x) => x !== s) : [...current, s]
    setFilters({ status: updated.length ? updated : undefined })
  }

  function toggleSource(s: LeadSource) {
    const current = filters.source ?? []
    const updated = current.includes(s) ? current.filter((x) => x !== s) : [...current, s]
    setFilters({ source: updated.length ? updated : undefined })
  }

  const hasFilters = Object.values(filters).some((v) => v !== undefined && (Array.isArray(v) ? v.length > 0 : true))

  return (
    <div className="bg-white rounded-lg border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <Filter className="w-4 h-4" />
          Filters
        </div>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={() => { clearFilters(); setSearch('') }} className="text-xs h-7">
            <X className="w-3 h-3 mr-1" /> Clear all
          </Button>
        )}
      </div>

      {/* Search */}
      <Input
        placeholder="Search name, phone, email..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="h-8 text-sm"
      />

      {/* Status badges */}
      <div>
        <p className="text-xs text-gray-500 mb-1">Status</p>
        <div className="flex flex-wrap gap-1">
          {(Object.entries(LEAD_STATUS_LABELS) as [LeadStatus, string][]).map(([k, v]) => (
            <button
              key={k}
              onClick={() => toggleStatus(k)}
              className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${filters.status?.includes(k)
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Source badges */}
      <div>
        <p className="text-xs text-gray-500 mb-1">Source</p>
        <div className="flex flex-wrap gap-1">
          {(Object.entries(LEAD_SOURCE_LABELS) as [LeadSource, string][]).map(([k, v]) => (
            <button
              key={k}
              onClick={() => toggleSource(k)}
              className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${filters.source?.includes(k)
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Selects row */}
      <div className="grid grid-cols-2 gap-2">
        <Select
          value={filters.assigned_to?.[0] ?? ''}
          onValueChange={(v) => setFilters({ assigned_to: v ? [v] : undefined })}
        >
          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Assigned to" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">All</SelectItem>
            {telecallers.map((t) => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select
          value={filters.course_id?.[0] ?? ''}
          onValueChange={(v) => setFilters({ course_id: v ? [v] : undefined })}
        >
          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Course" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">All courses</SelectItem>
            {courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select
          value={filters.payment_status ?? ''}
          onValueChange={(v) => setFilters({ payment_status: v as typeof filters.payment_status || undefined })}
        >
          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Payment" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">All</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="partial">Partial</SelectItem>
            <SelectItem value="unpaid">Unpaid</SelectItem>
          </SelectContent>
        </Select>

        <Input
          placeholder="City"
          value={filters.city ?? ''}
          onChange={(e) => setFilters({ city: e.target.value || undefined })}
          className="h-8 text-xs"
        />
      </div>

      {/* Date ranges */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className="text-xs text-gray-500 mb-1">Created from</p>
          <Input type="date" className="h-8 text-xs" value={filters.created_from ?? ''} onChange={(e) => setFilters({ created_from: e.target.value || undefined })} />
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">Created to</p>
          <Input type="date" className="h-8 text-xs" value={filters.created_to ?? ''} onChange={(e) => setFilters({ created_to: e.target.value || undefined })} />
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">Followup from</p>
          <Input type="date" className="h-8 text-xs" value={filters.followup_from ?? ''} onChange={(e) => setFilters({ followup_from: e.target.value || undefined })} />
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">Followup to</p>
          <Input type="date" className="h-8 text-xs" value={filters.followup_to ?? ''} onChange={(e) => setFilters({ followup_to: e.target.value || undefined })} />
        </div>
      </div>
    </div>
  )
}
