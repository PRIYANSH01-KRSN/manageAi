# Deploying ChronosFlow (free: Supabase + Vercel)

Everything below runs on free tiers: **Supabase Free** (accounts + Postgres) and
**Vercel Hobby** (website + API as a serverless function). Gemini has a free API tier.

```
Browser (React)  ──sign in──►  Supabase Auth
      │  Authorization: Bearer <student token>
      ▼
Vercel  /api/*  (server/app.js as a serverless function)
      │  queries run *as that student* → row-level security
      ▼
Supabase Postgres (each student sees only their own rows)
```

Without Supabase variables the app still runs locally exactly as before (single-user SQLite).

---

## 1. Supabase (≈10 minutes)

1. Create a free account at https://supabase.com → **New project** (pick the region closest to your students, save the DB password somewhere safe).
2. **SQL Editor → New query** → paste all of [`supabase/schema.sql`](supabase/schema.sql) → **Run**. You should see 7 tables under **Table Editor** (profiles, habits, fixed_events, tasks, session_reviews, fatigue_hours, daily_checkins), each marked "RLS enabled".
3. **Project Settings → API**: copy the **Project URL** and the **anon public** key. (Never use the `service_role` key in this app.)
4. **Authentication → URL Configuration**:
   - **Site URL**: your Vercel URL, e.g. `https://manage-ai.vercel.app`
   - **Redirect URLs**: add `https://manage-ai.vercel.app/**` and `http://localhost:5173/**`
5. **Authentication → Providers → Email**: enabled by default.
   - The free built-in email sender only sends a few emails per hour. While testing, you can turn **Confirm email** off so sign-up works instantly; turn it back on (or add your own free SMTP such as Resend/Brevo under **Authentication → SMTP**) before real students join.
6. *(Optional)* **Google sign-in**: Authentication → Providers → Google → follow the steps to create a free OAuth client in Google Cloud Console, paste Client ID/Secret. Until you do this, the "Continue with Google" button shows a friendly "not enabled yet" message.

## 2. Vercel (≈5 minutes)

1. Your repo is already connected to Vercel. Open the project → **Settings → Environment Variables** and add (for Production and Preview):

   | Name | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | Supabase Project URL |
   | `VITE_SUPABASE_ANON_KEY` | Supabase anon public key |
   | `SUPABASE_URL` | same Project URL |
   | `SUPABASE_ANON_KEY` | same anon key |
   | `GEMINI_API_KEY` | your Gemini key (https://aistudio.google.com/apikey) |
   | `GEMINI_MODEL` | *(optional)* model name |

2. **Deployments → Redeploy** (env vars only apply to new builds — `VITE_` values are baked in at build time).
3. Check `https://<your-site>/api/status` — it should say `"mode":"supabase","authRequired":true`.

`vercel.json` already routes `/api/*` to `api/index.js` (60 s max for AI calls) and everything else to the React app.

## 3. Try it

1. Open the site → **Sign in → Create an account**.
2. Add a task, do a check-in → open the site on your phone, sign in → same plan.
3. Sign up a second test account in a private window → it sees an empty plan (data is isolated).

Anything a student created *before* signing in on a device is uploaded to their account once, on first sign-in. Signing out clears that browser's copy.

## Local development with Supabase (optional)

Put the same values in `.env` (see `.env.example`), then `npm run server` and `npm run dev`.
Leave them empty to keep using the local SQLite database.

## Free-tier notes

- **Supabase Free**: 500 MB database, 50k monthly active users; projects pause after 1 week with no activity (click "Restore" in the dashboard — data is kept).
- **Vercel Hobby**: for personal/non-commercial use; serverless functions up to 60 s.
- **Gemini free tier**: rate-limited per minute/day; the app limits each student to 30 AI calls per 10 minutes and falls back to built-in guidance when AI is unavailable.
