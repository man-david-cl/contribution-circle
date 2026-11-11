-- Member bank-transfer deposit submissions with private receipt storage.
alter table public.group_settings
  add column if not exists deposit_bank_name text,
  add column if not exists deposit_account_name text,
  add column if not exists deposit_account_number text;

alter table public.contributions
  add column if not exists transfer_date date,
  add column if not exists receipt_path text,
  add column if not exists member_note text,
  add column if not exists reviewed_at timestamptz,
  add column if not exists review_note text;

create index if not exists contributions_member_created_idx
  on public.contributions(member_id, created_at desc);
create index if not exists contributions_cycle_status_idx
  on public.contributions(cycle_id, status);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('deposit-receipts','deposit-receipts',false,5242880,
  array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do update set public=false, file_size_limit=5242880,
  allowed_mime_types=array['image/jpeg','image/png','image/webp','application/pdf'];

drop policy if exists "Members can read contributions" on public.contributions;
create policy "Members can read own contributions or admins can read all"
  on public.contributions for select to authenticated
  using (member_id=auth.uid() or public.is_admin());

drop policy if exists "Members can read own deposit receipts" on storage.objects;
create policy "Members can read own deposit receipts"
  on storage.objects for select to authenticated
  using (bucket_id='deposit-receipts' and (storage.foldername(name))[1]=auth.uid()::text);

drop policy if exists "Members can upload own deposit receipts" on storage.objects;
create policy "Members can upload own deposit receipts"
  on storage.objects for insert to authenticated
  with check (bucket_id='deposit-receipts' and (storage.foldername(name))[1]=auth.uid()::text);

drop policy if exists "Admins can read deposit receipts" on storage.objects;
create policy "Admins can read deposit receipts"
  on storage.objects for select to authenticated
  using (bucket_id='deposit-receipts' and public.is_admin());
