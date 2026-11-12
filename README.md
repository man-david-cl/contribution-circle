# Contribution Circle

A responsive Next.js + Supabase starter for a private rotating contribution group. The included flow covers registration, email confirmation, first-login bank setup, member dashboard, current recipient display, withdrawal request submission, admin review, and automatic position rotation after an administrator confirms payment.

> **Important:** This is a starter implementation that must be configured and tested in your own Supabase/Vercel accounts before real use. It does not move money or connect to a bank/payment gateway. Admins manually verify the transfer and mark it paid. Do not use this as a public money-holding service without legal, security, and financial review.

## Requirements

- Node.js 20.9 or later (Node 22 LTS recommended)
- A Supabase project
- A Vercel account (for hosting)
- GitHub account (recommended for deployment)

## 1. Install locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000.

On Windows PowerShell, copy the env template with:

```powershell
Copy-Item .env.example .env.local
```

## 2. Connect Supabase

1. Create a project at https://supabase.com/dashboard.
2. Open **Project Settings → API** (or **Data API** depending on dashboard version).
3. Copy the Project URL and anon/publishable key into `.env.local` as `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. Copy the service-role/secret key into `SUPABASE_SERVICE_ROLE_KEY`. This is server-only. Never prefix it with `NEXT_PUBLIC_`, commit it to Git, or paste it into chat.
5. In Supabase **SQL Editor**, open `supabase/schema.sql`, paste the complete file and run it.
6. In **Authentication → URL Configuration**, set Site URL to your local URL during local development (`http://localhost:3000`). Add `http://localhost:3000/auth/callback` to Redirect URLs. Later add your Vercel production domain and its `/auth/callback` URL.
7. In **Authentication → Providers → Email**, choose whether email confirmation is required. If enabled, test the confirmation email and redirect.

## 3. Create your first admin and group

Register your own account through `/register`, then confirm your email if required. In Supabase SQL Editor, replace the example email with the exact admin email you used and run:

```sql
update public.profiles p
set role = 'admin'
from auth.users u
where p.id = u.id and lower(u.email) = lower('admin@example.com');

insert into public.group_settings(group_name, contribution_amount, currency, cycle_frequency, current_position, next_cycle_date)
values ('My Contribution Circle', 10000, 'NGN', 'monthly', 1, current_date + interval '1 month')
on conflict do nothing;
```

Add members through the normal registration page. Assign their positions from SQL after they register. Example (replace email addresses):

```sql
update public.profiles p set position_number = v.position
from (values
  ('admin@example.com', 1),
  ('member2@example.com', 2),
  ('member3@example.com', 3)
) as v(email, position)
join auth.users u on lower(u.email) = lower(v.email)
where p.id = u.id;
```

Make sure every active member has a unique position number and has completed bank onboarding before starting the group.

Create the first contribution cycle:

```sql
insert into public.contribution_cycles(cycle_number, month_label, contribution_amount, status, due_date, recipient_id)
select 1, to_char(current_date, 'FMMonth YYYY'), contribution_amount, 'collecting', current_date + interval '1 month',
       (select id from public.profiles where position_number = 1 and is_active = true limit 1)
from public.group_settings limit 1;
```

For each new cycle, an administrator should create the next `contribution_cycles` row and set the recipient to the current position. The rotation RPC advances `group_settings.current_position` after a paid withdrawal; it does not automatically create the next month's cycle.

## 4. Run the app

```bash
npm run dev
```

Routes:

- `/` public landing page
- `/register` member registration (no bank fields)
- `/login` member login
- `/onboarding/bank` mandatory first-login bank setup
- `/dashboard` member dashboard
- `/admin` administrator dashboard

## 5. How the withdrawal process works

1. The current recipient sees their details and the **Request withdrawal** button.
2. The button calls the `request_current_withdrawal()` database function. The function checks the logged-in user is the current eligible recipient and prevents a duplicate open request for that cycle.
3. An administrator opens `/admin` and approves or rejects the request.
4. After independently verifying that the transfer really reached the recipient, the admin selects **Confirm paid**.
5. The database transaction marks the request paid, writes a transaction and audit record, completes the cycle, advances the active position, and notifies members. The position only advances at this last step.

## 6. Deploy to Vercel

1. Push this folder to a private GitHub repository.
2. In Vercel, choose **Add New → Project** and import the repository.
3. Add the same environment variables from `.env.local` in **Project Settings → Environment Variables**. Add them for Preview and Production as appropriate.
4. Set `NEXT_PUBLIC_APP_URL` to your production URL.
5. In Supabase Auth URL Configuration, add the production URL and `https://YOUR_DOMAIN/auth/callback` to allowed redirects.
6. Deploy. Test registration, email confirmation, first login, bank onboarding, member access, withdrawal request, admin approval, and payment confirmation in a separate test group before inviting real members.

