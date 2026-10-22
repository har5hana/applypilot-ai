# ApplyPilot AI

An approval-first job search workspace built with Next.js, TypeScript, Tailwind CSS, Zod, and OpenAI. The app searches free public remote job feeds from Remotive and Jobicy without API keys. Profile editing, PDF/DOCX text extraction, draft materials, and a local application queue are also available in the browser.

## Run locally

```bash
npm install
Copy-Item .env.example .env.local
npm run dev
```

Open `http://localhost:3000`. The home page opens sign-in and account creation. With Supabase configured, new accounts are sent to a personal onboarding flow where they can upload a PDF/DOCX resume or enter their profile manually. Resume text is extracted in the browser; the user reviews the detected name, title, location, skills, and education before opening the workspace. The no-credentials preview remains available from the login page.

## Configure optional services

1. Create a Supabase project and configure email/password authentication.
2. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to `.env.local`.
3. Apply `supabase/migrations/202610220001_initial_schema.sql` and `supabase/seed.sql` in the Supabase SQL editor.
4. Add `OPENAI_API_KEY` to enable AI drafts through the server-side route. AI use requires configured Supabase Auth and a signed-in user. Keep the key private.
5. Job search works without provider credentials. See [integration notes](docs/INTEGRATIONS.md) for feed coverage, caching, and source limitations.

**Supabase email/password authentication is wired when its public URL and anon key are configured.** Profile details, extracted resume text, and search filters sync to the user’s RLS-protected `profiles` row. Without Supabase, filters persist in this browser. Saved jobs and the application queue remain in user-scoped browser storage and do not sync between devices. The migration provides the data model and RLS foundation. Production use still needs database-backed application routes, per-user rate limits, resume file storage, deletion/export flows, and deployment secrets.

## Approval behavior

Preparing a role creates a draft in the queue. The user can edit the summary, cover letter, and answers, then approve or reject. Approval stores the exact displayed document snapshot in local demo data. Any edit after approval makes that consent stale and requires another approval. Rejected items cannot be submitted. The “Continue to employer” action opens the employer page as a manual handoff; ApplyPilot does not submit the form or claim that the application was sent.

The SQL migration also includes revision-bound approval and idempotent submission-claim functions for future server-side integration. A production submission adapter is not included.

## Commands

```bash
npm run dev       # local development
npm run lint      # ESLint
npm run typecheck # TypeScript
npm test          # unit tests
npm run build     # production build
```

## Deploy

Import the repository into Vercel, configure the same environment variables in project settings, apply the Supabase migration, and deploy. The public job feeds need no secrets.

## Current limits

- Profile details and extracted resume text sync to the signed-in user’s Supabase profile row. Saved roles and the application queue are browser-local and user-scoped.
- Job feeds focus on remote roles; providers may delay listings or omit salary and employment details. Matching scores are fit indicators, not hiring probabilities.
- Resume files are parsed in the browser and are not uploaded or retained as original files by demo mode.
- AI generation requires an OpenAI key; factual accuracy still needs user review.
- Job application handoff is manual; automatic submission is not supported.
- GitHub/Vercel workflows are examples and do not publish or deploy automatically from this workspace.
