-- This public table contains only a non-sensitive setup flag, never account identifiers.
create table public.application_setup(singleton boolean primary key default true check(singleton));
alter table public.application_setup enable row level security;
revoke all on public.application_setup from public,anon,authenticated;
grant select on public.application_setup to anon,authenticated;
create policy read_setup_status on public.application_setup for select to anon,authenticated using(true);
insert into public.application_setup(singleton) select true where exists(select 1 from private.ledger_administrator);
create policy no_client_access on private.ledger_administrator for all to anon,authenticated using(false) with check(false);
create or replace function private.only_ledger_administrator() returns trigger
language plpgsql security definer set search_path='' as $$
declare claimed uuid;
begin
 if lower(new.email) is distinct from 'khalids8774@gmail.com' then raise exception 'This ledger is restricted to its designated administrator.';end if;
 if tg_op='INSERT' then
  insert into private.ledger_administrator(singleton,user_id) values(true,new.id) on conflict(singleton) do nothing;
 end if;
 select user_id into claimed from private.ledger_administrator where singleton;
 if claimed is distinct from new.id then raise exception 'Administrator setup is already complete. Sign in or reset your password.';end if;
 insert into public.application_setup(singleton) values(true) on conflict(singleton) do nothing;
 return new;
end$$;
create or replace function public.administrator_setup_complete() returns boolean
language sql stable security invoker set search_path='' as $$select exists(select 1 from public.application_setup)$$;
