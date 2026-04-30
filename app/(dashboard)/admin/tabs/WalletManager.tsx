'use client'
import { useState } from 'react'
import { Wallet, PlusCircle, MinusCircle, History, TrendingUp, TrendingDown, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

interface WalletEntry {
  id: string
  user_id: string
  user_name: string
  role: string
  balance: number
  last_updated: string
}

interface Transaction {
  id: string
  wallet_id: string
  user_name: string
  type: 'credit' | 'debit'
  amount: number
  description: string
  created_at: string
}

interface Props {
  counsellors: { id: string; full_name: string; role: string }[]
}

const SAMPLE_WALLETS: WalletEntry[] = [
  { id: 'w1', user_id: 'u1', user_name: 'Rajesh Kumar', role: 'Counselor', balance: 3500, last_updated: '2026-04-20' },
  { id: 'w2', user_id: 'u2', user_name: 'Sunita Sharma', role: 'Counselor', balance: 8200, last_updated: '2026-04-19' },
  { id: 'w3', user_id: 'u3', user_name: 'Amit Singh', role: 'Lead', balance: 1200, last_updated: '2026-04-18' },
  { id: 'w4', user_id: 'u4', user_name: 'Meera Patel', role: 'Counselor', balance: 0, last_updated: '2026-04-15' },
]

const SAMPLE_TRANSACTIONS: Transaction[] = [
  { id: 't1', wallet_id: 'w1', user_name: 'Rajesh Kumar', type: 'credit', amount: 2000, description: 'Wallet recharge', created_at: '2026-04-20 14:30' },
  { id: 't2', wallet_id: 'w2', user_name: 'Sunita Sharma', type: 'credit', amount: 5000, description: 'Incentive credited — BBA Premium admission', created_at: '2026-04-19 11:20' },
  { id: 't3', wallet_id: 'w1', user_name: 'Rajesh Kumar', type: 'debit', amount: 500, description: 'Admission payment — Rahul Sharma', created_at: '2026-04-18 16:45' },
  { id: 't4', wallet_id: 'w3', user_name: 'Amit Singh', type: 'credit', amount: 1200, description: 'Manual credit — Refund adjustment', created_at: '2026-04-18 10:00' },
]

export function WalletManager({ counsellors }: Props) {
  const [wallets, setWallets] = useState<WalletEntry[]>(() => {
    if (counsellors.length > 0) {
      return counsellors.slice(0, 4).map((c, i) => SAMPLE_WALLETS[i] ? { ...SAMPLE_WALLETS[i], user_id: c.id, user_name: c.full_name } : { id: Date.now().toString() + i, user_id: c.id, user_name: c.full_name, role: c.role, balance: 0, last_updated: new Date().toISOString().split('T')[0] })
    }
    return SAMPLE_WALLETS
  })
  const [transactions, setTransactions] = useState<Transaction[]>(SAMPLE_TRANSACTIONS)
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [form, setForm] = useState({ wallet_id: '', type: 'credit' as 'credit' | 'debit', amount: '', reason: '' })

  function handleAdjust() {
    if (!form.wallet_id || !form.amount || !form.reason) { toast.error('Fill all fields'); return }
    const amt = Number(form.amount)
    const wallet = wallets.find(w => w.id === form.wallet_id)
    if (!wallet) return
    if (form.type === 'debit' && wallet.balance < amt) { toast.error('Insufficient wallet balance'); return }
    setWallets(prev => prev.map(w => w.id === form.wallet_id ? { ...w, balance: form.type === 'credit' ? w.balance + amt : w.balance - amt, last_updated: new Date().toISOString().split('T')[0] } : w))
    setTransactions(prev => [{
      id: Date.now().toString(), wallet_id: form.wallet_id, user_name: wallet.user_name,
      type: form.type, amount: amt, description: `Manual ${form.type} — ${form.reason}`, created_at: new Date().toLocaleString('en-IN'),
    }, ...prev])
    toast.success(`₹${amt.toLocaleString('en-IN')} ${form.type === 'credit' ? 'credited to' : 'debited from'} ${wallet.user_name}'s wallet`)
    setOpen(false)
    setForm({ wallet_id: '', type: 'credit', amount: '', reason: '' })
  }

  const filtered = wallets.filter(w => w.user_name.toLowerCase().includes(search.toLowerCase()))
  const totalBalance = wallets.reduce((a, w) => a + w.balance, 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Wallet Manager</h2>
          <p className="text-sm text-muted-foreground">View associate/counselor wallets and perform manual credit/debit adjustments.</p>
        </div>
        <Button size="sm" onClick={() => setOpen(true)}><Wallet className="w-4 h-4 mr-1" />Manual Adjustment</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-green-50 border border-green-100 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-green-700">₹{totalBalance.toLocaleString('en-IN')}</p>
          <p className="text-xs text-green-600">Total Wallet Balance</p>
        </div>
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-blue-700">{wallets.filter(w => w.balance > 0).length}</p>
          <p className="text-xs text-blue-600">Active Wallets</p>
        </div>
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-amber-700">{wallets.filter(w => w.balance === 0).length}</p>
          <p className="text-xs text-amber-600">Zero Balance</p>
        </div>
      </div>

      {/* Wallets Table */}
      <div>
        <div className="flex items-center gap-3 mb-3">
          <div className="relative max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input placeholder="Search user..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
          </div>
        </div>
        <div className="rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">User</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Role</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600">Balance</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Last Updated</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map(w => (
                <tr key={w.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium">{w.user_name}</td>
                  <td className="px-4 py-3"><Badge variant="outline" className="text-xs capitalize">{w.role}</Badge></td>
                  <td className="px-4 py-3 text-right">
                    <span className={`font-bold font-mono ${w.balance > 0 ? 'text-green-700' : 'text-slate-400'}`}>₹{w.balance.toLocaleString('en-IN')}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{w.last_updated}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <Button variant="ghost" size="sm" className="text-green-600 h-7 text-xs"
                        onClick={() => { setForm({ wallet_id: w.id, type: 'credit', amount: '', reason: '' }); setOpen(true) }}>
                        <PlusCircle className="w-3.5 h-3.5 mr-1" />Credit
                      </Button>
                      <Button variant="ghost" size="sm" className="text-red-500 h-7 text-xs"
                        onClick={() => { setForm({ wallet_id: w.id, type: 'debit', amount: '', reason: '' }); setOpen(true) }}>
                        <MinusCircle className="w-3.5 h-3.5 mr-1" />Debit
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transaction Ledger */}
      <div>
        <h3 className="font-semibold text-sm flex items-center gap-2 mb-3"><History className="w-4 h-4 text-slate-500" />Recent Transactions</h3>
        <div className="rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">User</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Type</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600">Amount</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Description</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {transactions.map(t => (
                <tr key={t.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium">{t.user_name}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {t.type === 'credit' ? <TrendingUp className="w-3.5 h-3.5 text-green-500" /> : <TrendingDown className="w-3.5 h-3.5 text-red-500" />}
                      <Badge className={`border-0 text-xs ${t.type === 'credit' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{t.type}</Badge>
                    </div>
                  </td>
                  <td className={`px-4 py-3 text-right font-bold font-mono ${t.type === 'credit' ? 'text-green-700' : 'text-red-600'}`}>
                    {t.type === 'credit' ? '+' : '-'}₹{t.amount.toLocaleString('en-IN')}
                  </td>
                  <td className="px-4 py-3 text-slate-600 text-xs">{t.description}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{t.created_at}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Adjustment Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {form.type === 'credit' ? <PlusCircle className="w-4 h-4 text-green-500" /> : <MinusCircle className="w-4 h-4 text-red-500" />}
              Manual Wallet {form.type === 'credit' ? 'Credit' : 'Debit'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>User</Label>
              <Select value={form.wallet_id} onValueChange={v => setForm(f => ({ ...f, wallet_id: v ?? '' }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select user" /></SelectTrigger>
                <SelectContent>{wallets.map(w => <SelectItem key={w.id} value={w.id}>{w.user_name} (₹{w.balance.toLocaleString('en-IN')})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Type</Label>
              <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v as 'credit' | 'debit' }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="credit">Credit (Add Money)</SelectItem>
                  <SelectItem value="debit">Debit (Deduct Money)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Amount (₹)</Label>
              <Input type="number" placeholder="0" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label>Reason</Label>
              <Textarea placeholder="e.g. Refund for cancelled admission" value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} rows={2} className="mt-1" />
            </div>
            <p className="text-xs text-muted-foreground bg-slate-50 rounded p-2">This transaction will be logged in the audit trail with your admin ID and timestamp.</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={handleAdjust} className={form.type === 'debit' ? 'bg-red-600 hover:bg-red-700' : ''}>
                {form.type === 'credit' ? 'Credit Wallet' : 'Debit Wallet'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
