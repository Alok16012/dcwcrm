import { cn } from '@/lib/utils'

interface StatCardProps {
  label: string
  value: string | number
  sub?: string
  color?: 'default' | 'green' | 'amber' | 'red' | 'blue'
}

const colorMap = {
  default: 'border-l-4 border-gray-400 bg-white',
  green: 'border-l-4 border-green-500 bg-white',
  amber: 'border-l-4 border-amber-500 bg-white',
  red: 'border-l-4 border-red-500 bg-white',
  blue: 'border-l-4 border-blue-500 bg-white',
}

const valueColorMap = {
  default: 'text-gray-900',
  green: 'text-green-700',
  amber: 'text-amber-700',
  red: 'text-red-700',
  blue: 'text-blue-700',
}

export function StatCard({ label, value, sub, color = 'default' }: StatCardProps) {
  return (
    <div className={cn('rounded-lg p-4 shadow-sm', colorMap[color])}>
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className={cn('mt-1 text-2xl font-bold', valueColorMap[color])}>{value}</p>
      {sub && <p className="mt-1 text-xs text-gray-400">{sub}</p>}
    </div>
  )
}
