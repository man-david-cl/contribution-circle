-- Automatically hand over the contribution turn and open the next cycle only
-- after an administrator confirms that an approved withdrawal was actually paid.

create or replace function public.admin_update_withdrawal(
  p_request_id uuid,
  p_action text,
  p_admin_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.withdrawal_requests%rowtype;
  settings_row public.group_settings%rowtype;
  next_member public.profiles%rowtype;
  next_cycle_id uuid;
  next_cycle_number integer;
  next_due_date date;
  next_label text;
begin
  if auth.uid() is not null and auth.uid() <> p_admin_id then
    raise exception 'Administrator identity mismatch';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = p_admin_id and role = 'admin'
  ) then
    raise exception 'Administrator access required';
  end if;

  select * into settings_row
  from public.group_settings
  order by created_at
  limit 1
  for update;

  if not found then
    raise exception 'Group settings have not been configured';
  end if;

  select * into r
  from public.withdrawal_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Withdrawal request not found';
  end if;

  if p_action = 'approve' then
    if r.status <> 'pending' then
      raise exception 'Only pending requests can be approved';
    end if;

    update public.withdrawal_requests
    set status = 'approved', reviewed_at = now(), reviewed_by = p_admin_id
    where id = p_request_id;

  elsif p_action = 'reject' then
    if r.status not in ('pending','approved') then
      raise exception 'This request cannot be rejected';
    end if;

    update public.withdrawal_requests
    set status = 'rejected', reviewed_at = now(), reviewed_by = p_admin_id
    where id = p_request_id;

  elsif p_action = 'paid' then
    if r.status <> 'approved' then
      raise exception 'Only approved requests can be marked paid';
    end if;

    if r.member_id is null then
      raise exception 'Withdrawal recipient is missing';
    end if;

    -- Record payment and close the cycle that funded this recipient.
    update public.withdrawal_requests
    set status = 'paid', paid_at = now(), reviewed_at = now(), reviewed_by = p_admin_id
    where id = p_request_id;

    insert into public.transactions(
      cycle_id, member_id, withdrawal_request_id, transaction_type, amount, reference
    )
    select r.cycle_id, r.member_id, r.id, 'withdrawal',
           coalesce(c.contribution_amount, 0), r.payment_reference
    from public.contribution_cycles c
    where c.id = r.cycle_id;

    update public.contribution_cycles
    set status = 'completed', completed_at = now()
    where id = r.cycle_id;

    -- Find the next active member in position order, wrapping to the first.
    select * into next_member
    from public.profiles
    where is_active = true
      and position_number is not null
      and bank_account_number is not null
      and position_number > settings_row.current_position
    order by position_number
    limit 1;

    if next_member.id is null then
      select * into next_member
      from public.profiles
      where is_active = true
        and position_number is not null
        and bank_account_number is not null
      order by position_number
      limit 1;
    end if;

    if next_member.id is null then
      raise exception 'No active member with bank details is available for the next turn';
    end if;

    -- This update also disables withdrawal access through the rotation trigger.
    update public.group_settings
    set current_position = next_member.position_number,
        withdrawal_enabled = false
    where id = settings_row.id;

    -- Automatically create and open the next contribution cycle.
    -- If an open cycle already exists, reuse it and assign its recipient.
    select id, cycle_number into next_cycle_id, next_cycle_number
    from public.contribution_cycles
    where status in ('open','collecting')
    order by cycle_number desc
    limit 1
    for update;

    if next_cycle_id is null then
      select coalesce(max(cycle_number), 0) + 1
      into next_cycle_number
      from public.contribution_cycles;

      next_due_date := coalesce(
        settings_row.next_cycle_date,
        case
          when settings_row.cycle_frequency = 'weekly' then current_date + 7
          when settings_row.cycle_frequency = 'biweekly' then current_date + 14
          when settings_row.cycle_frequency = 'quarterly' then (current_date + interval '3 months')::date
          when settings_row.cycle_frequency = 'yearly' then (current_date + interval '1 year')::date
          else (current_date + interval '1 month')::date
        end
      );

      next_label := to_char(next_due_date, 'FMMonth YYYY');

      insert into public.contribution_cycles(
        cycle_number, month_label, contribution_amount, status, due_date, recipient_id
      )
      values(
        next_cycle_number,
        next_label,
        settings_row.contribution_amount,
        'open',
        next_due_date,
        next_member.id
      )
      returning id into next_cycle_id;
    else
      update public.contribution_cycles
      set recipient_id = next_member.id
      where id = next_cycle_id;
    end if;

    insert into public.notifications(member_id, title, message)
    select id,
      'Contribution turn updated',
      'Payment has been confirmed. The next recipient is ' ||
      coalesce(next_member.full_name, 'the next member') ||
      ' (position #' || next_member.position_number::text ||
      '). A new contribution cycle is now open.'
    from public.profiles
    where is_active = true;

  else
    raise exception 'Invalid action';
  end if;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, details)
  values(
    p_admin_id,
    'withdrawal_' || p_action,
    'withdrawal_request',
    p_request_id,
    jsonb_build_object(
      'member_id', r.member_id,
      'next_cycle_id', case when p_action = 'paid' then next_cycle_id else null end,
      'next_position', case when p_action = 'paid' then next_member.position_number else null end
    )
  );

  return jsonb_build_object(
    'request_id', p_request_id,
    'action', p_action,
    'rotation_advanced', p_action = 'paid',
    'next_cycle_id', case when p_action = 'paid' then next_cycle_id else null end,
    'next_position', case when p_action = 'paid' then next_member.position_number else null end,
    'withdrawal_enabled', false
  );
end;
$$;

revoke all on function public.admin_update_withdrawal(uuid,text,uuid) from public;
grant execute on function public.admin_update_withdrawal(uuid,text,uuid) to service_role;
