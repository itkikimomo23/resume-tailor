# Resume Tailor

Internal web app that generates ATS-tailored resumes (and cover letters) from a job
description, using OpenAI for the writing, DOCX templates for formatting, and Google
Drive for delivering the final file. A companion Chrome extension ("AutoGen") drives
part of the pipeline through this app's API.

This document is written for someone who has **zero prior context** on this project.
It covers the full local setup, the Supabase database/storage setup, Google Drive
integration, the auth/webhook model, deployment, and a handover checklist.

## Table of contents

1. [How the app fits together](#how-the-app-fits-together)
2. [Tech stack](#tech-stack)
3. [Prerequisites](#prerequisites)
4. [Environment variables](#environment-variables)
5. [Step 1 – Supabase project (database + storage)](#step-1--supabase-project-database--storage)
6. [Step 2 – Create the first admin user](#step-2--create-the-first-admin-user)
7. [Step 3 – Google Drive setup](#step-3--google-drive-setup)
8. [Step 4 – OpenAI setup](#step-4--openai-setup)
9. [Step 5 – Run it locally](#step-5--run-it-locally)
10. [First-run checklist (make it actually generate something)](#first-run-checklist-make-it-actually-generate-something)
11. [Auth model & the webhook / Chrome extension integration](#auth-model--the-webhook--chrome-extension-integration)
12. [Deploying to production](#deploying-to-production)
13. [Project structure](#project-structure)
14. [Feature map (what each page does)](#feature-map-what-each-page-does)
15. [Security notes](#security-notes)
16. [Handover checklist (do this when taking over the project)](#handover-checklist-do-this-when-taking-over-the-project)
17. [Troubleshooting](#troubleshooting)

---

## How the app fits together

```
                         ┌─────────────────────┐
                         │   Chrome extension    │
                         │   ("AutoGen")         │
                         └──────────┬────────────┘
                                    │ Bearer token (from /api/auth/login)
                                    ▼
┌───────────────────────────────────────────────────────────────────┐
│                         Next.js app (this repo)                    │
│  - Web UI (login-gated) for admins/assistants                      │
│  - /api/* routes: applications, templates, prompts, team, webhook, │
│    autogen/*                                                       │
│  - OpenAI call to write tailored resume JSON                       │
│  - docxtemplater fills a .docx template with that JSON             │
└───────────┬───────────────────────────────────────┬───────────────┘
            │                                        │
            ▼                                        ▼
   ┌─────────────────────┐                 ┌────────────────────┐
   │      Supabase         │                 │    Google Drive      │
   │  - Postgres DB         │                 │  - Generated .docx    │
   │    (schema.sql)        │                 │    files land here,   │
   │  - Storage bucket       │                 │    shared via link    │
   │    "docx-templates"     │                 └────────────────────┘
   │    (uploaded .docx       │
   │    templates live here)  │
   └─────────────────────┘
```

There is **no Supabase Auth** in this project. Login/sessions/roles are entirely
custom, backed by a `team_users` table and a hand-rolled signed-token scheme — see
[Auth model](#auth-model--the-webhook--chrome-extension-integration) below. This is
the single most important thing to understand before touching anything auth-related.

## Tech stack

- **Framework**: Next.js 16 (App Router), React 19, TypeScript
- **Database**: Supabase (hosted Postgres)
- **File storage**: Supabase Storage (for uploaded `.docx` templates) + Google Drive
  (for generated resumes/cover letters)
- **AI**: OpenAI API (`openai` npm package)
- **DOCX generation**: `docxtemplater` + `pizzip`
- **Auth**: custom, HMAC-signed session tokens, `bcryptjs` for password hashing
- **Styling**: Tailwind CSS v4, shadcn-style components (`components/ui`)

## Prerequisites

Before you start, get accounts/access to:

- **Node.js 20+** and npm (repo uses `package-lock.json`, so stick with npm, not
  yarn/pnpm, to avoid lockfile drift)
- A **Supabase** account (https://supabase.com) — free tier is fine to start
- A **Google Cloud** account (for the Drive integration)
- An **OpenAI** API key with billing enabled
- Wherever you plan to deploy (Vercel is the natural fit for Next.js — see
  [Deploying](#deploying-to-production))

## Environment variables

Copy `.env.example` to `.env` and fill it in:

```bash
cp .env.example .env
```

| Variable | Required? | Purpose |
|---|---|---|
| `OPENAI_API_KEY` | **Yes** | OpenAI API key used to generate resume content. |
| `OPENAI_MODEL` | No (has default) | Model id, e.g. `gpt-4o`. See `lib/models.ts` for the list the UI offers. |
| `REASONING_EFFORT` | No (default `medium`) | Passed to reasoning-capable models: `none\|low\|medium\|high\|xhigh`. |
| `NEXT_PUBLIC_SUPABASE_URL` | **Yes** | Your Supabase project URL. |
| `SUPABASE_SERVICE_KEY` | **Yes** | Supabase **service role** key (not the anon key — see [Security notes](#security-notes)). |
| `SESSION_SECRET` | **Yes** | Secret used to HMAC-sign session tokens (web login cookie *and* API/webhook bearer tokens). Generate with `openssl rand -hex 32`. Rotating this instantly logs out every user and Chrome-extension session. |
| `DEFAULT_TEMPLATE_ID` | No | UUID of a row in `docx_templates`. If set, this template is used as a fallback whenever an application has no template of its own assigned (webhook intake, autogen claim flow). Leave blank until you've uploaded at least one template and copied its id. |
| `GOOGLE_CLIENT_ID` | **Yes** (for Drive delivery) | OAuth2 client id from Google Cloud Console. |
| `GOOGLE_CLIENT_SECRET` | **Yes** | OAuth2 client secret. |
| `GOOGLE_REFRESH_TOKEN` | **Yes** | Long-lived refresh token for a Google account that has access to the target Drive folder. See [Step 3](#step-3--google-drive-setup). |
| `GOOGLE_DRIVE_FOLDER_ID` | No | Drive folder id where generated files are uploaded. If omitted, files go to the authorizing account's Drive root. |

> **Heads up — three variables in `.env.example` are currently dead / not wired
> into the code**: `APP_EMAIL`, `APP_PASSWORD`, and `WEBHOOK_SECRET` (an
> `X-Webhook-Secret` header check they imply doesn't exist anywhere in the
> codebase), plus `BACKGROUND_INFO` (also unreferenced). Leave them blank. The real
> auth mechanism for the webhook and the Chrome extension is a **Bearer session
> token**, described in [Auth model](#auth-model--the-webhook--chrome-extension-integration).
> Either those were planned and never finished, or left over from an earlier
> version — don't spend time looking for where they're checked, they aren't.

## Step 1 – Supabase project (database + storage)

1. Create a new project at https://supabase.com/dashboard (pick any region close to
   your users; note the DB password it generates, though you won't need it directly
   since you'll use the API keys).
2. **Run the schema**: open **SQL Editor** in the Supabase dashboard, paste the
   entire contents of [`schema.sql`](./schema.sql) from this repo, and run it.
   - This file is a full schema dump (tables, functions, triggers, grants) taken
     from the original project. It includes Supabase's own `storage` schema
     objects — a brand-new Supabase project already has those, so you may see
     harmless "already exists" notices for the `storage.*` statements; that's
     expected and fine. What actually matters is that the **six `public.*`
     application tables** get created: `applications`, `contexts`,
     `docx_templates`, `profile_assignments`, `profiles`, `prompts`, `sessions`,
     `team_users` (that's 8 — count them all).
   - Verify afterward with:
     ```sql
     select table_name from information_schema.tables
     where table_schema = 'public' order by 1;
     ```
     You should see all 8 tables listed above.
3. **Create the storage bucket**: go to **Storage** in the dashboard and create a
   new bucket named exactly:
   ```
   docx-templates
   ```
   Leave it **private** (not public) — the app only ever touches it server-side
   using the service role key, which bypasses bucket ACLs entirely, so there's no
   need for public access or storage policies. This is where uploaded `.docx`
   templates are stored (`app/api/docx-templates`); `schema.sql` only creates the
   `storage.buckets` *table*, not the bucket row itself, so this step is required
   and easy to miss.
4. **Get your API keys**: **Project Settings → API**.
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `service_role` **secret** key (not `anon`/`public`) → `SUPABASE_SERVICE_KEY`

   The service role key bypasses Row Level Security and has full table access —
   treat it like a root database password. Never expose it to the browser (it's
   intentionally *not* prefixed `NEXT_PUBLIC_`).

## Step 2 – Create the first admin user

There's no signup page — accounts are created either by an existing admin (via the
in-app **Team** page) or, for the very first account, with a helper script:

```bash
node scripts/create-admin.mjs you@example.com "your-password" "Your Name"
```

This prints an `INSERT INTO team_users ...` statement (with the password already
bcrypt-hashed) — copy it into the Supabase **SQL Editor** and run it. After that,
log in at `/login` with that email/password, and use the **Team** page in the app
to add further admins/assistants without touching SQL again.

Roles: `admin` (full access) vs `assistant` (restricted — assistants only see
applications/templates/profiles assigned to them; see `proxy.ts` and
`app/api/team` for the exact rules).

## Step 3 – Google Drive setup

Generated resumes/cover letters are uploaded to Google Drive, and made viewable via
a shareable link (the app sets `role: reader, type: anyone` on every file it
uploads — i.e. **anyone with the link can view it**, no Google login required; see
[Security notes](#security-notes)).

1. In [Google Cloud Console](https://console.cloud.google.com/), create a project
   (or reuse one) and enable the **Google Drive API**.
2. **OAuth consent screen**: set it up (Internal if you have Workspace, External +
   Testing mode otherwise is fine for a single-account integration like this).
3. **Credentials → Create Credentials → OAuth client ID**, application type
   **Web application**. Add this authorized redirect URI:
   ```
   http://localhost:3333/callback
   ```
   Copy the generated **Client ID** and **Client Secret** →
   `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` in your `.env`.
4. **Get a refresh token** using the helper script in this repo (decide first
   *which* Google account should own the uploaded files — that's the account you
   authorize in the next step):
   ```bash
   GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... node scripts/get-refresh-token.mjs
   ```
   It prints a Google auth URL — open it, sign in as the Drive account you want to
   use, grant access, and the script prints a refresh token in your terminal.
   Put that in `.env` as `GOOGLE_REFRESH_TOKEN`.
   - This uses `access_type: offline` + `prompt: consent`, so it always forces a
     fresh refresh token — re-run it any time the token is lost or revoked.
5. (Optional) Create a folder in that Drive account for generated resumes, open it,
   copy the folder id from the URL
   (`https://drive.google.com/drive/folders/<THIS_PART>`) → `GOOGLE_DRIVE_FOLDER_ID`.
   If left blank, files upload to the account's Drive root instead.

## Step 4 – OpenAI setup

Just an API key with billing enabled: https://platform.openai.com/api-keys →
`OPENAI_API_KEY`. Optionally set `OPENAI_MODEL` (see `lib/models.ts` for the ids the
UI dropdown offers) and `REASONING_EFFORT`.

## Step 5 – Run it locally

```bash
npm install
npm run dev
```

Visit `http://localhost:3000`, log in with the admin account from
[Step 2](#step-2--create-the-first-admin-user).

Other scripts:
```bash
npm run build   # production build
npm run start   # run the production build
```

## First-run checklist (make it actually generate something)

A fresh database has zero templates and zero prompts, so nothing will generate
until you seed a little data through the UI:

1. Log in as admin.
2. **Templates** page → upload a `.docx` file containing `<<variable>>` placeholders
   (docxtemplater syntax) — `template_type` is either `resume` or `cover_letter`
   (cover letters may only use `<<date>>` and `<<letter>>`, enforced server-side in
   `app/api/docx-templates/route.ts`).
3. (Optional) **Prompts** page → add a custom system prompt, or mark one as
   default. If you skip this entirely, a hardcoded fallback prompt in
   `lib/defaultSystemPrompt.ts` is used — the app never breaks from having zero
   prompts configured.
4. (Optional) **Profiles** / **Contexts** pages → add candidate background info /
   reusable context snippets used when generating manually.
5. **Generate** or **Builder** page → paste a job description, pick a template, run
   a generation, confirm a `.docx` shows up in your configured Google Drive
   location.
6. If you'll use the fallback-template webhook flow, copy the new template's id
   into `DEFAULT_TEMPLATE_ID`.

## Auth model & the webhook / Chrome extension integration

There is no Supabase Auth and no NextAuth — everything is hand-rolled in
`lib/auth.ts`:

- Passwords are `bcryptjs`-hashed in `team_users.password_hash`.
- A session token has the shape `userId:role:nonce:<hmac-sha256>`, signed with
  `SESSION_SECRET` (`lib/auth.ts` → `createSession` / `verifySession`).
- **Web login** (`/login` or `POST /api/auth/login`) sets this token as an
  `httpOnly` cookie (`rt_session`) and also inserts a row into the `sessions`
  table with an expiry.
- **API / webhook / extension access** uses the *same* token as a Bearer header
  instead of a cookie — `Authorization: Bearer <token>` — validated by
  `requireBearerAuth`, which additionally checks the `sessions` table for a
  matching, non-expired row (so revoking is just deleting that row, or waiting
  out its 24h expiry).
- Role is always re-read live from `team_users` on every request — disabling a
  user (`is_active = false`) or changing their role takes effect immediately,
  even for tokens issued earlier.

**So: to integrate the Chrome extension (or any external caller) with this app,
first call `POST /api/auth/login`** with a team member's email/password, capture
the `token` from the JSON response, and send it as a Bearer token on every
subsequent call. There is no separate static webhook secret to configure.

```bash
# 1. Log in, capture the token
curl -X POST https://your-deployment.example.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"your-password"}'
# → { "token": "...", "expiresAt": "...", ... }

# 2. Use it against the webhook (creates an application, optionally
#    auto-tailors + uploads to Drive if tailor_flag is true)
curl -X POST https://your-deployment.example.com/api/webhook \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
        "role": "Senior Backend Engineer",
        "company_name": "Acme Corp",
        "job_description": "…",
        "tailor_flag": true
      }'
```

The `/api/autogen/*` routes (`app/api/autogen/**`) are the endpoints the AutoGen
Chrome extension itself calls to claim an application, get a rendered prompt to
feed to ChatGPT's web UI, and submit the answer back for docx rendering + Drive
upload. They all require the same Bearer token. Read
`app/api/autogen/applications/[id]/claim/route.ts` and
`lib/autogenClaim.ts` if you need to touch that flow — the comments there explain
the claim/stale-claim/race-condition handling in detail.

## Deploying to production

This is a standard Next.js app — [Vercel](https://vercel.com) requires the least
setup (auto-detects the framework, zero config needed beyond env vars). Any
Node.js host that can run `npm run build` + `npm run start` works too.

1. Push this repo to GitHub/GitLab and import it in Vercel (or connect your host
   of choice).
2. Add **every** variable from [Environment variables](#environment-variables)
   (except the dead ones) to the project's environment settings. Do this for all
   environments you use (Production/Preview) — don't forget Preview if you rely on
   PR previews, since Supabase/Drive/OpenAI keys aren't inherited automatically per
   environment.
3. Deploy. Build command `npm run build`, output is the default Next.js output —
   no special config needed beyond what's already in `next.config.ts`.
4. `allowedDevOrigins` in `next.config.ts` is a **local-network dev convenience**
   only (lets you hit the dev server from another LAN device during testing) — it
   has no effect in production and is safe to leave as-is or delete if unused.
5. Run through the [First-run checklist](#first-run-checklist-make-it-actually-generate-something)
   again against production once it's live — the Supabase project/env vars for
   prod should normally be a **separate Supabase project** from whatever was used
   for local development, unless you've deliberately decided to share one.

## Project structure

```
app/
  (main)/            Authenticated UI pages: dashboard, builder, batch-builder,
                      generate, applications, job-board, templates, prompts,
                      contexts, profile, team
  login/              Login page + server action
  api/                All backend routes (see Feature map below)
components/           Shared React components (components/ui = shadcn-style primitives)
lib/
  supabase.ts         Supabase client (service role)
  auth.ts             Custom session/auth logic
  googleDrive.ts       Google Drive upload/download/delete
  generateResume.ts     OpenAI call + orchestration for a single generation
  docxTemplater.ts       Fills .docx templates with generated data
  promptBuilder.ts        Assembles the full prompt sent to OpenAI
  promptResolution.ts      Resolves which system prompt to use (see Step: First run)
  autogenClaim.ts           Claim/lock logic for the AutoGen extension flow
  models.ts                  OpenAI model choices shown in the UI
scripts/
  create-admin.mjs            Bootstraps the very first admin account
  get-refresh-token.mjs         One-time Google OAuth refresh-token helper
schema.sql                        Full Postgres schema dump — run once against a new
                                    Supabase project (see Step 1)
proxy.ts                            Route-level auth guard / role-based redirects
resumeBuilder.js                     Standalone one-off docx-building script
                                      (uses the `docx` npm package, not a dependency of
                                      the app — unrelated to the Next.js runtime path)
```

## Feature map (what each page does)

- **Dashboard** — overview/metrics.
- **Builder** — manual single-resume generation flow.
- **Batch builder** — generate multiple resumes at once.
- **Generate** — the core "job description → tailored resume" flow.
- **Applications / Job board** — tracks each application's pipeline status,
  recruiter contact info, Drive link, scheduling; this is also the table the
  webhook and autogen endpoints read/write.
- **Templates** — upload/manage `.docx` templates (resume or cover letter), each
  optionally tied to a profile and a prompt.
- **Prompts** — manage system prompts used for generation; one can be marked
  default.
- **Contexts** — reusable background/context text snippets.
- **Profile** — candidate profiles (name + assignable to assistants via
  `profile_assignments`).
- **Team** — admin-only user management (create/disable team members, set roles).

## Security notes

Worth understanding before making changes, not necessarily things to "fix"
unprompted:

- **Row Level Security is off on every application table** (`applications`,
  `contexts`, `docx_templates`, `profile_assignments`, `profiles`, `prompts`,
  `sessions`, `team_users`) — only Supabase's own `storage.*` tables have RLS
  enabled, inherited from the default Supabase setup. Access control for the app's
  own data lives entirely in the Next.js API routes (role checks, `requireSession`
  / `requireBearerAuth`), not in Postgres. This is safe **as long as** the
  Supabase `anon` key is never used anywhere in this app (it currently isn't —
  everything goes through the service role key in `lib/supabase.ts`). If anyone
  later adds a client-side Supabase call using the anon/public key, these tables
  would be fully readable/writable from the browser, since RLS wouldn't stop it.
- **`SUPABASE_SERVICE_KEY` is a full-access secret** — never expose it to the
  client, never prefix it `NEXT_PUBLIC_`, never commit it (it isn't — `.env` is
  gitignored).
- **Uploaded resumes are link-shareable, not private** — `uploadResumeToDrive` in
  `lib/googleDrive.ts` explicitly grants `role: reader, type: anyone` on every
  file it creates. Anyone with the URL can view it without a Google login. This is
  intentional (so links can be shared/opened without friction) — flag it to
  whoever owns this project if that's no longer the desired behavior for
  sensitive candidate data.
- **`SESSION_SECRET` rotation invalidates every session immediately** — web
  cookies and all Bearer tokens the extension is holding stop verifying.
  Coordinate before rotating it.

## Handover checklist (do this when taking over the project)

Since this project is being transferred to someone new, treat every secret the
previous owner had access to as compromised and rotate it:

- [ ] Generate a new `SESSION_SECRET` (this immediately logs everyone out —
      do it once, then have all team members log back in).
- [ ] Rotate the Supabase `service_role` key (Project Settings → API — Supabase
      supports regenerating this) and update it everywhere it's deployed.
- [ ] Rotate/replace the Google OAuth client secret in Google Cloud Console, and
      re-run `scripts/get-refresh-token.mjs` to issue a fresh refresh token tied
      to the new secret.
- [ ] Rotate the OpenAI API key.
- [ ] Review `team_users` — disable (`is_active = false`) or remove any accounts
      that shouldn't retain access, and have remaining admins reset their
      passwords.
- [ ] Confirm who owns the Google account the Drive files upload into, and the
      Supabase project's billing/owner account, and transfer those separately if
      needed (they aren't part of this repo).
- [ ] Double check `.env` was **not** committed anywhere in git history
      (`git log --all --oneline -- .env`) — the `.gitignore` excludes it going
      forward, but that doesn't retroactively scrub history.

## Troubleshooting

- **"Missing Supabase environment variables" on startup** — `NEXT_PUBLIC_SUPABASE_URL`
  or `SUPABASE_SERVICE_KEY` isn't set; `lib/supabase.ts` throws immediately at
  import time.
- **"Missing Google Drive credentials" when generating** — one of
  `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REFRESH_TOKEN` is
  unset; thrown from `lib/googleDrive.ts`.
- **Login always fails / "Server credentials not configured"** — `SESSION_SECRET`
  is empty; set it and redeploy/restart.
- **Nothing happens when generating from the webhook** — check `templateId` was
  resolved: either the request included one, or the application's own
  `template_id` is set, or `DEFAULT_TEMPLATE_ID` is configured. Without any of
  those, `shouldTailor` short-circuits and the application is just saved as
  `pending` with no generation attempted.
- **401s from the webhook/extension** — the Bearer token expired (sessions last
  24h from creation, per `schema.sql`'s default on `sessions.expires_at`) or the
  `sessions` row was deleted; log in again via `/api/auth/login` to get a fresh
  token.
- **Docx upload rejected with "Only .docx files are supported" / variable errors**
  — `app/api/docx-templates/route.ts` validates file extension and, for cover
  letters, restricts placeholders to `<<date>>` / `<<letter>>` only.
