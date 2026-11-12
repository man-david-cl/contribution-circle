-- Add the cancelled cycle state in its own committed migration.
-- PostgreSQL does not allow a newly added enum label to be used until the
-- transaction that adds it has committed.
alter type public.cycle_status add value if not exists 'cancelled';
