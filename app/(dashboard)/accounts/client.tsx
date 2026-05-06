'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import Link from 'next/link'
import {
  DollarSign, TrendingUp, TrendingDown, BookOpen,
  Wallet, GraduationCap, Calendar, Receipt, ArrowRight,
  CheckCircle2, Clock, XCircle, PlusCircle, MinusCircle,
  Search, ChevronRight,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)

interface Student {
  id: string
  full_name: string
  enrollment_number: string
  total_fee: number | null
  amount_paid: number | null
  enrollment_date: string | null
  status: string
  courses: { name: string } | null
  sessions: { name: string } | null
}

interface PaymentRow {
  id: string
  amount: number
  payment_date: string
  payment_mode: string
  receipt_number: string | null
  notes: string | null
  student_name: string
}

interface CourseStatRow {
  id: string
  name: string
  studentCount: number
  totalFee: number
  collectedFee: number
  pendingFee: number
}

interface WalletEntry {
  id: string
  user_name: string
  role: string
  balance: number
}

interface Props {
  userName: string
  month: string
  incomeMonth: number
  incomeTotal: number
  expenseMonth: number
  outstandingFees: number
  pendingExpenseCount: number
  students: Student[]
  recentPayments: PaymentRow[]
  courses: { id: string; name: string; sub_courses: { id: string; name: string }[] }[]
  sessions: { id: string; name: string; is_active: boolean }[]
  counsellors: { id: string; full_name: string; role: string }[]
  courseStats: CourseStatRow[]
}

