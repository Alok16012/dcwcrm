-- Add 'updated' to the activity_type check constraint
alter table lead_activities drop constraint if exists lead_activities_activity_type_check;

alter table lead_activities add constraint lead_activities_activity_type_check 
check (activity_type in (
  'created','status_changed','assigned','transferred','note_added',
  'followup_set','payment_received','converted', 'document_uploaded', 'call_made', 'updated'
));
