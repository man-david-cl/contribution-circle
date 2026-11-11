-- Member deposits: manual bank transfer receipts + Paystack checkout.
alter table public.group_settings
  add column if not exists deposit_bank_name text,
  add column if not exists deposit_account_name text,
  add column if not exists deposit_account_number text,
  add column if not exists paystack_enabled boolean not null default false;

create table if not exists public.member_deposits (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles(id) on delete cascade,
  cycle_id uuid not null references public.contribution_cycles(id),
  amount numeric(14,2) not null check (amount > 0),
  currency text not null default 'NGN',
  payment_method text not null check (payment_method in ('bank_transfer','paystack')),
  status text not null default 'pending' check (status in ('pending','approved','rejected','paid')),
  receipt_path text,
  payment_reference text unique,
  transfer_date date,
  member_note text,
  admin_note text,
  verified_by uuid references public.profiles(id),
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists member_deposits_member_created_idx
  on public.member_deposits(member_id, created_at desc);
create index if not exists member_deposits_cycle_status_idx
  on public.member_deposits(cycle_id, status);

alter table public.member_deposits enable row level security;
drop policy if exists "Members can view own deposits and admins all" on public.member_deposits;
create policy "Members can view own deposits and admins all"
  on public.member_deposits for select to authenticated
  using (member_id = auth.uid() or public.is_admin());

drop policy if exists "Members can submit own bank transfer deposits" on public.member_deposits;
create policy "Members can submit own bank transfer deposits"
  on public.member_deposits for insert to authenticated
  with check (
    member_id = auth.uid()
    and payment_method = 'bank_transfer'
    and status = 'pending'
    and payment_reference is null
    and verified_by is null
    and verified_at is null
  );

drop policy if exists "Admins can update deposits" on public.member_deposits;
create policy "Admins can update deposits"
  on public.member_deposits for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Private receipt bucket. Files are only readable by their owner and administrators.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('deposit-receipts', 'deposit-receipts', false, 5242880,
        array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do update set public = false, file_size_limit = 5242880,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Members upload own deposit receipts" on storage.objects;
create policy "Members upload own deposit receipts"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'deposit-receipts'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Members and admins read deposit receipts" on storage.objects;
create policy "Members and admins read deposit receipts"
on storage.objects for select to authenticated
using (
  bucket_id = 'deposit-receipts'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_admin()
  )
);

grant select, insert on public.member_deposits to authenticated;
grant update on public.member_deposits to authenticated;
