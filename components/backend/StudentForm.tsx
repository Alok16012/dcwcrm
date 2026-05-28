'use client'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
    User, Phone, Mail, MapPin, Tag, BookOpen, UserCheck, Calendar,
    IndianRupee, FileText, Building2, Users, GraduationCap,
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

interface Associate { id: string; name: string; associate_code: string | null }
interface Telecaller { id: string; full_name: string }

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
    const [leads, setLeads] = useState<Telecaller[]>([])
    const [selectedLead, setSelectedLead] = useState('')
    const [currentMentor, setCurrentMentor] = useState<Telecaller | null>(null)
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
                const [{ data: c }, { data: p }, { data: d }, { data: s }, { data: assocs }, { data: leadsData }] = await Promise.all([
                    supabase.from('courses').select('*').order('name'),
                    supabase.from('profiles').select('*').in('role', ['counselor', 'lead', 'admin']).eq('is_active', true).order('full_name'),
                    supabase.from('departments').select('*').order('name'),
                    supabase.from('sessions').select('*').order('name', { ascending: false }),
                    (supabase as any).from('associates').select('id, name, associate_code').eq('status', 'approved').order('name'),
                    supabase.from('profiles').select('id, full_name').in('role', ['lead', 'counselor']).eq('is_active', true).order('full_name'),
                ])

                if (!isMounted) return
                setCourses((c ?? []) as any[])
                setCounsellors((p ?? []) as any[])
                setDepartments(d ?? [])
                setSessions(s ?? [])
                setAssociates((assocs ?? []) as Associate[])
                const loadedLeads = (leadsData ?? []) as Telecaller[]
                setLeads(loadedLeads)

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

                    // Set current mentor from student record
                    const mentorId = (student as any).mentor_telecaller_id
                    if (mentorId && isMounted) {
                        const found = loadedLeads.find(l => l.id === mentorId)
                        if (found) setCurrentMentor(found)
                        else {
                            // Fetch if not in loaded list
                            const { data: mp } = await supabase.from('profiles').select('id, full_name').eq('id', mentorId).single()
                            if (mp && isMounted) setCurrentMentor(mp as Telecaller)
                        }
                    }
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

    async function assignMentor() {
        if (!student?.id || !selectedLead) return
        setSavingMentorship(true)
        try {
            const { error } = await supabase
                .from('students')
                .update({ mentor_telecaller_id: selectedLead } as never)
                .eq('id', student.id)
            if (error) throw error
            const found = leads.find(l => l.id === selectedLead) ?? null
            setCurrentMentor(found)
            setSelectedLead('')
            toast.success('Mentor assigned successfully')
        } catch (err: any) {
            toast.error(err?.message ?? 'Failed to assign mentor')
        } finally {
            setSavingMentorship(false)
        }
    }

    async function unassignMentor() {
        if (!student?.id) return
        try {
            const { error } = await supabase
                .from('students')
                .update({ mentor_telecaller_id: null } as never)
                .eq('id', student.id)
            if (error) throw error
            setCurrentMentor(null)
            toast.success('Mentorship assignment removed')
        } catch {
            toast.error('Failed to remove assignment')
        }
    }

    return (
        <div>
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

                    {/* Mentorship */}
                    {student?.id && (
                        <div className="bg-violet-50/50 rounded-xl p-4 border border-violet-100">
                            <SectionHeader icon={GraduationCap} title="Mentorship" color="border-violet-200" />
                            <div className="space-y-3">
                                {currentMentor && (
                                    <div className="flex items-center justify-between bg-white border border-violet-200 rounded-lg px-3 py-2">
                                        <div>
                                            <p className="text-[10px] text-violet-500 font-bold uppercase tracking-wider leading-none mb-0.5">Assigned Mentor</p>
                                            <p className="text-sm font-semibold text-violet-900">{currentMentor.full_name}</p>
                                        </div>
                                        <Button type="button" size="sm" variant="ghost"
                                            className="h-7 text-xs text-red-500 hover:bg-red-50 hover:text-red-600"
                                            onClick={unassignMentor}>
                                            Remove
                                        </Button>
                                    </div>
                                )}
                                <div className="flex gap-2 items-end">
                                    <div className="flex-1">
                                        <Select value={selectedLead || 'none'} onValueChange={v => setSelectedLead(v === 'none' ? '' : (v ?? ''))}>
                                            <SelectTrigger className="bg-white border-violet-200 h-9 text-sm">
                                                <SelectValue>
                                                    {selectedLead ? leads.find(l => l.id === selectedLead)?.full_name ?? '— Select Lead / Counselor —' : '— Select Lead / Counselor —'}
                                                </SelectValue>
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">— Select Lead / Counselor —</SelectItem>
                                                {leads.map(l => (
                                                    <SelectItem key={l.id} value={l.id}>{l.full_name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <Button type="button" onClick={assignMentor}
                                        disabled={!selectedLead || savingMentorship}
                                        className="bg-violet-600 hover:bg-violet-700 text-white h-9 text-sm shrink-0">
                                        {savingMentorship ? 'Assigning...' : currentMentor ? 'Reassign' : 'Assign'}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}

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
        </div>
    )
}
