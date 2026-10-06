import { cn } from '@/lib/utils'

export const inputCls =
  'w-full rounded-lg border border-gray-200 bg-white px-3 h-9 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:bg-gray-50'
export const textareaCls =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'

export function Field({ label, hint, className, children }: {
  label: string; hint?: string; className?: string; children: React.ReactNode
}) {
  return (
    <label className={cn('block', className)}>
      <span className="block text-xs font-medium text-gray-600 mb-1">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-gray-400 mt-1">{hint}</span>}
    </label>
  )
}

export function EmptyState({ icon: Icon, title, hint, action }: {
  icon: React.ElementType; title: string; hint?: string; action?: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-xl border border-dashed border-gray-200 p-10 text-center">
      <Icon className="h-9 w-9 text-gray-300 mx-auto mb-3" />
      <p className="text-gray-600 font-medium">{title}</p>
      {hint && <p className="text-sm text-gray-400 mt-1">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
