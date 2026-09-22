'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  FileText, Download, Search, BookOpen, GraduationCap,
  Image, Video, FileImage, Folder, ExternalLink, Filter, Eye, Loader2,
} from 'lucide-react'
import { Input } from '@/components/ui/input'

type ResourceType = 'prospectus' | 'pamphlet' | 'brochure' | 'fee_structure' | 'admission_form' | 'marketing' | 'poster' | 'reel' | 'training' | 'other'

const RESOURCE_TYPE_CFG: Record<ResourceType | string, { label: string; icon: any; color: string; bg: string }> = {
  prospectus:     { label: 'College Prospectus', icon: BookOpen,    color: 'text-blue-600',    bg: 'bg-blue-50' },
  pamphlet:       { label: 'Pamphlet',         icon: FileImage,     color: 'text-violet-600',  bg: 'bg-violet-50' },
  brochure:       { label: 'Brochure',         icon: BookOpen,      color: 'text-blue-600',    bg: 'bg-blue-50' },
  fee_structure:  { label: 'Fee Structure',    icon: FileText,      color: 'text-emerald-600', bg: 'bg-emerald-50' },
  admission_form: { label: 'Admission Form',   icon: GraduationCap, color: 'text-indigo-600',  bg: 'bg-indigo-50' },
  marketing:      { label: 'Marketing',        icon: FileImage,     color: 'text-blue-600',  bg: 'bg-blue-50' },
  poster:         { label: 'Poster',           icon: Image,         color: 'text-pink-600',    bg: 'bg-pink-50' },
  reel:           { label: 'Reel / Creative',  icon: Video,         color: 'text-orange-600',  bg: 'bg-orange-50' },
  training:       { label: 'Training',         icon: Folder,        color: 'text-amber-600',   bg: 'bg-amber-50' },
  other:          { label: 'Other',            icon: FileText,      color: 'text-gray-600',    bg: 'bg-gray-100' },
}

interface Resource {
  id: string
  title: string
  description: string | null
  type: string
  url: string
  file_size: string | null
  department: string | null
  created_at: string
}

