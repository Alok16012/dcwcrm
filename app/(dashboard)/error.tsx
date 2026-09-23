'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw, RotateCcw } from 'lucide-react'

/**
 * Error boundary for every dashboard page. Without it a crash shows Next's
 * bare "Application error: a client-side exception has occurred" with no
 * clue why — this keeps the sidebar, offers a retry, and prints the actual
 * message so a screenshot is enough to find the bug.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Dashboard page crashed:', error)
  }, [error])

  // The first frames of the stack point at the component that threw
  const where = (error.stack ?? '')
    .split('\n')
    .slice(1, 4)
    .map(l => l.trim())
    .join('\n')

  return (
    <div className="max-w-xl mx-auto mt-16 bg-white border border-red-200 rounded-2xl p-6 space-y-4">
      <div className="flex items-center gap-2 text-red-700">
        <AlertTriangle className="w-5 h-5" />
        <h2 className="font-bold">Ye page load nahi ho paya</h2>
      </div>

      <p className="text-sm text-gray-600">
        Neeche ka error ka screenshot bhej do — isi se asli wajah pata chalegi.
      </p>

      <div className="rounded-lg bg-red-50 border border-red-100 p-3 text-xs font-mono text-red-800 break-words whitespace-pre-wrap">
        {error.message || 'Unknown error'}
        {error.digest ? `\n\ndigest: ${error.digest}` : ''}
        {where ? `\n\n${where}` : ''}
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => reset()}
          className="flex items-center gap-1.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg px-4 py-2"
        >
          <RotateCcw className="w-4 h-4" /> Try again
        </button>
        <button
          onClick={() => window.location.reload()}
          className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 border border-gray-200 hover:bg-gray-50 rounded-lg px-4 py-2"
        >
          <RefreshCw className="w-4 h-4" /> Reload page
        </button>
      </div>
    </div>
  )
}
