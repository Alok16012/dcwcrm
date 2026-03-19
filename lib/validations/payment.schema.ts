import { z } from 'zod'

export const paymentSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  payment_mode: z.enum(['cash', 'upi', 'card', 'neft', 'rtgs', 'cheque', 'other']),
  payment_date: z.string().min(1, 'Date required'),
  receipt_number: z.string().optional(),
  notes: z.string().optional(),
})

export type PaymentFormData = z.infer<typeof paymentSchema>
