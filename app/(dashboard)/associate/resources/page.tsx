'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  FileText, Download, Search, BookOpen, GraduationCap,
  Image, Video, FileImage, Folder, ExternalLink, Filter,
} from 'lucide-react'
import { Input } from '@/components/ui/input'

type ResourceType = 'brochure' | 'fee_structure' | 'admission_form' | 'marketing' | 'poster' | 'reel' | 'training' | 'other'

const RESOURCE_TYPE_CFG: Record<ResourceType | string, { label: string; icon: any; color: string; bg: string }> = {
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
  created_at: string
}

export default function AssociateResourcesPage() {
  const supabase = createClient()
  const db = supabase as any
  const [resources, setResources] = useState<Resource[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await db.from('associate_resources')
      .select('id, title, description, type, url, file_size, created_at')
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
    return matchSearch && matchType
  })

  // Group by type
  const grouped = filtered.reduce((acc, r) => {
    const key = r.type || 'other'
    if (!acc[key]) acc[key] = []
    acc[key].push(r)
    return acc
  }, {} as Record<string, Resource[]>)

  const availableTypes = [...new Set(resources.map(r => r.type))].filter(Boolean)

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
          {r.file_size && <p className="text-[10px] text-gray-400 mt-1 font-medium">{r.file_size}</p>}
        </div>
        <a
          href={r.url}
          target="_blank"
          rel="noopener noreferrer"
          className={`shrink-0 flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
            isVideo
              ? 'text-orange-600 bg-orange-50 hover:bg-orange-100'
              : 'text-blue-600 bg-blue-50 hover:bg-blue-100'
          }`}
        >
          {isVideo ? <ExternalLink className="w-3 h-3" /> : <Download className="w-3 h-3" />}
          {isVideo ? 'View' : 'Download'}
        </a>
      </div>
    </div>
  )
}