export default function AccountsClient({
  userName, month, incomeMonth, incomeTotal, expenseMonth,
  outstandingFees, pendingExpenseCount, students, recentPayments,
  courses, sessions, counsellors, courseStats,
}: Props) {
  const netProfit = incomeMonth - expenseMonth

  // Admission portal search
  const [admissionSearch, setAdmissionSearch] = useState('')
  const [feeFilter, setFeeFilter] = useState<'all' | 'paid' | 'partial' | 'pending'>('all')

  const filteredStudents = students.filter(s => {
    const matchSearch = admissionSearch === '' ||
      s.full_name.toLowerCase().includes(admissionSearch.toLowerCase()) ||
      s.enrollment_number.toLowerCase().includes(admissionSearch.toLowerCase())
    const paid = s.amount_paid ?? 0
    const total = s.total_fee ?? 0
    const matchFee =
      feeFilter === 'all' ? true :
      feeFilter === 'paid' ? paid >= total && total > 0 :
      feeFilter === 'partial' ? paid > 0 && paid < total :
      paid === 0
    return matchSearch && matchFee
  })

  // Wallet state (UI-only, visual demo)
  const [wallets, setWallets] = useState<WalletEntry[]>(() =>
    counsellors.slice(0, 8).map((c, i) => ({
      id: c.id,
      user_name: c.full_name,
      role: c.role,
      balance: [3500, 8200, 1200, 0, 4500, 2300, 6700, 900][i] ?? 0,
    }))
  )
  const [walletSearch, setWalletSearch] = useState('')
  const [walletOpen, setWalletOpen] = useState(false)
  const [walletForm, setWalletForm] = useState({ wallet_id: '', type: 'credit' as 'credit' | 'debit', amount: '', reason: '' })

  function handleWalletAdjust() {
    if (!walletForm.wallet_id || !walletForm.amount || !walletForm.reason) {
      toast.error('Please fill all fields')
      return
    }
    const amt = Number(walletForm.amount)
    const wallet = wallets.find(w => w.id === walletForm.wallet_id)
    if (!wallet) return
    if (walletForm.type === 'debit' && wallet.balance < amt) {
      toast.error('Insufficient wallet balance')
      return
    }
    setWallets(prev => prev.map(w =>
      w.id === walletForm.wallet_id
        ? { ...w, balance: walletForm.type === 'credit' ? w.balance + amt : w.balance - amt }
        : w
    ))
    toast.success(`₹${amt.toLocaleString('en-IN')} ${walletForm.type === 'credit' ? 'credited to' : 'debited from'} ${wallet.user_name}'s wallet`)
    setWalletOpen(false)
    setWalletForm({ wallet_id: '', type: 'credit', amount: '', reason: '' })
  }

  const filteredWallets = wallets.filter(w =>
    w.user_name.toLowerCase().includes(walletSearch.toLowerCase())
  )
  const totalWalletBalance = wallets.reduce((s, w) => s + w.balance, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Associate Portal</h1>
          <p className="text-sm text-muted-foreground">Welcome, {userName} &middot; {month}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/finance/income">
            <Button size="sm" variant="outline" className="gap-1.5">
              <Receipt className="w-4 h-4" /> Income Ledger
            </Button>
          </Link>
          <Link href="/finance/expenses">
            <Button size="sm" variant="outline" className="gap-1.5">
              <DollarSign className="w-4 h-4" /> Expenses
            </Button>
          </Link>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-xl border bg-white p-4 space-y-1">
          <p className="text-xs text-muted-foreground font-medium">Total Collected</p>
          <p className="text-lg font-bold text-blue-700">{fmt(incomeTotal)}</p>
          <p className="text-[10px] text-muted-foreground">All time</p>
        </div>
        <div className="rounded-xl border bg-white p-4 space-y-1">
          <p className="text-xs text-muted-foreground font-medium">Income This Month</p>
          <p className="text-lg font-bold text-green-700">{fmt(incomeMonth)}</p>
          <div className="flex items-center gap-1 text-green-500 text-[10px]"><TrendingUp className="w-3 h-3" />{month}</div>
        </div>
        <div className="rounded-xl border bg-white p-4 space-y-1">
          <p className="text-xs text-muted-foreground font-medium">Expenses This Month</p>
          <p className="text-lg font-bold text-red-600">{fmt(expenseMonth)}</p>
          <div className="flex items-center gap-1 text-red-400 text-[10px]"><TrendingDown className="w-3 h-3" />{month}</div>
        </div>
        <div className={`rounded-xl border bg-white p-4 space-y-1`}>
          <p className="text-xs text-muted-foreground font-medium">Net Profit/Loss</p>
          <p className={`text-lg font-bold ${netProfit >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmt(Math.abs(netProfit))}</p>
          <p className={`text-[10px] font-medium ${netProfit >= 0 ? 'text-green-500' : 'text-red-400'}`}>{netProfit >= 0 ? 'Profit' : 'Loss'}</p>
        </div>
        <div className="rounded-xl border bg-white p-4 space-y-1">
          <p className="text-xs text-muted-foreground font-medium">Outstanding Fees</p>
          <p className="text-lg font-bold text-amber-600">{fmt(outstandingFees)}</p>
          <p className="text-[10px] text-muted-foreground">Pending from students</p>
        </div>
        <div className={`rounded-xl border bg-white p-4 space-y-1`}>
          <p className="text-xs text-muted-foreground font-medium">Pending Approvals</p>
          <p className={`text-lg font-bold ${pendingExpenseCount > 0 ? 'text-amber-600' : 'text-gray-500'}`}>{pendingExpenseCount}</p>
          <Link href="/finance/expenses" className="text-[10px] text-blue-500 hover:underline flex items-center gap-0.5">View expenses <ChevronRight className="w-3 h-3" /></Link>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="admissions" className="space-y-4">
        <TabsList className="bg-white border">
          <TabsTrigger value="admissions" className="gap-1.5 text-xs sm:text-sm">
            <GraduationCap className="w-4 h-4" /> Admission Portal
          </TabsTrigger>
          <TabsTrigger value="courses" className="gap-1.5 text-xs sm:text-sm">
            <BookOpen className="w-4 h-4" /> Courses & Sessions
          </TabsTrigger>
          <TabsTrigger value="payments" className="gap-1.5 text-xs sm:text-sm">
            <Receipt className="w-4 h-4" /> Recent Payments
          </TabsTrigger>
          <TabsTrigger value="wallet" className="gap-1.5 text-xs sm:text-sm">
            <Wallet className="w-4 h-4" /> Wallet
          </TabsTrigger>
        </TabsList>

        {/* ── ADMISSION PORTAL ── */}
        <TabsContent value="admissions" className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search by name or enrollment no..."
                value={admissionSearch}
                onChange={e => setAdmissionSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            <div className="flex gap-1.5">
              {(['all', 'paid', 'partial', 'pending'] as const).map(f => (
                <Button
                  key={f}
                  size="sm"
                  variant={feeFilter === f ? 'default' : 'outline'}
                  className="h-8 capitalize text-xs"
                  onClick={() => setFeeFilter(f)}
                >
                  {f === 'all' ? 'All' : f === 'paid' ? 'Fully Paid' : f === 'partial' ? 'Partial' : 'Unpaid'}
                </Button>
              ))}
            </div>
            <p className="text-sm text-muted-foreground ml-auto">{filteredStudents.length} students</p>
          </div>

          <div className="rounded-xl border overflow-hidden bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Student</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 hidden sm:table-cell">Enroll No.</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 hidden md:table-cell">Course</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 hidden lg:table-cell">Session</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600">Total Fee</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600">Paid</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600">Pending</th>
                  <th className="text-center px-4 py-3 font-semibold text-slate-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredStudents.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-12 text-muted-foreground">No students found</td></tr>
                ) : filteredStudents.map(s => {
                  const paid = s.amount_paid ?? 0
                  const total = s.total_fee ?? 0
                  const pending = Math.max(0, total - paid)
                  const feeStatus = total === 0 ? 'no-fee' : paid >= total ? 'paid' : paid > 0 ? 'partial' : 'unpaid'
                  return (
                    <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900">{s.full_name}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs hidden sm:table-cell font-mono">{s.enrollment_number}</td>
                      <td className="px-4 py-3 text-slate-600 hidden md:table-cell">{(s.courses as any)?.name ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs hidden lg:table-cell">{(s.sessions as any)?.name ?? '—'}</td>
                      <td className="px-4 py-3 text-right font-mono text-slate-700">{total > 0 ? fmt(total) : '—'}</td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-green-700">{paid > 0 ? fmt(paid) : '—'}</td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-red-600">{pending > 0 ? fmt(pending) : '—'}</td>
                      <td className="px-4 py-3 text-center">
                        {feeStatus === 'paid' && (
                          <Badge className="bg-green-100 text-green-800 border-0 text-xs gap-1">
                            <CheckCircle2 className="w-3 h-3" />Paid
                          </Badge>
                        )}
                        {feeStatus === 'partial' && (
                          <Badge className="bg-amber-100 text-amber-800 border-0 text-xs gap-1">
                            <Clock className="w-3 h-3" />Partial
                          </Badge>
                        )}
                        {feeStatus === 'unpaid' && (
                          <Badge className="bg-red-100 text-red-800 border-0 text-xs gap-1">
                            <XCircle className="w-3 h-3" />Unpaid
                          </Badge>
                        )}
                        {feeStatus === 'no-fee' && (
                          <Badge className="bg-slate-100 text-slate-600 border-0 text-xs">—</Badge>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* ── COURSES & SESSIONS ── */}
        <TabsContent value="courses" className="space-y-6">
          {/* Course-wise fee stats */}
          <div>
            <h3 className="font-semibold text-sm text-slate-700 mb-3 flex items-center gap-2">
              <BookOpen className="w-4 h-4" /> Course-wise Fee Collection
            </h3>
            {courseStats.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No enrolled students yet</p>
            ) : (
              <div className="rounded-xl border overflow-hidden bg-white">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      <th className="text-left px-4 py-3 font-semibold text-slate-600">Course</th>
                      <th className="text-right px-4 py-3 font-semibold text-slate-600">Students</th>
                      <th className="text-right px-4 py-3 font-semibold text-slate-600">Total Fee</th>
                      <th className="text-right px-4 py-3 font-semibold text-slate-600">Collected</th>
                      <th className="text-right px-4 py-3 font-semibold text-slate-600">Pending</th>
                      <th className="px-4 py-3 w-40">Collection %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {courseStats.map(c => {
                      const pct = c.totalFee > 0 ? Math.round((c.collectedFee / c.totalFee) * 100) : 0
                      return (
                        <tr key={c.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-medium">{c.name}</td>
                          <td className="px-4 py-3 text-right text-slate-600">{c.studentCount}</td>
                          <td className="px-4 py-3 text-right font-mono text-slate-700">{fmt(c.totalFee)}</td>
                          <td className="px-4 py-3 text-right font-mono font-semibold text-green-700">{fmt(c.collectedFee)}</td>
                          <td className="px-4 py-3 text-right font-mono font-semibold text-red-600">{c.pendingFee > 0 ? fmt(c.pendingFee) : '—'}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-slate-200 rounded-full h-2">
                                <div
                                  className={`h-2 rounded-full transition-all ${pct >= 80 ? 'bg-green-500' : pct >= 40 ? 'bg-amber-400' : 'bg-red-400'}`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span className="text-xs font-semibold text-slate-600 w-8 text-right">{pct}%</span>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Sessions list */}
          <div>
            <h3 className="font-semibold text-sm text-slate-700 mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4" /> Sessions
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {sessions.length === 0 ? (
                <p className="text-sm text-muted-foreground col-span-full py-4">No sessions configured</p>
              ) : sessions.map(s => (
                <div key={s.id} className="rounded-xl border bg-white p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{s.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Session</p>
                  </div>
                  <Badge className={`text-xs border-0 ${s.is_active ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-500'}`}>
                    {s.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              ))}
            </div>
          </div>

          {/* All courses list */}
          <div>
            <h3 className="font-semibold text-sm text-slate-700 mb-3 flex items-center gap-2">
              <BookOpen className="w-4 h-4" /> All Courses
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {courses.map(c => (
                <div key={c.id} className="rounded-xl border bg-white p-4">
                  <p className="font-semibold text-sm text-gray-800">{c.name}</p>
                  {c.sub_courses.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {c.sub_courses.map(sc => (
                        <Badge key={sc.id} variant="outline" className="text-xs">{sc.name}</Badge>
                      ))}
                    </div>
                  )}
                  {c.sub_courses.length === 0 && (
                    <p className="text-xs text-muted-foreground mt-1">No sub-courses</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* ── RECENT PAYMENTS ── */}
        <TabsContent value="payments" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Latest 20 payments</p>
            <Link href="/finance/income">
              <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8">
                View All <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </div>
          <div className="rounded-xl border overflow-hidden bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Date</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Student / Source</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 hidden sm:table-cell">Notes</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600">Amount</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 hidden md:table-cell">Mode</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 hidden lg:table-cell">Receipt #</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {recentPayments.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">No payments yet</td></tr>
                ) : recentPayments.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                      {format(new Date(p.payment_date), 'dd MMM yyyy')}
                    </td>
                    <td className="px-4 py-3 font-medium">{p.student_name}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs hidden sm:table-cell">{p.notes || '—'}</td>
                    <td className="px-4 py-3 text-right font-bold font-mono text-green-700">{fmt(p.amount)}</td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <Badge variant="outline" className="text-xs uppercase">{p.payment_mode}</Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs hidden lg:table-cell">{p.receipt_number || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* ── WALLET ── */}
        <TabsContent value="wallet" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Counselor Wallets</h3>
              <p className="text-sm text-muted-foreground">View and manage counselor/associate wallet balances</p>
            </div>
            <Button size="sm" onClick={() => setWalletOpen(true)} className="gap-1.5">
              <Wallet className="w-4 h-4" /> Manual Adjustment
            </Button>
          </div>

          {/* Wallet stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-green-50 border border-green-100 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-green-700">₹{totalWalletBalance.toLocaleString('en-IN')}</p>
              <p className="text-xs text-green-600 mt-1">Total Wallet Balance</p>
            </div>
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-blue-700">{wallets.filter(w => w.balance > 0).length}</p>
              <p className="text-xs text-blue-600 mt-1">Active Wallets</p>
            </div>
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-amber-700">{wallets.filter(w => w.balance === 0).length}</p>
              <p className="text-xs text-amber-600 mt-1">Zero Balance</p>
            </div>
          </div>

          {/* Search */}
          <div className="relative max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search counselor..."
              value={walletSearch}
              onChange={e => setWalletSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>

          {/* Wallets table */}
          <div className="rounded-xl border overflow-hidden bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Counselor</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Role</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600">Balance</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredWallets.length === 0 ? (
                  <tr><td colSpan={4} className="text-center py-10 text-muted-foreground">No wallets found</td></tr>
                ) : filteredWallets.map(w => (
                  <tr key={w.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium">{w.user_name}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="text-xs capitalize">{w.role}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-bold font-mono ${w.balance > 0 ? 'text-green-700' : 'text-slate-400'}`}>
                        ₹{w.balance.toLocaleString('en-IN')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center gap-1 justify-end">
                        <Button
                          variant="ghost" size="sm"
                          className="text-green-600 h-7 text-xs"
                          onClick={() => { setWalletForm({ wallet_id: w.id, type: 'credit', amount: '', reason: '' }); setWalletOpen(true) }}
                        >
                          <PlusCircle className="w-3.5 h-3.5 mr-1" />Credit
                        </Button>
                        <Button
                          variant="ghost" size="sm"
                          className="text-red-500 h-7 text-xs"
                          onClick={() => { setWalletForm({ wallet_id: w.id, type: 'debit', amount: '', reason: '' }); setWalletOpen(true) }}
                        >
                          <MinusCircle className="w-3.5 h-3.5 mr-1" />Debit
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Wallet Adjustment Dialog */}
      <Dialog open={walletOpen} onOpenChange={setWalletOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {walletForm.type === 'credit'
                ? <PlusCircle className="w-4 h-4 text-green-500" />
                : <MinusCircle className="w-4 h-4 text-red-500" />}
              Wallet {walletForm.type === 'credit' ? 'Credit' : 'Debit'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Select Counselor</Label>
              <select
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                value={walletForm.wallet_id}
                onChange={e => setWalletForm(f => ({ ...f, wallet_id: e.target.value }))}
              >
                <option value="">-- Select --</option>
                {wallets.map(w => (
                  <option key={w.id} value={w.id}>
                    {w.user_name} (₹{w.balance.toLocaleString('en-IN')})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Type</Label>
              <select
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                value={walletForm.type}
                onChange={e => setWalletForm(f => ({ ...f, type: e.target.value as 'credit' | 'debit' }))}
              >
                <option value="credit">Credit (Add Money)</option>
                <option value="debit">Debit (Deduct Money)</option>
              </select>
            </div>
            <div>
              <Label>Amount (₹)</Label>
              <Input
                type="number" min="1" placeholder="0"
                value={walletForm.amount}
                onChange={e => setWalletForm(f => ({ ...f, amount: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Reason</Label>
              <Textarea
                placeholder="e.g. Incentive for admission, refund adjustment..."
                value={walletForm.reason}
                onChange={e => setWalletForm(f => ({ ...f, reason: e.target.value }))}
                rows={2}
                className="mt-1"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setWalletOpen(false)}>Cancel</Button>
              <Button
                onClick={handleWalletAdjust}
                className={walletForm.type === 'debit' ? 'bg-red-600 hover:bg-red-700' : ''}
              >
                {walletForm.type === 'credit' ? 'Credit Wallet' : 'Debit Wallet'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
