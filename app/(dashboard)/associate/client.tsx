'use client'

import { useState } from 'react'
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

// ── DUMMY DATA ──────────────────────────────────────────
const STUDENTS = [
  { id: '1', name: 'Rahul Sharma', enroll: 'DCW2024001', course: 'BBA', total: 45000, paid: 45000, status: 'paid' },
  { id: '2', name: 'Priya Verma', enroll: 'DCW2024002', course: 'MBA', total: 75000, paid: 40000, status: 'partial' },
  { id: '3', name: 'Amit Singh', enroll: 'DCW2024003', course: 'BCA', total: 35000, paid: 0, status: 'unpaid' },
  { id: '4', name: 'Sneha Patel', enroll: 'DCW2024004', course: 'MCA', total: 55000, paid: 55000, status: 'paid' },
  { id: '5', name: 'Vikram Yadav', enroll: 'DCW2024005', course: 'B.Com', total: 30000, paid: 15000, status: 'partial' },
  { id: '6', name: 'Pooja Mishra', enroll: 'DCW2024006', course: 'MBA', total: 75000, paid: 0, status: 'unpaid' },
  { id: '7', name: 'Rohit Kumar', enroll: 'DCW2024007', course: 'BBA', total: 45000, paid: 45000, status: 'paid' },
  { id: '8', name: 'Anjali Gupta', enroll: 'DCW2024008', course: 'BCA', total: 35000, paid: 20000, status: 'partial' },
]

const PAYMENTS = [
  { id: '1', date: '05 May 2026', name: 'Rahul Sharma', amount: 45000, mode: 'UPI', receipt: 'RCP001' },
  { id: '2', date: '03 May 2026', name: 'Sneha Patel', amount: 55000, mode: 'NEFT', receipt: 'RCP002' },
  { id: '3', date: '01 May 2026', name: 'Priya Verma', amount: 40000, mode: 'Cash', receipt: 'RCP003' },
  { id: '4', date: '28 Apr 2026', name: 'Vikram Yadav', amount: 15000, mode: 'UPI', receipt: 'RCP004' },
  { id: '5', date: '25 Apr 2026', name: 'Rohit Kumar', amount: 45000, mode: 'Cheque', receipt: 'RCP005' },
  { id: '6', date: '20 Apr 2026', name: 'Anjali Gupta', amount: 20000, mode: 'UPI', receipt: 'RCP006' },
]

const COURSES = [
  { id: '1', name: 'MBA', students: 3, total: 225000, collected: 150000 },
  { id: '2', name: 'BBA', students: 2, total: 90000, collected: 90000 },
  { id: '3', name: 'BCA', students: 2, total: 70000, collected: 20000 },
  { id: '4', name: 'MCA', students: 1, total: 55000, collected: 55000 },
  { id: '5', name: 'B.Com', students: 1, total: 30000, collected: 15000 },
]

const SESSIONS = [
  { id: '1', name: '2024-25', active: true },
  { id: '2', name: '2023-24', active: false },
  { id: '3', name: '2022-23', active: false },
]

const WALLETS = [
  { id: '1', name: 'Rajesh Kumar', role: 'Counselor', balance: 3500 },
  { id: '2', name: 'Sunita Sharma', role: 'Counselor', balance: 8200 },
  { id: '3', name: 'Amit Verma', role: 'Lead', balance: 1200 },
  { id: '4', name: 'Meera Patel', role: 'Counselor', balance: 0 },
  { id: '5', name: 'Rahul Gupta', role: 'Counselor', balance: 4500 },
]

