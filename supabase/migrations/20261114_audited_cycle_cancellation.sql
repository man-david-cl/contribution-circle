-- Audited cancellation for unpaid contribution cycles.
-- The enum label is committed by the preceding 20261113 migration.

alter table public.contributions
  drop constraint if exists contributions_status_check;
alter table public.contributions
  add constraint contributions_status_check
  check (status in ('pending', 'submitted', 'verified', 'rejected', 'cancelled'));

alter table public.contribution_cycles
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid references public.profiles(id),
  add column if not exists cancellation_reason text;

create or replace function public.confirm_contribution_payment(
  p_payment_reference text,
  p_provider_reference text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  c public.contributions%rowtype;
  cycle_state text;
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

  select status::text into cycle_state
  from public.contribution_cycles
  where id = c.cycle_id
  for update;

  if cycle_state is distinct from 'open' and cycle_state is distinct from 'collecting' then
    raise exception 'This contribution cycle is no longer accepting payments.';
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
$function$;

create or replace function public.admin_cancel_contribution_cycle(
  p_cycle_id uuid,
  p_admin_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  cycle_row public.contribution_cycles%rowtype;
  cancelled_count integer := 0;
  reason_text text := nullif(trim(p_reason), '');
begin
  if auth.uid() is not null and auth.uid() <> p_admin_id then
    raise exception 'Administrator identity mismatch';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = p_admin_id and role = 'admin' and is_active = true
  ) then
    raise exception 'Administrator access required';
  end if;

  if reason_text is null or length(reason_text) < 10 or length(reason_text) > 500 then
    raise exception 'Enter a cancellation reason between 10 and 500 characters.';
  end if;

  -- Lock contribution rows first, matching the payment-confirmation lock order.
  perform 1
  from public.contributions
  where cycle_id = p_cycle_id
  order by id
  for update;

  select * into cycle_row
  from public.contribution_cycles
  where id = p_cycle_id
  for update;

  if not found then
    raise exception 'Contribution cycle not found.';
  end if;

  if cycle_row.status::text not in ('open', 'collecting') then
    raise exception 'Only an open or collecting cycle can be cancelled.';
  end if;

  if exists (
    select 1 from public.contributions
    where cycle_id = p_cycle_id and status = 'verified'
  ) or exists (
    select 1 from public.transactions
    where cycle_id = p_cycle_id and transaction_type = 'contribution'
  ) then
    raise exception 'This cycle has a verified payment. Reconcile the payment before cancellation.';
  end if;

  if exists (
    select 1 from public.withdrawal_requests
    where cycle_id = p_cycle_id
  ) then
    raise exception 'This cycle has a withdrawal request and must be reviewed manually.';
  end if;

  update public.contributions
  set status = 'cancelled'
  where cycle_id = p_cycle_id and status in ('pending', 'submitted');
  get diagnostics cancelled_count = row_count;

  -- Dynamic SQL avoids using the new enum label before this migration commits.
  execute 'update public.contribution_cycles
           set status = ''cancelled'',
               cancelled_at = now(),
               cancelled_by = $1,
               cancellation_reason = $2
           where id = $3'
  using p_admin_id, reason_text, p_cycle_id;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, details)
  values (
    p_admin_id, 'contribution_cycle_cancelled', 'contribution_cycle', p_cycle_id,
    jsonb_build_object(
      'cycle_number', cycle_row.cycle_number,
      'amount', cycle_row.contribution_amount,
      'cancelled_contributions', cancelled_count,
      'reason', reason_text
    )
  );

  return jsonb_build_object(
    'success', true,
    'cycle_id', p_cycle_id,
    'cycle_number', cycle_row.cycle_number,
    'cancelled_contributions', cancelled_count,
    'rotation_advanced', false,
    'refund_issued', false
  );
end;
$function$;

revoke all on function public.admin_cancel_contribution_cycle(uuid, uuid, text) from public, anon;
grant execute on function public.admin_cancel_contribution_cycle(uuid, uuid, text) to authenticated;
