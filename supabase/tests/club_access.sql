-- All fixture accounts and changes roll back, including the signup toggle.
begin;
select set_config('test.root',(select user_id::text from private.ledger_administrator),true);
update public.application_setup set signup_enabled=false;
do $$begin
 begin
  insert into auth.users(id,email) values('b1111111-1111-4111-8111-111111111111','club-access-fixture@example.invalid');
  raise exception 'TEST FAILED: closed signup allowed';
 exception when raise_exception then
  if sqlerrm='TEST FAILED: closed signup allowed' then raise;end if;
 end;
end$$;
update public.application_setup set signup_enabled=true;
insert into auth.users(id,email) values('b1111111-1111-4111-8111-111111111111','club-access-fixture@example.invalid');
set local role authenticated;
select set_config('request.jwt.claim.sub','b1111111-1111-4111-8111-111111111111',true);
do $$begin
 if public.account_access()->>'status'<>'pending' then raise exception 'New account must be pending';end if;
 if exists(select 1 from public.members) or exists(select 1 from public.transactions) or exists(select 1 from public.dues) or exists(select 1 from public.expense_categories) then raise exception 'Pending account can read ledger';end if;
 begin perform public.manage_club('approve','b1111111-1111-4111-8111-111111111111');raise exception 'TEST FAILED: self approval';exception when insufficient_privilege then null;end;
 begin perform public.admin_users();raise exception 'TEST FAILED: user directory exposed';exception when insufficient_privilege then null;end;
 begin insert into public.members(owner_id,name) values(auth.uid(),'Forbidden');raise exception 'TEST FAILED: pending write';exception when insufficient_privilege then null;end;
end$$;
select set_config('request.jwt.claim.sub',current_setting('test.root'),true);
select public.manage_club('approve','b1111111-1111-4111-8111-111111111111');
insert into public.members(owner_id,name) values(auth.uid(),'Club access test member');
select set_config('request.jwt.claim.sub','b1111111-1111-4111-8111-111111111111',true);
do $$begin
 if public.account_access()->>'status'<>'active' or not exists(select 1 from public.members where name='Club access test member') then raise exception 'Approved user cannot read club';end if;
 begin insert into public.members(owner_id,name) values(auth.uid(),'Forbidden');raise exception 'TEST FAILED: viewer write';exception when insufficient_privilege then null;end;
 update public.members set name='Tampered' where name='Club access test member';
 if exists(select 1 from public.members where name='Tampered') then raise exception 'Viewer updated ledger';end if;
end$$;
select set_config('request.jwt.claim.sub',current_setting('test.root'),true);
select public.manage_club('ban','b1111111-1111-4111-8111-111111111111');
select set_config('request.jwt.claim.sub','b1111111-1111-4111-8111-111111111111',true);
do $$begin
 if public.account_access()->>'status'<>'banned' then raise exception 'Ban status missing';end if;
 if exists(select 1 from public.members) or exists(select 1 from public.transactions) or exists(select 1 from public.dues) or exists(select 1 from public.expense_categories) then raise exception 'Banned existing JWT can read';end if;
 begin perform public.manage_club('unban',auth.uid());raise exception 'TEST FAILED: self unban';exception when insufficient_privilege then null;end;
end$$;
select set_config('request.jwt.claim.sub',current_setting('test.root'),true);
select public.manage_club('unban','b1111111-1111-4111-8111-111111111111');
select set_config('request.jwt.claim.sub','b1111111-1111-4111-8111-111111111111',true);
do $$begin
 if public.account_access()->>'status'<>'active' then raise exception 'Unban did not restore membership';end if;
end$$;
select set_config('request.jwt.claim.sub',current_setting('test.root'),true);
select public.manage_club('remove','b1111111-1111-4111-8111-111111111111');
do $$begin
 begin perform public.manage_club('ban',auth.uid());raise exception 'TEST FAILED: admin ban';exception when raise_exception then if sqlerrm='TEST FAILED: admin ban' then raise;end if;end;
 begin perform public.manage_club('remove',auth.uid());raise exception 'TEST FAILED: admin removal';exception when raise_exception then if sqlerrm='TEST FAILED: admin removal' then raise;end if;end;
end$$;
select set_config('request.jwt.claim.sub','b1111111-1111-4111-8111-111111111111',true);
do $$begin
 if public.account_access()->>'status'<>'pending' or exists(select 1 from public.members) then raise exception 'Removal did not revoke access';end if;
end$$;
reset role;
select 'PASS: closed signup, pending denial, approval, read-only membership, immediate ban, unban, removal, administrator protection' as result;
rollback;