export default function AssociateClient() {
  const [admissionSearch, setAdmissionSearch] = useState('')
  const [feeFilter, setFeeFilter] = useState<'all' | 'paid' | 'partial' | 'unpaid'>('all')

  const [wallets, setWallets] = useState(WALLETS)
  const [walletSearch, setWalletSearch] = useState('')
  const [walletOpen, setWalletOpen] = useState(false)
  const [walletForm, setWalletForm] = useState({ wallet_id: '', type: 'credit' as 'credit' | 'debit', amount: '', reason: '' })

  const filteredStudents = STUDENTS.filter(s => {
    const matchSearch = admissionSearch === '' ||
      s.name.toLowerCase().includes(admissionSearch.toLowerCase()) ||
      s.enroll.toLowerCase().includes(admissionSearch.toLowerCase())
    const matchFee = feeFilter === 'all' ? true : s.status === feeFilter
    return matchSearch && matchFee
  })

  const filteredWallets = wallets.filter(w =>
    w.name.toLowerCase().includes(walletSearch.toLowerCase())
  )
  const totalWalletBalance = wallets.reduce((s, w) => s + w.balance, 0)

  function handleWalletAdjust() {
    if (!walletForm.wallet_id || !walletForm.amount || !walletForm.reason) {
      toast.error('Please fill all fields')
      return
    }
    const amt = Number(walletForm.amount)
    const wallet = wallets.find(w => w.id === walletForm.wallet_id)
    if (!wallet) return
    if (walletForm.type === 'debit' && wallet.balance < amt) {
      toast.error('Insufficient balance')
      return
    }
    setWallets(prev => prev.map(w =>
      w.id === walletForm.wallet_id
        ? { ...w, balance: walletForm.type === 'credit' ? w.balance + amt : w.balance - amt }
        : w
    ))
    toast.success(`₹${amt.toLocaleString('en-IN')} ${walletForm.type === 'credit' ? 'credited to' : 'debited from'} ${wallet.name}'s wallet`)
    setWalletOpen(false)
    setWalletForm({ wallet_id: '', type: 'credit', amount: '', reason: '' })
  }

  return (
    <div className="space-y-6">

      {/* ── HEADER ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Associate Portal</h1>
          <p className="text-sm text-muted-foreground">Welcome, Associate &middot; May 2026</p>
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

      {/* ── SUMMARY CARDS ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-xl border bg-white p-4 space-y-1">
          <p className="text-xs text-muted-foreground font-medium">Total Collected</p>
          <p className="text-lg font-bold text-blue-700">{fmt(3280000)}</p>
          <p className="text-[10px] text-muted-foreground">All time</p>
        </div>
        <div className="rounded-xl border bg-white p-4 space-y-1">
          <p className="text-xs text-muted-foreground font-medium">Income This Month</p>
          <p className="text-lg font-bold text-green-700">{fmt(220000)}</p>
          <div className="flex items-center gap-1 text-green-500 text-[10px]">
            <TrendingUp className="w-3 h-3" /> May 2026
          </div>
        </div>
        <div className="rounded-xl border bg-white p-4 space-y-1">
          <p className="text-xs text-muted-foreground font-medium">Expenses This Month</p>
          <p className="text-lg font-bold text-red-600">{fmt(85000)}</p>
          <div className="flex items-center gap-1 text-red-400 text-[10px]">
            <TrendingDown className="w-3 h-3" /> May 2026
          </div>
        </div>
        <div className="rounded-xl border bg-white p-4 space-y-1">
          <p className="text-xs text-muted-foreground font-medium">Net Profit</p>
          <p className="text-lg font-bold text-green-700">{fmt(135000)}</p>
          <p className="text-[10px] font-medium text-green-500">Profit</p>
        </div>
        <div className="rounded-xl border bg-white p-4 space-y-1">
          <p className="text-xs text-muted-foreground font-medium">Outstanding Fees</p>
          <p className="text-lg font-bold text-amber-600">{fmt(130000)}</p>
          <p className="text-[10px] text-muted-foreground">Pending from students</p>
        </div>
        <div className="rounded-xl border bg-white p-4 space-y-1">
          <p className="text-xs text-muted-foreground font-medium">Pending Approvals</p>
          <p className="text-lg font-bold text-amber-600">3</p>
          <Link href="/finance/expenses" className="text-[10px] text-blue-500 hover:underline flex items-center gap-0.5">
            View expenses <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {/* ── TABS ── */}
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
              {(['all', 'paid', 'partial', 'unpaid'] as const).map(f => (
                <Button key={f} size="sm"
                  variant={feeFilter === f ? 'default' : 'outline'}
                  className="h-8 text-xs capitalize"
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
                  <th className="text-right px-4 py-3 font-semibold text-slate-600">Total Fee</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600">Paid</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600">Pending</th>
                  <th className="text-center px-4 py-3 font-semibold text-slate-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredStudents.length === 0
                  ? <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">No students found</td></tr>
                  : filteredStudents.map(s => {
                    const pending = Math.max(0, s.total - s.paid)
                    return (
                      <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 font-medium text-gray-900">{s.name}</td>
                        <td className="px-4 py-3 text-slate-500 text-xs hidden sm:table-cell font-mono">{s.enroll}</td>
                        <td className="px-4 py-3 text-slate-600 hidden md:table-cell">{s.course}</td>
                        <td className="px-4 py-3 text-right font-mono text-slate-700">{fmt(s.total)}</td>
                        <td className="px-4 py-3 text-right font-mono font-semibold text-green-700">{s.paid > 0 ? fmt(s.paid) : '—'}</td>
                        <td className="px-4 py-3 text-right font-mono font-semibold text-red-600">{pending > 0 ? fmt(pending) : '—'}</td>
                        <td className="px-4 py-3 text-center">
                          {s.status === 'paid' && (
                            <Badge className="bg-green-100 text-green-800 border-0 text-xs gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Paid
                            </Badge>
                          )}
                          {s.status === 'partial' && (
                            <Badge className="bg-amber-100 text-amber-800 border-0 text-xs gap-1">
                              <Clock className="w-3 h-3" /> Partial
                            </Badge>
                          )}
                          {s.status === 'unpaid' && (
                            <Badge className="bg-red-100 text-red-800 border-0 text-xs gap-1">
                              <XCircle className="w-3 h-3" /> Unpaid
                            </Badge>
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
          <div>
            <h3 className="font-semibold text-sm text-slate-700 mb-3 flex items-center gap-2">
              <BookOpen className="w-4 h-4" /> Course-wise Fee Collection
            </h3>
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
                  {COURSES.map(c => {
                    const pct = Math.round((c.collected / c.total) * 100)
                    const pending = c.total - c.collected
                    return (
                      <tr key={c.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium">{c.name}</td>
                        <td className="px-4 py-3 text-right text-slate-600">{c.students}</td>
                        <td className="px-4 py-3 text-right font-mono text-slate-700">{fmt(c.total)}</td>
                        <td className="px-4 py-3 text-right font-mono font-semibold text-green-700">{fmt(c.collected)}</td>
                        <td className="px-4 py-3 text-right font-mono font-semibold text-red-600">{pending > 0 ? fmt(pending) : '—'}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-slate-200 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full ${pct >= 80 ? 'bg-green-500' : pct >= 40 ? 'bg-amber-400' : 'bg-red-400'}`}
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
          </div>

          <div>
            <h3 className="font-semibold text-sm text-slate-700 mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4" /> Sessions
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {SESSIONS.map(s => (
                <div key={s.id} className="rounded-xl border bg-white p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{s.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Academic Year</p>
                  </div>
                  <Badge className={`text-xs border-0 ${s.active ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-500'}`}>
                    {s.active ? 'Active' : 'Closed'}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* ── RECENT PAYMENTS ── */}
        <TabsContent value="payments" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Recent payments received</p>
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
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Student</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600">Amount</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 hidden md:table-cell">Mode</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 hidden lg:table-cell">Receipt #</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {PAYMENTS.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{p.date}</td>
                    <td className="px-4 py-3 font-medium">{p.name}</td>
                    <td className="px-4 py-3 text-right font-bold font-mono text-green-700">{fmt(p.amount)}</td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <Badge variant="outline" className="text-xs uppercase">{p.mode}</Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs hidden lg:table-cell">{p.receipt}</td>
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
              <p className="text-sm text-muted-foreground">View and manage counselor wallet balances</p>
            </div>
            <Button size="sm" onClick={() => setWalletOpen(true)} className="gap-1.5">
              <Wallet className="w-4 h-4" /> Manual Adjustment
            </Button>
          </div>

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

          <div className="relative max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input placeholder="Search counselor..." value={walletSearch}
              onChange={e => setWalletSearch(e.target.value)} className="pl-9 h-9" />
          </div>

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
                {filteredWallets.map(w => (
                  <tr key={w.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium">{w.name}</td>
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
                        <Button variant="ghost" size="sm" className="text-green-600 h-7 text-xs"
                          onClick={() => { setWalletForm({ wallet_id: w.id, type: 'credit', amount: '', reason: '' }); setWalletOpen(true) }}>
                          <PlusCircle className="w-3.5 h-3.5 mr-1" />Credit
                        </Button>
                        <Button variant="ghost" size="sm" className="text-red-500 h-7 text-xs"
                          onClick={() => { setWalletForm({ wallet_id: w.id, type: 'debit', amount: '', reason: '' }); setWalletOpen(true) }}>
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

      {/* ── WALLET DIALOG ── */}
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
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                value={walletForm.wallet_id}
                onChange={e => setWalletForm(f => ({ ...f, wallet_id: e.target.value }))}
              >
                <option value="">-- Select --</option>
                {wallets.map(w => (
                  <option key={w.id} value={w.id}>{w.name} (₹{w.balance.toLocaleString('en-IN')})</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Type</Label>
              <select
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                value={walletForm.type}
                onChange={e => setWalletForm(f => ({ ...f, type: e.target.value as 'credit' | 'debit' }))}
              >
                <option value="credit">Credit (Add Money)</option>
                <option value="debit">Debit (Deduct Money)</option>
              </select>
            </div>
            <div>
              <Label>Amount (₹)</Label>
              <Input type="number" min="1" placeholder="0" value={walletForm.amount}
                onChange={e => setWalletForm(f => ({ ...f, amount: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label>Reason</Label>
              <Textarea placeholder="e.g. Incentive for admission..." value={walletForm.reason}
                onChange={e => setWalletForm(f => ({ ...f, reason: e.target.value }))} rows={2} className="mt-1" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setWalletOpen(false)}>Cancel</Button>
              <Button onClick={handleWalletAdjust}
                className={walletForm.type === 'debit' ? 'bg-red-600 hover:bg-red-700' : ''}>
                {walletForm.type === 'credit' ? 'Credit Wallet' : 'Debit Wallet'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
