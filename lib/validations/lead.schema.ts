import { z } from 'zod'

export const leadSchema = z.object({
  full_name: z.string().min(2, 'Name required'),
  phone: z.string().min(10, 'Valid phone required'),
  email: z.string().email().optional().or(z.literal('')),
  city: z.string().optional(),
  state: z.string().optional(),
  course_id: z.string().uuid().optional().or(z.literal('')),
  sub_course_id: z.string().uuid().optional().or(z.literal('')),
  department_id: z.string().uuid().optional().or(z.literal('')),
  sub_section_id: z.string().uuid().optional().or(z.literal('')),
  session_id: z.string().uuid().optional().or(z.literal('')),
  status: z.enum(['new', 'contacted', 'interested', 'counselled', 'application_sent', 'converted', 'cold', 'lost']),
  source: z.enum(['website', 'walk_in', 'referral', 'whatsapp', 'phone', 'excel_import', 'social_media', 'other']),
  assigned_to: z.string().uuid().optional().or(z.literal('')),
  next_followup_date: z.string().optional(),
  notes: z.string().optional(),
  total_fee: z.number().positive().optional(),
})

export type LeadFormData = z.infer<typeof leadSchema>
