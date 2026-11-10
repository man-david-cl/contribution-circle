# Deployment checklist

- [ ] Create Supabase project
- [ ] Run `supabase/schema.sql`
- [ ] Configure Supabase URL, anon key and server-only service role key
- [ ] Configure Supabase auth redirect URLs
- [ ] Register first admin and promote it using the SQL in README
- [ ] Add group settings and assign member positions
- [ ] Create the first contribution cycle
- [ ] Test with at least two member accounts
- [ ] Confirm only current recipient can request withdrawal
- [ ] Confirm pending/approved request does not advance rotation
- [ ] Confirm paid action advances exactly one position
- [ ] Push repository to GitHub
- [ ] Import into Vercel and configure environment variables
- [ ] Add production auth callback URL to Supabase
- [ ] Run a complete end-to-end test on the deployed URL
