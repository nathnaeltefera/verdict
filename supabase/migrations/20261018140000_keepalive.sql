-- Something cheap for .github/workflows/keepalive.yml to call. Supabase pauses
-- a free-plan project after a week without database traffic, and the receipt
-- reader never queries the database, so without this the project goes idle
-- however often receipts are scanned.

create or replace function public.keepalive()
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select now();
$$;

revoke all on function public.keepalive() from public;
grant execute on function public.keepalive() to anon, authenticated;
