create table private.ledger_administrator (
 singleton boolean primary key default true check(singleton),
 user_id uuid not null unique,
 claimed_at timestamptz not null default now()
);
alter table private.ledger_administrator enable row level security;
revoke all on private.ledger_administrator from public,anon,authenticated;
-- Keep the claim if an Auth account is deleted: setup must never reopen implicitly.
insert into private.ledger_administrator(singleton,user_id)
select true,id from auth.users where lower(email)='khalids8774@gmail.com' order by created_at limit 1;
create or replace function private.only_ledger_administrator() returns trigger
language plpgsql security definer set search_path='' as $$
declare claimed uuid;
begin
 if lower(new.email) is distinct from 'khalids8774@gmail.com' then
  raise exception 'This ledger is restricted to its designated administrator.';
 end if;
 if tg_op='INSERT' then
  insert into private.ledger_administrator(singleton,user_id) values(true,new.id)
  on conflict(singleton) do nothing;
 end if;
 select user_id into claimed from private.ledger_administrator where singleton;
 if claimed is distinct from new.id then
  raise exception 'Administrator setup is already complete. Sign in or reset your password.';
 end if;
 return new;
end$$;
revoke execute on function private.only_ledger_administrator() from public,anon,authenticated;
create function public.administrator_setup_complete() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.ledger_administrator where singleton)
$$;
revoke all on function public.administrator_setup_complete() from public;
grant execute on function public.administrator_setup_complete() to anon,authenticated;
