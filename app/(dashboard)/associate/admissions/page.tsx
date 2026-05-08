'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { CheckCircle2, Clock, XCircle, GraduationCap, Search } from 'lucide-react'

interface Lead {
  id: string
  full_name: string
  phone: string
  status: string
  created_at: string
  course?: { name: string } | null
}

export default function AssociateAdmissionsPage() {
  const supabase = createClient()
  const db = supabase as any
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const { data: assoc } = await db.from('associates').select('id').eq('user_id', user.id).single()
    if (!assoc) { setLoading(false); return }
    const { data } = await supabase.from('leads')
      .select('id, full_name, phone, status, created_at, course:courses(name)')
      .eq('referred_by_associate', assoc.id)
      .order('created_at', { ascending: false })
    setLeads((data ?? []) as Lead[])
    setLoading(false)
  }, [supabase, db])

  useEffect(() => { load() }, [load])

  const filtered = leads.filter(l =>
    !search || l.full_name.toLowerCase().includes(search.toLowerCase()) || l.phone.includes(search)
  )

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Admissions</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Students you have referred</p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input placeholder="Search by name or phone..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
        <p className="text-sm text-muted-foreground ml-auto">{filtered.length} referrals</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-7 h-7 border-4 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground border rounded-xl bg-white">
          <GraduationCap className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No referrals found</p>
          <p className="text-xs mt-1">Students you refer will appear here</p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Name</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 hidden sm:table-cell">Phone</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 hidden md:table-cell">Course</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 hidden lg:table-cell">Date</th>
                <th className="text-center px-4 py-3 font-semibold text-slate-600">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map(l => (
                <tr key={l.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{l.full_name}</td>
                  <td className="px-4 py-3 text-slate-600 hidden sm:table-cell">{l.phone}</td>
                  <td className="px-4 py-3 text-slate-500 hidden md:table-cell">{l.course?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs hidden lg:table-cell">
                    {new Date(l.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-3 text-center"><LeadBadge status={l.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function LeadBadge({ status }: { status: string }) {
  if (status === 'converted') return <Badge className="bg-green-100 text-green-800 border-0 text-xs gap-1"><CheckCircle2 className="w-3 h-3" />Converted</Badge>
  if (status === 'lost') return <Badge className="bg-red-100 text-red-800 border-0 text-xs gap-1"><XCircle className="w-3 h-3" />Lost</Badge>
  return <Badge className="bg-amber-100 text-amber-800 border-0 text-xs gap-1"><Clock className="w-3 h-3" />{status.replace(/_/g, ' ')}</Badge>
}
