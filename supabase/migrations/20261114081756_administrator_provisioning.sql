create or replace function private.only_ledger_administrator() returns trigger language plpgsql set search_path='' as $$
begin
 if lower(new.email) is distinct from 'khalids8774@gmail.com' and current_user not in ('postgres','supabase_admin') then
 raise exception 'This is a private ledger. Only the designated administrator can create an account.';
 end if;
 return new;
end$$;
