'use client'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { User, Phone, Mail, MapPin, Tag, BookOpen, UserCheck, Calendar, IndianRupee, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { studentSchema, type StudentFormData } from '@/lib/validations/student.schema'
import {
    type Student, type Course, type SubCourse, type Profile,
} from '@/types/app.types'

interface StudentFormProps {
    student: Student
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
    const [counsellors, setCounsellors] = useState<Profile[]>([])
    const [loading, setLoading] = useState(false)
    const supabase = createClient()

    const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<StudentFormData>({
        resolver: zodResolver(studentSchema),
        defaultValues: {
            full_name: student.full_name,
            phone: student.phone,
            email: student.email ?? '',
            city: student.city ?? '',
            enrollment_number: student.enrollment_number,
            enrollment_date: student.enrollment_date ?? '',
            course_id: student.course_id ?? '',
            sub_course_id: student.sub_course_id ?? '',
            assigned_counsellor: student.assigned_counsellor ?? '',
            status: student.status as any,
            incentive_amount: student.incentive_amount ?? 0,
            total_fee: student.total_fee ?? 0,
            amount_paid: student.amount_paid ?? 0,
        },
    })

    const selectedCourseId = watch('course_id')

    useEffect(() => {
        async function load() {
            const [{ data: c }, { data: p }] = await Promise.all([
                supabase.from('courses').select('*').order('name'),
                supabase.from('profiles').select('*').order('full_name'),
            ])

            const cds = (c ?? []) as any[]
            if (student.course && !cds.find(x => x.id === student.course?.id)) {
                cds.push(student.course)
            }
            setCourses([...cds])
            setCounsellors(p ?? [])

            reset({
                full_name: student.full_name,
                phone: student.phone,
                email: student.email ?? '',
                city: student.city ?? '',
                enrollment_number: student.enrollment_number,
                enrollment_date: student.enrollment_date ?? '',
                course_id: student.course_id ?? (student as any).course?.id ?? '',
                sub_course_id: student.sub_course_id ?? (student as any).sub_course?.id ?? '',
                assigned_counsellor: student.assigned_counsellor ?? '',
                status: student.status as any,
                incentive_amount: student.incentive_amount ?? 0,
                total_fee: student.total_fee ?? 0,
                amount_paid: student.amount_paid ?? 0,
            } as any)
        }
        load()
    }, [student, reset])

    useEffect(() => {
        if (!selectedCourseId) { setSubCourses([]); return }
        supabase.from('sub_courses').select('*').eq('course_id', selectedCourseId)
            .then(({ data }) => {
                const sds = (data ?? []) as any[]
                if (student.sub_course && student.sub_course.course_id === selectedCourseId) {
                    if (!sds.find(x => x.id === student.sub_course?.id)) sds.push(student.sub_course)
                }
                setSubCourses([...sds])
                if (selectedCourseId === (student.course_id || student.course?.id)) {
                    setValue('sub_course_id', (student.sub_course_id || (student as any).sub_course?.id || '') as any)
                }
            })
    }, [selectedCourseId, student, setValue])

    async function onSubmit(data: StudentFormData) {
        setLoading(true)
        try {
            const { error } = await supabase.from('students').update({
                ...data,
                updated_at: new Date().toISOString(),
            } as never).eq('id', student.id)

            if (error) throw error
            toast.success('Student profile updated')
            onSuccess()
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to update student')
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
                    <FieldWrapper label="Enrollment #" required error={errors.enrollment_number?.message}>
                        <div className="relative">
                            <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-400" />
                            <Input {...register('enrollment_number')} className="pl-9 bg-white border-purple-200 font-mono" />
                        </div>
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
                            <Select value={watch('assigned_counsellor') || ''} onValueChange={(v) => setValue('assigned_counsellor', v || '')}>
                                <SelectTrigger className="pl-9 bg-white border-purple-200">
                                    <SelectValue placeholder="Select counsellor" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="">Unassigned</SelectItem>
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

            <div className="bg-emerald-50/50 rounded-xl p-4 border border-emerald-100">
                <SectionHeader icon={BookOpen} title="Course Details" color="border-emerald-200" />
                <div className="grid grid-cols-2 gap-4">
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

                    <FieldWrapper label="Amount Paid">
                        <div className="relative">
                            <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-orange-400" />
                            <Input type="number" {...register('amount_paid', { valueAsNumber: true })} className="pl-9 bg-white border-orange-200 bg-gray-50" readOnly />
                        </div>
                    </FieldWrapper>
                </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
                <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white min-w-[120px]">
                    {loading ? 'Saving...' : 'Update Student'}
                </Button>
            </div>
        </form>
    )
}
