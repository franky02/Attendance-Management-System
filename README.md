# Attendance Management System for a Railway Station

(The project folder and code still call it ENNORE Muster.)

A small attendance app for one user. Mark daily attendance for the station staff, then download a muster PDF for each period. A period runs from the 16th to the 15th.

- **Codes:** P (Present, blue), R (Rest, red), and A (Absent) or a leave type such as CL or LAP (red). A blank cell means "not recorded". It is never counted as absent.
- **Screens:** Mark (opens first), Muster (grid and PDFs), Staff (staff list and backup).
- **Stack:** React, TypeScript, Vite, Supabase, pdf-lib in the browser, Cloudflare Pages.

**Privacy:** this repository holds no real staff details. Demo mode uses 16 made-up sample staff (`src/seed.ts`), and the real list lives only in the database.

The official paper forms the PDFs are matched to (`reference/*.pdf`) aren't included either, because they carry staff names. The owner keeps them locally, and git ignores them. The PDF layouts in `src/*Pdf.ts` already contain every measurement taken from them.

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
3. **Staff data:** check that hosting staff PF/HRMS data on Supabase is permitted. Copy `supabase/seed.example.sql` to `supabase/seed.sql` (git ignores it), put in the real staff exactly as printed, and run it.
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

## Night Duty (NDA statement)

The **Night Duty** tab is per **calendar month**, separate from the muster's 16th–15th periods. Pick the month on the sideways-scrolling month strip; it opens on last month, because the hours are filled in after the month ends. For each person it records:
- **Total Hrs.:** a number, decimals allowed (e.g. 48 or 7.5)
- **Remarks:** free text

**Roster** always prints "Cont." on the PDF; there is nothing to enter for it. **Weighted Hrs.** is Total Hrs. ÷ 6. The app works it out, so it isn't stored. It always shows at least two digits and two decimals: 36 → 06.00, 56 → 09.33, 66 → 11.00. The same applies on screen, in the total and on the PDF.

Entries save automatically a moment after typing stops. They are kept on the phone until saved, and retried if saving fails.

**Download NDA statement** makes a one-page US Letter PDF matched to `reference/NDA-BLANK-2026.pdf` (`src/ndaPdf.ts`), titled with the month (e.g. OCTOBER 2026).

The data lives in the `night_duty` table (`supabase/migrations/0002_night_duty.sql`). Its `period_start` column holds the month's 1st day (`0003_night_duty_calendar_month.sql`).

## National holidays and the NHA statement

The **NH** tab works per calendar month: pick the month on the month strip. It opens on last month.

- **NH dates:** under "National holidays this month", add each NH date, with an optional name such as "Republic Day". You can also remove one. Dates are stored in the `national_holiday` table (`supabase/migrations/0004_national_holiday.sql`).
- **In the muster:** NH days show a red "National Holiday" tag on the Mark screen and an "NH" label on the Muster grid's date column.
- **NH code:** **NH (National Holiday availed)** is in the A list. Mark it when someone takes the holiday off.
- **Eligibility**, worked out from the muster marks on each NH date (`src/nha.ts`):
  - **P, R or CR:** Eligible (printed sky blue).
  - **NH, A or any other leave:** Not Eligible (printed red).
  - **Blank:** "Not marked" (grey). It isn't counted, and the app warns before downloading.
- **NHA column:** the number of eligible NH days, printed as "03", or "--" for none.
- **PDF:** **Download NHA statement** makes a US Letter PDF (`src/nhaPdf.ts`) based on `reference/NHA-Statement-JANUARY-2026-3-colmn.pdf`. It has one column per NH date, with its name underneath, and a numbered spare row. When the month has a single NH, a **Remarks** column is added (Present / Rest / CR / NH Availed / the leave code), as in `reference/NHA-Statement-SEPTEMBER-2026.pdf`.

## Zoom

The magnifier buttons either side of the title make everything on the screen bigger or smaller, in five steps from 90% to 145%. The title and tab bar stay the same size. The choice is remembered on the phone (`src/zoom.ts`). When zoomed in, each Mark row puts the name on its own line with the P/A/R buttons underneath.

## App icon

The icon shows a train between two platforms, under "AMS". Its source is `scripts/icon/icon.svg`, and `scripts/icon/render.sh` turns it into `public/icon-*.png` (needs `brew install librsvg`). The main artwork stays inside the central safe area, so Android can crop it to a circle or squircle without cutting it off.

## Stations

Dad can work at any of the 19 stations in `src/stations.ts`: MGR Chennai Central Suburban to Arambakkam on the Gummidipundi line. To add one, add a line there.

- **Choosing:** the sign-in screen has a **Station** field. Tapping it opens a scroll wheel. Once signed in, tapping the station name in the title opens the same wheel to switch. The app then reloads for that station, after sending any unsaved taps first.
- **What's separate:** each station has its own staff (`employee.station`) and muster periods (`period` is keyed by station and start date). Attendance and night duty follow their staff, so they're separate too. A new station starts empty: add its staff on the Staff tab.
- **What's shared:** national holiday dates, and the backup (**Download all data** saves every station).
- **Title and PDFs:** both use the chosen station: "Attendance Management System for Ponneri Station", "Muster Roll of PONNERI Station Staffs …", and file names like `Muster-PONNERI-2026-10-Final.pdf`. Long names shrink to fit the title line.
- **Database:** `supabase/migrations/0005_stations.sql`. Everything entered before stations existed belongs to Ennore (ENR).

## Sound and vibration

Buttons and selecting scrollers give gentle feedback (`src/feedback.ts`). The sounds are made by the phone itself (Web Audio), so there are no audio files, and vibration uses `navigator.vibrate` (Android; iPhones ignore it).

- **Tap:** every button (one listener on the page) and opening a Muster cell get a soft click and an 8 ms pulse.
- **Tick:** tabs, month chips, and each station passing the centre of the station wheel get a lighter tick. Ticks closer than 35 ms apart merge, so a fast flick never buzzes.
- **Success:** "Mark remaining Present" and any download get a two-note chime and a double pulse.
- **Warn:** a failed sign-in gets a low double tone, and so does saving when it first starts failing (once, not on every retry).
- **Silent:** plain scrolling (the Muster grid, lists), locked cells, and anything while the app is in the background.

**Staff → Sound & vibration** turns each one on or off for this phone. A button can choose its kind with `data-fb="tick" | "success" | "warn"`, or opt out with `data-fb="off"`.

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