export default function AssociateResourcesPage() {
  const supabase = createClient()
  const db = supabase as any
  const [resources, setResources] = useState<Resource[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterDept, setFilterDept] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await db.from('associate_resources')
      .select('id, title, description, type, url, file_size, department, created_at')
      .eq('is_active', true)
      .order('type')
      .order('title')
    setResources((data ?? []) as Resource[])
    setLoading(false)
  }, [db])

  useEffect(() => { load() }, [load])

  const filtered = resources.filter(r => {
    const matchSearch = !search || r.title.toLowerCase().includes(search.toLowerCase()) || r.description?.toLowerCase().includes(search.toLowerCase())
    const matchType = !filterType || r.type === filterType
    const matchDept = !filterDept || (r.department ?? '') === filterDept
    return matchSearch && matchType && matchDept
  })

  // Group by type
  const grouped = filtered.reduce((acc, r) => {
    const key = r.type || 'other'
    if (!acc[key]) acc[key] = []
    acc[key].push(r)
    return acc
  }, {} as Record<string, Resource[]>)

  const availableTypes = [...new Set(resources.map(r => r.type))].filter(Boolean)
  const availableDepts = [...new Set(resources.map(r => r.department).filter(Boolean))].sort() as string[]

  return (
    <div className="space-y-4 max-w-4xl">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Resources & Downloads</h1>
        <p className="text-sm text-gray-400 mt-0.5">Brochures, fee structures, marketing materials, and more</p>
      </div>

      {/* Search + Filter */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input placeholder="Search resources…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
        </div>
        {availableDepts.length > 0 && (
          <select value={filterDept} onChange={e => setFilterDept(e.target.value)}
            className="border rounded-lg px-2 h-9 text-xs bg-white text-gray-700 min-w-40">
            <option value="">All Departments</option>
            {availableDepts.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        )}
        <div className="flex items-center gap-1.5 flex-wrap">
          <Filter className="w-3.5 h-3.5 text-gray-400" />
          <button
            onClick={() => setFilterType('')}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${!filterType ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            All
          </button>
          {availableTypes.map(type => {
            const cfg = RESOURCE_TYPE_CFG[type] ?? RESOURCE_TYPE_CFG['other']!
            return (
              <button
                key={type}
                onClick={() => setFilterType(f => f === type ? '' : type)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${filterType === type ? `${cfg.color} ${cfg.bg} border-current` : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
              >
                {cfg.label}
              </button>
            )
          })}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-7 h-7 border-4 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 border rounded-2xl bg-white">
          <Folder className="w-10 h-10 mx-auto mb-3 text-gray-200" />
          <p className="font-semibold text-gray-500">{resources.length === 0 ? 'No resources available yet' : 'No matches found'}</p>
          <p className="text-xs text-gray-400 mt-1">Materials will be added by the admin team</p>
        </div>
      ) : (
        <div className="space-y-5">
          {Object.entries(grouped).map(([type, items]) => {
            const cfg = RESOURCE_TYPE_CFG[type] ?? RESOURCE_TYPE_CFG['other']!
            const Icon = cfg.icon
            return (
              <div key={type}>
                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-7 h-7 ${cfg.bg} rounded-lg flex items-center justify-center`}>
                    <Icon className={`w-3.5 h-3.5 ${cfg.color}`} />
                  </div>
                  <h3 className="font-bold text-gray-800 text-sm">{cfg.label}</h3>
                  <span className="text-xs text-gray-400 font-medium">{items.length} file{items.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {items.map(r => (
                    <ResourceCard key={r.id} resource={r} cfg={cfg} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ResourceCard({ resource: r, cfg }: { resource: Resource; cfg: { icon: any; color: string; bg: string; label: string } }) {
  const Icon = cfg.icon
  const [busy, setBusy] = useState(false)

  // The file lives on another origin, so <a download> would just open it —
  // fetch the bytes and save them under the resource's own name instead.
  async function download() {
    setBusy(true)
    try {
      const res = await fetch(r.url)
      const blob = await res.blob()
      const ext = (r.url.split('?')[0].split('.').pop() ?? 'pdf').slice(0, 5)
      const href = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = href
      a.download = `${r.title.replace(/[^\w-]+/g, '_')}.${ext}`
      a.click()
      setTimeout(() => URL.revokeObjectURL(href), 1000)
    } catch {
      window.open(r.url, '_blank', 'noopener')
    } finally {
      setBusy(false)
    }
  }
  const isPdf = r.url?.toLowerCase().includes('.pdf') || r.url?.toLowerCase().includes('pdf')
  const isImage = /\.(jpg|jpeg|png|webp|gif)/.test(r.url?.toLowerCase() ?? '')
  const isVideo = /\.(mp4|mov|avi|webm)/.test(r.url?.toLowerCase() ?? '') || r.url?.includes('youtube') || r.url?.includes('vimeo')

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4 hover:shadow-sm transition-all group">
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 ${cfg.bg} rounded-lg flex items-center justify-center shrink-0 mt-0.5`}>
          <Icon className={`w-4 h-4 ${cfg.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 text-sm leading-tight truncate">{r.title}</p>
          {r.description && <p className="text-xs text-gray-400 mt-0.5 line-clamp-2 leading-relaxed">{r.description}</p>}
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {r.department && (
              <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded-full">{r.department}</span>
            )}
            {r.file_size && <span className="text-[10px] text-gray-400 font-medium">{r.file_size}</span>}
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-1.5">
          <a
            href={r.url}
            target="_blank"
            rel="noopener noreferrer"
            title={isVideo ? 'Open' : 'Preview'}
            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
              isVideo ? 'text-orange-600 bg-orange-50 hover:bg-orange-100' : 'text-gray-600 bg-gray-100 hover:bg-gray-200'
            }`}
          >
            {isVideo ? <ExternalLink className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
            {isVideo ? 'Open' : 'Preview'}
          </a>
          {!isVideo && (
            <button
              type="button"
              onClick={download}
              disabled={busy}
              title="Download"
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg text-blue-600 bg-blue-50 hover:bg-blue-100 disabled:opacity-60"
            >
              {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
              Download
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
