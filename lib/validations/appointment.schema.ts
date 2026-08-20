import { z } from 'zod'

export const appointmentSchema = z
  .object({
    lead_id: z.string().uuid('Select a lead'),
    appointment_type: z.enum(['office_visit', 'google_meet']),
    host_id: z.string().uuid('Select who will host'),
    scheduled_date: z.string().min(1, 'Pick a date'),
    scheduled_time: z.string().min(1, 'Pick a slot'),
    meet_link: z.string().optional().or(z.literal('')),
    notes: z.string().optional(),
  })
  // Mirrors the DB's appointments_meet_link_required check — catches the
  // mistake in the form before the round trip, not just after.
  .refine(
    (data) => data.appointment_type !== 'google_meet' || (data.meet_link ?? '').trim().length > 0,
    { message: 'Google Meet link is required', path: ['meet_link'] }
  )

export type AppointmentFormData = z.infer<typeof appointmentSchema>
