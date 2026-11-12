-- Paystack contribution payments. Run after supabase/schema.sql.
create unique index if not exists transactions_reference_unique
  on public.transactions(reference) where reference is not null;
create unique index if not exists contributions_payment_reference_unique
  on public.contributions(payment_reference) where payment_reference is not null;

create or replace function public.confirm_contribution_payment(
  p_payment_reference text,
  p_provider_reference text
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.contributions%rowtype;
begin
  select * into c
  from public.contributions
  where payment_reference = p_payment_reference
  for update;

  if not found then
    raise exception 'Contribution payment reference not found';
  end if;

  if c.status = 'verified' then
    return false;
  end if;

  if c.status not in ('pending', 'submitted') then
    raise exception 'Contribution is not payable';
  end if;

  update public.contributions
    set status = 'verified', paid_at = now()
    where id = c.id;

  insert into public.transactions(
    cycle_id, member_id, transaction_type, amount, reference
  ) values (
    c.cycle_id, c.member_id, 'contribution', c.amount, p_payment_reference
  )
  on conflict (reference) where reference is not null do nothing;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, details)
  values (
    c.member_id, 'contribution_payment_verified', 'contribution', c.id,
    jsonb_build_object('payment_reference', p_payment_reference,
                       'provider_reference', p_provider_reference)
  );

  return true;
end;
$$;

revoke all on function public.confirm_contribution_payment(text,text) from public, anon, authenticated;
grant execute on function public.confirm_contribution_payment(text,text) to service_role;
