'use client'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
    User, Phone, Mail, MapPin, Tag, BookOpen, UserCheck, Calendar,
    IndianRupee, FileText, Building2, Users, GraduationCap,
    ClipboardList, CheckCircle2, Clock, XCircle, Star,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { studentSchema, type StudentFormData } from '@/lib/validations/student.schema'
import {
    type Student, type Course, type SubCourse, type Profile,
    type Department, type DepartmentSubSection, type Session,
    PAYMENT_MODE_LABELS
} from '@/types/app.types'
import { format } from 'date-fns'

interface Associate { id: string; name: string; associate_code: string | null }
interface Telecaller { id: string; full_name: string }

interface MentorshipTask {
    task_type: 'work_assignment' | 'practical' | 'exam'
    description: string
    rating: string
}

interface MentorshipRecord {
    id: string
    task_type: string
    description: string | null
    rating: number | null
    status: string
    salary_percentage: number | null
    admin_remarks: string | null
    created_at: string
    telecaller: { id: string; full_name: string } | null
}

interface StudentFormProps {
    student?: Partial<Student>
    onSuccess: () => void
    onCancel: () => void
}

const STATUS_LABELS: Record<string, string> = {
    active: 'Active',
    completed: 'Completed',
    dropped: 'Dropped',
    on_hold: 'On Hold',
}

const STATUS_DOT: Record<string, string> = {
    active: 'bg-green-500',
    completed: 'bg-blue-500',
    dropped: 'bg-red-500',
    on_hold: 'bg-yellow-500',
}

const TASK_LABELS: Record<string, string> = {
    work_assignment: 'Work Assignment',
    practical: 'Practical',
    exam: 'Exam',
}

const TASK_COLORS: Record<string, string> = {
    work_assignment: 'blue',
    practical: 'emerald',
    exam: 'purple',
}

const MENTORSHIP_STATUS_CFG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
    pending:  { label: 'Pending Approval', color: 'bg-amber-100 text-amber-800 border-amber-200',    icon: Clock },
    approved: { label: 'Approved',         color: 'bg-green-100 text-green-800 border-green-200',    icon: CheckCircle2 },
    rejected: { label: 'Rejected',         color: 'bg-red-100 text-red-800 border-red-200',          icon: XCircle },
}

const EMPTY_TASKS: MentorshipTask[] = [
    { task_type: 'work_assignment', description: '', rating: '' },
    { task_type: 'practical',       description: '', rating: '' },
    { task_type: 'exam',            description: '', rating: '' },
]

function SectionHeader({ icon: Icon, title, color }: { icon: React.ElementType; title: string; color: string }) {
    return (
        <div className={`flex items-center gap-2 pb-2 mb-3 border-b ${color}`}>
            <div className={`w-6 h-6 rounded-md flex items-center justify-center ${color.replace('border-', 'bg-').replace('-200', '-100')}`}>
                <Icon className={`w-3.5 h-3.5 ${color.replace('border-', 'text-').replace('-200', '-600')}`} />
            </div>
            <span className={`text-xs font-bold uppercase tracking-wider ${color.replace('border-', 'text-').replace('-200', '-600')}`}>{title}</span>
        </div>
    )
}

