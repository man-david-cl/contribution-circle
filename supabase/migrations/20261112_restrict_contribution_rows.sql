-- Restrict contribution rows to the owning member and administrators.
-- The previous policy allowed every authenticated member to read every
-- member's payment amount, status, and Paystack reference.
drop policy if exists "Members can read contributions" on public.contributions;

create policy "Members can read own contributions or admins can read all"
on public.contributions
for select
to authenticated
using (member_id = auth.uid() or public.is_admin());
