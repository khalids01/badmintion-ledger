begin;
do $$
declare first_id uuid:=gen_random_uuid();
begin
 if public.administrator_setup_complete() then
  raise notice 'Existing administrator preserved; test must run on a fresh test database';
  return;
 end if;
 insert into auth.users(id,email) values(first_id,'khalids8774@gmail.com');
 if not public.administrator_setup_complete() then raise exception 'Setup claim was not recorded';end if;
 begin
  insert into auth.users(id,email) values(gen_random_uuid(),'khalids8774@gmail.com');
  raise exception 'Second administrator accepted';
 exception when raise_exception then if sqlerrm='Second administrator accepted' then raise;end if;end;
 begin
  update auth.users set email='changed@example.invalid' where id=first_id;
  raise exception 'Administrator email changed';
 exception when raise_exception then if sqlerrm='Administrator email changed' then raise;end if;end;
 delete from auth.users where id=first_id;
 if not public.administrator_setup_complete() then raise exception 'Deletion reopened setup';end if;
 begin
  insert into auth.users(id,email) values(gen_random_uuid(),'khalids8774@gmail.com');
  raise exception 'Deleted administrator was recreated';
 exception when raise_exception then if sqlerrm='Deleted administrator was recreated' then raise;end if;end;
end$$;
select 'PASS: administrator claimed once; second account and email changes blocked; deletion does not reopen setup' as result;
rollback;
