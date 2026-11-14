create schema if not exists private;
create function private.only_ledger_administrator() returns trigger language plpgsql set search_path='' as $$
begin
 if lower(new.email) is distinct from 'khalids8774@gmail.com' then
 raise exception 'This is a private ledger. Only the designated administrator can create an account.';
 end if;
 return new;
end$$;
create trigger restrict_ledger_account before insert or update of email on auth.users for each row execute function private.only_ledger_administrator();
revoke all on schema private from public,anon,authenticated;
revoke execute on function private.only_ledger_administrator() from public,anon,authenticated;
