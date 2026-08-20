'use client'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Search, X } from 'lucide-react'

interface LeadOption { id: string; full_name: string; phone: string }

interface LeadPickerProps {
  value: LeadOption | null
  onChange: (lead: LeadOption | null) => void
}

// A plain debounced search + dropdown, not a Popover/Command combobox — the
// leads table is unbounded so it can't be preloaded like the small,
// bounded counselor/host lists elsewhere in this app, but this codebase has
// no proven Popover-based combobox anywhere yet, so a plain list (same
// setTimeout-debounce idiom as LeadTable.tsx's search box) keeps this on
// tested ground instead of being the first place that pattern is tried.
export function LeadPicker({ value, onChange }: LeadPickerProps) {
  const supabase = createClient()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<LeadOption[]>([])
  const [open, setOpen] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    const t = setTimeout(() => {
      supabase
        .from('leads')
        .select('id, full_name, phone')
        .or(`full_name.ilike.%${query.trim()}%,phone.ilike.%${query.trim()}%`)
        .order('created_at', { ascending: false })
        .limit(15)
        .then(({ data }) => setResults((data ?? []) as LeadOption[]))
    }, 300)
    return () => clearTimeout(t)
  }, [query]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  if (value) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
        <div>
          <p className="text-sm font-medium text-gray-900">{value.full_name}</p>
          <p className="text-xs text-gray-500">{value.phone}</p>
        </div>
        <button type="button" onClick={() => onChange(null)} className="text-gray-400 hover:text-gray-600">
          <X className="w-4 h-4" />
        </button>
      </div>
    )
  }

  return (
    <div ref={boxRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder="Search lead by name or phone…"
          className="pl-9"
        />
      </div>
      {open && query.trim() && (
        <div className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg">
          {results.length === 0 ? (
            <p className="px-3 py-2 text-sm text-gray-400">No leads found</p>
          ) : (
            results.map((lead) => (
              <button
                key={lead.id}
                type="button"
                onClick={() => { onChange(lead); setQuery(''); setOpen(false) }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 border-b border-gray-50 last:border-0"
              >
                <p className="font-medium text-gray-900">{lead.full_name}</p>
                <p className="text-xs text-gray-500">{lead.phone}</p>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
