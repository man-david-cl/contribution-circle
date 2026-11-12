-- Secure member-visible recipient data and make withdrawal approval specific to each rotation turn.

-- Public recipient lookup intentionally excludes bank and phone fields.
create or replace function public.get_current_recipient_public()
returns table(member_id uuid, full_name text, position_number integer)
language sql
stable
security definer
set search_path=public
as $$
  select p.id, p.full_name, p.position_number
  from public.profiles p
  join public.group_settings g on p.position_number = g.current_position
  where p.is_active = true
    and p.bank_account_number is not null
  order by p.created_at
  limit 1;
$$;

-- Only an authenticated administrator can retrieve the private recipient details.
create or replace function public.admin_get_current_recipient()
returns table(
  member_id uuid,
  full_name text,
  phone text,
  position_number integer,
  bank_name text,
  bank_account_name text,
  bank_account_number text
)
language plpgsql
stable
security definer
set search_path=public
as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  ) then
    raise exception 'Administrator access required';
  end if;

  return query
  select p.id, p.full_name, p.phone, p.position_number,
         p.bank_name, p.bank_account_name, p.bank_account_number
  from public.profiles p
  join public.group_settings g on p.position_number = g.current_position
  where p.is_active = true
    and p.bank_account_number is not null
  order by p.created_at
  limit 1;
end;
$$;

-- Retire the old RPC because it returned private bank and phone fields to every member.
revoke all on function public.get_current_recipient() from public;
revoke all on function public.get_current_recipient() from anon;
revoke all on function public.get_current_recipient() from authenticated;

grant execute on function public.get_current_recipient_public() to authenticated;
grant execute on function public.admin_get_current_recipient() to authenticated;

-- Every time the rotation advances, require the administrator to activate access again.
create or replace function public.disable_withdrawals_when_rotation_changes()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  if new.current_position is distinct from old.current_position then
    new.withdrawal_enabled := false;
  end if;
  return new;
end;
$$;

drop trigger if exists group_rotation_disables_withdrawals on public.group_settings;
create trigger group_rotation_disables_withdrawals
before update of current_position on public.group_settings
for each row
execute function public.disable_withdrawals_when_rotation_changes();

-- Keep the withdrawal gate tied to the one configured group row.
create or replace function public.request_current_withdrawal()
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  uid uuid := auth.uid();
  pos integer;
  cycleid uuid;
  reqid uuid;
  current_pos integer;
  access_enabled boolean;
begin
  if uid is null then
    raise exception 'Authentication required';
  end if;

  select current_position, withdrawal_enabled
    into current_pos, access_enabled
  from public.group_settings
  order by created_at
  limit 1;

  if current_pos is null then
    raise exception 'Group rotation has not been configured';
  end if;

  if access_enabled is distinct from true then
    raise exception 'The administrator has not activated withdrawal access for this turn';
  end if;

  select position_number into pos
  from public.profiles
  where id = uid and is_active = true;

  if pos is null or pos <> current_pos then
    raise exception 'Only the current recipient can request a withdrawal';
  end if;

  select id into cycleid
  from public.contribution_cycles
  where status in ('open','collecting')
  order by cycle_number desc
  limit 1;

  if cycleid is null then
    raise exception 'No open contribution cycle is configured';
  end if;

  insert into public.withdrawal_requests(cycle_id, member_id)
  values(cycleid, uid)
  returning id into reqid;

  insert into public.notifications(member_id,title,message)
  select id,'Withdrawal requested','The current recipient has submitted a withdrawal request.'
  from public.profiles where role='admin';

  insert into public.audit_logs(actor_id,action,entity_type,entity_id)
  values(uid,'withdrawal_requested','withdrawal_request',reqid);

  return reqid;
end;
$$;

grant execute on function public.request_current_withdrawal() to authenticated;
