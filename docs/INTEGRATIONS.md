# Integration setup and limitations

ApplyPilot searches public remote job feeds from Remotive, Jobicy, and Himalayas. Listings link to the originating source, and no job board is scraped. No application is submitted automatically.

## Supabase

1. Create a Supabase project and copy its project URL and anon key to `.env.local` from `.env.example`.
2. In the Supabase SQL editor, run `supabase/migrations/202610220001_initial_schema.sql`, then `supabase/seed.sql`.
3. Enable email/password in Authentication settings. Keep email confirmation enabled for production.
4. The migration enables RLS on user data and creates a private `resumes` storage bucket. The service-role key is server-only and must never be prefixed with `NEXT_PUBLIC_`.

Email/password sign-up, login, confirmation, reset, protected dashboard access, and sign-out use Supabase Auth when configured. Profile data and search preferences sync to the signed-in user's profile row. Saved jobs and application queue records remain in user-scoped browser storage; they do not yet sync across devices.

## OpenAI

Set `OPENAI_API_KEY` in the server environment and configure Supabase Auth. The `/api/generate` route requires a verified signed-in user, validates request and response shapes, limits input lengths, and tells the model to treat job descriptions as untrusted text. Without a key it returns a clearly labeled demo draft. Add durable per-user rate limiting before enabling this route for public traffic.

## Job sources

The `/api/jobs` route aggregates the free public APIs from Remotive, Jobicy, and Himalayas; none currently needs an API key. Remotive and Jobicy feeds are cached for up to six hours. Himalayas data refreshes daily; the route follows up to five cursor pages (100 jobs total) from its 20-job-per-request API. Remotive says listings can be delayed by 24 hours and recommends no more than four API requests per day. Jobicy's public feed covers jobs from the last seven days and asks integrations to poll no more than once per hour. Each listing keeps source attribution and a source link. For Himalayas that link is the API's `applicationLink`, as required by its terms. Current filters include keyword, location text, remote eligibility, minimum salary, employment type, experience level, and sorting; filters apply to the results returned by each feed. Experience filtering uses level metadata supplied by the provider where available.

The feeds are best-effort: fields such as salary and employment type may be missing, and opening a source link is the way to check whether a role is still active. Himalayas salary data may use hourly, weekly, fortnightly, monthly, or annual pay periods; the salary filter skips non-annual salary figures rather than treating them as annual. These sources focus on remote roles and do not provide the full coverage of major job boards.

## Submission workflow

Application submission is intentionally a manual handoff in this MVP. The SQL approval function binds consent to a revision and the claim function rejects stale or rejected revisions. A production adapter still needs provider-specific authorization, idempotency, retry/backoff, audit logging, rate limits, and a global kill switch. Never automate browser login or bypass a board’s restrictions.
