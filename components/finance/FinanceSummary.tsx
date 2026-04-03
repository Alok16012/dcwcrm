'use client'

import { StatCard } from '@/components/shared/StatCard'

interface FinanceSummaryProps {
  totalIncomeThisMonth: number
  totalExpensesThisMonth: number
  outstandingReceivables: number
  pendingExpenseCount: number
  totalIncomeEver: number
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)

export default function FinanceSummary({
  totalIncomeThisMonth,
  totalExpensesThisMonth,
  outstandingReceivables,
  pendingExpenseCount,
  totalIncomeEver,
}: FinanceSummaryProps) {
  const netProfitLoss = totalIncomeThisMonth - totalExpensesThisMonth

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
      <StatCard label="Total Fee Collected" value={fmt(totalIncomeEver)} color="blue" />
      <StatCard label="Income This Month" value={fmt(totalIncomeThisMonth)} color="green" />
      <StatCard label="Expenses This Month" value={fmt(totalExpensesThisMonth)} color="red" />
      <StatCard
        label="Net Profit / Loss"
        value={fmt(netProfitLoss)}
        color={netProfitLoss >= 0 ? 'green' : 'red'}
        sub={netProfitLoss >= 0 ? 'Profit' : 'Loss'}
      />
      <StatCard label="Outstanding Receivables" value={fmt(outstandingReceivables)} color="amber" />
      <StatCard label="Pending Approvals" value={pendingExpenseCount} color={pendingExpenseCount > 0 ? 'amber' : 'default'} />
    </div>
  )
}
