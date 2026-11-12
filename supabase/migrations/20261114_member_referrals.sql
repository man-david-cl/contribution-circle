-- Member referral links and safe referral reporting.
alter table public.profiles
  add column if not exists referral_code text,
  add column if not exists referred_by uuid references public.profiles(id) on delete set null;

update public.profiles
set referral_code = upper(substr(md5(random()::text || clock_timestamp()::text || id::text), 1, 10))
where referral_code is null;

alter table public.profiles alter column referral_code set not null;
create unique index if not exists profiles_referral_code_unique on public.profiles(referral_code);
create index if not exists profiles_referred_by_idx on public.profiles(referred_by);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  referrer_id uuid;
  supplied_code text;
begin
  supplied_code := upper(nullif(trim(new.raw_user_meta_data->>'referral_code'), ''));
  if supplied_code is not null then
    select id into referrer_id
    from public.profiles
    where referral_code = supplied_code and is_active = true
    limit 1;
  end if;

  insert into public.profiles(id, full_name, username, phone, referral_code, referred_by)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(nullif(new.raw_user_meta_data->>'username', ''), split_part(new.email, '@', 1) || '_' || substr(new.id::text, 1, 6)),
    coalesce(new.raw_user_meta_data->>'phone', ''),
    upper(substr(md5(random()::text || clock_timestamp()::text || new.id::text), 1, 10)),
    referrer_id
  );
  return new;
end;
$$;

create or replace function public.get_my_referrals()
returns table(
  referral_code text,
  referred_member_id uuid,
  referred_full_name text,
  referred_at timestamptz,
  referred_is_active boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select me.referral_code, referred.id, referred.full_name, referred.created_at, referred.is_active
  from public.profiles me
  left join public.profiles referred on referred.referred_by = me.id
  where me.id = auth.uid()
  order by referred.created_at desc nulls last;
$$;

revoke all on function public.get_my_referrals() from public;
grant execute on function public.get_my_referrals() to authenticated;
