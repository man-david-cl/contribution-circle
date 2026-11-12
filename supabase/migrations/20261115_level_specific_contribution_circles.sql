-- Level-specific contribution circles.
-- Each group_settings row is an independent circle with its own roster,
-- contribution cycle sequence, current recipient and withdrawal gate.

do $$
begin
  if exists (select 1 from public.contribution_cycles where status in ('open','collecting')) then
    raise exception 'Finish or close the currently open legacy contribution cycle before enabling level-specific circles.';
  end if;
  if exists (select 1 from public.withdrawal_requests where status in ('pending','approved')) then
    raise exception 'Resolve pending or approved legacy withdrawals before enabling level-specific circles.';
  end if;
end $$;

alter table public.group_settings
  add column if not exists contribution_level smallint,
  add column if not exists circle_number integer not null default 1,
  add column if not exists max_members integer not null default 50,
  add column if not exists group_status text not null default 'active';

alter table public.group_settings
  drop constraint if exists group_settings_contribution_level_check;
alter table public.group_settings
  add constraint group_settings_contribution_level_check
  check (contribution_level is null or contribution_level between 1 and 5);
alter table public.group_settings
  drop constraint if exists group_settings_circle_number_check;
alter table public.group_settings
  add constraint group_settings_circle_number_check check (circle_number > 0);
alter table public.group_settings
  drop constraint if exists group_settings_max_members_check;
alter table public.group_settings
  add constraint group_settings_max_members_check check (max_members between 2 and 500);
alter table public.group_settings
  drop constraint if exists group_settings_group_status_check;
alter table public.group_settings
  add constraint group_settings_group_status_check
  check (group_status in ('active','paused','full','completed'));

-- Reuse the existing settings row for Level 1 / Circle 1. Historical cycles
-- remain untouched; new cycles are attached to a specific circle.
update public.group_settings
set contribution_level = 1,
    circle_number = 1,
    group_name = 'Level 1 · Circle 1',
    contribution_amount = 10000,
    current_position = 1,
    max_members = greatest(max_members, 50),
    group_status = 'active'
where id = (select id from public.group_settings order by created_at limit 1);

insert into public.group_settings
  (group_name, contribution_level, circle_number, contribution_amount, currency, cycle_frequency, current_position, max_members, group_status, withdrawal_enabled)
select 'Level 1 · Circle 1', 1, 1, 10000, 'NGN', 'monthly', 1, 50, 'active', false
where not exists (select 1 from public.group_settings where contribution_level = 1 and circle_number = 1);

insert into public.group_settings
  (group_name, contribution_level, circle_number, contribution_amount, currency, cycle_frequency, current_position, max_members, group_status, withdrawal_enabled)
select 'Level ' || levels.level_no || ' · Circle 1',
       levels.level_no,
       1,
       levels.level_no * 10000,
       'NGN',
       'monthly',
       1,
       50,
       'active',
       false
from (values (2),(3),(4),(5)) as levels(level_no)
where not exists (
  select 1 from public.group_settings g
  where g.contribution_level = levels.level_no and g.circle_number = 1
);

create unique index if not exists group_settings_level_circle_unique
  on public.group_settings(contribution_level, circle_number)
  where contribution_level is not null;

alter table public.profiles
  add column if not exists group_id uuid references public.group_settings(id) on delete set null;

-- Position numbers are scoped to a circle, not globally across the platform.
alter table public.profiles drop constraint if exists profiles_position_number_key;
drop index if exists public.profiles_position_number_key;

with ranked_members as (
  select p.id,
         g.id as group_id,
         row_number() over (
           partition by p.contribution_level
           order by p.position_number nulls last, p.created_at, p.id
         )::integer as new_position
  from public.profiles p
  join public.group_settings g
    on g.contribution_level = case p.contribution_level
      when 10000 then 1 when 20000 then 2 when 30000 then 3
      when 40000 then 4 when 50000 then 5 end
   and g.circle_number = 1
  where p.role = 'member' and p.contribution_level is not null
)
update public.profiles p
set group_id = ranked_members.group_id,
    position_number = ranked_members.new_position
from ranked_members
where p.id = ranked_members.id;

update public.group_settings g
set max_members = greatest(g.max_members, (
  select count(*)::integer from public.profiles p where p.group_id = g.id
))
where g.contribution_level is not null;

create unique index if not exists profiles_group_position_unique
  on public.profiles(group_id, position_number)
  where group_id is not null and position_number is not null;
