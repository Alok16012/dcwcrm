import { z } from 'zod'

export const studentSchema = z.object({
    full_name: z.string().min(2, 'Name required'),
    phone: z.string().min(10, 'Valid phone required'),
    email: z.string().email().optional().or(z.literal('')),
    guardian_name: z.string().optional().or(z.literal('')),
    city: z.string().optional(),
    enrollment_number: z.string().min(1, 'Enrollment number required'),
    enrollment_date: z.string().optional(),
    course_id: z.string().uuid().optional().or(z.literal('')),
    sub_course_id: z.string().uuid().optional().or(z.literal('')),
    assigned_counsellor: z.string().uuid().optional().or(z.literal('')),
    status: z.enum(['active', 'completed', 'dropped', 'on_hold']),
    total_fee: z.number().min(0).optional(),
    amount_paid: z.number().min(0).optional(),
    incentive_amount: z.number().min(0).optional(),
})

export type StudentFormData = z.infer<typeof studentSchema>
