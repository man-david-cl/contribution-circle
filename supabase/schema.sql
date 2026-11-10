-- Contribution Circle: single-group starter schema for Supabase Postgres.
create extension if not exists pgcrypto;
create type public.member_role as enum ('member','admin');
create type public.withdrawal_status as enum ('pending','approved','rejected','paid');
create type public.cycle_status as enum ('open','collecting','completed');

create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 full_name text not null default '', username text unique not null,
 phone text not null default '', role public.member_role not null default 'member',
 position_number integer unique check(position_number is null or position_number > 0),
 bank_name text, bank_account_name text,
 bank_account_number text check(bank_account_number is null or bank_account_number ~ '^[0-9]{10}$'),
 is_active boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.group_settings (
 id uuid primary key default gen_random_uuid(), group_name text not null default 'Contribution Circle',
 contribution_amount numeric(14,2) not null default 0 check(contribution_amount>=0),
 currency text not null default 'NGN', cycle_frequency text not null default 'monthly',
 current_position integer not null default 1 check(current_position>0),
 next_cycle_date date, created_at timestamptz not null default now()
);
create table public.contribution_cycles (
 id uuid primary key default gen_random_uuid(), cycle_number integer unique not null,
 month_label text not null, contribution_amount numeric(14,2) not null default 0,
 status public.cycle_status not null default 'open', due_date date,
 recipient_id uuid references public.profiles(id), created_at timestamptz not null default now(), completed_at timestamptz
);
create table public.contributions (
 id uuid primary key default gen_random_uuid(), cycle_id uuid not null references public.contribution_cycles(id),
 member_id uuid not null references public.profiles(id), amount numeric(14,2) not null check(amount>=0),
 status text not null default 'pending' check(status in ('pending','submitted','verified','rejected')),
 payment_reference text, paid_at timestamptz, verified_by uuid references public.profiles(id), created_at timestamptz not null default now(),
 unique(cycle_id,member_id)
);
create table public.withdrawal_requests (
 id uuid primary key default gen_random_uuid(), cycle_id uuid not null references public.contribution_cycles(id),
 member_id uuid not null references public.profiles(id), status public.withdrawal_status not null default 'pending',
 request_note text, admin_note text, payment_reference text, created_at timestamptz not null default now(),
 reviewed_at timestamptz, paid_at timestamptz, reviewed_by uuid references public.profiles(id)
);
create unique index one_unresolved_withdrawal_per_cycle on public.withdrawal_requests(cycle_id) where status in ('pending','approved');
create table public.transactions (
 id uuid primary key default gen_random_uuid(), cycle_id uuid references public.contribution_cycles(id),
 member_id uuid references public.profiles(id), withdrawal_request_id uuid references public.withdrawal_requests(id),
 transaction_type text not null check(transaction_type in ('contribution','withdrawal')),
 amount numeric(14,2) not null default 0, reference text, created_at timestamptz not null default now()
);
create table public.notifications (
 id uuid primary key default gen_random_uuid(), member_id uuid references public.profiles(id) on delete cascade,
 title text not null, message text not null, read_at timestamptz, created_at timestamptz not null default now()
);
create table public.audit_logs (
 id uuid primary key default gen_random_uuid(), actor_id uuid references public.profiles(id),
 action text not null, entity_type text not null, entity_id uuid, details jsonb not null default '{}', created_at timestamptz not null default now()
);

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin
 insert into public.profiles(id,full_name,username,phone)
 values(new.id,coalesce(new.raw_user_meta_data->>'full_name',''),coalesce(nullif(new.raw_user_meta_data->>'username',''),split_part(new.email,'@',1)||'_'||substr(new.id::text,1,6)),coalesce(new.raw_user_meta_data->>'phone',''));
 return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create or replace function public.get_current_recipient() returns table(member_id uuid,full_name text,phone text,position_number integer,bank_name text,bank_account_name text,bank_account_number text) language sql stable security definer set search_path=public as $$
 select p.id,p.full_name,p.phone,p.position_number,p.bank_name,p.bank_account_name,p.bank_account_number
 from public.profiles p join public.group_settings g on p.position_number=g.current_position
 where p.is_active=true and p.bank_account_number is not null limit 1; $$;
grant execute on function public.get_current_recipient() to authenticated;

create or replace function public.request_current_withdrawal() returns uuid language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); pos integer; cycleid uuid; reqid uuid;
begin
 if uid is null then raise exception 'Authentication required'; end if;
 select position_number into pos from public.profiles where id=uid and is_active=true;
 if pos is null then raise exception 'Member is not active or has no assigned position'; end if;
 if not exists(select 1 from public.group_settings where current_position=pos) then raise exception 'It is not your turn to receive the contribution'; end if;
 select id into cycleid from public.contribution_cycles where status in ('open','collecting') order by cycle_number desc limit 1;
 if cycleid is null then raise exception 'No open contribution cycle is configured'; end if;
 insert into public.withdrawal_requests(cycle_id,member_id) values(cycleid,uid) returning id into reqid;
 insert into public.notifications(member_id,title,message) select id,'Withdrawal requested','The current recipient has submitted a withdrawal request.' from public.profiles where role='admin';
 insert into public.audit_logs(actor_id,action,entity_type,entity_id) values(uid,'withdrawal_requested','withdrawal_request',reqid);
 return reqid;