## 7. Security and operational checklist

- Keep the Supabase service-role key server-only.
- Restrict who can access the Supabase dashboard and Vercel project.
- Set up database backups and review audit logs.
- Test RLS with at least two member accounts and one admin account.
- Member dashboards use a public recipient lookup that exposes only the recipient's name and position. The administrator-only recipient RPC exposes bank and phone details; member profile reads remain restricted.
- Review the SQL policies and have a qualified engineer audit the database and API before handling real financial activity.
- Do not store or request online banking passwords, card PINs, OTPs, or card security codes.

## Current scope / known limitations

- Single contribution group, monthly rotation model.
- Manual bank transfer and administrator payment verification; no payment gateway.
- Member registration and bank onboarding are connected to Supabase Auth/DB.
- The starter provides cycle and contribution tables, but does not yet include a complete admin UI for creating cycles, collecting/validating each member's monthly contribution, editing the rotation list, password recovery, or notification delivery by SMS/email.
- Admin setup and initial member positions are configured with the SQL snippets above.
- No production build or live account connection is claimed until you configure credentials and run the test checklist in your environment.


## 8. Paystack contribution payments (new feature branch)

The `feature/paystack-contributions` branch adds Paystack Checkout for active contribution cycles. It does not create a member cash wallet or hold funds: it records a successful payment against the member's existing contribution row, then writes a contribution transaction.

### Configure

1. Copy `.env.example` to `.env.local`.
2. Set the Supabase URL, anon/publishable key, and server-only service-role key.
3. Create or sign in to your Paystack account and copy the **test** secret key into `PAYSTACK_SECRET_KEY`. Never expose this key with a `NEXT_PUBLIC_` prefix or commit it.
4. In Supabase SQL Editor, first confirm that the original `supabase/schema.sql` has been applied. Then run `supabase/paystack-contributions.sql`.
5. In Paystack Dashboard → Settings / API & Webhooks, configure the webhook URL as `https://YOUR_DOMAIN/api/payments/webhook` (for local testing, use a secure tunnel URL that forwards to your local server).
6. Run `npm install` and `npm run dev`. Sign in as an active member and open `/dashboard/contribute`.

### Payment lifecycle

- The server reads the cycle amount from the database; the browser cannot choose or override the amount.
- Paystack receives the amount in kobo (NGN × 100).
- The return page verifies the reference directly against Paystack.
- The webhook verifies Paystack's `x-paystack-signature` against the raw request body and then independently verifies the transaction with Paystack.
- A database function locks the contribution row and marks it verified once. Repeated callback/webhook delivery does not create duplicate transaction records.

### Before going live

Test successful, cancelled, failed, repeated-webhook, mismatched-amount, and already-paid cases using Paystack test mode. Confirm that the matching contribution changes to `verified` and one `transactions` row is created. Configure the production secret only after test-mode verification and have the payment/database flow reviewed before accepting real contributions.


## 9. Restored administrator rotation controls

The redesigned administrator dashboard retains the original group-management workflow alongside the newer payment analytics. It includes the current recipient's private bank details, the member/position register, group contribution amount, initial-cycle setup, and a per-turn withdrawal enable/disable control. Confirming an approved withdrawal as paid advances to the next eligible member, creates or assigns the next open cycle, and disables withdrawal access until the administrator enables it for the new recipient.

### Apply the restored Supabase migrations

After the original `supabase/schema.sql` and the Paystack migration, run these files in the Supabase SQL Editor in this order:

1. `supabase/migrations/20261111_admin_withdrawal_controls.sql`
2. `supabase/migrations/20261111_member_privacy_per_turn_withdrawal.sql`
3. `supabase/migrations/20261111_auto_next_contribution_cycle.sql`
4. `supabase/migrations/20261112_admin_group_contribution_amount.sql`
5. `supabase/migrations/20261112_admin_open_initial_cycle.sql`
6. `supabase/migrations/20261112_admin_set_withdrawal_enabled.sql`

These migrations add the withdrawal switch, secure member-visible recipient data, restore admin-only bank details, and install the automatic rotation and cycle setup functions. Do not skip the order: later migrations replace earlier withdrawal and admin RPC definitions.

Once applied, open `/admin` and verify the recipient, bank details, member list, group amount, cycle state, and withdrawal switch before enabling withdrawals for a real group.
