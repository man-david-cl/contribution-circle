-- Create the first contribution cycle safely from the administrator dashboard.
create or replace function public.admin_open_initial_cycle(p_admin_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  settings_row public.group_settings%rowtype;
  recipient public.profiles%rowtype;
  existing_cycle public.contribution_cycles%rowtype;
  new_cycle_id uuid;
  new_cycle_number integer;
  due_on date;
  label text;
begin
  if auth.uid() is not null and auth.uid() <> p_admin_id then
    raise exception 'Administrator identity mismatch';
  end if;
  if not exists (select 1 from public.profiles where id = p_admin_id and role = 'admin') then
    raise exception 'Administrator access required';
  end if;

  select * into settings_row
  from public.group_settings
  order by created_at
  limit 1
  for update;
  if not found then raise exception 'Group settings have not been configured'; end if;

  select * into existing_cycle
  from public.contribution_cycles
  where status in ('open','collecting')
  order by cycle_number desc
  limit 1
  for update;

  if existing_cycle.id is not null then
    return jsonb_build_object('created', false, 'cycle_id', existing_cycle.id,
      'cycle_number', existing_cycle.cycle_number, 'message', 'An open contribution cycle already exists.');
  end if;

  select * into recipient
  from public.profiles
  where is_active = true
    and position_number = settings_row.current_position
  limit 1;

  if recipient.id is null then
    raise exception 'The current recipient is not assigned to an active member. Check the group position.';
  end if;
  if coalesce(settings_row.contribution_amount, 0) <= 0 then
    raise exception 'Set a contribution amount greater than zero in group settings before opening a cycle.';
  end if;

  select coalesce(max(cycle_number), 0) + 1 into new_cycle_number
  from public.contribution_cycles;

  due_on := coalesce(
    settings_row.next_cycle_date,
    case
      when settings_row.cycle_frequency = 'weekly' then current_date + 7
      when settings_row.cycle_frequency = 'biweekly' then current_date + 14
      when settings_row.cycle_frequency = 'quarterly' then (current_date + interval '3 months')::date
      when settings_row.cycle_frequency = 'yearly' then (current_date + interval '1 year')::date
      else (current_date + interval '1 month')::date
    end
  );
  label := to_char(due_on, 'FMMonth YYYY');

  insert into public.contribution_cycles(
    cycle_number, month_label, contribution_amount, status, due_date, recipient_id
  )
  values(new_cycle_number, label, settings_row.contribution_amount, 'open', due_on, recipient.id)
  returning id into new_cycle_id;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, details)
  values(p_admin_id, 'initial_contribution_cycle_opened', 'contribution_cycle', new_cycle_id,
    jsonb_build_object('recipient_id', recipient.id, 'position_number', recipient.position_number));

  return jsonb_build_object('created', true, 'cycle_id', new_cycle_id,
    'cycle_number', new_cycle_number, 'recipient', recipient.full_name,
    'position_number', recipient.position_number, 'due_date', due_on);
end;
$$;

revoke all on function public.admin_open_initial_cycle(uuid) from public;
grant execute on function public.admin_open_initial_cycle(uuid) to authenticated;
