import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BookOpen, FileText, Video, Radio, Download, Book, ExternalLink, Monitor, ChevronRight } from 'lucide-react'

const TYPE_META: Record<string, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  ebook:          { label: 'E-Books',          icon: Book,      color: 'text-blue-600',   bg: 'bg-blue-50' },
  pdf_notes:      { label: 'PDF Notes',        icon: FileText,  color: 'text-blue-600', bg: 'bg-blue-50' },
  syllabus:       { label: 'Syllabus',         icon: BookOpen,  color: 'text-green-600',  bg: 'bg-green-50' },
  recorded_class: { label: 'Recorded Classes', icon: Video,     color: 'text-orange-600', bg: 'bg-orange-50' },
  live_class:     { label: 'Live Classes',     icon: Radio,     color: 'text-red-600',    bg: 'bg-red-50' },
  other:          { label: 'Other',            icon: FileText,  color: 'text-gray-600',   bg: 'bg-gray-50' },
}

export default async function MaterialsPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/student/login')

  const { data: student } = await supabase
    .from('students')
    .select('id, course_id, sub_course_id')
    .eq('portal_user_id', user.id)
    .single()

  if (!student) redirect('/student/login')

  const s = student as { id: string; course_id: string | null; sub_course_id: string | null }

  type Material = { id: string; title: string; description: string | null; type: string; url: string | null; course: { name: string } | null }
  const { data: materials } = await (supabase as any)
    .from('study_materials')
    .select('id, title, description, type, url, course:courses(name)')
    .eq('is_active', true)
    .order('type')
    .order('title') as { data: Material[] | null }

  const grouped: Record<string, Material[]> = {}
  for (const m of materials ?? []) {
    if (!grouped[m.type]) grouped[m.type] = []
    grouped[m.type]!.push(m)
  }

  const typeOrder = ['syllabus', 'ebook', 'pdf_notes', 'recorded_class', 'live_class', 'other']

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Study Materials & Classes</h1>
        <p className="text-sm text-gray-500 mt-0.5">Access your e-books, notes, syllabus, and classes</p>
      </div>

      {/* BOSSE LMS Card */}
      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-5 text-white overflow-hidden relative">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '18px 18px' }} />
        <div className="relative">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Monitor className="h-5 w-5 text-blue-200" />
                <p className="text-xs font-bold uppercase tracking-widest text-blue-200">BOSSE Online Portal</p>
              </div>
              <h2 className="text-xl font-extrabold leading-tight">BOSSE LMS</h2>
              <p className="text-sm text-blue-200 mt-1">Board of Open Schooling & Skill Education — Access your study material, admit card and results online.</p>
            </div>
            <a
              href="https://www.bosseonline.in"
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 flex items-center gap-1.5 bg-white text-blue-700 font-bold text-xs px-4 py-2 rounded-xl hover:bg-blue-50 transition-colors mt-1"
            >
              Open LMS <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>

          {/* Login Steps */}
          <div className="mt-4 bg-white/10 backdrop-blur-sm rounded-xl p-4">
            <p className="text-xs font-bold text-blue-100 uppercase tracking-wide mb-3">How to Login</p>
            <div className="space-y-2">
              {[
                { step: '1', text: 'Go to bosseonline.in and click "Student Login"' },
                { step: '2', text: 'Enter your Enrollment Number (e.g. DCW-873254) as User ID' },
                { step: '3', text: 'Enter your Date of Birth (DD/MM/YYYY) as password' },
                { step: '4', text: 'Access study material, admit card, results & more' },
              ].map(({ step, text }) => (
                <div key={step} className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-[10px] font-bold text-white">{step}</span>
                  </div>
                  <p className="text-xs text-blue-100 leading-relaxed">{text}</p>
                </div>
              ))}
            </div>
          </div>

          <a
            href="https://www.bosseonline.in"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 flex items-center gap-1 text-xs text-blue-200 hover:text-white transition-colors font-medium"
          >
            www.bosseonline.in <ChevronRight className="h-3 w-3" />
          </a>
        </div>
      </div>

      {/* Category pills */}
      <div className="flex flex-wrap gap-2">
        {typeOrder.map(type => {
          const meta = TYPE_META[type]!
          const count = grouped[type]?.length ?? 0
          if (!count) return null
          const Icon = meta.icon
          return (
            <div key={type} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${meta.bg} ${meta.color}`}>
              <Icon className="h-3.5 w-3.5" />
              {meta.label} ({count})
            </div>
          )
        })}
      </div>

      {typeOrder.every(t => !grouped[t]?.length) ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center shadow-sm">
          <BookOpen className="h-10 w-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No study materials available yet</p>
          <p className="text-sm text-gray-400 mt-1">Materials will appear here once uploaded by your institution.</p>
        </div>
      ) : (
        typeOrder.map(type => {
          const items = grouped[type]
          if (!items?.length) return null
          const meta = TYPE_META[type]!
          const Icon = meta.icon
          return (
            <div key={type} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className={`px-5 py-3 flex items-center gap-2 border-b border-gray-50 ${meta.bg}`}>
                <Icon className={`h-4.5 w-4.5 ${meta.color}`} />
                <h2 className={`font-semibold text-sm ${meta.color}`}>{meta.label}</h2>
                <span className="ml-auto text-xs text-gray-500">{items.length} items</span>
              </div>
              <div className="divide-y divide-gray-50">
                {items.map(m => (
                  <div key={m.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors">
                    <div className={`w-9 h-9 ${meta.bg} rounded-xl flex items-center justify-center shrink-0`}>
                      <Icon className={`h-4 w-4 ${meta.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800">{m.title}</p>
                      {m.description && <p className="text-xs text-gray-400 truncate">{m.description}</p>}
                      {(m.course as { name: string } | null)?.name && (
                        <p className="text-xs text-blue-500 mt-0.5">{(m.course as { name: string }).name}</p>
                      )}
                    </div>
                    {m.url && (
                      <a
                        href={m.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg ${meta.bg} ${meta.color} hover:opacity-80 transition-opacity shrink-0`}
                      >
                        {type === 'live_class' ? (
                          <><Radio className="h-3 w-3" /> Join</>
                        ) : type === 'recorded_class' ? (
                          <><Video className="h-3 w-3" /> Watch</>
                        ) : (
                          <><Download className="h-3 w-3" /> Download</>
                        )}
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        })
      )}

      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
        <p className="text-xs font-semibold text-blue-800 mb-1">📚 Study Tips</p>
        <p className="text-xs text-blue-700">
          Download your syllabus first to understand the course structure. Check for live class schedules regularly and join on time for maximum benefit.
        </p>
      </div>
    </div>
  )
}