function FieldWrapper({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) {
    return (
        <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-gray-600">
                {label}
                {required && <span className="text-red-400 ml-0.5">*</span>}
            </Label>
            {children}
            {error && <p className="text-xs text-red-500 flex items-center gap-1">⚠ {error}</p>}
        </div>
    )
}

export function StudentForm({ student, onSuccess, onCancel }: StudentFormProps) {
    const [courses, setCourses] = useState<Course[]>([])
    const [subCourses, setSubCourses] = useState<SubCourse[]>([])
    const [departments, setDepartments] = useState<Department[]>([])
    const [subSections, setSubSections] = useState<DepartmentSubSection[]>([])
    const [sessions, setSessions] = useState<Session[]>([])
    const [counsellors, setCounsellors] = useState<Profile[]>([])
    const [associates, setAssociates] = useState<Associate[]>([])
    const [loading, setLoading] = useState(false)

    // Mentorship state
    const [activeFormTab, setActiveFormTab] = useState<'details' | 'mentorship'>('details')
    const [telecallers, setTelecallers] = useState<Telecaller[]>([])
    const [selectedTelecaller, setSelectedTelecaller] = useState('')
    const [mentorshipTasks, setMentorshipTasks] = useState<MentorshipTask[]>(EMPTY_TASKS)
    const [existingMentorships, setExistingMentorships] = useState<MentorshipRecord[]>([])
    const [savingMentorship, setSavingMentorship] = useState(false)

    const supabase = createClient()

    const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<StudentFormData>({
        resolver: zodResolver(studentSchema),
        defaultValues: {
            full_name: student?.full_name ?? '',
            father_name: (student as any)?.father_name ?? '',
            guardian_name: student?.guardian_name ?? '',
            guardian_phone: (student as any)?.guardian_phone ?? '',
            guardian_relationship: (student as any)?.guardian_relationship ?? '',
            referred_by_associate: (student as any)?.referred_by_associate ?? '',
            phone: student?.phone ?? '',
            email: student?.email ?? '',
            city: student?.city ?? '',
            enrollment_date: student?.enrollment_date ?? '',
            course_id: student?.course_id ?? '',
            sub_course_id: student?.sub_course_id ?? '',
            department_id: student?.department_id ?? '',
            sub_section_id: student?.sub_section_id ?? '',
            session_id: student?.session_id ?? '',
            assigned_counsellor: student?.assigned_counsellor ?? '',
            status: (student?.status as any) || 'active',
            drop_reason: (student as any)?.drop_reason ?? '',
            mode: student?.mode ?? '',
            incentive_amount: student?.incentive_amount ?? 0,
            total_fee: student?.total_fee ?? 0,
            amount_paid: student?.amount_paid ?? 0,
        },
    })

    const selectedCourseId = watch('course_id')
    const selectedDeptId = watch('department_id')

    useEffect(() => {
        let isMounted = true
        async function load() {
            setLoading(true)
            try {
                const [{ data: c }, { data: p }, { data: d }, { data: s }, { data: assocs }, { data: tc }] = await Promise.all([
                    supabase.from('courses').select('*').order('name'),
                    supabase.from('profiles').select('*').in('role', ['counselor', 'lead', 'admin']).eq('is_active', true).order('full_name'),
                    supabase.from('departments').select('*').order('name'),
                    supabase.from('sessions').select('*').order('name', { ascending: false }),
                    (supabase as any).from('associates').select('id, name, associate_code').eq('status', 'approved').order('name'),
                    supabase.from('profiles').select('id, full_name').eq('role', 'telecaller').eq('is_active', true).order('full_name'),
                ])

                if (!isMounted) return
                setCourses((c ?? []) as any[])
                setCounsellors((p ?? []) as any[])
                setDepartments(d ?? [])
                setSessions(s ?? [])
                setAssociates((assocs ?? []) as Associate[])
                setTelecallers((tc ?? []) as Telecaller[])

                if (student?.id) {
                    reset({
                        full_name: student?.full_name ?? '',
                        father_name: (student as any)?.father_name ?? '',
                        guardian_name: student?.guardian_name ?? '',
                        guardian_phone: (student as any)?.guardian_phone ?? '',
                        guardian_relationship: (student as any)?.guardian_relationship ?? '',
                        referred_by_associate: (student as any)?.referred_by_associate ?? '',
                        phone: student?.phone ?? '',
                        email: student?.email ?? '',
                        city: student?.city ?? '',
                        enrollment_date: student?.enrollment_date ?? '',
                        course_id: student?.course_id ?? (student as any)?.course?.id ?? '',
                        sub_course_id: student?.sub_course_id ?? (student as any)?.sub_course?.id ?? '',
                        department_id: student?.department_id ?? (student as any)?.department?.id ?? '',
                        sub_section_id: student?.sub_section_id ?? (student as any)?.sub_section?.id ?? '',
                        session_id: student?.session_id ?? (student as any)?.session?.id ?? '',
                        assigned_counsellor: student?.assigned_counsellor ?? '',
                        status: (student?.status as any) || 'active',
                        drop_reason: (student as any)?.drop_reason ?? '',
                        mode: student?.mode ?? '',
                        incentive_amount: student?.incentive_amount ?? 0,
                        total_fee: student?.total_fee ?? 0,
                        amount_paid: student?.amount_paid ?? 0,
                    } as any)

                    // Load existing mentorships
                    const { data: ms } = await supabase
                        .from('student_mentorships')
                        .select('*, telecaller:profiles!student_mentorships_telecaller_id_fkey(id, full_name)')
                        .eq('student_id', student.id)
                        .order('created_at', { ascending: false })
                    if (isMounted) setExistingMentorships((ms ?? []) as MentorshipRecord[])
                }
            } catch (err) {
                console.error('Error loading form options:', err)
            } finally {
                if (isMounted) setLoading(false)
            }
        }
        load()
        return () => { isMounted = false }
    }, [student?.id, reset])

    useEffect(() => {
        if (!selectedCourseId) { setSubCourses([]); return }
        const isEditingOriginalCourse = student?.id && selectedCourseId === (student?.course_id || (student as any)?.course?.id)

        supabase.from('sub_courses').select('*').eq('course_id', selectedCourseId)
            .then(({ data }) => {
                const sds = (data ?? []) as any[]
                if (isEditingOriginalCourse && student?.sub_course) {
                    if (!sds.find(x => x.id === student.sub_course?.id)) sds.push(student.sub_course)
                }
                setSubCourses([...sds])
                if (isEditingOriginalCourse) {
                    const originalSubId = student?.sub_course_id || (student as any)?.sub_course?.id
                    if (originalSubId) setValue('sub_course_id', originalSubId as any)
                }
            })
    }, [selectedCourseId, student?.id, setValue])

    useEffect(() => {
        if (!selectedDeptId) { setSubSections([]); return }
        const isEditingOriginalDept = student?.id && selectedDeptId === (student?.department_id || (student as any)?.department?.id)

        supabase.from('department_sub_sections').select('*').eq('department_id', selectedDeptId)
            .then(({ data }) => {
                const ssds = (data ?? []) as any[]
                if (isEditingOriginalDept && student?.sub_section) {
                    if (!ssds.find(x => x.id === student.sub_section?.id)) ssds.push(student.sub_section)
                }
                setSubSections([...ssds])
                if (isEditingOriginalDept) {
                    const originalSubId = student?.sub_section_id || (student as any)?.sub_section?.id
                    if (originalSubId) setValue('sub_section_id', originalSubId as any)
                }
            })
    }, [selectedDeptId, student?.id, setValue])

    async function onSubmit(data: StudentFormData) {
        setLoading(true)
        try {
            const base = {
                course_id: data.course_id || null,
                sub_course_id: data.sub_course_id || null,
                department_id: data.department_id || null,
                sub_section_id: data.sub_section_id || null,
                assigned_counsellor: data.assigned_counsellor || null,
                referred_by_associate: (data.referred_by_associate && data.referred_by_associate !== 'none') ? data.referred_by_associate : null,
                mode: data.mode || null,
                enrollment_date: data.enrollment_date || null,
                session_id: data.session_id || null,
            }

            const { data: { user } } = await supabase.auth.getUser()

            if (student?.id) {
                const { amount_paid: _ap, ...rest } = data
                void _ap
                const payload = {
                    ...rest,
                    ...base,
                    incentive_amount: Math.round((data.incentive_amount ?? 0) * 100) / 100,
                }
                const { error } = await supabase.from('students').update({
                    ...payload,
                    updated_at: new Date().toISOString(),
                } as never).eq('id', student.id)
                if (error) throw error

                if (data.status === 'dropped' && student.status !== 'dropped') {
                    const pending = (student.total_fee ?? 0) - (student.amount_paid ?? 0)
                    await supabase.from('department_litigations').insert({
                        student_id: student.id,
                        student_name: student.full_name,
                        father_name: (student as any).father_name || student.guardian_name || null,
                        phone: student.phone || null,
                        department_id: data.department_id || student.department_id || null,
                        sub_section_id: data.sub_section_id || student.sub_section_id || null,
                        session_id: data.session_id || student.session_id || null,
                        litigation_type: 'debt_recovery',
                        reason: data.drop_reason || null,
                        litigation_amount: pending > 0 ? pending : 0,
                        amount_paid: 0,
                        record_type: 'litigation',
                    } as never)
                    toast.success('Student marked as dropped & added to Litigation')
                } else {
                    toast.success('Student profile updated')
                }
            } else {
                const newPayload = {
                    ...data,
                    ...base,
                    incentive_amount: Math.round((data.incentive_amount ?? 0) * 100) / 100,
                }
                const { data: newStudent, error } = await supabase.from('students').insert({
                    ...newPayload,
                } as never).select().single()
                if (error) throw error
                toast.success('Student successfully added')
            }

            onSuccess()
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to save student')
        } finally {
            setLoading(false)
        }
    }

    async function saveMentorship() {
        if (!student?.id) return
        if (!selectedTelecaller) { toast.error('Please select a telecaller'); return }

        const filledTasks = mentorshipTasks.filter(t => t.description.trim() || t.rating)
        if (filledTasks.length === 0) {
            toast.error('Please fill at least one task (description or rating)')
            return
        }

        setSavingMentorship(true)
        try {
            const { data: { user } } = await supabase.auth.getUser()
            const records = filledTasks.map(t => ({
                student_id: student.id,
                telecaller_id: selectedTelecaller,
                task_type: t.task_type,
                description: t.description.trim() || null,
                rating: t.rating ? parseFloat(t.rating) : null,
                status: 'pending',
                created_by: user?.id ?? null,
            }))

            const { error } = await supabase.from('student_mentorships').insert(records as never)
            if (error) throw error

            toast.success('Mentorship submitted for admin approval')
            setMentorshipTasks(EMPTY_TASKS.map(t => ({ ...t })))
            setSelectedTelecaller('')

            // Reload history
            const { data: ms } = await supabase
                .from('student_mentorships')
                .select('*, telecaller:profiles!student_mentorships_telecaller_id_fkey(id, full_name)')
                .eq('student_id', student.id)
                .order('created_at', { ascending: false })
            setExistingMentorships((ms ?? []) as MentorshipRecord[])
        } catch (err) {
            toast.error('Failed to submit mentorship')
            console.error(err)
        } finally {
            setSavingMentorship(false)
        }
    }

    function updateTask(index: number, field: keyof MentorshipTask, value: string) {
        setMentorshipTasks(prev => prev.map((t, i) => i === index ? { ...t, [field]: value } : t))
    }

    return (
        <div>
            {/* Tab switcher — Mentorship only shown when editing existing student */}
            <div className="flex gap-1 mb-5 border-b border-gray-200">
                <button
                    type="button"
                    onClick={() => setActiveFormTab('details')}
                    className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
                        activeFormTab === 'details'
                            ? 'border-blue-600 text-blue-700'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                >
                    <User className="w-4 h-4" /> Student Details
                </button>
                {student?.id && (
                    <button
                        type="button"
                        onClick={() => setActiveFormTab('mentorship')}
                        className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
                            activeFormTab === 'mentorship'
                                ? 'border-violet-600 text-violet-700'
                                : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        <GraduationCap className="w-4 h-4" /> Mentorship
                        {existingMentorships.filter(m => m.status === 'pending').length > 0 && (
                            <span className="bg-amber-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                                {existingMentorships.filter(m => m.status === 'pending').length}
                            </span>
                        )}
                    </button>
                )}
            </div>

            {/* ── DETAILS TAB ── */}
            {activeFormTab === 'details' && (
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                    <div className="bg-blue-50/50 rounded-xl p-4 border border-blue-100">
                        <SectionHeader icon={User} title="Personal Information" color="border-blue-200" />
                        <div className="grid grid-cols-2 gap-4">
                            <FieldWrapper label="Full Name" required error={errors.full_name?.message}>
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400" />
                                    <Input {...register('full_name')} className="pl-9 bg-white border-blue-200" />
                                </div>
                            </FieldWrapper>

                            <FieldWrapper label="Father Name">
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400" />
                                    <Input {...register('father_name')} placeholder="e.g. Ramesh Kumar" className="pl-9 bg-white border-blue-200" />
                                </div>
                            </FieldWrapper>

                            <FieldWrapper label="Phone" required error={errors.phone?.message}>
                                <div className="relative">
                                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400" />
                                    <Input {...register('phone')} className="pl-9 bg-white border-blue-200" />
                                </div>
                            </FieldWrapper>

                            <FieldWrapper label="Email">
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400" />
                                    <Input {...register('email')} className="pl-9 bg-white border-blue-200" />
                                </div>
                            </FieldWrapper>

                            <FieldWrapper label="City">
                                <div className="relative">
                                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400" />
                                    <Input {...register('city')} className="pl-9 bg-white border-blue-200" />
                                </div>
                            </FieldWrapper>
                        </div>
                    </div>

                    {/* Guardian */}
                    <div className="bg-teal-50/50 rounded-xl p-4 border border-teal-100">
                        <SectionHeader icon={UserCheck} title="Guardian Details" color="border-teal-200" />
                        <div className="grid grid-cols-2 gap-4">
                            <FieldWrapper label="Guardian Name">
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-teal-400" />
                                    <Input {...register('guardian_name')} placeholder="Guardian name" className="pl-9 bg-white border-teal-200" />
                                </div>
                            </FieldWrapper>

                            <FieldWrapper label="Guardian Phone">
                                <div className="relative">
                                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-teal-400" />
                                    <Input {...register('guardian_phone')} placeholder="Guardian mobile number" className="pl-9 bg-white border-teal-200" />
                                </div>
                            </FieldWrapper>

                            <FieldWrapper label="Relationship">
                                <div className="relative">
                                    <UserCheck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-teal-400" />
                                    <Input {...register('guardian_relationship')} placeholder="e.g. Father, Mother, Spouse" className="pl-9 bg-white border-teal-200" />
                                </div>
                            </FieldWrapper>
                        </div>
                    </div>

                    {/* Associate */}
                    <div className="bg-indigo-50/50 rounded-xl p-4 border border-indigo-100">
                        <SectionHeader icon={Users} title="Associate" color="border-indigo-200" />
                        <FieldWrapper label="Referred by Associate">
                            <Select
                                value={watch('referred_by_associate') || 'none'}
                                onValueChange={v => setValue('referred_by_associate', v === 'none' ? '' : v as any)}
                            >
                                <SelectTrigger className="bg-white border-indigo-200">
                                    <SelectValue placeholder="Select associate">
                                        {(() => {
                                            const id = watch('referred_by_associate')
                                            if (!id) return 'None'
                                            const a = associates.find(x => x.id === id)
                                            return a ? `${a.name}${a.associate_code ? ` (${a.associate_code})` : ''}` : 'None'
                                        })()}
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">None</SelectItem>
                                    {associates.map(a => (
                                        <SelectItem key={a.id} value={a.id}>
                                            {a.name}{a.associate_code ? ` (${a.associate_code})` : ''}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </FieldWrapper>
                    </div>

                    {/* Enrollment */}
                    <div className="bg-purple-50/50 rounded-xl p-4 border border-purple-100">
                        <SectionHeader icon={Tag} title="Enrollment Details" color="border-purple-200" />
                        <div className="grid grid-cols-2 gap-4">
                            <FieldWrapper label="Mode">
                                <Select value={watch('mode') || ''} onValueChange={(v) => setValue('mode', v as any)}>
                                    <SelectTrigger className="bg-white border-purple-200">
                                        <SelectValue placeholder="Select mode" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="">Select mode</SelectItem>
                                        <SelectItem value="attending">Attending</SelectItem>
                                        <SelectItem value="non-attending">Non-Attending</SelectItem>
                                    </SelectContent>
                                </Select>
                            </FieldWrapper>

                            <FieldWrapper label="Enrollment Date">
                                <div className="relative">
                                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-400" />
                                    <Input type="date" {...register('enrollment_date')} className="pl-9 bg-white border-purple-200" />
                                </div>
                            </FieldWrapper>

                            <FieldWrapper label="Status">
                                <Select value={watch('status')} onValueChange={(v) => setValue('status', v as any)}>
                                    <SelectTrigger className="bg-white border-purple-200">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {Object.entries(STATUS_LABELS).map(([k, v]) => (
                                            <SelectItem key={k} value={k}>
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-2 h-2 rounded-full ${STATUS_DOT[k]}`} />
                                                    {v}
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </FieldWrapper>

                            {watch('status') === 'dropped' && (
                                <FieldWrapper label="Reason for Drop">
                                    <div className="relative">
                                        <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-red-400" />
                                        <Input
                                            {...register('drop_reason')}
                                            placeholder="e.g. Fee not paid, shifted city..."
                                            className="pl-9 bg-white border-red-200 focus:border-red-400"
                                        />
                                    </div>
                                </FieldWrapper>
                            )}

                            <FieldWrapper label="Counsellor">
                                <div className="relative">
                                    <UserCheck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-400" />
                                    <Select value={(watch('assigned_counsellor') as string) || 'none'} onValueChange={(v) => setValue('assigned_counsellor', (v === 'none' ? '' : v) as any)}>
                                        <SelectTrigger className="pl-9 bg-white border-purple-200">
                                            <SelectValue placeholder="Select counsellor">
                                                {(watch('assigned_counsellor') && watch('assigned_counsellor') !== 'none')
                                                    ? counsellors.find(c => c.id === (watch('assigned_counsellor') || ''))?.full_name || (student as any)?.counsellor?.full_name || watch('assigned_counsellor')
                                                    : "Select counsellor"}
                                            </SelectValue>
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">Unassigned</SelectItem>
                                            {counsellors.map((c) => (
                                                <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </FieldWrapper>

                            <FieldWrapper label="Incentive Amount">
                                <div className="relative">
                                    <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-400" />
                                    <Input type="number" {...register('incentive_amount', { valueAsNumber: true })} className="pl-9 bg-white border-purple-200" />
                                </div>
                            </FieldWrapper>
                        </div>
                    </div>

                    {/* Department & University */}
                    <div className="bg-amber-50/50 rounded-xl p-4 border border-amber-100">
                        <SectionHeader icon={Building2} title="Department & University" color="border-amber-200" />
                        <div className="grid grid-cols-2 gap-4">
                            <FieldWrapper label="Department">
                                <Select value={watch('department_id') || ''} onValueChange={(v) => { setValue('department_id', v || ''); setValue('sub_section_id', '') }}>
                                    <SelectTrigger className="bg-white border-amber-200">
                                        <SelectValue placeholder="Select department">
                                            {departments.find(d => d.id === watch('department_id'))?.name}
                                        </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="">No department</SelectItem>
                                        {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </FieldWrapper>

                            <FieldWrapper label="University/Board">
                                <Select value={watch('sub_section_id') || ''} onValueChange={(v) => setValue('sub_section_id', v || '')} disabled={!selectedDeptId}>
                                    <SelectTrigger className="bg-white border-amber-200 disabled:opacity-50">
                                        <SelectValue placeholder="Select university/board">
                                            {subSections.find(s => s.id === watch('sub_section_id'))?.name}
                                        </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="">No university/board</SelectItem>
                                        {subSections.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </FieldWrapper>
                        </div>
                    </div>

                    {/* Academic */}
                    <div className="bg-emerald-50/50 rounded-xl p-4 border border-emerald-100">
                        <SectionHeader icon={BookOpen} title="Academic Details" color="border-emerald-200" />
                        <div className="grid grid-cols-2 gap-4">
                            <FieldWrapper label="Session">
                                <Select value={watch('session_id') || ''} onValueChange={(v) => setValue('session_id', v || '')}>
                                    <SelectTrigger className="bg-white border-emerald-200">
                                        <SelectValue placeholder="Select session">
                                            {sessions.find(s => s.id === watch('session_id'))?.name}
                                        </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="">No session</SelectItem>
                                        {sessions.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </FieldWrapper>

                            <FieldWrapper label="Course">
                                <Select value={watch('course_id') || ''} onValueChange={(v) => { setValue('course_id', v || ''); setValue('sub_course_id', '') }}>
                                    <SelectTrigger className="bg-white border-emerald-200">
                                        <SelectValue placeholder="Select course">
                                            {courses.find(c => c.id === watch('course_id'))?.name}
                                        </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="">No course</SelectItem>
                                        {courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </FieldWrapper>

                            <FieldWrapper label="Standard">
                                <Select value={watch('sub_course_id') || ''} onValueChange={(v) => setValue('sub_course_id', v || '')} disabled={!selectedCourseId}>
                                    <SelectTrigger className="bg-white border-emerald-200 disabled:opacity-50">
                                        <SelectValue placeholder="Select standard">
                                            {subCourses.find(s => s.id === watch('sub_course_id'))?.name}
                                        </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="">No standard</SelectItem>
                                        {subCourses.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </FieldWrapper>
                        </div>
                    </div>

                    {/* Fees */}
                    <div className="bg-orange-50/50 rounded-xl p-4 border border-orange-100">
                        <SectionHeader icon={IndianRupee} title="Fees Information" color="border-orange-200" />
                        <div className="grid grid-cols-2 gap-4">
                            <FieldWrapper label="Total Fee">
                                <div className="relative">
                                    <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-orange-400" />
                                    <Input type="number" {...register('total_fee', { valueAsNumber: true })} className="pl-9 bg-white border-orange-200" />
                                </div>
                            </FieldWrapper>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
                        <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white min-w-[120px]">
                            {loading ? 'Saving...' : student?.id ? 'Update Student' : 'Add Student'}
                        </Button>
                    </div>
                </form>
            )}

            {/* ── MENTORSHIP TAB ── */}
            {activeFormTab === 'mentorship' && student?.id && (
                <div className="space-y-5">
                    {/* Telecaller selector */}
                    <div className="bg-violet-50/60 rounded-xl p-4 border border-violet-100">
                        <SectionHeader icon={UserCheck} title="Assign Telecaller" color="border-violet-200" />
                        {telecallers.length === 0 ? (
                            <p className="text-sm text-gray-500 bg-white border border-dashed border-gray-300 rounded-lg px-4 py-3">
                                No telecallers found. Add a profile with role = <code className="text-violet-600 font-mono text-xs">telecaller</code> first.
                            </p>
                        ) : (
                            <FieldWrapper label="Telecaller" required>
                                <Select value={selectedTelecaller || 'none'} onValueChange={v => setSelectedTelecaller(v === 'none' ? '' : (v ?? ''))}>
                                    <SelectTrigger className="bg-white border-violet-200">
                                        <SelectValue placeholder="Select telecaller">
                                            {selectedTelecaller
                                                ? telecallers.find(t => t.id === selectedTelecaller)?.full_name ?? 'Select telecaller'
                                                : 'Select telecaller'}
                                        </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">— Select Telecaller —</SelectItem>
                                        {telecallers.map(t => (
                                            <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </FieldWrapper>
                        )}
                    </div>

                    {/* Task cards */}
                    <div className="space-y-3">
                        <p className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                            <ClipboardList className="w-3.5 h-3.5" /> Mentorship Tasks
                        </p>
                        {mentorshipTasks.map((task, i) => {
                            const color = TASK_COLORS[task.task_type]
                            const borderCls = `border-${color}-200`
                            const bgCls = `bg-${color}-50/50`
                            const textCls = `text-${color}-600`
                            return (
                                <div key={task.task_type} className={`rounded-xl p-4 border ${
                                    task.task_type === 'work_assignment' ? 'bg-blue-50/50 border-blue-200' :
                                    task.task_type === 'practical' ? 'bg-emerald-50/50 border-emerald-200' :
                                    'bg-purple-50/50 border-purple-200'
                                }`}>
                                    <p className={`text-xs font-bold uppercase tracking-wider mb-3 ${
                                        task.task_type === 'work_assignment' ? 'text-blue-600' :
                                        task.task_type === 'practical' ? 'text-emerald-600' :
                                        'text-purple-600'
                                    }`}>
                                        {TASK_LABELS[task.task_type]}
                                    </p>
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="col-span-2 space-y-1.5">
                                            <Label className="text-xs font-semibold text-gray-600">Work Description</Label>
                                            <Textarea
                                                value={task.description}
                                                onChange={e => updateTask(i, 'description', e.target.value)}
                                                placeholder="Describe the mentorship work done..."
                                                rows={2}
                                                className="bg-white text-sm resize-none"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-semibold text-gray-600 flex items-center gap-1">
                                                <Star className="w-3 h-3 text-amber-500" /> Rating (0–10)
                                            </Label>
                                            <Input
                                                type="number"
                                                min="0"
                                                max="10"
                                                step="0.5"
                                                value={task.rating}
                                                onChange={e => updateTask(i, 'rating', e.target.value)}
                                                placeholder="e.g. 8.5"
                                                className="bg-white"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => { setMentorshipTasks(EMPTY_TASKS.map(t => ({ ...t }))); setSelectedTelecaller('') }}
                        >
                            Clear
                        </Button>
                        <Button
                            type="button"
                            onClick={saveMentorship}
                            disabled={savingMentorship}
                            className="bg-violet-600 hover:bg-violet-700 text-white min-w-[160px]"
                        >
                            {savingMentorship ? 'Submitting...' : 'Submit for Approval'}
                        </Button>
                    </div>

                    {/* Existing mentorships history */}
                    {existingMentorships.length > 0 && (
                        <div className="mt-2">
                            <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-1.5">
                                <ClipboardList className="w-3.5 h-3.5" /> Mentorship History
                            </p>
                            <div className="space-y-2">
                                {existingMentorships.map(m => {
                                    const cfg = MENTORSHIP_STATUS_CFG[m.status] ?? MENTORSHIP_STATUS_CFG.pending
                                    const StatusIcon = cfg.icon
                                    return (
                                        <div key={m.id} className="bg-white border border-gray-200 rounded-lg px-4 py-3 flex items-start gap-3">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="text-xs font-bold text-gray-700">{TASK_LABELS[m.task_type] ?? m.task_type}</span>
                                                    {m.rating != null && (
                                                        <span className="flex items-center gap-0.5 text-xs text-amber-600 font-semibold">
                                                            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                                                            {m.rating}/10
                                                        </span>
                                                    )}
                                                    {m.telecaller && (
                                                        <span className="text-xs text-gray-500">· {m.telecaller.full_name}</span>
                                                    )}
                                                    <span className="text-xs text-gray-400">
                                                        {format(new Date(m.created_at), 'dd MMM yyyy')}
                                                    </span>
                                                </div>
                                                {m.description && <p className="text-xs text-gray-500 mt-0.5 truncate">{m.description}</p>}
                                                {m.status === 'approved' && m.salary_percentage != null && (
                                                    <p className="text-xs text-green-600 font-semibold mt-0.5">+{m.salary_percentage}% salary bonus approved</p>
                                                )}
                                                {m.admin_remarks && (
                                                    <p className="text-xs text-gray-500 italic mt-0.5">"{m.admin_remarks}"</p>
                                                )}
                                            </div>
                                            <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border flex-shrink-0 ${cfg.color}`}>
                                                <StatusIcon className="w-3 h-3" />
                                                {cfg.label}
                                            </span>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
