create table public.members (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id),
 name text not null check(length(trim(name)) between 1 and 100), phone text, notes text,
 is_me boolean not null default false, is_active boolean not null default true,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(), unique(owner_id,id)
);
create unique index one_self_member_per_owner on public.members(owner_id) where is_me;
create table public.expense_categories (
 id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id),
 name text not null check(length(trim(name)) between 1 and 100),icon text,sort_order integer not null default 0 check(sort_order>=0),is_active boolean not null default true,
 created_at timestamptz not null default now(),unique(owner_id,id),unique(owner_id,name)
);
create table public.dues (
 id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id),member_id uuid not null,
 title text not null check(length(trim(title)) between 1 and 200),amount numeric(12,2) not null check(amount>0),due_date date,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),voided_at timestamptz,
 foreign key(owner_id,member_id) references public.members(owner_id,id)
);
create table public.transactions (
 id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id),
 type text not null check(type in ('contribution','expense','loan_received','loan_repayment')),amount numeric(12,2) not null check(amount>0),
 transaction_date timestamptz not null default now(),member_id uuid,paid_by_member_id uuid,category_id uuid,
 funding_source text,personal_settlement text,payment_method text,description text,notes text,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),voided_at timestamptz,void_reason text,
 foreign key(owner_id,member_id) references public.members(owner_id,id),
 foreign key(owner_id,paid_by_member_id) references public.members(owner_id,id),
 foreign key(owner_id,category_id) references public.expense_categories(owner_id,id),
 constraint valid_financial_combination check (
  (type in ('contribution','loan_received','loan_repayment') and member_id is not null and paid_by_member_id is null and category_id is null and funding_source is null and personal_settlement is null and payment_method is not null and payment_method in ('cash','bank_transfer','mobile_wallet','other'))
  or (type='expense' and category_id is not null and member_id is null and funding_source is not null and
    ((funding_source='group_funds' and paid_by_member_id is null and personal_settlement is null and payment_method is not null and payment_method in ('cash','bank_transfer','mobile_wallet','other'))
     or (funding_source='member_personal' and paid_by_member_id is not null and personal_settlement is not null and personal_settlement in ('contribution','loan') and payment_method is null)))
 ),
 check ((voided_at is null and void_reason is null) or (voided_at is not null and length(trim(void_reason))>=3))
);
create index dues_owner_member on public.dues(owner_id,member_id);
create index transactions_owner_date on public.transactions(owner_id,transaction_date desc);
create index transactions_member on public.transactions(owner_id,member_id);
create index transactions_payer on public.transactions(owner_id,paid_by_member_id);
create index transactions_category on public.transactions(owner_id,category_id);
create function public.touch_updated_at() returns trigger language plpgsql set search_path='' as $$begin new.updated_at=now();return new;end$$;
create trigger members_updated before update on public.members for each row execute function public.touch_updated_at();
create trigger dues_updated before update on public.dues for each row execute function public.touch_updated_at();
create trigger transactions_updated before update on public.transactions for each row execute function public.touch_updated_at();
-- Serializes financial changes per owner. The deferred check sees all changes in a statement.
create function public.lock_ledger() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='UPDATE' then
  if new.owner_id<>old.owner_id then raise exception 'Ownership cannot change'; end if;
  if old.voided_at is not null then raise exception 'Voided entries are immutable'; end if;
 end if;
 perform pg_advisory_xact_lock(hashtextextended(new.owner_id::text,0));return new;
end$$;
create trigger lock_financial_changes before insert or update on public.transactions for each row execute function public.lock_ledger();
create function public.validate_loan_balances() returns trigger language plpgsql set search_path='' as $$
begin
 if exists (
 select 1 from (
 select coalesce(t.member_id,t.paid_by_member_id) member,
 sum(case when t.type='loan_received' or (t.type='expense' and t.personal_settlement='loan') then t.amount when t.type='loan_repayment' then -t.amount else 0 end) balance
 from public.transactions t where t.owner_id=new.owner_id and t.voided_at is null group by 1
 ) b where b.balance<0
 ) then raise exception 'Repayment exceeds the outstanding loan. Edit or void repayments first.';end if;
 return new;
end$$;
create constraint trigger validate_loans after insert or update on public.transactions deferrable initially deferred for each row execute function public.validate_loan_balances();
alter table public.members enable row level security;
alter table public.expense_categories enable row level security;
alter table public.dues enable row level security;
alter table public.transactions enable row level security;
create policy members_select on public.members for select to authenticated using(owner_id=(select auth.uid()));
create policy members_insert on public.members for insert to authenticated with check(owner_id=(select auth.uid()));
create policy members_update on public.members for update to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
create policy categories_select on public.expense_categories for select to authenticated using(owner_id=(select auth.uid()));
create policy categories_insert on public.expense_categories for insert to authenticated with check(owner_id=(select auth.uid()));
create policy categories_update on public.expense_categories for update to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
create policy dues_select on public.dues for select to authenticated using(owner_id=(select auth.uid()));
create policy dues_insert on public.dues for insert to authenticated with check(owner_id=(select auth.uid()));
create policy dues_update on public.dues for update to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
create policy transactions_select on public.transactions for select to authenticated using(owner_id=(select auth.uid()));
create policy transactions_insert on public.transactions for insert to authenticated with check(owner_id=(select auth.uid()));
create policy transactions_update on public.transactions for update to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
-- No delete grants or policies: archive members/categories; void financial entries.
revoke all on public.members,public.expense_categories,public.dues,public.transactions from anon,authenticated;
grant select,insert,update on public.members,public.expense_categories,public.dues,public.transactions to authenticated;
revoke execute on function public.touch_updated_at(),public.lock_ledger(),public.validate_loan_balances() from public,anon,authenticated;
-- Default categories are created atomically on the first member, without privileged functions.
create function public.seed_ledger_categories() returns trigger language plpgsql set search_path='' as $$
begin
 insert into public.expense_categories(owner_id,name,sort_order)
 select new.owner_id,v.name,v.ord::integer from unnest(array['Court / Venue','Shuttlecocks','Net & Equipment','Tape & Accessories','Lighting / Electricity','Repairs & Maintenance','Tournament / Entry Fees','Other']) with ordinality as v(name,ord)
 on conflict(owner_id,name) do nothing;
 return new;
end$$;
create trigger seed_categories after insert on public.members for each row execute function public.seed_ledger_categories();
revoke execute on function public.seed_ledger_categories() from public,anon,authenticated;
