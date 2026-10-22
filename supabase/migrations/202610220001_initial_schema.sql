create extension if not exists pgcrypto;

create type public.remote_policy as enum ('remote','hybrid','onsite','unspecified');
create type public.application_status as enum ('discovered','preparing','pending_review','approved','rejected','ready_to_submit','submitting','submitted','failed');

create or replace function public.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '', email text not null default '', phone text, location text, country text,
  preferred_locations text[] not null default '{}', linkedin_url text, portfolio_url text, github_url text,
  professional_summary text not null default '', years_experience numeric(4,1), desired_titles text[] not null default '{}',
  preferred_industries text[] not null default '{}', minimum_salary integer, salary_currency text default 'USD',
  employment_types text[] not null default '{}', remote_preference public.remote_policy default 'unspecified',
  work_authorization text, notice_period text, availability_date date,
  onboarding_draft jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create or replace function public.create_profile_for_auth_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, full_name, email)
  values(new.id, coalesce(new.raw_user_meta_data->>'full_name',''), coalesce(new.email,''))
  on conflict (id) do nothing;
  return new;
end; $$;
create trigger auth_user_profile after insert on auth.users
for each row execute function public.create_profile_for_auth_user();

create table public.resumes (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  original_name text not null, storage_path text not null unique, mime_type text not null check (mime_type in ('application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document')),
  byte_size bigint not null check (byte_size between 1 and 8388608), extracted_text text, is_primary boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.resume_versions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  resume_id uuid references public.resumes(id) on delete set null, job_id uuid, name text not null,
  content jsonb not null, content_hash text not null, is_ai_generated boolean not null default false,
  created_at timestamptz not null default now()
);
create table public.work_experiences (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  company text not null, title text not null, location text, start_date date, end_date date, is_current boolean not null default false,
  description text not null default '', achievements text[] not null default '{}', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.educations (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  institution text not null, degree text, field_of_study text, start_date date, end_date date, details text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.skills (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  name text not null, proficiency text, years_experience numeric(4,1), verified boolean not null default false,
  created_at timestamptz not null default now(), unique(user_id, name)
);
create table public.job_sources (
  id uuid primary key default gen_random_uuid(), name text not null unique, provider_key text not null unique,
  integration_type text not null check (integration_type in ('demo','api','feed','manual')), is_enabled boolean not null default false,
  terms_url text, last_synced_at timestamptz, created_at timestamptz not null default now()
);
create table public.jobs (
  id uuid primary key default gen_random_uuid(), source_id uuid not null references public.job_sources(id) on delete restrict,
  external_job_id text, title text not null, company text not null, location text, remote_policy public.remote_policy not null default 'unspecified',
  salary_min integer, salary_max integer, salary_currency text, employment_type text, experience_level text,
  description text not null, required_skills text[] not null default '{}', preferred_skills text[] not null default '{}',
  posted_at timestamptz, deadline_at timestamptz, original_url text not null, application_method text not null default 'manual',
  is_active boolean not null default true, last_verified_at timestamptz, normalized_url text not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(source_id, external_job_id), unique(source_id, normalized_url)
);
create table public.job_matches (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade, score smallint not null check(score between 0 and 100),
  matching_skills text[] not null default '{}', missing_skills text[] not null default '{}', explanation text not null default '',
  concerns text[] not null default '{}', created_at timestamptz not null default now(), unique(user_id, job_id)
);
create table public.applications (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete restrict, status public.application_status not null default 'discovered',
  current_revision uuid not null default gen_random_uuid(), approved_revision uuid, rejection_reason text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(user_id, job_id),
  check (approved_revision is null or approved_revision = current_revision)
);
create table public.application_documents (
  id uuid primary key default gen_random_uuid(), application_id uuid not null references public.applications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade, revision uuid not null, document_type text not null check(document_type in ('resume','cover_letter','summary')),
  content jsonb not null, content_hash text not null, is_ai_generated boolean not null default false, created_at timestamptz not null default now(), unique(application_id, revision, document_type)
);
create table public.application_answers (
  id uuid primary key default gen_random_uuid(), application_id uuid not null references public.applications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade, revision uuid not null, question text not null, answer text,
  needs_user_input boolean not null default false, created_at timestamptz not null default now()
);
create table public.application_approvals (
  id uuid primary key default gen_random_uuid(), application_id uuid not null references public.applications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade, revision uuid not null,
  content_fingerprint text not null, decision text not null check(decision in ('approved','rejected')),
  decided_at timestamptz not null default now(), unique(application_id, revision)
);
create table public.submission_attempts (
  id uuid primary key default gen_random_uuid(), application_id uuid not null references public.applications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade, revision uuid not null, idempotency_key text not null unique,
  state text not null check(state in ('queued','running','succeeded','failed')), attempt_count integer not null default 0,
  max_attempts integer not null default 3, next_attempt_at timestamptz, confirmation_reference text, safe_error text,
  started_at timestamptz, finished_at timestamptz, created_at timestamptz not null default now()
);
create table public.automation_settings (
  user_id uuid primary key references auth.users(id) on delete cascade, enabled boolean not null default false,
  daily_limit smallint not null default 5 check(daily_limit between 0 and 30), paused boolean not null default false,
  updated_at timestamptz not null default now()
);
create table public.audit_logs (
  id bigint generated always as identity primary key, user_id uuid references auth.users(id) on delete set null,
  action text not null, entity_type text not null, entity_id uuid, metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index jobs_search_idx on public.jobs using gin (to_tsvector('english', title || ' ' || company || ' ' || description));
create index jobs_active_posted_idx on public.jobs (is_active, posted_at desc);
create index matches_user_score_idx on public.job_matches (user_id, score desc);
create index applications_user_status_idx on public.applications (user_id, status, updated_at desc);
create index attempts_due_idx on public.submission_attempts (state, next_attempt_at) where state in ('queued','failed');

do $$ declare t text; begin
  foreach t in array array['profiles','resumes','work_experiences','educations','jobs','applications'] loop
    execute format('create trigger %I_set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t, t);
  end loop;
end $$;

alter table public.profiles enable row level security;
alter table public.resumes enable row level security;
alter table public.resume_versions enable row level security;
alter table public.work_experiences enable row level security;
alter table public.educations enable row level security;
alter table public.skills enable row level security;
alter table public.job_sources enable row level security;
alter table public.jobs enable row level security;
alter table public.job_matches enable row level security;
alter table public.applications enable row level security;
alter table public.application_documents enable row level security;
alter table public.application_answers enable row level security;
alter table public.application_approvals enable row level security;
alter table public.submission_attempts enable row level security;
alter table public.automation_settings enable row level security;
alter table public.audit_logs enable row level security;

create policy "profiles owner" on public.profiles for all using (id = auth.uid()) with check (id = auth.uid());
create policy "resumes owner" on public.resumes for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "resume versions owner" on public.resume_versions for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "work experience owner" on public.work_experiences for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "education owner" on public.educations for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "skills owner" on public.skills for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "sources readable" on public.job_sources for select using (is_enabled = true);
create policy "active jobs readable" on public.jobs for select using (is_active = true);
create policy "matches owner" on public.job_matches for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "applications owner" on public.applications for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "application documents owner" on public.application_documents for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "application answers owner" on public.application_answers for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "approvals owner" on public.application_approvals for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "submission attempts owner" on public.submission_attempts for select using (user_id = auth.uid());
create policy "automation settings owner" on public.automation_settings for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "audit logs owner read" on public.audit_logs for select using (user_id = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('resumes', 'resumes', false, 8388608, array['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do nothing;
create policy "users manage own resume files" on storage.objects for all using (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text) with check (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);

-- Approval must bind to the current immutable material revision. Call from a server route after authentication.
create or replace function public.approve_application(p_application_id uuid, p_revision uuid, p_fingerprint text, p_decision text)
returns public.applications language plpgsql security invoker set search_path = public as $$
declare a public.applications;
begin
  if p_decision not in ('approved','rejected') then raise exception 'invalid decision'; end if;
  select * into a from public.applications where id = p_application_id and user_id = auth.uid() for update;
  if not found then raise exception 'application not found'; end if;
  if a.current_revision <> p_revision then raise exception 'application changed; review the latest version'; end if;
  update public.applications set status = case when p_decision = 'approved' then 'approved'::public.application_status else 'rejected'::public.application_status end,
    approved_revision = case when p_decision = 'approved' then p_revision else null end where id = p_application_id returning * into a;
  insert into public.application_approvals(application_id,user_id,revision,content_fingerprint,decision)
    values(a.id,auth.uid(),p_revision,p_fingerprint,p_decision)
    on conflict(application_id,revision) do update set content_fingerprint=excluded.content_fingerprint,decision=excluded.decision,decided_at=now();
  return a;
end; $$;

create or replace function public.claim_approved_application(p_application_id uuid, p_revision uuid, p_idempotency_key text)
returns uuid language plpgsql security definer set search_path = public, auth as $$
declare a public.applications; attempt_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select * into a from public.applications where id=p_application_id and user_id=auth.uid() for update;
  if not found or a.status <> 'approved' or a.current_revision <> p_revision or a.approved_revision <> p_revision then raise exception 'current application version is not approved'; end if;
  if not exists(select 1 from public.application_approvals where application_id=a.id and revision=p_revision and decision='approved') then raise exception 'approval record missing'; end if;
  insert into public.submission_attempts(application_id,user_id,revision,idempotency_key,state)
    values(a.id,auth.uid(),p_revision,p_idempotency_key,'queued') returning id into attempt_id;
  update public.applications set status='ready_to_submit' where id=a.id;
  return attempt_id;
end; $$;
