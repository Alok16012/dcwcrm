import { redirect } from 'next/navigation'
import { getMonth, getYear, format } from 'date-fns'
import { createServerClient } from '@/lib/supabase/server'
import { DataTable } from '@/components/shared/DataTable'
import type { ColumnDef } from '@tanstack/react-table'

interface PerformanceRow {
  id: string
  full_name: string
  leads_assigned: number
  leads_contacted: number
  conversions: number
  revenue: number
  conversion_rate: string
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)

const columns: ColumnDef<PerformanceRow>[] = [
  { accessorKey: 'full_name', header: 'Employee' },
  { accessorKey: 'leads_assigned', header: 'Leads Assigned' },
  { accessorKey: 'leads_contacted', header: 'Contacted' },
  { accessorKey: 'conversions', header: 'Conversions' },
  { accessorKey: 'conversion_rate', header: 'Conv. Rate' },
  {
    accessorKey: 'revenue',
    header: 'Revenue Generated',
    cell: ({ getValue }) => fmt(getValue() as number),
  },
]

export default async function PerformancePage({
  searchParams,
}: {
  searchParams: { month?: string; year?: string }
}) {
  const supabase = await createServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user ?? null
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single() as { data: { role: string } | null }

  if (!profile || profile.role !== 'admin') redirect('/')

  const now = new Date()
  const month = Number(searchParams.month ?? getMonth(now) + 1)
  const year = Number(searchParams.year ?? getYear(now))
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`
  const monthEnd = `${year}-${String(month).padStart(2, '0')}-31`

  const [tcRes, leadsRes, paymentsRes] = await Promise.all([
    supabase.from('profiles').select('id, full_name'),
    supabase.from('leads').select('id, assigned_to, status').gte('created_at', monthStart).lte('created_at', monthEnd),
    supabase.from('payments').select('lead_id, amount').gte('payment_date', monthStart).lte('payment_date', monthEnd),
  ])
  const telecallers = tcRes.data as { id: string; full_name: string }[] | null
  const leads = leadsRes.data as { id: string; assigned_to: string | null; status: string }[] | null
  const payments = paymentsRes.data as { lead_id: string | null; amount: number }[] | null

  // Build lead_id → assigned_to map
  const leadOwnerMap = Object.fromEntries((leads ?? []).filter((l) => l.assigned_to).map((l) => [l.id, l.assigned_to!]))

  const rows: PerformanceRow[] = (telecallers ?? []).map((tc) => {
    const myLeads = (leads ?? []).filter((l) => l.assigned_to === tc.id)
    const contacted = myLeads.filter((l) =>
      ['contacted', 'interested', 'counselled', 'application_sent', 'converted'].includes(l.status)
    ).length
    const converted = myLeads.filter((l) => l.status === 'converted').length
    const revenue = (payments ?? [])
      .filter((p) => p.lead_id && leadOwnerMap[p.lead_id] === tc.id)
      .reduce((s, p) => s + (p.amount ?? 0), 0)
    const rate = myLeads.length > 0 ? ((converted / myLeads.length) * 100).toFixed(1) + '%' : '0%'

    return {
      id: tc.id,
      full_name: tc.full_name,
      leads_assigned: myLeads.length,
      leads_contacted: contacted,
      conversions: converted,
      revenue,
      conversion_rate: rate,
    }
  })

  const monthLabel = format(new Date(year, month - 1), 'MMMM yyyy')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Performance</h1>
        <p className="text-sm text-muted-foreground">{monthLabel}</p>
      </div>
      <DataTable data={rows} columns={columns} />
    </div>
  )
}