create index if not exists profiles_group_id_idx on public.profiles(group_id);

alter table public.contribution_cycles
  add column if not exists group_id uuid references public.group_settings(id) on delete restrict;

alter table public.contribution_cycles
  drop constraint if exists contribution_cycles_cycle_number_key;
drop index if exists public.contribution_cycles_cycle_number_key;
create unique index if not exists contribution_cycles_group_cycle_unique
  on public.contribution_cycles(group_id, cycle_number)
  where group_id is not null;
create index if not exists contribution_cycles_group_status_idx
  on public.contribution_cycles(group_id, status);

-- Existing completed cycles are historical shared-pool records. All newly
-- opened cycles must belong to one circle.
create or replace function public.member_select_contribution_level(p_amount numeric)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  level_no smallint;
  current_profile public.profiles%rowtype;
  target_group public.group_settings%rowtype;
  next_position integer;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  level_no := case p_amount
    when 10000 then 1 when 20000 then 2 when 30000 then 3
    when 40000 then 4 when 50000 then 5 else null end;
  if level_no is null then raise exception 'Choose one of the five available contribution levels.'; end if;

  select * into current_profile from public.profiles where id = uid for update;
  if not found or current_profile.is_active is not true then
    raise exception 'Your membership is not active.';
  end if;

  if current_profile.group_id is not null and current_profile.contribution_level = p_amount then
    select * into target_group from public.group_settings where id = current_profile.group_id;
    if target_group.id is not null then
      return jsonb_build_object('success', true, 'group_id', target_group.id,
        'level', level_no, 'amount', p_amount, 'position_number', current_profile.position_number,
        'group_name', target_group.group_name);
    end if;
  end if;

  if current_profile.group_id is not null then
    if exists (
      select 1 from public.contribution_cycles c
      where c.group_id = current_profile.group_id and c.status in ('open','collecting')
    ) or exists (
      select 1 from public.withdrawal_requests w
      join public.contribution_cycles c on c.id = w.cycle_id
      where c.group_id = current_profile.group_id and w.member_id = uid
        and w.status in ('pending','approved')
    ) then
      raise exception 'You cannot change levels while your current circle has an open cycle or unresolved withdrawal.';
    end if;
  end if;

  select * into target_group
  from public.group_settings g
  where g.contribution_level = level_no
    and g.group_status = 'active'
    and (select count(*) from public.profiles p where p.group_id = g.id and p.is_active = true) < g.max_members
  order by (select count(*) from public.profiles p where p.group_id = g.id and p.is_active = true), g.circle_number
  limit 1
  for update;

  if target_group.id is null then
    raise exception 'There is no available circle for this level. Please contact the administrator.';
  end if;

  select coalesce(max(position_number), 0) + 1 into next_position
  from public.profiles where group_id = target_group.id;

  update public.profiles
  set contribution_level = p_amount,
      group_id = target_group.id,
      position_number = next_position
  where id = uid;

  if current_profile.group_id is not null and current_profile.group_id <> target_group.id then
    update public.group_settings old_group
    set current_position = coalesce((
      select min(p.position_number) from public.profiles p
      where p.group_id = old_group.id and p.is_active = true
    ), 1),
    withdrawal_enabled = false
    where old_group.id = current_profile.group_id;
  end if;

  if target_group.current_position is null or not exists (
    select 1 from public.profiles p
    where p.group_id = target_group.id and p.position_number = target_group.current_position and p.is_active = true
  ) then
    update public.group_settings set current_position = next_position where id = target_group.id;
  end if;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, details)
  values(uid, 'contribution_level_selected', 'group_settings', target_group.id,
    jsonb_build_object('level', level_no, 'amount', p_amount, 'position_number', next_position));

  return jsonb_build_object(
    'success', true, 'group_id', target_group.id, 'level', level_no,
    'amount', p_amount, 'position_number', next_position,
    'group_name', target_group.group_name
  );
end;
$$;

revoke all on function public.member_select_contribution_level(numeric) from public, anon;
grant execute on function public.member_select_contribution_level(numeric) to authenticated;

