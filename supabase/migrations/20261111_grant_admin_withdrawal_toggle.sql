-- Allow authenticated admins to call the protected withdrawal toggle RPC.
-- The function itself verifies auth.uid(), the supplied admin ID, and profiles.role.
grant execute on function public.admin_set_withdrawal_enabled(boolean,uuid) to authenticated;