end; $$;

create or replace function public.admin_update_withdrawal(p_request_id uuid,p_action text,p_admin_id uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare r public.withdrawal_requests; nextpos integer; maxpos integer;
begin
 if not exists(select 1 from public.profiles where id=p_admin_id and role='admin') then raise exception 'Administrator access required'; end if;
 select * into r from public.withdrawal_requests where id=p_request_id for update;
 if not found then raise exception 'Withdrawal request not found'; end if;
 if p_action='approve' then
   if r.status<>'pending' then raise exception 'Only pending requests can be approved'; end if;
   update public.withdrawal_requests set status='approved',reviewed_at=now(),reviewed_by=p_admin_id where id=p_request_id;
 elsif p_action='reject' then
   if r.status not in ('pending','approved') then raise exception 'This request cannot be rejected'; end if;
   update public.withdrawal_requests set status='rejected',reviewed_at=now(),reviewed_by=p_admin_id where id=p_request_id;
 elsif p_action='paid' then
   if r.status<>'approved' then raise exception 'Only approved requests can be marked paid'; end if;
   update public.withdrawal_requests set status='paid',paid_at=now(),reviewed_at=now(),reviewed_by=p_admin_id where id=p_request_id;
   insert into public.transactions(cycle_id,member_id,withdrawal_request_id,transaction_type,amount,reference)
   values(r.cycle_id,r.member_id,r.id,'withdrawal',coalesce((select contribution_amount from public.contribution_cycles where id=r.cycle_id),0),r.payment_reference);
   update public.contribution_cycles set status='completed',completed_at=now() where id=r.cycle_id;
   select max(position_number) into maxpos from public.profiles where is_active=true and position_number is not null;
   select current_position into nextpos from public.group_settings limit 1;
   if maxpos is null or maxpos=0 then raise exception 'No members have been assigned positions'; end if;
   nextpos:=case when nextpos>=maxpos then 1 else nextpos+1 end;
   update public.group_settings set current_position=nextpos;
   insert into public.notifications(member_id,title,message)
   select id,'Contribution turn updated','The previous withdrawal was confirmed paid. The active recipient has moved to the next position.' from public.profiles where is_active=true;
 else raise exception 'Invalid action'; end if;
 insert into public.audit_logs(actor_id,action,entity_type,entity_id,details) values(p_admin_id,'withdrawal_'||p_action,'withdrawal_request',p_request_id,jsonb_build_object('member_id',r.member_id));
 return jsonb_build_object('request_id',p_request_id,'action',p_action,'rotation_advanced',p_action='paid');
end; $$;

create or replace function public.is_admin(check_user uuid default auth.uid()) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.profiles where id=check_user and role='admin'); $$;

alter table public.profiles enable row level security;
alter table public.group_settings enable row level security;
alter table public.contribution_cycles enable row level security;
alter table public.contributions enable row level security;
alter table public.withdrawal_requests enable row level security;
alter table public.transactions enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;
create policy "Members can view own profile or admins can view all" on public.profiles for select to authenticated using (id=auth.uid() or public.is_admin());
create policy "Members can update own basic profile" on public.profiles for update to authenticated using (id=auth.uid()) with check (id=auth.uid());
create policy "Members can read group settings" on public.group_settings for select to authenticated using (true);
create policy "Members can read cycles" on public.contribution_cycles for select to authenticated using (true);
create policy "Members can read contributions" on public.contributions for select to authenticated using (true);
create policy "Members can read own withdrawal requests" on public.withdrawal_requests for select to authenticated using (member_id=auth.uid() or public.is_admin());
create policy "Members can read own transactions" on public.transactions for select to authenticated using (member_id=auth.uid() or public.is_admin());
create policy "Members can read own notifications" on public.notifications for select to authenticated using (member_id=auth.uid());
create policy "Members can mark own notifications read" on public.notifications for update to authenticated using (member_id=auth.uid()) with check (member_id=auth.uid());
create policy "Admins can read audit logs" on public.audit_logs for select to authenticated using (public.is_admin());

-- Bank columns are only writable by the owner at column level. Role and position remain admin/service controlled.
revoke update on public.profiles from authenticated;
grant update(bank_name,bank_account_name,bank_account_number) on public.profiles to authenticated;
-- RPC is callable by signed-in users; its internal checks enforce eligibility and admin role.
grant execute on function public.request_current_withdrawal() to authenticated;
grant execute on function public.admin_update_withdrawal(uuid,text,uuid) to service_role;
