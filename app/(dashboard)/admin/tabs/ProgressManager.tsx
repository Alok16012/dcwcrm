'use client'
import { useState } from 'react'
import { Search, Plus, CheckCircle2, Circle, Clock, AlertCircle, ChevronRight, Settings2, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'

interface Milestone {
  id: string
  name: string
  status: 'completed' | 'in_progress' | 'upcoming' | 'delayed'
  date: string
  remarks: string
}

interface StudentProgress {
  student_id: string
  student_name: string
  course: string
  department: string
  board_type: string
  current_stage: string
  last_updated: string
  milestones: Milestone[]
}

interface MilestoneTemplate {
  id: string
  board_type: string
  milestones: string[]
}

interface Props {
  students: { id: string; full_name: string; course?: { name: string }; department?: { name: string }; status: string }[]
  courses: { id: string; name: string }[]
  departments: { id: string; name: string }[]
}

const BOARD_TYPES = ['CBSE/ICSE Schools', 'State Universities (3-yr UG)', 'Distance/Open University', 'Professional Courses', 'Custom']

const DEFAULT_TEMPLATES: MilestoneTemplate[] = [
  { id: '1', board_type: 'CBSE/ICSE Schools', milestones: ['Admission Confirmed', 'Books Issued', 'Unit Test 1', 'Mid-Term', 'Annual Exam', 'Result', 'Next Class Promotion'] },
  { id: '2', board_type: 'State Universities (3-yr UG)', milestones: ['Admission', 'Semester 1 Exam', 'Sem 1 Result', 'Semester 2', 'Sem 2 Result', 'Year 2 Fee Due', 'Final Result', 'Certificate Issued'] },
  { id: '3', board_type: 'Distance/Open University', milestones: ['Enrollment', 'Study Material Dispatched', 'Assignment Submission', 'Term End Exam', 'Result', 'Re-registration'] },
  { id: '4', board_type: 'Professional Courses', milestones: ['Enrollment', 'Foundation Enrolled', 'Exam Registration', 'Mock Tests', 'Main Exam', 'Result', 'Next Level'] },
]

const SAMPLE_PROGRESS: StudentProgress[] = [
  {
    student_id: 's1', student_name: 'Rahul Sharma', course: 'B.Com', department: 'Commerce', board_type: 'State Universities (3-yr UG)', current_stage: 'Semester 1 Exam', last_updated: '2026-04-20',
    milestones: [
      { id: 'm1', name: 'Admission', status: 'completed', date: '2026-04-12', remarks: 'Documents verified' },
      { id: 'm2', name: 'Semester 1 Exam', status: 'in_progress', date: '2026-06-01', remarks: 'Exam schedule shared' },
      { id: 'm3', name: 'Sem 1 Result', status: 'upcoming', date: '2026-07-15', remarks: '' },
      { id: 'm4', name: 'Semester 2', status: 'upcoming', date: '2026-12-01', remarks: '' },
    ]
  },
  {
    student_id: 's2', student_name: 'Priya Verma', course: 'BBA', department: 'Management', board_type: 'Distance/Open University', current_stage: 'Study Material Dispatched', last_updated: '2026-04-18',
    milestones: [
      { id: 'm5', name: 'Enrollment', status: 'completed', date: '2026-04-10', remarks: 'ID issued' },
      { id: 'm6', name: 'Study Material Dispatched', status: 'completed', date: '2026-04-18', remarks: 'Courier dispatched via Delhivery' },
      { id: 'm7', name: 'Assignment Submission', status: 'upcoming', date: '2026-06-30', remarks: '' },
      { id: 'm8', name: 'Term End Exam', status: 'upcoming', date: '2026-08-01', remarks: '' },
    ]
  },
]

const STATUS_ICON = {
  completed: <CheckCircle2 className="w-4 h-4 text-green-500" />,
  in_progress: <Clock className="w-4 h-4 text-blue-500" />,
  upcoming: <Circle className="w-4 h-4 text-slate-300" />,
  delayed: <AlertCircle className="w-4 h-4 text-red-500" />,
}

const STATUS_COLORS = {
  completed: 'bg-green-100 text-green-800',
  in_progress: 'bg-blue-100 text-blue-800',
  upcoming: 'bg-slate-100 text-slate-600',
  delayed: 'bg-red-100 text-red-800',
}

export function ProgressManager({ students, courses, departments }: Props) {
  const [progressList, setProgressList] = useState<StudentProgress[]>(() => {
    if (students.length > 0) {
      return students.slice(0, 5).map((s, i) => SAMPLE_PROGRESS[i] ? { ...SAMPLE_PROGRESS[i], student_id: s.id, student_name: s.full_name, course: s.course?.name ?? 'N/A', department: s.department?.name ?? 'N/A' } : {
        student_id: s.id, student_name: s.full_name, course: s.course?.name ?? 'N/A', department: s.department?.name ?? 'N/A', board_type: 'State Universities (3-yr UG)', current_stage: 'Admission', last_updated: new Date().toISOString().split('T')[0],
        milestones: [{ id: Date.now().toString() + i, name: 'Admission', status: 'completed' as const, date: new Date().toISOString().split('T')[0], remarks: 'Enrolled' }]
      })
    }
    return SAMPLE_PROGRESS
  })
  const [templates, setTemplates] = useState<MilestoneTemplate[]>(DEFAULT_TEMPLATES)
  const [search, setSearch] = useState('')
  const [selectedStudent, setSelectedStudent] = useState<StudentProgress | null>(null)
  const [updateOpen, setUpdateOpen] = useState(false)
  const [templateOpen, setTemplateOpen] = useState(false)
  const [updateForm, setUpdateForm] = useState({ milestone: '', status: 'completed' as Milestone['status'], remarks: '', date: new Date().toISOString().split('T')[0] })
  const [editingTemplate, setEditingTemplate] = useState<MilestoneTemplate | null>(null)
  const [newMilestone, setNewMilestone] = useState('')

  const filtered = progressList.filter(p => p.student_name.toLowerCase().includes(search.toLowerCase()) || p.department.toLowerCase().includes(search.toLowerCase()))

  function handleAddUpdate() {
    if (!selectedStudent || !updateForm.milestone) { toast.error('Select a milestone'); return }
    const newM: Milestone = { id: Date.now().toString(), name: updateForm.milestone, status: updateForm.status, date: updateForm.date, remarks: updateForm.remarks }
    setProgressList(prev => prev.map(p => p.student_id === selectedStudent.student_id ? { ...p, milestones: [...p.milestones, newM], current_stage: newM.name, last_updated: updateForm.date } : p))
    setSelectedStudent(prev => prev ? { ...prev, milestones: [...prev.milestones, newM], current_stage: newM.name } : null)
    toast.success('Progress update pushed. Associate notified.')
    setUpdateOpen(false)
  }

  function handleUpdateMilestoneStatus(studentId: string, milestoneId: string, status: Milestone['status']) {
    setProgressList(prev => prev.map(p => p.student_id === studentId ? { ...p, milestones: p.milestones.map(m => m.id === milestoneId ? { ...m, status } : m) } : p))
    setSelectedStudent(prev => prev ? { ...prev, milestones: prev.milestones.map(m => m.id === milestoneId ? { ...m, status } : m) } : null)
    toast.success('Milestone status updated')
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Student Progress Manager</h2>
        <p className="text-sm text-muted-foreground">Push progress updates for enrolled students. Associates see live timelines.</p>
      </div>

      <Tabs defaultValue="students">
        <TabsList>
          <TabsTrigger value="students" className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" />Student Progress</TabsTrigger>
          <TabsTrigger value="templates" className="flex items-center gap-1.5"><Settings2 className="w-3.5 h-3.5" />Milestone Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="students" className="space-y-3 mt-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input placeholder="Search student or department..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {filtered.map(p => (
              <div key={p.student_id} className={`border rounded-xl p-4 hover:shadow-sm transition-all cursor-pointer ${selectedStudent?.student_id === p.student_id ? 'border-blue-400 bg-blue-50' : 'bg-white hover:border-slate-300'}`}
                onClick={() => setSelectedStudent(prev => prev?.student_id === p.student_id ? null : p)}>
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm">{p.student_name}</p>
                      <Badge variant="outline" className="text-xs">{p.board_type}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{p.course} · {p.department}</p>
                    <p className="text-xs text-blue-600 mt-1 font-medium">Current: {p.current_stage}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">Updated {p.last_updated}</span>
                    <Button size="sm" variant="outline" className="h-7 text-xs"
                      onClick={e => { e.stopPropagation(); setSelectedStudent(p); setUpdateForm({ milestone: '', status: 'completed', remarks: '', date: new Date().toISOString().split('T')[0] }); setUpdateOpen(true) }}>
                      <Plus className="w-3 h-3 mr-1" />Push Update
                    </Button>
                    <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${selectedStudent?.student_id === p.student_id ? 'rotate-90' : ''}`} />
                  </div>
                </div>

                {/* Expanded timeline */}
                {selectedStudent?.student_id === p.student_id && (
                  <div className="mt-4 pt-3 border-t space-y-2">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Progress Timeline</p>
                    {p.milestones.map((m, idx) => (
                      <div key={m.id} className="flex items-start gap-3">
                        <div className="flex flex-col items-center mt-0.5">
                          {STATUS_ICON[m.status]}
                          {idx < p.milestones.length - 1 && <div className="w-px h-5 bg-slate-200 mt-1" />}
                        </div>
                        <div className="flex-1 min-w-0 pb-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium">{m.name}</p>
                            <Select value={m.status} onValueChange={v => { handleUpdateMilestoneStatus(p.student_id, m.id, v as Milestone['status']); setSelectedStudent(prev => prev ? { ...prev, milestones: prev.milestones.map(ms => ms.id === m.id ? { ...ms, status: v as Milestone['status'] } : ms) } : null) }}>
                              <SelectTrigger className="h-5 text-[10px] w-28 px-2 py-0">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${STATUS_COLORS[m.status]}`}>{m.status.replace('_', ' ')}</span>
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="completed">Completed</SelectItem>
                                <SelectItem value="in_progress">In Progress</SelectItem>
                                <SelectItem value="upcoming">Upcoming</SelectItem>
                                <SelectItem value="delayed">Delayed</SelectItem>
                              </SelectContent>
                            </Select>
                            <span className="text-xs text-slate-400">{m.date}</span>
                          </div>
                          {m.remarks && <p className="text-xs text-slate-500 mt-0.5">{m.remarks}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="text-center py-10 text-slate-400">No enrolled students found</div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="templates" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Customize milestone sequences per board/university type. Students auto-assigned template on enrollment.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {templates.map(t => (
              <div key={t.id} className="border rounded-xl p-4 bg-white space-y-3">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="font-medium">{t.board_type}</Badge>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setEditingTemplate(t); setTemplateOpen(true) }}>
                    <Settings2 className="w-3 h-3 mr-1" />Edit
                  </Button>
                </div>
                <ol className="space-y-1">
                  {t.milestones.map((m, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-500 text-xs flex items-center justify-center font-semibold flex-shrink-0">{i + 1}</span>
                      {m}
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Push Update Dialog */}
      <Dialog open={updateOpen} onOpenChange={setUpdateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Push Progress Update — {selectedStudent?.student_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Milestone Name</Label>
              <Input placeholder="e.g. Semester 1 Result Declared" value={updateForm.milestone} onChange={e => setUpdateForm(f => ({ ...f, milestone: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Status</Label>
                <Select value={updateForm.status} onValueChange={v => setUpdateForm(f => ({ ...f, status: v as Milestone['status'] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="upcoming">Upcoming</SelectItem>
                    <SelectItem value="delayed">Delayed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Date</Label>
                <Input type="date" value={updateForm.date} onChange={e => setUpdateForm(f => ({ ...f, date: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Remarks (visible to associate)</Label>
              <Textarea placeholder="Optional notes..." value={updateForm.remarks} onChange={e => setUpdateForm(f => ({ ...f, remarks: e.target.value }))} rows={3} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setUpdateOpen(false)}>Cancel</Button>
              <Button onClick={handleAddUpdate}>Push Update</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Template Dialog */}
      <Dialog open={templateOpen} onOpenChange={setTemplateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Template — {editingTemplate?.board_type}</DialogTitle>
          </DialogHeader>
          {editingTemplate && (
            <div className="space-y-3">
              <ol className="space-y-2">
                {editingTemplate.milestones.map((m, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 w-5">{i + 1}.</span>
                    <Input value={m} className="h-8 text-sm" onChange={e => {
                      const updated = [...editingTemplate.milestones]
                      updated[i] = e.target.value
                      setEditingTemplate({ ...editingTemplate, milestones: updated })
                    }} />
                    <Button variant="ghost" size="sm" className="text-red-400 h-8 w-8 p-0" onClick={() => setEditingTemplate({ ...editingTemplate, milestones: editingTemplate.milestones.filter((_, j) => j !== i) })}>×</Button>
                  </li>
                ))}
              </ol>
              <div className="flex gap-2">
                <Input placeholder="New milestone..." value={newMilestone} onChange={e => setNewMilestone(e.target.value)} className="h-8 text-sm" />
                <Button size="sm" className="h-8" onClick={() => { if (newMilestone.trim()) { setEditingTemplate({ ...editingTemplate, milestones: [...editingTemplate.milestones, newMilestone.trim()] }); setNewMilestone('') } }}>
                  <Plus className="w-3 h-3" />
                </Button>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setTemplateOpen(false)}>Cancel</Button>
                <Button onClick={() => {
                  setTemplates(prev => prev.map(t => t.id === editingTemplate.id ? editingTemplate : t))
                  toast.success('Template saved')
                  setTemplateOpen(false)
                }}>Save Template</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
