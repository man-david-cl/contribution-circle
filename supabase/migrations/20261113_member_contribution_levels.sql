-- Members select their own recurring contribution amount.
alter table public.profiles
  add column if not exists contribution_level numeric(14,2);

alter table public.profiles
  drop constraint if exists profiles_contribution_level_allowed;

alter table public.profiles
  add constraint profiles_contribution_level_allowed
  check (contribution_level is null or contribution_level in (10000, 20000, 30000, 40000, 50000));

comment on column public.profiles.contribution_level is
  'Member-selected recurring contribution amount in NGN. Applies to future cycles/payments.';

-- The base schema revokes broad profile updates; grant only this additional
-- self-service field while retaining the existing column-level bank controls.
grant update(contribution_level) on public.profiles to authenticated;

-- Withdrawal transactions represent the complete shared pool for that cycle,
-- not the cycle's former single fixed contribution amount.
create or replace function public.set_shared_pool_withdrawal_amount()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.transaction_type = 'withdrawal' and new.cycle_id is not null then
    select coalesce(sum(c.amount), 0)
      into new.amount
    from public.contributions c
    where c.cycle_id = new.cycle_id
      and c.status = 'verified';
  end if;
  return new;
end;
$$;

drop trigger if exists transactions_shared_pool_withdrawal_amount on public.transactions;
create trigger transactions_shared_pool_withdrawal_amount
before insert on public.transactions
for each row execute function public.set_shared_pool_withdrawal_amount();

revoke all on function public.set_shared_pool_withdrawal_amount() from public, anon, authenticated;
