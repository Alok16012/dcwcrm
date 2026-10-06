import type { SupabaseClient } from '@supabase/supabase-js'
import { Video, FileText, AlignLeft, Link2, ClipboardCheck } from 'lucide-react'

/**
 * The lms_* tables (migration 115) aren't in the generated Database types yet.
 * Route LMS queries through an untyped client instead of sprinkling `as any`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lmsDb(supabase: unknown): SupabaseClient<any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return supabase as SupabaseClient<any>
}

export const LMS_BUCKET = 'lms-content'

export type CourseStatus = 'draft' | 'published' | 'archived'
export type LessonType = 'video' | 'pdf' | 'text' | 'link' | 'test'

export interface LmsCourse {
  id: string
  title: string
  description: string
  thumbnail_url: string | null
  crm_course_id: string | null
  crm_sub_course_id: string | null
  auto_enroll: boolean
  status: CourseStatus
  sort_order: number
  created_at: string
}

export interface LmsModule {
  id: string
  course_id: string
  title: string
  description: string
  sort_order: number
}

export interface LmsLesson {
  id: string
  module_id: string
  course_id: string
  title: string
  type: LessonType
  video_url: string | null
  file_url: string | null
  body: string
  test_id: string | null
  duration_min: number
  is_published: boolean
  sort_order: number
}

export interface LmsTest {
  id: string
  course_id: string
  title: string
  description: string
  duration_min: number
  pass_percent: number
  negative_marks: number
  max_attempts: number
  status: 'draft' | 'published'
  created_at: string
}

export interface LmsQuestion {
  id: string
  test_id: string
  question: string
  opt_a: string
  opt_b: string
  opt_c: string
  opt_d: string
  correct: 'a' | 'b' | 'c' | 'd'
  marks: number
  explanation: string
  sort_order: number
}

export interface LmsLiveClass {
  id: string
  course_id: string
  title: string
  description: string
  start_at: string
  duration_min: number
  join_url: string | null
  recording_url: string | null
  status: 'scheduled' | 'completed' | 'cancelled'
}

export interface LmsAnnouncement {
  id: string
  course_id: string | null
  title: string
  body: string
  created_at: string
}

export interface LmsAttempt {
  id: string
  test_id: string
  student_id: string
  score: number
  total: number
  correct_cnt: number
  wrong_cnt: number
  unattempted: number
  passed: boolean
  started_at: string | null
  submitted_at: string
}

export const LESSON_TYPES: Record<LessonType, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  video: { label: 'Video',      icon: Video,          color: 'text-red-600',     bg: 'bg-red-50' },
  pdf:   { label: 'PDF / File', icon: FileText,       color: 'text-blue-600',    bg: 'bg-blue-50' },
  text:  { label: 'Notes',      icon: AlignLeft,      color: 'text-emerald-600', bg: 'bg-emerald-50' },
  link:  { label: 'Link',       icon: Link2,          color: 'text-violet-600',  bg: 'bg-violet-50' },
  test:  { label: 'Test',       icon: ClipboardCheck, color: 'text-amber-600',   bg: 'bg-amber-50' },
}

export const STATUS_BADGE: Record<CourseStatus, string> = {
  draft: 'bg-gray-100 text-gray-600',
  published: 'bg-emerald-100 text-emerald-700',
  archived: 'bg-amber-100 text-amber-700',
}

/** Embeddable player URL for YouTube / Vimeo / Google Drive links; null for anything else. */
export function videoEmbedUrl(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    const u = new URL(url.trim())
    const host = u.hostname.replace(/^www\.|^m\./, '')
    if (host === 'youtu.be') return `https://www.youtube.com/embed/${u.pathname.slice(1)}`
    if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      if (u.pathname === '/watch' && u.searchParams.get('v')) return `https://www.youtube.com/embed/${u.searchParams.get('v')}`
      const m = u.pathname.match(/^\/(embed|shorts|live)\/([^/?]+)/)
      if (m) return `https://www.youtube.com/embed/${m[2]}`
    }
    if (host === 'vimeo.com') {
      const id = u.pathname.split('/').filter(Boolean)[0]
      if (id && /^\d+$/.test(id)) return `https://player.vimeo.com/video/${id}`
    }
    if (host === 'player.vimeo.com') return url
    if (host === 'drive.google.com') {
      const m = u.pathname.match(/\/file\/d\/([^/]+)/)
      if (m) return `https://drive.google.com/file/d/${m[1]}/preview`
    }
  } catch {
    return null
  }
  return null
}

/** True when the URL points straight at a video file the <video> tag can play. */
export function isDirectVideo(url: string | null | undefined): boolean {
  return !!url && /\.(mp4|webm|ogg|mov)(\?|$)/i.test(url)
}

export function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

/** "YYYY-MM-DDTHH:mm" for a datetime-local input, in IST. */
export function toIstInput(iso: string): string {
  const d = new Date(new Date(iso).getTime() + 330 * 60_000)
  return d.toISOString().slice(0, 16)
}

/** A datetime-local value (entered as IST) → UTC ISO string. */
export function istInputToIso(value: string): string {
  return new Date(`${value}:00+05:30`).toISOString()
}

export function pct(done: number, total: number): number {
  return total > 0 ? Math.round((done / total) * 100) : 0
}
