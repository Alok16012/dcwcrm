-- Ensure the 'student-documents' storage bucket exists (used by admission docs,
-- portal manager and mentorship screenshots). Public read, authenticated upload.

insert into storage.buckets (id, name, public)
values ('student-documents', 'student-documents', true)
on conflict (id) do nothing;

-- Authenticated users can upload to the bucket
drop policy if exists "student_docs_auth_upload" on storage.objects;
create policy "student_docs_auth_upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'student-documents');

-- Authenticated users can update/overwrite (upsert)
drop policy if exists "student_docs_auth_update" on storage.objects;
create policy "student_docs_auth_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'student-documents');

-- Anyone can read (bucket is public)
drop policy if exists "student_docs_public_read" on storage.objects;
create policy "student_docs_public_read" on storage.objects
  for select
  using (bucket_id = 'student-documents');
