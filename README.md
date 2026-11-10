# ENNORE Muster

A small attendance app for one user. Mark daily attendance for the station staff, then download a muster PDF for each period. A period runs from the 16th to the 15th.

- **Codes:** P (Present, blue), R (Rest, red), and A (Absent) or a leave type such as CL or LAP (red). A blank cell means "not recorded". It is never counted as absent.
- **Screens:** Mark (opens first), Muster (grid and PDFs), Staff (staff list and backup).
- **Stack:** React, TypeScript, Vite, Supabase, pdf-lib in the browser, Cloudflare Pages.

This repository contains staff PF/HRMS details. **Keep it private.**

## Try it locally (demo mode)

```bash
npm install
npm run dev
```

With no `.env` file, the app runs in **demo mode**. It loads the 16 staff and keeps everything in the browser's local storage. This is useful for trying it out. It is not a real backup.

Other commands:

```bash
npm test             # date logic tests
npm run sample-pdf   # writes out/sample-final.pdf, out/sample-interim.pdf, out/overlay.pdf (overlay on the reference)
npm run build
```

## Owner setup (one time)

1. **Supabase project:** create it in **Mumbai (ap-south-1)** on the free tier.
2. **Database:** in the SQL editor, open `supabase/migrations/0001_schema.sql`. Replace `OWNER_EMAIL@example.com` with the login email, then run it.
3. **Staff data:** check that hosting staff PF/HRMS data on Supabase is permitted. Then run `supabase/seed.sql`.
4. **Login:** go to Authentication → Sign In / Providers. Turn **off** "Allow new users to sign up". Then go to Authentication → Users → Add user and create the one account, using the same email as in step 2.
5. **App settings:** copy `.env.example` to `.env` and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from Project Settings → API.
6. **Hosting on Cloudflare (free):** the app is served as static files by a Cloudflare Worker. Its config is in `wrangler.jsonc`.
   - Log in once with `npx wrangler login`.
   - Publish with `npm run deploy`. This builds with the `.env` settings, checks that no staff details are in the public files, and uploads.
   - Live address: https://YOUR-APP.workers.dev
7. **Email on the 16th:**
   - Create a Resend account and an API key. Without a verified domain, Resend only sends to your own account email from `onboarding@resend.dev`. Check Resend's current rules. To send from your own address, verify a domain and set `RESEND_FROM`.
   - Deploy the function:
     ```bash
     supabase functions deploy notify-muster-ready --no-verify-jwt
     ```
   - Set the secrets:
     ```bash
     supabase secrets set RESEND_API_KEY=... ALERT_EMAIL=... APP_URL=https://... CRON_SECRET=<long random string>
     ```
   - In `supabase/cron.sql`, replace `PROJECT_REF` and `CRON_SECRET_VALUE`, then run it in the SQL editor.
   - Test it by calling the function by hand:
     ```bash
     curl -X POST https://PROJECT_REF.supabase.co/functions/v1/notify-muster-ready -H "x-cron-secret: <CRON_SECRET>"
     ```
8. **On the phone:** open the site, sign in once, then use Share → **Add to Home Screen**.

## Codes and leave types

- **Mark screen:** three buttons. **P** (Present, blue) and **R** (Rest, red) save with one tap. **A** opens a list: "Absent (no leave type)" first, then the HRMS leave types (CL, RH, LAP, LHAP, CCLSF, …, RC, CR, S, PME). The chosen code shows on the A button in red.
- **Muster grid:** tapping a cell opens the full list (P, A, R, every leave type, Clear).
- **PDF:** prints the code itself in red. Long codes shrink to fit the cell.
- **Counts:** every leave type counts as "Leave/Absent". None of them counts as unmarked.

To add a leave type, add one line to `LEAVE_TYPES` in `src/statusCodes.ts`, for example:

```ts
['HPL', 'Half Pay Leave'],
```

Nothing changes in the database: the code is stored as text.

## Absentees statement

The **Absentees** tab totals three kinds of absence for one period, from the 16th up to the date chosen in "Count up to" (which defaults to today, or to the 15th for an ended period):

- **LAP:** the number of days marked `LAP`
- **SICK:** the number of days marked `S`
- **CR:** the number of days marked `CR`

The tab shows the totals on screen. **Download absentees statement** makes a one-page US Letter PDF that matches `reference/ABSENTEES-Statement-BLANK.pdf` (`src/absenteesPdf.ts`). If the count stops before the period ends, the PDF is marked "INTERIM: recorded up to …". The codes behind each column are set in `ABSENTEE_COLUMNS` in `src/absentees.ts`.

## How it behaves

- **Mark:** one tap saves, and tapping the selected code again clears it. "Mark remaining Present" fills only blank cells. Its Undo, shown for 10 seconds, removes only the cells it filled. Rest days: tap **R** first, then use "Mark remaining Present".
- **Speed:** the app keeps a copy of recent data on the phone (`src/store.ts`). Screens draw from it instantly and refresh in the background. Taps update the screen at once and save in the background, and taps made close together go in one request (`src/saver.ts`). The PDF code loads only when needed.
- **Saving:** a failed save shows "Not saved" and retries every few seconds. Unsaved taps are kept on the phone, so they are sent the next time the app opens, even if Android closes it.
- **On Android:** open https://YOUR-APP.workers.dev in Chrome, then use ⋮ → Install app. Cloudflare caching rules are in `public/_headers`.
- **No paid plan:** the free Supabase project pauses after about 7 days with no use. Daily marking keeps it awake. After a long break, resume it from the Supabase dashboard.
- **Periods:** a period row is created just before its first attendance save. Its staff list (roster) is frozen at that point. Staff edits update only the current period's roster. An ended period never changes.
- **Banner:** after a period ends, the Mark screen shows a banner until its final PDF is downloaded.
- **PDF:** A3 landscape, matched to `reference/MUSTER-2026-1.pdf`. It uses open substitute fonts in `public/fonts/` (licences are alongside). Carlito and TeX Gyre Bonum are embedded whole, because pdf-lib's subsetter drops their glyphs.
- **Backup:** use Staff → **Download all data** now and then. There are no automatic backups.

## Known limits

- Corrections leave no history.
- The free Supabase project pauses after about a week without use. When that happens, resume it from the Supabase dashboard. The email on the 16th can be missed during a pause, but the in-app banner still appears.