create or replace function public.get_my_contribution_group_members()
returns table(
  member_id uuid,
  full_name text,
  position_number integer,
  is_current_recipient boolean,
  group_name text,
  contribution_level smallint,
  contribution_amount numeric,
  circle_number integer,
  current_position integer
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.full_name, p.position_number,
         p.position_number = g.current_position,
         g.group_name, g.contribution_level, g.contribution_amount,
         g.circle_number, g.current_position
  from public.profiles me
  join public.group_settings g on g.id = me.group_id
  join public.profiles p on p.group_id = g.id and p.is_active = true
  where me.id = auth.uid()
  order by p.position_number;
$$;

revoke all on function public.get_my_contribution_group_members() from public, anon;
grant execute on function public.get_my_contribution_group_members() to authenticated;

create or replace function public.get_current_recipient_public()
returns table(member_id uuid, full_name text, position_number integer)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.full_name, p.position_number
  from public.profiles me
  join public.group_settings g on g.id = me.group_id
  join public.profiles p on p.group_id = g.id
    and p.position_number = g.current_position
    and p.is_active = true
    and p.bank_account_number is not null
  where me.id = auth.uid()
  limit 1;
$$;

revoke all on function public.get_current_recipient_public() from public, anon;
grant execute on function public.get_current_recipient_public() to authenticated;

create or replace function public.admin_create_contribution_group(
  p_admin_id uuid,
  p_level smallint,
  p_group_name text,
  p_max_members integer,
  p_frequency text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  new_group public.group_settings%rowtype;
  amount numeric;
  next_circle integer;
begin
  if auth.uid() is not null and auth.uid() <> p_admin_id then raise exception 'Administrator identity mismatch'; end if;
  if not exists(select 1 from public.profiles where id=p_admin_id and role='admin') then raise exception 'Administrator access required'; end if;
  if p_level not between 1 and 5 then raise exception 'Select a valid contribution level.'; end if;
  if p_max_members not between 2 and 500 then raise exception 'Circle capacity must be between 2 and 500.'; end if;
  if p_frequency not in ('weekly','biweekly','monthly','quarterly','yearly') then raise exception 'Select a valid contribution frequency.'; end if;

  amount := p_level * 10000;
  select coalesce(max(circle_number),0)+1 into next_circle
  from public.group_settings where contribution_level=p_level;

  insert into public.group_settings(
    group_name, contribution_level, circle_number, contribution_amount,
    currency, cycle_frequency, current_position, max_members, group_status, withdrawal_enabled
  ) values (
    coalesce(nullif(trim(p_group_name),''), 'Level '||p_level||' · Circle '||next_circle),
    p_level, next_circle, amount, 'NGN', p_frequency, 1, p_max_members, 'active', false
  ) returning * into new_group;

  insert into public.audit_logs(actor_id,action,entity_type,entity_id,details)
  values(p_admin_id,'contribution_circle_created','group_settings',new_group.id,
    jsonb_build_object('level',p_level,'circle_number',next_circle,'capacity',p_max_members));

  return jsonb_build_object('id',new_group.id,'group_name',new_group.group_name,
    'level',p_level,'circle_number',next_circle,'contribution_amount',amount);
end;
$$;

revoke all on function public.admin_create_contribution_group(uuid,smallint,text,integer,text) from public, anon;
grant execute on function public.admin_create_contribution_group(uuid,smallint,text,integer,text) to authenticated;

create or replace function public.admin_update_contribution_group(
  p_admin_id uuid,
  p_group_id uuid,
  p_contribution_amount numeric,
  p_cycle_frequency text,
  p_max_members integer,
  p_group_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  g public.group_settings%rowtype;
begin
  if auth.uid() is not null and auth.uid() <> p_admin_id then raise exception 'Administrator identity mismatch'; end if;
  if not exists(select 1 from public.profiles where id=p_admin_id and role='admin') then raise exception 'Administrator access required'; end if;
  select * into g from public.group_settings where id=p_group_id for update;
  if not found then raise exception 'Contribution circle not found.'; end if;
  if p_contribution_amount <= 0 or p_contribution_amount > 10000000 then raise exception 'Enter a valid contribution amount.'; end if;
  if p_cycle_frequency not in ('weekly','biweekly','monthly','quarterly','yearly') then raise exception 'Select a valid contribution frequency.'; end if;
  if p_max_members not between 2 and 500 then raise exception 'Circle capacity must be between 2 and 500.'; end if;
  if p_group_status not in ('active','paused','completed') then raise exception 'Select a valid circle status.'; end if;
  if p_max_members < (select count(*) from public.profiles where group_id=p_group_id and is_active=true) then
    raise exception 'Capacity cannot be lower than the current active member count.';
  end if;
  if p_contribution_amount <> g.contribution_amount and exists (
    select 1 from public.contribution_cycles where group_id=p_group_id and status in ('open','collecting')
  ) then raise exception 'Finish the open cycle before changing its contribution amount.'; end if;

  update public.group_settings
  set contribution_amount=p_contribution_amount,
      cycle_frequency=p_cycle_frequency,
      max_members=p_max_members,
      group_status=p_group_status
  where id=p_group_id;

  insert into public.audit_logs(actor_id,action,entity_type,entity_id,details)
  values(p_admin_id,'contribution_circle_updated','group_settings',p_group_id,
    jsonb_build_object('contribution_amount',p_contribution_amount,'cycle_frequency',p_cycle_frequency,
      'max_members',p_max_members,'group_status',p_group_status));

  return jsonb_build_object('success',true,'group_id',p_group_id);
end;
$$;

revoke all on function public.admin_update_contribution_group(uuid,uuid,numeric,text,integer,text) from public, anon;
grant execute on function public.admin_update_contribution_group(uuid,uuid,numeric,text,integer,text) to authenticated;

create or replace function public.admin_open_group_cycle(p_admin_id uuid, p_group_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  g public.group_settings%rowtype;
  recipient public.profiles%rowtype;
  cycle_id uuid;
  cycle_no integer;
  due_on date;
begin
  if auth.uid() is not null and auth.uid() <> p_admin_id then raise exception 'Administrator identity mismatch'; end if;
  if not exists(select 1 from public.profiles where id=p_admin_id and role='admin') then raise exception 'Administrator access required'; end if;

  select * into g from public.group_settings where id=p_group_id for update;
  if not found then raise exception 'Contribution circle not found.'; end if;
  if g.group_status <> 'active' then raise exception 'Activate this circle before opening a cycle.'; end if;
  if g.contribution_amount <= 0 then raise exception 'Set a contribution amount greater than zero.'; end if;

  if exists(select 1 from public.contribution_cycles where group_id=p_group_id and status in ('open','collecting')) then
    select id,cycle_number into cycle_id,cycle_no from public.contribution_cycles
    where group_id=p_group_id and status in ('open','collecting') order by cycle_number desc limit 1;
    return jsonb_build_object('created',false,'cycle_id',cycle_id,'cycle_number',cycle_no,'message','This circle already has an open cycle.');
  end if;

  select * into recipient from public.profiles
  where group_id=p_group_id and is_active=true and position_number=g.current_position
    and bank_account_number is not null limit 1;
  if recipient.id is null then raise exception 'Assign an active member with bank details to the current recipient position first.'; end if;
  if (select count(*) from public.profiles where group_id=p_group_id and is_active=true) < 2 then
    raise exception 'A circle needs at least two active members before its rotation can begin.';
  end if;

  select coalesce(max(cycle_number),0)+1 into cycle_no
  from public.contribution_cycles where group_id=p_group_id;
  due_on := coalesce(g.next_cycle_date,
    case when g.cycle_frequency='weekly' then current_date+7
         when g.cycle_frequency='biweekly' then current_date+14
         when g.cycle_frequency='quarterly' then (current_date+interval '3 months')::date
         when g.cycle_frequency='yearly' then (current_date+interval '1 year')::date
         else (current_date+interval '1 month')::date end);

  insert into public.contribution_cycles(group_id,cycle_number,month_label,contribution_amount,status,due_date,recipient_id)
  values(p_group_id,cycle_no,to_char(due_on,'FMMonth YYYY'),g.contribution_amount,'open',due_on,recipient.id)
  returning id into cycle_id;

  insert into public.audit_logs(actor_id,action,entity_type,entity_id,details)
  values(p_admin_id,'contribution_cycle_opened','contribution_cycle',cycle_id,
    jsonb_build_object('group_id',p_group_id,'recipient_id',recipient.id,'position_number',recipient.position_number));

  return jsonb_build_object('created',true,'cycle_id',cycle_id,'cycle_number',cycle_no,
    'recipient',recipient.full_name,'position_number',recipient.position_number,'due_date',due_on);
end;
$$;

revoke all on function public.admin_open_group_cycle(uuid,uuid) from public, anon;
grant execute on function public.admin_open_group_cycle(uuid,uuid) to authenticated;

create or replace function public.admin_set_group_withdrawal_enabled(
  p_enabled boolean, p_group_id uuid, p_admin_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and auth.uid() <> p_admin_id then raise exception 'Administrator identity mismatch'; end if;
  if not exists(select 1 from public.profiles where id=p_admin_id and role='admin') then raise exception 'Administrator access required'; end if;
  if not exists(select 1 from public.group_settings where id=p_group_id) then raise exception 'Contribution circle not found.'; end if;
  if p_enabled and not exists(
    select 1 from public.contribution_cycles c
    join public.group_settings g on g.id=c.group_id
    join public.profiles p on p.group_id=g.id and p.position_number=g.current_position and p.is_active=true
    where g.id=p_group_id and c.status in ('open','collecting') and p.bank_account_number is not null
  ) then raise exception 'Open a cycle and assign an eligible recipient before enabling withdrawals.'; end if;

  update public.group_settings set withdrawal_enabled=p_enabled where id=p_group_id;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,details)
  values(p_admin_id,case when p_enabled then 'group_withdrawals_enabled' else 'group_withdrawals_disabled' end,
    'group_settings',p_group_id,jsonb_build_object('withdrawal_enabled',p_enabled));
  return jsonb_build_object('success',true,'withdrawal_enabled',p_enabled,'group_id',p_group_id);
end;
$$;

revoke all on function public.admin_set_group_withdrawal_enabled(boolean,uuid,uuid) from public, anon;
grant execute on function public.admin_set_group_withdrawal_enabled(boolean,uuid,uuid) to authenticated;

create or replace function public.request_current_withdrawal()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  member_row public.profiles%rowtype;
  group_row public.group_settings%rowtype;
  cycle_id uuid;
  request_id uuid;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  select * into member_row from public.profiles where id=uid and is_active=true;
  if member_row.id is null or member_row.group_id is null then raise exception 'Choose a contribution level before requesting a withdrawal.'; end if;
  select * into group_row from public.group_settings where id=member_row.group_id;
  if group_row.withdrawal_enabled is distinct from true then raise exception 'The administrator has not activated withdrawal access for your circle.'; end if;
  if member_row.position_number <> group_row.current_position then raise exception 'Only the current recipient in your circle can request a withdrawal.'; end if;
  select id into cycle_id from public.contribution_cycles
  where group_id=member_row.group_id and status in ('open','collecting')
  order by cycle_number desc limit 1;
  if cycle_id is null then raise exception 'Your circle has no open contribution cycle.'; end if;

  insert into public.withdrawal_requests(cycle_id,member_id) values(cycle_id,uid) returning id into request_id;
  insert into public.notifications(member_id,title,message)
  select id,'Withdrawal requested','The current recipient in your contribution circle has submitted a withdrawal request.'
  from public.profiles where role='admin';
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,details)
  values(uid,'withdrawal_requested','withdrawal_request',request_id,jsonb_build_object('group_id',member_row.group_id));
  return request_id;
end;
$$;

grant execute on function public.request_current_withdrawal() to authenticated;

-- Level assignment is now performed only by the guarded RPC, not direct profile updates.
revoke update (contribution_level) on public.profiles from authenticated;

-- Retire single-global-group RPCs so they cannot create unassigned legacy cycles
-- or change the first circle behind the new per-circle controls.
revoke all on function public.admin_open_initial_cycle(uuid) from public, anon, authenticated;
revoke all on function public.admin_update_group_contribution_amount(uuid,numeric) from public, anon, authenticated;
revoke all on function public.admin_set_withdrawal_enabled(boolean,uuid) from public, anon, authenticated;

create or replace function public.admin_update_withdrawal(
  p_request_id uuid, p_action text, p_admin_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.withdrawal_requests%rowtype;
  cycle_row public.contribution_cycles%rowtype;
  g public.group_settings%rowtype;
  next_member public.profiles%rowtype;
  next_cycle_id uuid;
  next_cycle_no integer;
  due_on date;
  next_label text;
begin
  if auth.uid() is not null and auth.uid() <> p_admin_id then raise exception 'Administrator identity mismatch'; end if;
  if not exists(select 1 from public.profiles where id=p_admin_id and role='admin') then raise exception 'Administrator access required'; end if;
  select * into r from public.withdrawal_requests where id=p_request_id for update;
  if not found then raise exception 'Withdrawal request not found'; end if;
  select * into cycle_row from public.contribution_cycles where id=r.cycle_id for update;
  if cycle_row.group_id is null then raise exception 'This is a legacy shared-pool request. Resolve it using the legacy administrator workflow.'; end if;
  select * into g from public.group_settings where id=cycle_row.group_id for update;

  if p_action='approve' then
    if r.status<>'pending' then raise exception 'Only pending requests can be approved.'; end if;
    update public.withdrawal_requests set status='approved',reviewed_at=now(),reviewed_by=p_admin_id where id=p_request_id;
  elsif p_action='reject' then
    if r.status not in ('pending','approved') then raise exception 'This request cannot be rejected.'; end if;
    update public.withdrawal_requests set status='rejected',reviewed_at=now(),reviewed_by=p_admin_id where id=p_request_id;
  elsif p_action='paid' then
    if r.status<>'approved' then raise exception 'Only approved requests can be marked paid.'; end if;
    if r.member_id is null then raise exception 'Withdrawal recipient is missing.'; end if;
    update public.withdrawal_requests set status='paid',paid_at=now(),reviewed_at=now(),reviewed_by=p_admin_id where id=p_request_id;

    insert into public.transactions(cycle_id,member_id,withdrawal_request_id,transaction_type,amount,reference)
    values(r.cycle_id,r.member_id,r.id,'withdrawal',0,r.payment_reference);

    update public.contribution_cycles set status='completed',completed_at=now() where id=r.cycle_id;

    select * into next_member from public.profiles
    where group_id=g.id and is_active=true and bank_account_number is not null
      and position_number>g.current_position order by position_number limit 1;
    if next_member.id is null then
      select * into next_member from public.profiles
      where group_id=g.id and is_active=true and bank_account_number is not null
      order by position_number limit 1;
    end if;
    if next_member.id is null then raise exception 'No active member with bank details is available for the next turn in this circle.'; end if;

    update public.group_settings set current_position=next_member.position_number,withdrawal_enabled=false where id=g.id;

    select coalesce(max(cycle_number),0)+1 into next_cycle_no
    from public.contribution_cycles where group_id=g.id;
    due_on := coalesce(g.next_cycle_date,
      case when g.cycle_frequency='weekly' then current_date+7
           when g.cycle_frequency='biweekly' then current_date+14
           when g.cycle_frequency='quarterly' then (current_date+interval '3 months')::date
           when g.cycle_frequency='yearly' then (current_date+interval '1 year')::date
           else (current_date+interval '1 month')::date end);
    next_label := to_char(due_on,'FMMonth YYYY');

    insert into public.contribution_cycles(group_id,cycle_number,month_label,contribution_amount,status,due_date,recipient_id)
    values(g.id,next_cycle_no,next_label,g.contribution_amount,'open',due_on,next_member.id)
    returning id into next_cycle_id;

    insert into public.notifications(member_id,title,message)
    select id,'Circle rotation updated',
      'The payout for '||g.group_name||' was confirmed. The next recipient is '||
      coalesce(next_member.full_name,'the next member')||' (position #'||next_member.position_number||').'
    from public.profiles where group_id=g.id and is_active=true;
  else
    raise exception 'Invalid withdrawal action.';
  end if;

  insert into public.audit_logs(actor_id,action,entity_type,entity_id,details)
  values(p_admin_id,'withdrawal_'||p_action,'withdrawal_request',p_request_id,
    jsonb_build_object('group_id',cycle_row.group_id,'member_id',r.member_id,
      'next_cycle_id',case when p_action='paid' then next_cycle_id else null end,
      'next_position',case when p_action='paid' then next_member.position_number else null end));

  return jsonb_build_object('request_id',p_request_id,'action',p_action,
    'rotation_advanced',p_action='paid','group_id',cycle_row.group_id,
    'next_cycle_id',case when p_action='paid' then next_cycle_id else null end,
    'next_position',case when p_action='paid' then next_member.position_number else null end,
    'withdrawal_enabled',false);
end;
$$;

revoke all on function public.admin_update_withdrawal(uuid,text,uuid) from public, anon;
grant execute on function public.admin_update_withdrawal(uuid,text,uuid) to service_role;

comment on table public.group_settings is
  'Each row represents an independent contribution circle. Rotation and withdrawal access are isolated per circle.';
comment on column public.profiles.group_id is
  'The contribution circle this member belongs to. Position numbers are unique within this circle.';
comment on column public.contribution_cycles.group_id is
  'The contribution circle whose members fund this cycle and whose rotation advances when its payout is confirmed.';
