import { createServerClient } from '@/lib/supabase/server'
import { FormFieldsClient } from './client'

export default async function FormFieldsPage() {
  const supabase = await createServerClient()
  const { data: fields } = await supabase
    .from('lead_form_fields')
    .select('*')
    .order('display_order')

  return <FormFieldsClient fields={fields ?? []} />
}
