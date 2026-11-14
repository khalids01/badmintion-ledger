-- A single club, its permanently claimed administrator, and explicitly approved viewers.
alter table public.application_setup add column signup_enabled boolean not null default false;
create table private.club_accounts (
 user_id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null default '' check(length(display_name)<=100),
 approved_at timestamptz, banned_at timestamptz,
 updated_at timestamptz not null default now()
);
alter table private.club_accounts enable row level security;
revoke all on private.club_accounts from public,anon,authenticated;
create policy no_client_access on private.club_accounts for all to anon,authenticated using(false) with check(false);
insert into private.club_accounts(user_id,approved_at)
select u.id,case when a.user_id=u.id then now() end from auth.users u
left join private.ledger_administrator a on a.user_id=u.id;

create function private.club_owner() returns uuid language sql stable security definer set search_path='' as $$
 select a.user_id from private.ledger_administrator a
 where auth.uid() is not null and exists(
 select 1 from private.club_accounts c where c.user_id=auth.uid() and c.banned_at is null
 and (c.user_id=a.user_id or c.approved_at is not null))
$$;
create function private.club_admin() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and auth.uid()=private.club_owner()
$$;
create function private.account_access() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('is_admin',coalesce(private.club_admin(),false),'owner_id',private.club_owner(),
 'status',case when c.banned_at is not null then 'banned' when private.club_owner() is not null then 'active' else 'pending' end)
 from (select 1) seed left join private.club_accounts c on c.user_id=auth.uid()
 where auth.uid() is not null
$$;
create function public.account_access() returns jsonb language sql stable security invoker set search_path='' as $$select private.account_access()$$;
create function public.signup_enabled() returns boolean language sql stable security invoker set search_path='' as $$
 select coalesce((select signup_enabled from public.application_setup where singleton),false)
$$;

-- Keep the original administrator claim forever. Only the INSERT path checks signup settings.
create or replace function private.only_ledger_administrator() returns trigger
language plpgsql security definer set search_path='' as $$
declare claimed uuid;
begin
 select user_id into claimed from private.ledger_administrator where singleton;
 if claimed is null then
  if lower(new.email) is distinct from 'khalids8774@gmail.com' then raise exception 'Administrator setup is required.'; end if;
  if tg_op='INSERT' then
   insert into private.ledger_administrator(singleton,user_id) values(true,new.id) on conflict(singleton) do nothing;
   select user_id into claimed from private.ledger_administrator where singleton;
  end if;
 end if;
 if new.id=claimed then
  if lower(new.email) is distinct from 'khalids8774@gmail.com' then raise exception 'The administrator email is fixed.';end if;
  insert into public.application_setup(singleton) values(true) on conflict(singleton) do nothing;
 else
  if lower(new.email)='khalids8774@gmail.com' then raise exception 'Administrator setup is already complete.';end if;
  if tg_op='INSERT' and not coalesce((select signup_enabled from public.application_setup where singleton),false) then
   raise exception 'Signups are currently disabled.';
  end if;
 end if;
 return new;
end$$;
create function private.provision_club_account() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into private.club_accounts(user_id,approved_at) values(new.id,
 case when exists(select 1 from private.ledger_administrator where user_id=new.id) then now() end);
 return new;
end$$;
create trigger provision_club_account after insert on auth.users for each row execute function private.provision_club_account();

create function private.admin_users() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not coalesce(private.club_admin(),false) then raise exception 'Administrator access required.' using errcode='42501';end if;
 return jsonb_build_object('signup_enabled',(select signup_enabled from public.application_setup where singleton),
 'users',coalesce((select jsonb_agg(jsonb_build_object('id',u.id,'email',u.email,'name',c.display_name,
 'created_at',u.created_at,'last_sign_in_at',u.last_sign_in_at,'confirmed',u.email_confirmed_at is not null,
 'is_admin',u.id=a.user_id,'approved',c.approved_at is not null,'banned',c.banned_at is not null) order by u.created_at desc)
 from auth.users u join private.club_accounts c on c.user_id=u.id cross join private.ledger_administrator a),'[]'::jsonb));
end$$;
create function public.admin_users() returns jsonb language sql stable security invoker set search_path='' as $$select private.admin_users()$$;
create function private.manage_club(action text,target uuid default null,value text default null) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not coalesce(private.club_admin(),false) then raise exception 'Administrator access required.' using errcode='42501';end if;
 if action='signup' then
  if value not in ('true','false') or value is null then raise exception 'Invalid signup setting.';end if;
  update public.application_setup set signup_enabled=value::boolean where singleton;
  return;
 end if;
 if target is null or not exists(select 1 from private.club_accounts where user_id=target) then raise exception 'Account not found.';end if;
 if exists(select 1 from private.ledger_administrator where user_id=target) and action<>'rename' then raise exception 'The administrator cannot be banned or removed.';end if;
 case action
 when 'approve' then update private.club_accounts set approved_at=now(),updated_at=now() where user_id=target and banned_at is null;
 when 'remove' then update private.club_accounts set approved_at=null,updated_at=now() where user_id=target;
 when 'ban' then update private.club_accounts set banned_at=now(),updated_at=now() where user_id=target;
 when 'unban' then update private.club_accounts set banned_at=null,updated_at=now() where user_id=target;
 when 'rename' then
  if value is null or length(trim(value)) not between 1 and 100 then raise exception 'Name must be 1–100 characters.';end if;
  update private.club_accounts set display_name=trim(value),updated_at=now() where user_id=target;
 else raise exception 'Unknown action.';
 end case;
end$$;
create function public.manage_club(action text,target uuid default null,value text default null) returns void
language sql security invoker set search_path='' as $$select private.manage_club(action,target,value)$$;

-- Replace owner-only policies with shared reads for approved club members; only the administrator writes.
do $$declare p record;t text;begin
 for p in select tablename,policyname from pg_policies where schemaname='public' and tablename in ('members','expense_categories','dues','transactions') loop
 execute format('drop policy %I on public.%I',p.policyname,p.tablename);end loop;
 foreach t in array array['members','expense_categories','dues','transactions'] loop
 execute format('create policy club_read on public.%I for select to authenticated using(owner_id=(select private.club_owner()))',t);
 execute format('create policy admin_insert on public.%I for insert to authenticated with check(owner_id=(select auth.uid()) and (select private.club_admin()))',t);
 execute format('create policy admin_update on public.%I for update to authenticated using(owner_id=(select auth.uid()) and (select private.club_admin())) with check(owner_id=(select auth.uid()) and (select private.club_admin()))',t);
 end loop;
end$$;
grant usage on schema private to authenticated;
revoke execute on function private.club_owner(),private.club_admin(),private.account_access(),private.admin_users(),private.manage_club(text,uuid,text),private.provision_club_account() from public,anon,authenticated;
grant execute on function private.club_owner(),private.club_admin(),private.account_access(),private.admin_users(),private.manage_club(text,uuid,text) to authenticated;
revoke execute on function public.account_access(),public.admin_users(),public.manage_club(text,uuid,text),public.signup_enabled() from public,anon,authenticated;
grant execute on function public.account_access(),public.admin_users(),public.manage_club(text,uuid,text) to authenticated;
grant execute on function public.signup_enabled() to anon,authenticated;
