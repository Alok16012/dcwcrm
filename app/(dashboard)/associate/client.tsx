'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CheckCircle2, Clock, XCircle, RefreshCw, GraduationCap, IndianRupee, TrendingUp, Bell } from 'lucide-react'
import Link from 'next/link'

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)

interface Associate {
  id: string
  name: string
  associate_code: string | null
  wallet_balance: number
}

interface Lead {
  id: string
  full_name: string
  status: string
  created_at: string
  course?: { name: string } | null
  referred_by_associate?: string
}

interface WalletTxn {
  id: string
  type: 'credit' | 'debit'
  amount: number
  reason: string | null
  created_at: string
  associate_id: string
}

export default function AssociateClient() {
  const supabase = createClient()
  const db = supabase as any
  const [associate, setAssociate] = useState<Associate | null>(null)
  const [leads, setLeads] = useState<Lead[]>([])
  const [txns, setTxns] = useState<WalletTxn[]>([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data: assoc } = await db.from('associates').select('id, name, associate_code, wallet_balance').eq('user_id', user.id).single()
    if (!assoc) { setLoading(false); return }
    setAssociate(assoc)

    const [leadRes, txnRes, notifRes] = await Promise.all([
      supabase.from('leads').select('id, full_name, status, created_at, course:courses(name), referred_by_associate').eq('referred_by_associate', assoc.id).order('created_at', { ascending: false }).limit(5),
      db.from('associate_wallet_txns').select('*').eq('associate_id', assoc.id).order('created_at', { ascending: false }).limit(5),
      db.from('associate_notifications').select('id').eq('associate_id', assoc.id).eq('is_read', false),
    ])

    setLeads((leadRes.data ?? []) as Lead[])
    setTxns((txnRes.data ?? []) as WalletTxn[])
    setUnread((notifRes.data ?? []).length)
    setLoading(false)
  }, [supabase, db])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
      </div>
    )
  }

  if (!associate) {
    return (
      <div className="flex items-center justify-center min-h-[400px] text-muted-foreground text-center">
        <div>
          <p className="font-medium">Associate profile not found</p>
          <p className="text-sm mt-1">Contact admin if this is unexpected</p>
        </div>
      </div>
    )
  }

  const converted = leads.filter(l => l.status === 'converted').length
  const inProgress = leads.filter(l => !['converted', 'lost'].includes(l.status)).length
  const totalEarned = txns.filter(t => t.type === 'credit').reduce((s, t) => s + t.amount, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Welcome, {associate.name} · Code:{' '}
            <span className="font-mono font-semibold text-blue-700">{associate.associate_code ?? '—'}</span>
          </p>
        </div>
        <div className="flex gap-2 items-center">
          {unread > 0 && (
            <Link href="/associate/notifications">
              <Badge className="bg-red-100 text-red-700 border-0 gap-1 cursor-pointer hover:bg-red-200 transition-colors">
                <Bell className="w-3 h-3" /> {unread} new
              </Badge>
            </Link>
          )}
          <Button variant="outline" size="sm" onClick={load} className="gap-1.5 h-8">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Wallet Balance" value={fmt(associate.wallet_balance)} color="blue" icon={<IndianRupee className="w-4 h-4" />} />
        <StatCard label="Total Earned" value={fmt(totalEarned)} color="green" icon={<TrendingUp className="w-4 h-4" />} />
        <StatCard label="Converted" value={converted.toString()} color="green" icon={<CheckCircle2 className="w-4 h-4" />} />
        <StatCard label="In Progress" value={inProgress.toString()} color="amber" icon={<GraduationCap className="w-4 h-4" />} />
      </div>

      {/* Recent panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Referrals */}
        <div className="rounded-xl border bg-white p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm text-slate-700">Recent Referrals</h3>
            <Link href="/associate/admissions" className="text-xs text-blue-600 hover:underline">View all →</Link>
          </div>
          {leads.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No referrals yet</p>
          ) : (
            <div className="space-y-0 divide-y">
              {leads.map(l => (
                <div key={l.id} className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="font-medium text-sm text-gray-900">{l.full_name}</p>
                    <p className="text-xs text-muted-foreground">{l.course?.name ?? '—'}</p>
                  </div>
                  <LeadStatusBadge status={l.status} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Wallet Txns */}
        <div className="rounded-xl border bg-white p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm text-slate-700">Recent Transactions</h3>
            <Link href="/associate/account" className="text-xs text-blue-600 hover:underline">View all →</Link>
          </div>
          {txns.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No transactions yet</p>
          ) : (
            <div className="space-y-0 divide-y">
              {txns.map(t => (
                <div key={t.id} className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{t.reason ?? 'Transaction'}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(t.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                    </p>
                  </div>
                  <span className={`font-bold font-mono text-sm ${t.type === 'credit' ? 'text-green-700' : 'text-red-600'}`}>
                    {t.type === 'credit' ? '+' : '-'}{fmt(t.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, color, icon }: { label: string; value: string; color: 'blue' | 'green' | 'amber'; icon: React.ReactNode }) {
  const c = { blue: 'bg-blue-50 border-blue-100 text-blue-700', green: 'bg-green-50 border-green-100 text-green-700', amber: 'bg-amber-50 border-amber-100 text-amber-700' }
  return (
    <div className={`rounded-xl border p-4 space-y-2 ${c[color]}`}>
      <div className="flex items-center gap-2 opacity-70">{icon}<p className="text-xs font-medium">{label}</p></div>
      <p className="text-xl font-bold">{value}</p>
    </div>
  )
}

function LeadStatusBadge({ status }: { status: string }) {
  if (status === 'converted') return <Badge className="bg-green-100 text-green-800 border-0 text-xs gap-1"><CheckCircle2 className="w-3 h-3" />Converted</Badge>
  if (status === 'lost') return <Badge className="bg-red-100 text-red-800 border-0 text-xs gap-1"><XCircle className="w-3 h-3" />Lost</Badge>
  return <Badge className="bg-amber-100 text-amber-800 border-0 text-xs gap-1"><Clock className="w-3 h-3" />{status.replace(/_/g, ' ')}</Badge>
}
