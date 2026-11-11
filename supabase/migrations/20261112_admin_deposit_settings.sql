-- Administrator-only configuration for the group's deposit destination and Paystack switch.
create or replace function public.admin_update_deposit_settings(
 p_admin_id uuid,
 p_bank_name text,
 p_account_name text,
 p_account_number text,
 p_paystack_enabled boolean
) returns jsonb
language plpgsql security definer set search_path=public as $$
declare setting_id uuid;
begin
 if auth.uid() is not null and auth.uid() <> p_admin_id then raise exception 'Administrator identity mismatch'; end if;
 if not exists(select 1 from public.profiles where id=p_admin_id and role='admin') then raise exception 'Administrator access required'; end if;
 select id into setting_id from public.group_settings order by created_at limit 1 for update;
 if setting_id is null then raise exception 'Group settings have not been configured'; end if;
 update public.group_settings set
  deposit_bank_name=nullif(trim(p_bank_name),''),
  deposit_account_name=nullif(trim(p_account_name),''),
  deposit_account_number=nullif(trim(p_account_number),''),
  paystack_enabled=coalesce(p_paystack_enabled,false)
 where id=setting_id;
 return jsonb_build_object('saved',true);
end; $$;
revoke all on function public.admin_update_deposit_settings(uuid,text,text,text,boolean) from public;
grant execute on function public.admin_update_deposit_settings(uuid,text,text,text,boolean) to authenticated;
