# Annual Physicals Tracker

A small web app the front office uses to see which patients are due for an annual physical, log outreach, schedule the visit, and roll the patient forward to next year once the physical is done.

- **Data lives in a Google Sheet** (one tab per doctor). Nothing is stored anywhere else, so patient data stays inside the clinic's Google Workspace.
- **Staff sign in with their clinic Google account.** The app talks to the Sheets API as that person, so the sheet's own sharing settings decide who can use the app.
- **Hosted as static files** (Netlify). The host never sees patient data.

## How it works

| Column in the sheet | Meaning |
| --- | --- |
| Last Physical | Date of the most recent physical. |
| Next Outreach | Computed: the last day of the month 11 months after the last physical (8/1/2025 → 7/31/2026). |
| Next Physical | The scheduled appointment, if any. |
| Outreach Status | Blank, `Sent Message`, `Left Voicemail`, `Patient Calling Back`, `Completed`, or `Not Needed`. |

The app derives a status for every patient:

| Status | When | What staff do |
| --- | --- | --- |
| **Needs outreach** (red) | Outreach date has passed, or there is no physical on record. | Pick a contact status, or schedule the visit. |
| **In progress** (amber) | A contact status is set. | Keep updating it, or schedule the visit. |
| **Scheduled** (blue) | Next Physical has a date. | Click **Physical done** after the visit. |
| **Completed** (green) | Marked done, waiting for confirmation. | Click **Confirm & clear**. The last physical becomes the visit date, the appointment and status are cleared, and the patient drops to the bottom of the list until next year. Undo is offered in the toast. |
| **Up to date** (gray) | Outreach date is still in the future. | Nothing. |
| **No physical needed** | Status is `Not Needed` (e.g. children on a family plan). | Nothing. "Start tracking" brings them back. |

The list sorts action-needed patients to the top. Filter chips at the top show counts; search matches name, date of birth, or notes. Clicking a name opens the full record (edit any field, add notes, remove the patient). The list refreshes itself every 90 seconds and whenever the tab regains focus, so several staff can work at once.

## Who can get in

Access is two layers, both controlled by Google Workspace:

1. **Sign-in.** The OAuth consent screen is set to *Internal*, so Google itself refuses any account outside the clinic's Workspace. The app additionally checks the account's domain (`VITE_ALLOWED_DOMAIN`) and rejects personal Gmail accounts.
2. **Data.** The app reads and writes the sheet *as the signed-in person*, so they must have Editor access to the sheet. Sharing the sheet with "Anyone at <your Workspace>" gives every staff account access automatically; removing someone from Workspace removes their access to both.

Sessions last one hour and renew silently; if renewal fails (pop-up blocked, signed out of Google) the app returns to the sign-in screen.

## One-time setup

### 1. The spreadsheet

1. Create a Google Sheet (or import the `Dr. Sujansky.csv` seed file from `G:\My Drive\Code\physicals-tracker-seed-data` via **File → Import** to start with the current roster; that folder is outside the repo on purpose because it holds patient data).
2. Name the first tab **`Dr. Sujansky`** and add a second tab named **`Dr. Daniher`**. Every tab becomes a doctor on the toggle. A brand-new empty tab gets its header row written automatically the first time the app opens it.
3. Row 1 of each tab must be exactly:
   `ID, First Name, Last Name, Date of Birth, Membership, Last Physical, Next Outreach, Next Physical, Outreach Status, Notes, Last Updated, Updated By, Hint ID`
4. Share the sheet so the whole clinic can use the app without per-person sharing: **Share → General access → "Anyone at <your Workspace>" → Editor**. (Sharing with individual staff also works, but new hires would need to be added by hand.)
5. Copy the long ID from the sheet URL (`https://docs.google.com/spreadsheets/d/<THIS PART>/edit`).

### 2. Google sign-in (Google Cloud Console, about 10 minutes)

1. Go to <https://console.cloud.google.com/> signed in as an admin of the blueangelclinical.com Workspace. Create a project (e.g. "Physicals Tracker").
2. **APIs & Services → Library** → enable **Google Sheets API**.
3. **APIs & Services → OAuth consent screen** → User type **Internal** (only Workspace users can sign in; no Google verification needed). App name "Annual Physicals", support email, and add the scopes `.../auth/spreadsheets`, `.../auth/userinfo.email`, `.../auth/userinfo.profile`.
4. **APIs & Services → Credentials → Create credentials → OAuth client ID** → Application type **Web application**.
   - Authorised JavaScript origins: `http://localhost:5180` (for local dev) and the production URL (e.g. `https://physicals.blueangelclinical.com` or the Netlify URL).
   - No redirect URIs are needed.
5. Copy the **Client ID**.

### 3. Configure and deploy

Copy `.env.example` to `.env` for local development, or set the same variables in Netlify (**Site settings → Environment variables**):

```
VITE_GOOGLE_CLIENT_ID=xxxxxxxx.apps.googleusercontent.com
VITE_SHEET_ID=1AbC...
VITE_ALLOWED_DOMAIN=blueangelclinical.com
```

Netlify builds with `npm run build` and publishes `dist/` (see `netlify.toml`). Push to GitHub and connect the repo, or drag the `dist` folder onto Netlify.

## Local development

```bash
npm install
npm run dev
```

Open <http://localhost:5180>. Without a client ID configured, the sign-in page offers **Preview with sample data**, which runs the whole UI against fictional in-memory patients (also available in production by adding `?demo` to the URL).

> Google Drive gotcha: `npm install` fails inside a Drive-synced folder. Copy the project to a local folder (or pause Drive sync) before installing.

## Adding a doctor later

Add a tab to the sheet with the doctor's name. That's it.

## Project layout

```
src/
  App.tsx                 sign-in gate, data loading, all actions
  lib/types.ts            Patient model, statuses, sheet header
  lib/dates.ts            date parsing and the 11-month outreach rule
  lib/logic.ts            stage derivation, sorting, roll-forward
  lib/sheets.ts           Google Sheets data source
  lib/demo.ts             in-memory sample data source
  lib/auth.ts             Google Identity Services sign-in
  components/             UI
```
