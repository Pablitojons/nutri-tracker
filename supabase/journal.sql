-- Exécuter ce script dans SQL Editor Supabase (une fois).

create table if not exists journal (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  date date not null,
  meal_type text not null,
  food_name text not null,
  kcal numeric not null default 0,
  protein numeric not null default 0,
  carbs numeric not null default 0,
  fat numeric not null default 0,
  source text not null default 'manual'
);

create index if not exists journal_date_idx on journal (date desc);

alter table journal enable row level security;

drop policy if exists "journal_select_all" on journal;
drop policy if exists "journal_insert_all" on journal;
drop policy if exists "journal_update_all" on journal;
drop policy if exists "journal_delete_all" on journal;

create policy "journal_select_all" on journal for select using (true);
create policy "journal_insert_all" on journal for insert with check (true);
create policy "journal_update_all" on journal for update using (true);
create policy "journal_delete_all" on journal for delete using (true);
