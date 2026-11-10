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
- The current-recipient RPC is the intended way to reveal the active recipient's bank details; member profile reads are restricted to the member and admins.
- Review the SQL policies and have a qualified engineer audit the database and API before handling real financial activity.
- Do not store or request online banking passwords, card PINs, OTPs, or card security codes.

## Current scope / known limitations

- Single contribution group, monthly rotation model.
- Manual bank transfer and administrator payment verification; no payment gateway.
- Member registration and bank onboarding are connected to Supabase Auth/DB.
- The starter provides cycle and contribution tables, but does not yet include a complete admin UI for creating cycles, collecting/validating each member's monthly contribution, editing the rotation list, password recovery, or notification delivery by SMS/email.
- Admin setup and initial member positions are configured with the SQL snippets above.
- No production build or live account connection is claimed until you configure credentials and run the test checklist in your environment.
