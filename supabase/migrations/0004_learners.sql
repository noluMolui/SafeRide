create table public.learners (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.profiles(id) on delete cascade,
  full_name text not null check (char_length(btrim(full_name)) between 2 and 100),
  school_name text not null check (char_length(btrim(school_name)) between 2 and 100),
  grade text not null check (grade in ('R','1','2','3','4','5','6','7','8','9','10','11','12')),
  home_address text not null check (char_length(btrim(home_address)) between 5 and 250),
  school_address text not null check (char_length(btrim(school_address)) between 5 and 250),
  emergency_contact_name text not null check (char_length(btrim(emergency_contact_name)) between 2 and 100),
  emergency_contact_relationship text not null check (char_length(btrim(emergency_contact_relationship)) between 2 and 50),
  emergency_contact_phone text not null check (emergency_contact_phone ~ '^\+[1-9][0-9]{7,14}$'),
  medical_notes text check (medical_notes is null or char_length(medical_notes) <= 1000),
  allergy_notes text check (allergy_notes is null or char_length(allergy_notes) <= 1000),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index learners_parent_idx on public.learners(parent_id);
create trigger trg_learners_updated before update on public.learners
  for each row execute function public.set_updated_at();

alter table public.learners enable row level security;
alter table public.learners force row level security;
revoke all on public.learners from public, anon, authenticated;
grant select, insert on public.learners to authenticated;
grant update (full_name, school_name, grade, home_address, school_address,
  emergency_contact_name, emergency_contact_relationship, emergency_contact_phone,
  medical_notes, allergy_notes, is_active) on public.learners to authenticated;

create policy learners_parent_select on public.learners for select to authenticated
  using (parent_id = (select auth.uid()));
create policy learners_parent_insert on public.learners for insert to authenticated
  with check (
    parent_id = (select auth.uid())
    and exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'parent')
  );
create policy learners_parent_update on public.learners for update to authenticated
  using (parent_id = (select auth.uid()))
  with check (parent_id = (select auth.uid()));