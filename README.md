# Annual Physicals Tracker

A web app the front office uses to see which patients are due for an annual physical, log outreach, book the visit, and roll the patient forward to next year once it is done.

- **Data lives in Firestore**, in the same Firebase project as the travel medicine workflow, under its own `physicals` collection.
- **Staff sign in with their clinic Google account**, exactly as they do for travel medicine. Access is the Workspace domain plus the shared `admin/allowlist` document.
- **Changes appear live.** Everyone looking at the same practice sees each other's edits immediately.

## How it works

Each patient has a last physical date. Outreach is due at the end of the month eleven months later, so a physical on 8/1/2025 comes up for outreach on 7/31/2026.

| Status | When | What staff do |
| --- | --- | --- |
| **Needs outreach** (red) | The outreach date has passed, or there is no physical on record. | Pick a contact status, or book the visit. |
| **In progress** (amber) | Someone has sent a message, left a voicemail, or is waiting on a call back. | Keep it updated, or book the visit. |
| **Physical booked** (blue) | The status is `Physical Booked`, or a visit date is set. | Fill in the date if it is still missing, then click **Physical done** after the visit. |
| **Completed** (green) | Marked done, waiting for confirmation. | Click **Confirm & clear**. The visit date becomes the last physical, the status clears, and the patient drops down the list until next year. The toast offers an undo. |
| **Up to date** (grey) | The outreach date is still in the future. | Nothing. |
| **No physical needed** | The status is `Not Needed`, for children on a family plan. | Nothing. "Start tracking" brings them back. |

**The list holds still while you work.** Setting a status or typing a date never moves a row. The order is recalculated only when you click **Refresh**, change the sort or filter, add a patient, or click **Confirm & clear**. If someone else adds a patient while you are working, a small banner offers to bring them in.

**Sorting:** needs attention first (the default), last name A to Z, most recent physical, or oldest physical.

Filter chips across the top show live counts. Search matches name, date of birth, or notes. Clicking a name opens the full record. Every row has a small **x** to take a patient off the list, with a confirmation and an undo.

## Who can get in

Two layers, both already in place for the travel medicine app:

1. **Sign-in.** Google sign-in through Firebase Auth. Anyone on `blueangelclinical.com` is allowed. Individual outside addresses can be granted access through the shared `admin/allowlist` document that the existing admin page manages. Anyone else is signed straight back out.
2. **Data.** `firestore.rules` enforces the same check on the server, so the data cannot be read even with a hand-made request.

Removing someone from Google Workspace removes their access to both.

## One-time setup

### 1. Firebase

1. In the [Firebase console](https://console.firebase.google.com/), open the project that runs the travel medicine workflow.
2. **Project settings → Your apps → SDK setup and configuration** and copy the config values into `.env` (see `.env.example`), or into the GitHub repository variables listed below.
3. **Authentication → Sign-in method** should already have Google enabled. Under **Settings → Authorised domains**, add `physicals.blueangelclinical.com` and `<your-github-user>.github.io`.
4. **Firestore → Rules:** merge the `physicals` block from `firestore.rules` into the project's existing rules. Do not paste the file over them, or the travel medicine rules will be lost.

The first time the app runs it creates two practices, Dr. Sujansky and Dr. Daniher.

### 2. Bring the patients across

Open the app, pick the practice, and use **Import from CSV** on the empty list. Import the seed file at `G:\My Drive\Code\physicals-tracker-seed-data\Dr. Sujansky.csv`, which is the current roster of 210 patients. That folder sits outside this repository on purpose, because it holds patient data.

The importer matches columns by name, so any export with First Name and Last Name columns works. It also understands Date of Birth, Last Physical, Next Physical, Outreach Status, Notes, and Hint ID in any order.

### 3. Hosting

Pushing to `main` builds and deploys through GitHub Actions.

1. **Settings → Pages → Source: GitHub Actions.**
2. **Settings → Secrets and variables → Actions → Variables** and add the seven `VITE_*` names from `.env.example`. They are repository *variables*, not secrets, because they are public values that ship in the bundle.
3. Point DNS at GitHub Pages by adding a `CNAME` record for `physicals` to `<your-github-user>.github.io`, the same way `travel.blueangelclinical.com` is set up. `public/CNAME` already claims the name.

## Local development

```bash
npm install
npm run dev
```

Open <http://localhost:5180>. With no Firebase config present, the sign-in page offers **Preview with sample data**, which runs the whole app against fictional in-memory patients.

> Google Drive gotcha: `npm install` fails inside a Drive-synced folder. Copy the project to a local folder, or pause Drive sync, before installing.

## Shareable preview

`npm run build:preview` produces `dist-demo/`, the whole app on fictional sample patients with sign-in skipped. Use it to show the workflow to someone without giving them access to real patient data.

## Adding a practice later

Add a document to the `physicals` collection with a `title` and an `order`. It appears in the Practice dropdown.

## Project layout

```
src/
  App.tsx                 sign-in gate, data loading, list ordering, actions
  lib/types.ts            patient model, statuses, sort modes
  lib/dates.ts            date parsing and the 11-month outreach rule
  lib/logic.ts            status derivation, sorting, roll-forward
  lib/firebase.ts         Firebase app, auth and Firestore handles
  lib/auth.ts             Google sign-in and the access check
  lib/firestore.ts        Firestore data source, live updates, bulk import
  lib/csv.ts              spreadsheet import parsing
  lib/demo.ts             in-memory sample data
  components/             UI
firestore.rules           server-side access rules
```
