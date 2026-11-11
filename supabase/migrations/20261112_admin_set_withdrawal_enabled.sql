-- Safely allow an administrator to enable or disable withdrawal access.
create or replace function public.admin_set_withdrawal_enabled(
  p_enabled boolean,
  p_admin_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  settings_id uuid;
begin
  if auth.uid() is not null and auth.uid() <> p_admin_id then
    raise exception 'Administrator identity mismatch';
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = p_admin_id
      and role = 'admin'
  ) then
    raise exception 'Administrator access required';
  end if;

  select id
    into settings_id
  from public.group_settings
  order by created_at
  limit 1
  for update;

  if settings_id is null then
    raise exception 'Group settings have not been configured';
  end if;

  update public.group_settings
  set withdrawal_enabled = p_enabled
  where id = settings_id;

  return jsonb_build_object(
    'success', true,
    'withdrawal_enabled', p_enabled
  );
end;
$$;

revoke all on function public.admin_set_withdrawal_enabled(boolean, uuid) from public;
grant execute on function public.admin_set_withdrawal_enabled(boolean, uuid) to authenticated;
