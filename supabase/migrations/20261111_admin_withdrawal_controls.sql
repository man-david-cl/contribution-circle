-- Contribution Circle: administrator-controlled global withdrawal switch.
-- Apply this migration in the Supabase SQL Editor after the existing schema.

alter table public.group_settings
 add column if not exists withdrawal_enabled boolean not null default false;

-- Ensure the single-group application has a settings row to control.
insert into public.group_settings(group_name)
select 'Contribution Circle'
where not exists (select 1 from public.group_settings);

create or replace function public.request_current_withdrawal()
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
 uid uuid:=auth.uid();
 pos integer;
 cycleid uuid;
 reqid uuid;
begin
 if uid is null then raise exception 'Authentication required'; end if;
 if not exists(select 1 from public.group_settings where withdrawal_enabled=true) then
  raise exception 'Withdrawal requests are currently disabled by the administrator';
 end if;
 select position_number into pos from public.profiles where id=uid and is_active=true;
 if pos is null then raise exception 'Member is not active or has no assigned position'; end if;
 if not exists(select 1 from public.group_settings where current_position=pos) then raise exception 'It is not your turn to receive the contribution'; end if;
 select id into cycleid from public.contribution_cycles where status in ('open','collecting') order by cycle_number desc limit 1;
 if cycleid is null then raise exception 'No open contribution cycle is configured'; end if;
 insert into public.withdrawal_requests(cycle_id,member_id) values(cycleid,uid) returning id into reqid;
 insert into public.notifications(member_id,title,message)
  select id,'Withdrawal requested','The current recipient has submitted a withdrawal request.' from public.profiles where role='admin';
 insert into public.audit_logs(actor_id,action,entity_type,entity_id)
  values(uid,'withdrawal_requested','withdrawal_request',reqid);
 return reqid;
end;
$$;

create or replace function public.admin_set_withdrawal_enabled(p_enabled boolean,p_admin_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
 setting_id uuid;
begin
 if auth.uid() is not null and auth.uid()<>p_admin_id then
  raise exception 'Administrator identity mismatch';
 end if;
 if not exists(select 1 from public.profiles where id=p_admin_id and role='admin') then
  raise exception 'Administrator access required';
 end if;
 select id into setting_id from public.group_settings order by created_at limit 1 for update;
 if setting_id is null then raise exception 'Group settings have not been configured'; end if;
 update public.group_settings set withdrawal_enabled=p_enabled where id=setting_id;
 insert into public.audit_logs(actor_id,action,entity_type,entity_id,details)
  values(p_admin_id,case when p_enabled then 'withdrawals_enabled' else 'withdrawals_disabled' end,
   'group_settings',setting_id,jsonb_build_object('withdrawal_enabled',p_enabled));
 return jsonb_build_object('withdrawal_enabled',p_enabled);
end;
$$;

revoke all on function public.admin_set_withdrawal_enabled(boolean,uuid) from public;
grant execute on function public.admin_set_withdrawal_enabled(boolean,uuid) to service_role;

grant execute on function public.request_current_withdrawal() to authenticated;
