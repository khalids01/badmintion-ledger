begin;
-- Fixture provisioning only. This replacement is never committed or visible to
-- concurrent clients; rollback restores the real one-time setup trigger.
create or replace function private.only_ledger_administrator() returns trigger
language plpgsql security invoker set search_path='' as $$begin return new;end$$;
insert into auth.users(id,email) values ('10000000-0000-4000-8000-000000000001','ledger-test-a@example.invalid'),('10000000-0000-4000-8000-000000000002','ledger-test-b@example.invalid');
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
insert into public.members(id,owner_id,name,is_me) values('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Test A',true);
insert into public.transactions(owner_id,member_id,type,amount,payment_method) values('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','loan_received',1000,'cash');
insert into public.transactions(owner_id,member_id,type,amount,payment_method) values('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','loan_repayment',400,'cash');
set constraints all immediate;
do $$begin
 if (select count(*) from public.expense_categories)<>8 then raise exception 'Default categories failed';end if;
 begin
 insert into public.transactions(owner_id,member_id,type,amount,payment_method) values('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','loan_repayment',601,'cash');
 raise exception 'Overpayment accepted';
 exception when raise_exception then if sqlerrm='Overpayment accepted' then raise;end if;end;
 begin
 insert into public.transactions(owner_id,type,amount,funding_source) values('10000000-0000-4000-8000-000000000001','expense',50,'group_funds');
 raise exception 'Invalid expense accepted';exception when check_violation then null;end;
end$$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
do $$begin
 if exists(select 1 from public.members) or exists(select 1 from public.transactions) or exists(select 1 from public.expense_categories) then raise exception 'RLS leaked rows';end if;
 begin
 insert into public.members(owner_id,name) values('10000000-0000-4000-8000-000000000001','Intruder');raise exception 'Cross owner insert accepted';exception when insufficient_privilege then null;end;
 begin
 insert into public.dues(owner_id,member_id,title,amount) values('10000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','Cross owner',50);raise exception 'Cross owner FK accepted';exception when foreign_key_violation then null;end;
end$$;
reset role;
select 'PASS: ownership RLS, foreign keys, default categories, transaction constraints and loan overpayment checks' as result;
rollback;
