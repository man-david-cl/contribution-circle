-- Allow an administrator to configure the group's contribution amount.
create or replace function public.admin_update_group_contribution_amount(
  p_admin_id uuid,
  p_contribution_amount numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  setting_id uuid;
begin
  if auth.uid() is not null and auth.uid() <> p_admin_id then
    raise exception 'Administrator identity mismatch';
  end if;
  if not exists (select 1 from public.profiles where id = p_admin_id and role = 'admin') then
    raise exception 'Administrator access required';
  end if;
  if p_contribution_amount is null or p_contribution_amount <= 0 then
    raise exception 'Enter a contribution amount greater than zero.';
  end if;

  select id into setting_id
  from public.group_settings
  order by created_at
  limit 1
  for update;

  if setting_id is null then
    raise exception 'Group settings have not been configured';
  end if;

  update public.group_settings
  set contribution_amount = p_contribution_amount
  where id = setting_id;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, details)
  values (
    p_admin_id,
    'group_contribution_amount_updated',
    'group_settings',
    setting_id,
    jsonb_build_object('contribution_amount', p_contribution_amount)
  );

  return jsonb_build_object('contribution_amount', p_contribution_amount);
end;
$$;

revoke all on function public.admin_update_group_contribution_amount(uuid,numeric) from public;
grant execute on function public.admin_update_group_contribution_amount(uuid,numeric) to authenticated;
