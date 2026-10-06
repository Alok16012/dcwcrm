'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowLeft, CheckCircle2, Circle, ChevronLeft, ChevronRight, ExternalLink, Download, Clock, Trophy, Video, CalendarClock } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  lmsDb, LESSON_TYPES, videoEmbedUrl, isDirectVideo, fmtDateTime, pct,
  type LmsCourse, type LmsLesson, type LmsLiveClass, type LmsModule, type LmsTest,
} from '@/lib/lms/shared'
import { cn } from '@/lib/utils'

export interface AttemptSummary { id: string; test_id: string; score: number; total: number; passed: boolean; submitted_at: string }

export function CoursePlayer({ studentId, course, modules, lessons, completed, currentId, tests, attempts, classes }: {
  studentId: string
  course: LmsCourse
  modules: LmsModule[]
  lessons: LmsLesson[]
  completed: string[]
  currentId: string | null
  tests: LmsTest[]
  attempts: AttemptSummary[]
  classes: LmsLiveClass[]
}) {
  const router = useRouter()
  const [done, setDone] = useState(() => new Set(completed))
  const [saving, setSaving] = useState(false)
  const [now] = useState(() => Date.now())

  const idx = lessons.findIndex(l => l.id === currentId)
  const lesson = idx >= 0 ? lessons[idx]! : null
  const prev = idx > 0 ? lessons[idx - 1] : null
  const next = idx >= 0 && idx < lessons.length - 1 ? lessons[idx + 1] : null
  const progress = pct(lessons.filter(l => done.has(l.id)).length, lessons.length)
  const recordings = classes.filter(c => c.recording_url)
  const upcoming = classes.filter(c => c.status === 'scheduled' && new Date(c.start_at).getTime() + c.duration_min * 60_000 > now)

  async function toggleDone() {
    if (!lesson || lesson.type === 'test') return
    setSaving(true)
    const db = lmsDb(createClient())
    const wasDone = done.has(lesson.id)
    const { error } = wasDone
      ? await db.from('lms_lesson_progress').delete().eq('lesson_id', lesson.id).eq('student_id', studentId)
      : await db.from('lms_lesson_progress').insert({ lesson_id: lesson.id, course_id: course.id, student_id: studentId })
    setSaving(false)
    if (error) { toast.error(error.message); return }
    setDone(d => { const n = new Set(d); if (wasDone) n.delete(lesson.id); else n.add(lesson.id); return n })
    if (!wasDone && next) router.push(`/student/learning/${course.id}?lesson=${next.id}`, { scroll: false })
    else router.refresh()
  }

  return (
    <div className="space-y-4">
      <div>
        <Link href="/student/learning" className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 mb-1">
          <ArrowLeft className="h-3.5 w-3.5" /> My Learning
        </Link>
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <h1 className="text-xl font-bold text-gray-900">{course.title}</h1>
          <div className="flex items-center gap-2 w-48">
            <div className="h-1.5 flex-1 rounded-full bg-gray-100 overflow-hidden">
              <div className={cn('h-full rounded-full', progress === 100 ? 'bg-emerald-500' : 'bg-blue-500')} style={{ width: `${progress}%` }} />
            </div>
            <span className="text-xs font-semibold text-gray-700">{progress}%</span>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        {/* Viewer */}
        <div className="space-y-4 min-w-0">
          {!lesson ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-gray-500">This course has no lessons yet.</div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <LessonContent lesson={lesson} test={tests.find(t => t.id === lesson.test_id) ?? null}
                attempts={attempts.filter(a => a.test_id === lesson.test_id)} />
              <div className="p-4 md:p-5 space-y-3 border-t border-gray-50">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                      {modules.find(m => m.id === lesson.module_id)?.title} · Lesson {idx + 1} of {lessons.length}
                    </p>
                    <h2 className="text-lg font-bold text-gray-900">{lesson.title}</h2>
                  </div>
                  {lesson.type !== 'test' && (
                    <button onClick={toggleDone} disabled={saving}
                      className={cn('inline-flex items-center gap-1.5 rounded-xl px-4 h-9 text-sm font-semibold transition-colors disabled:opacity-60',
                        done.has(lesson.id) ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-blue-600 text-white hover:bg-blue-700')}>
                      <CheckCircle2 className="h-4 w-4" />{done.has(lesson.id) ? 'Completed' : 'Mark as complete'}
                    </button>
                  )}
                </div>
                {lesson.type !== 'text' && lesson.body && <p className="text-sm text-gray-600 whitespace-pre-line">{lesson.body}</p>}
                <div className="flex justify-between pt-2">
                  {prev ? (
                    <Link href={`/student/learning/${course.id}?lesson=${prev.id}`} scroll={false} className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-blue-700">
                      <ChevronLeft className="h-4 w-4" /> Previous
                    </Link>
                  ) : <span />}
                  {next && (
                    <Link href={`/student/learning/${course.id}?lesson=${next.id}`} scroll={false} className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700">
                      Next: <span className="max-w-[180px] truncate">{next.title}</span> <ChevronRight className="h-4 w-4" />
                    </Link>
                  )}
                </div>
              </div>
            </div>
          )}

          {(upcoming.length > 0 || recordings.length > 0) && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
              <p className="px-5 py-3 text-sm font-semibold text-gray-800 flex items-center gap-2"><CalendarClock className="h-4 w-4 text-orange-600" />Live classes</p>
              {[...upcoming].reverse().map(c => (
                <div key={c.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800">{c.title}</p>
                    <p className="text-xs text-gray-500">{fmtDateTime(c.start_at)} · {c.duration_min} min</p>
                  </div>
                  {c.join_url && <a href={c.join_url} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-blue-600 inline-flex items-center gap-1">Join <ExternalLink className="h-3 w-3" /></a>}
                </div>
              ))}
              {recordings.map(c => (
                <div key={c.id} className="flex items-center gap-3 px-5 py-3">
                  <Video className="h-4 w-4 text-emerald-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800">{c.title}</p>
                    <p className="text-xs text-gray-500">Recorded {fmtDateTime(c.start_at)}</p>
                  </div>
                  <a href={c.recording_url!} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-emerald-700 inline-flex items-center gap-1">Watch <ExternalLink className="h-3 w-3" /></a>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Outline */}
        <aside className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden h-fit lg:sticky lg:top-0 lg:max-h-[calc(100vh-140px)] lg:overflow-y-auto">
          {modules.map((m, mi) => {
            const items = lessons.filter(l => l.module_id === m.id)
            if (items.length === 0) return null
            return (
              <div key={m.id}>
                <p className="px-4 py-2.5 bg-gray-50 text-xs font-semibold text-gray-700 border-y border-gray-100 first:border-t-0">
                  {mi + 1}. {m.title}
                  <span className="float-right font-normal text-gray-400">{items.filter(l => done.has(l.id)).length}/{items.length}</span>
                </p>
                {items.map(l => {
                  const meta = LESSON_TYPES[l.type]
                  const active = l.id === lesson?.id
                  return (
                    <Link key={l.id} href={`/student/learning/${course.id}?lesson=${l.id}`} scroll={false}
                      className={cn('flex items-center gap-2.5 px-4 py-2.5 text-sm border-l-2', active ? 'bg-blue-50 border-blue-600' : 'border-transparent hover:bg-gray-50')}>
                      {done.has(l.id)
                        ? <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                        : <Circle className="h-4 w-4 text-gray-300 shrink-0" />}
                      <span className={cn('flex-1 min-w-0 truncate', active ? 'text-blue-700 font-medium' : 'text-gray-700')}>{l.title}</span>
                      <meta.icon className={cn('h-3.5 w-3.5 shrink-0', meta.color)} />
                    </Link>
                  )
                })}
              </div>
            )
          })}
        </aside>
      </div>
    </div>
  )
}

function officeViewer(url: string) {
  return /\.(docx?|pptx?|xlsx?)(\?|$)/i.test(url)
    ? `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`
    : url
}

function LessonContent({ lesson, test, attempts }: { lesson: LmsLesson; test: LmsTest | null; attempts: AttemptSummary[] }) {
  if (lesson.type === 'video' && lesson.video_url) {
    const embed = videoEmbedUrl(lesson.video_url)
    if (embed) {
      return (
        <div className="aspect-video bg-black">
          <iframe src={embed} title={lesson.title} className="h-full w-full" allowFullScreen
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" />
        </div>
      )
    }
    if (isDirectVideo(lesson.video_url)) {
      return <video src={lesson.video_url} controls controlsList="nodownload" className="w-full aspect-video bg-black" />
    }
    return <OpenBox href={lesson.video_url} label="Open video" />
  }

  if (lesson.type === 'pdf' && lesson.file_url) {
    const isImage = /\.(png|jpe?g|gif|webp)(\?|$)/i.test(lesson.file_url)
    return (
      <div>
        {isImage
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={lesson.file_url} alt={lesson.title} className="w-full max-h-[75vh] object-contain bg-gray-50" />
          : <iframe src={officeViewer(lesson.file_url)} title={lesson.title} className="w-full h-[70vh] bg-gray-50" />}
        <div className="flex gap-2 px-4 py-2 bg-gray-50 border-t border-gray-100">
          <a href={lesson.file_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-blue-600"><ExternalLink className="h-3.5 w-3.5" />Open in new tab</a>
          <a href={lesson.file_url} download className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 ml-3"><Download className="h-3.5 w-3.5" />Download</a>
        </div>
      </div>
    )
  }

  if (lesson.type === 'link' && lesson.file_url) return <OpenBox href={lesson.file_url} label="Open resource" />

  if (lesson.type === 'text') {
    return <div className="p-5 md:p-6 text-[15px] leading-relaxed text-gray-800 whitespace-pre-line">{lesson.body}</div>
  }

  if (lesson.type === 'test') {
    if (!test) return <div className="p-8 text-center text-sm text-gray-500">This test isn&apos;t available yet.</div>
    const left = test.max_attempts > 0 ? test.max_attempts - attempts.length : null
    const best = attempts.length ? Math.max(...attempts.map(a => pct(Number(a.score), Number(a.total)))) : null
    return (
      <div className="p-5 md:p-6 bg-gradient-to-br from-amber-50 to-white space-y-4">
        <div className="flex items-center gap-3">
          <span className="h-11 w-11 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center"><Trophy className="h-5 w-5" /></span>
          <div>
            <p className="font-bold text-gray-900">{test.title}</p>
            <p className="text-xs text-gray-500 flex items-center gap-2">
              <span className="flex items-center gap-0.5"><Clock className="h-3 w-3" />{test.duration_min} min</span>
              <span>Pass {test.pass_percent}%</span>
              {Number(test.negative_marks) > 0 && <span>−{Number(test.negative_marks)} per wrong answer</span>}
            </p>
          </div>
        </div>
        {test.description && <p className="text-sm text-gray-600 whitespace-pre-line">{test.description}</p>}
        {attempts.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-gray-500">Your attempts{best !== null ? ` · best ${best}%` : ''}</p>
            {attempts.map(a => (
              <Link key={a.id} href={`/student/learning/result/${a.id}`} className="flex items-center justify-between rounded-lg bg-white border border-gray-100 px-3 py-2 text-sm hover:border-blue-200">
                <span>{Number(a.score)} / {Number(a.total)} <span className={a.passed ? 'text-emerald-600' : 'text-red-600'}>· {a.passed ? 'Passed' : 'Not passed'}</span></span>
                <span className="text-xs text-gray-400">{fmtDateTime(a.submitted_at)} ›</span>
              </Link>
            ))}
          </div>
        )}
        {left === null || left > 0 ? (
          <Link href={`/student/learning/test/${test.id}`} className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold text-sm px-5 h-10">
            {attempts.length ? 'Retake test' : 'Start test'}{left !== null ? ` (${left} attempt${left !== 1 ? 's' : ''} left)` : ''}
          </Link>
        ) : (
          <p className="text-sm text-gray-500">You have used all attempts for this test.</p>
        )}
      </div>
    )
  }

  return <div className="p-8 text-center text-sm text-gray-500">Content unavailable.</div>
}

function OpenBox({ href, label }: { href: string; label: string }) {
  return (
    <div className="p-10 text-center bg-gray-50">
      <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm px-5 h-10">
        {label} <ExternalLink className="h-4 w-4" />
      </a>
    </div>
  )
}
