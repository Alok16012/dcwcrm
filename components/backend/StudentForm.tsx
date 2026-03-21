'use client'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { User, Phone, Mail, MapPin, Tag, BookOpen, UserCheck, Calendar, IndianRupee, FileText, Building2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { studentSchema, type StudentFormData } from '@/lib/validations/student.schema'
import {
    type Student, type Course, type SubCourse, type Profile,
    type Department, type DepartmentSubSection, type Session,
    PAYMENT_MODE_LABELS
} from '@/types/app.types'

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
    const [loading, setLoading] = useState(false)
    // Payment fields for new payment entry
    const [paymentAmount, setPaymentAmount] = useState('')
    const [paymentMode, setPaymentMode] = useState('cash')
    const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0])
    const [paymentReceipt, setPaymentReceipt] = useState('')
    const supabase = createClient()

    const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<StudentFormData>({
        resolver: zodResolver(studentSchema),
        defaultValues: {
            full_name: student?.full_name ?? '',
            guardian_name: student?.guardian_name ?? '',
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
            mode: student?.mode ?? '',
            incentive_amount: student?.incentive_amount ?? 0,
            total_fee: student?.total_fee ?? 0,
            amount_paid: student?.amount_paid ?? 0,
        },
    })

    const selectedCourseId = watch('course_id')
    const selectedDeptId = watch('department_id')

    useEffect(() => {
        async function load() {
            const [{ data: c }, { data: p }, { data: d }, { data: s }] = await Promise.all([
                supabase.from('courses').select('*').order('name'),
                supabase.from('profiles').select('*').order('full_name'),
                supabase.from('departments').select('*').order('name'),
                supabase.from('sessions').select('*').order('name', { ascending: false }),
            ])

            const cds = (c ?? []) as any[]
            if (student?.course && !cds.find(x => x.id === student.course?.id)) {
                cds.push(student.course)
            }
            const pds = (p ?? []) as any[]
            if (student?.counsellor && !pds.find(x => x.id === student.counsellor?.id)) {
                pds.push(student.counsellor)
            }
            setCourses([...cds])
            setCounsellors([...pds])
            setDepartments(d ?? [])
            setSessions(s ?? [])

            reset({
                full_name: student?.full_name ?? '',
                guardian_name: student?.guardian_name ?? '',
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
                mode: student?.mode ?? '',
                incentive_amount: student?.incentive_amount ?? 0,
                total_fee: student?.total_fee ?? 0,
                amount_paid: student?.amount_paid ?? 0,
            } as any)
        }
        load()
    }, [student, reset])

    useEffect(() => {
        if (!selectedCourseId) { setSubCourses([]); return }
        supabase.from('sub_courses').select('*').eq('course_id', selectedCourseId)
            .then(({ data }) => {
                const sds = (data ?? []) as any[]
                if (student?.sub_course && student.sub_course.course_id === selectedCourseId) {
                    if (!sds.find(x => x.id === student.sub_course?.id)) sds.push(student.sub_course)
                }
                setSubCourses([...sds])
                if (selectedCourseId === (student?.course_id || student?.course?.id)) {
                    setValue('sub_course_id', (student?.sub_course_id || (student as any)?.sub_course?.id || '') as any)
                }
            })
    }, [selectedCourseId, student, setValue])

    useEffect(() => {
        if (!selectedDeptId) { setSubSections([]); return }
        supabase.from('department_sub_sections').select('*').eq('department_id', selectedDeptId)
            .then(({ data }) => {
                const ssds = (data ?? []) as any[]
                if (student?.sub_section && student.sub_section.department_id === selectedDeptId) {
                    if (!ssds.find(x => x.id === student.sub_section?.id)) ssds.push(student.sub_section)
                }
                setSubSections([...ssds])
                if (selectedDeptId === (student?.department_id || student?.department?.id)) {
                    setValue('sub_section_id', (student?.sub_section_id || (student as any)?.sub_section?.id || '') as any)
                }
            })
    }, [selectedDeptId, student, setValue])

    async function onSubmit(data: StudentFormData) {
        setLoading(true)
        try {
            const payload = {
                ...data,
                course_id: data.course_id || null,
                sub_course_id: data.sub_course_id || null,
                department_id: data.department_id || null,
                sub_section_id: data.sub_section_id || null,
                assigned_counsellor: data.assigned_counsellor || null,
                mode: data.mode || null,
                enrollment_date: data.enrollment_date || null,
                session_id: data.session_id || null,
            }

            const { data: { user } } = await supabase.auth.getUser()

            if (student?.id) {
                const { error } = await supabase.from('students').update({
                    ...payload,
                    updated_at: new Date().toISOString(),
                } as never).eq('id', student.id)
                if (error) throw error

                // Record new payment if amount entered
                const newPayAmt = parseFloat(paymentAmount)
                if (!isNaN(newPayAmt) && newPayAmt > 0) {
                    const { error: payErr } = await supabase.from('payments').insert({
                        student_id: student.id,
                        lead_id: student.lead_id ?? null,
                        amount: newPayAmt,
                        payment_mode: paymentMode,
                        payment_date: paymentDate,
                        receipt_number: paymentReceipt || null,
                        notes: null,
                        recorded_by: user?.id,
                    } as never)
                    if (payErr) throw payErr
                    // Update amount_paid on student
                    await supabase.from('students').update({
                        amount_paid: (student.amount_paid ?? 0) + newPayAmt,
                    } as never).eq('id', student.id)
                }
                toast.success('Student profile updated')
            } else {
                const { data: newStudent, error } = await supabase.from('students').insert({
                    ...payload,
                } as never).select().single()
                if (error) throw error

                // Record the initial payment for new student
                if ((data.amount_paid ?? 0) > 0 && newStudent) {
                    await supabase.from('payments').insert({
                        student_id: (newStudent as any).id,
                        lead_id: (newStudent as any).lead_id ?? null,
                        amount: data.amount_paid,
                        payment_mode: 'cash',
                        payment_date: new Date().toISOString().split('T')[0],
                        notes: 'Initial payment during enrollment',
                        recorded_by: user?.id,
                    } as never)
                }
                toast.success('Student successfully added')
            }

            onSuccess()
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to save student')
        } finally {
            setLoading(false)
        }
    }

    return (
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

                    <FieldWrapper label="Guardian / Father Name" error={errors.guardian_name?.message}>
                        <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400" />
                            <Input {...register('guardian_name')} className="pl-9 bg-white border-blue-200" />
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

            <div className="bg-amber-50/50 rounded-xl p-4 border border-amber-100">
                <SectionHeader icon={Building2} title="Department & University" color="border-amber-200" />
                <div className="grid grid-cols-2 gap-4">
                    <FieldWrapper label="Department">
                        <Select key={departments.length} value={watch('department_id') || ''} onValueChange={(v) => { setValue('department_id', v || ''); setValue('sub_section_id', '') }}>
                            <SelectTrigger className="bg-white border-amber-200">
                                <SelectValue placeholder="Select department">
                                    {departments.find(d => d.id === watch('department_id'))?.name || (student as any)?.department?.name}
                                </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="">No department</SelectItem>
                                {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </FieldWrapper>

                    <FieldWrapper label="University/Board">
                        <Select key={subSections.length} value={watch('sub_section_id') || ''} onValueChange={(v) => setValue('sub_section_id', v || '')} disabled={!selectedDeptId}>
                            <SelectTrigger className="bg-white border-amber-200 disabled:opacity-50">
                                <SelectValue placeholder="Select university/board">
                                    {subSections.find(s => s.id === watch('sub_section_id'))?.name || (student as any)?.sub_section?.name}
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

            <div className="bg-emerald-50/50 rounded-xl p-4 border border-emerald-100">
                <SectionHeader icon={BookOpen} title="Academic Details" color="border-emerald-200" />
                <div className="grid grid-cols-2 gap-4">
                    <FieldWrapper label="Session">
                        <Select key={sessions.length} value={watch('session_id') || ''} onValueChange={(v) => setValue('session_id', v || '')}>
                            <SelectTrigger className="bg-white border-emerald-200">
                                <SelectValue placeholder="Select session">
                                    {sessions.find(s => s.id === watch('session_id'))?.name || (student as any)?.session?.name}
                                </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="">No session</SelectItem>
                                {sessions.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </FieldWrapper>

                    <FieldWrapper label="Course">
                        <Select key={courses.length} value={watch('course_id') || ''} onValueChange={(v) => { setValue('course_id', v || ''); setValue('sub_course_id', '') }}>
                            <SelectTrigger className="bg-white border-emerald-200">
                                <SelectValue placeholder="Select course">
                                    {courses.find(c => c.id === watch('course_id'))?.name || (student as any)?.course?.name}
                                </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="">No course</SelectItem>
                                {courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </FieldWrapper>

                    <FieldWrapper label="Standard">
                        <Select key={subCourses.length} value={watch('sub_course_id') || ''} onValueChange={(v) => setValue('sub_course_id', v || '')} disabled={!selectedCourseId}>
                            <SelectTrigger className="bg-white border-emerald-200 disabled:opacity-50">
                                <SelectValue placeholder="Select standard">
                                    {subCourses.find(s => s.id === watch('sub_course_id'))?.name || (student as any)?.sub_course?.name}
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

            <div className="bg-orange-50/50 rounded-xl p-4 border border-orange-100">
                <SectionHeader icon={IndianRupee} title="Fees Information" color="border-orange-200" />
                <div className="grid grid-cols-2 gap-4">
                    <FieldWrapper label="Total Fee">
                        <div className="relative">
                            <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-orange-400" />
                            <Input type="number" {...register('total_fee', { valueAsNumber: true })} className="pl-9 bg-white border-orange-200" />
                        </div>
                    </FieldWrapper>

                    <FieldWrapper label="Amount Paid (so far)">
                        <div className="relative">
                            <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-orange-400" />
                            <Input
                                type="number"
                                value={student?.id ? (student.amount_paid ?? 0) : undefined}
                                readOnly={!!student?.id}
                                {...(!student?.id ? register('amount_paid', { valueAsNumber: true }) : {})}
                                className="pl-9 bg-white border-orange-200 read-only:bg-gray-50 read-only:text-gray-500"
                            />
                        </div>
                    </FieldWrapper>
                </div>

                {/* New payment entry — only when editing existing student */}
                {student?.id && (
                    <div className="mt-4 pt-4 border-t border-orange-200">
                        <p className="text-xs font-semibold text-orange-700 uppercase tracking-wide mb-3">Record New Payment</p>
                        <div className="grid grid-cols-2 gap-3">
                            <FieldWrapper label="Payment Amount (₹)">
                                <div className="relative">
                                    <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-orange-400" />
                                    <Input
                                        type="number"
                                        min="0"
                                        placeholder="0"
                                        value={paymentAmount}
                                        onChange={(e) => setPaymentAmount(e.target.value)}
                                        className="pl-9 bg-white border-orange-200"
                                    />
                                </div>
                            </FieldWrapper>

                            <FieldWrapper label="Payment Mode">
                                <Select value={paymentMode} onValueChange={(v) => setPaymentMode(v ?? 'cash')}>
                                    <SelectTrigger className="bg-white border-orange-200">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {Object.entries(PAYMENT_MODE_LABELS).map(([k, v]) => (
                                            <SelectItem key={k} value={k}>{v}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </FieldWrapper>

                            <FieldWrapper label="Payment Date">
                                <Input
                                    type="date"
                                    value={paymentDate}
                                    onChange={(e) => setPaymentDate(e.target.value)}
                                    className="bg-white border-orange-200"
                                />
                            </FieldWrapper>

                            <FieldWrapper label="Receipt Number">
                                <Input
                                    placeholder="Optional"
                                    value={paymentReceipt}
                                    onChange={(e) => setPaymentReceipt(e.target.value)}
                                    className="bg-white border-orange-200"
                                />
                            </FieldWrapper>
                        </div>
                        <p className="text-xs text-orange-600 mt-2">Leave amount as 0 to skip recording a payment.</p>
                    </div>
                )}
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
                <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white min-w-[120px]">
                    {loading ? 'Saving...' : student?.id ? 'Update Student' : 'Add Student'}
                </Button>
            </div>
        </form >
    )
}
