# Connecting the tracker to Firebase

Everything below is done in a browser except Part 5, which needs a terminal.
Sign in as **joseph@blueangelclinical.com** throughout.

The travel medicine Firebase project is reused on purpose: staff already signed
in there, so nothing new has to be approved by them.

---

## Part 1 — Firebase console

### 1.1 The app is already registered

You registered the web app and sent me its config, so these are the values to
use. They are public. They identify the project, they do not grant access.
Access is decided by sign-in and by the rules in step 1.3.

```
VITE_FIREBASE_API_KEY          AIzaSyDb84xpoq9Z4NRUJ3xu3f_qj-qzHsMM-f8
VITE_FIREBASE_AUTH_DOMAIN      travel-medicine-workflow-ee312.firebaseapp.com
VITE_FIREBASE_PROJECT_ID       travel-medicine-workflow-ee312
VITE_FIREBASE_STORAGE_BUCKET   travel-medicine-workflow-ee312.firebasestorage.app
VITE_FIREBASE_SENDER_ID        814155807315
VITE_FIREBASE_APP_ID           1:814155807315:web:8ef90a29df4c8420a424a6
VITE_ALLOWED_DOMAIN            blueangelclinical.com
```

### 1.2 Allow the site to sign people in

1. Left sidebar: **Build → Authentication**.
2. **Sign-in method** tab. Confirm **Google** is Enabled. It will be, from travel medicine.
3. **Settings** tab → **Authorised domains** → **Add domain**, twice:
   - `physicals.blueangelclinical.com`
   - `josephrobillardbacp.github.io`

   Sign-in fails with an "unauthorised domain" error if these are missing.

### 1.3 Add the security rules

This is the step that protects the patient data, so do not skip it.

1. Left sidebar: **Build → Firestore Database**, then the **Rules** tab.
2. You will see the existing travel medicine rules. **Do not replace them.**
3. Find the line `match /databases/{database}/documents {`. Paste the block below
   directly underneath it, leaving everything already there untouched.
4. Click **Publish**.

```
    function physicalsSignedIn() {
      return request.auth != null && request.auth.token.email != null;
    }

    function physicalsEmail() {
      return request.auth.token.email.lower();
    }

    function physicalsOnDomain() {
      return physicalsEmail().matches('.*@blueangelclinical[.]com');
    }

    function physicalsOnAllowlist() {
      return exists(/databases/$(database)/documents/admin/allowlist)
        && get(/databases/$(database)/documents/admin/allowlist).data.emails[physicalsEmail()] != null;
    }

    function physicalsStaff() {
      return physicalsSignedIn() && (physicalsOnDomain() || physicalsOnAllowlist());
    }

    match /physicals/{panelId} {
      allow read, write: if physicalsStaff();

      match /{document=**} {
        allow read, write: if physicalsStaff();
      }
    }
```

Every name starts with `physicals` so nothing can clash with the rules already
there. The same block is kept in `firestore.rules` in this repository.

Nothing else is needed in Firestore. The app creates its own collections the
first time it runs.

---

## Part 2 — GitHub

Go to <https://github.com/josephrobillardBACP/physicals-tracker>.

### 2.1 Turn on Pages

**Settings → Pages → Build and deployment → Source: GitHub Actions.**

### 2.2 Add the seven variables

**Settings → Secrets and variables → Actions → Variables** tab (not Secrets).
Click **New repository variable** and add each name and value from step 1.1.

Variables rather than secrets, because they ship inside the JavaScript bundle
anyway. Putting them in Secrets would only hide them from you, not from anyone
who opens the page.

### 2.3 Deploy

**Actions** tab → **Deploy to GitHub Pages** → **Run workflow** on `main`.
It takes about two minutes. When it goes green the site is live at:

**https://josephrobillardbacp.github.io/physicals-tracker/**

You can sign in and use it at that address straight away. The custom domain in
Part 3 is cosmetic.

---

## Part 3 — Custom domain (optional)

1. In whichever DNS provider holds `blueangelclinical.com`, the same place
   `travel.blueangelclinical.com` is configured, add a record:

   | Type | Name | Value |
   | --- | --- | --- |
   | CNAME | `physicals` | `josephrobillardbacp.github.io` |

2. Back in **Settings → Pages**, the custom domain box should already read
   `physicals.blueangelclinical.com`, because `public/CNAME` claims it.
3. Wait for the DNS check to pass, then tick **Enforce HTTPS**. The certificate
   can take up to an hour.

---

## Part 4 — First run

1. Open the site and click **Sign in with Google**. Use your
   `@blueangelclinical.com` account.
2. The Practice dropdown shows **Dr. Sujansky** and **Dr. Daniher**. The app
   created both on first load.
3. With Dr. Sujansky selected, click **Import from CSV** and choose:
   `G:\My Drive\Code\physicals-tracker-seed-data\Dr. Sujansky.csv`
4. All 210 patients appear, sorted with the overdue ones first.
5. Switch to Dr. Daniher. It is empty and ready.

Then send the link to the front office. Anyone with a
`@blueangelclinical.com` account can sign in. No per-person setup.

---

## Part 5 — The daily outreach email (optional, do it last)

Once a day at 7am Pacific, each practice's recipients get an email if any of
their patients have **newly** come due for outreach. A patient who has been
waiting a while does not trigger another email. The message contains a count and
a link, never patient names.

### 5.1 Upgrade the Firebase project to Blaze

Scheduled functions need the pay-as-you-go plan.

1. Firebase console → gear icon → **Usage and billing** → **Details & settings**.
2. **Modify plan** → **Blaze** → link or create a Cloud Billing account.
3. While you are there, set a **budget alert** at a few dollars for peace of mind.

One run a day sits far inside the free allowance, so the real cost is nil. The
upgrade is about having a billing account attached, not about spending.

### 5.2 Set up Resend

1. Sign up at <https://resend.com>.
2. **Domains → Add Domain** → `blueangelclinical.com`.
3. Resend shows a handful of DNS records. Add them at the same provider you used
   in Part 3, then wait for it to verify.
4. **API Keys → Create API Key**. Copy it; it starts with `re_`. You only see it once.

To try it before touching DNS, skip straight to 5.3 and set the from address to
`onboarding@resend.dev`, which Resend lets anyone send from for testing.

### 5.3 Deploy the function

**Already done for you.** There is a working local checkout at
`C:\Users\Josep\Code\physicals-tracker` with the function's dependencies
installed and the Firebase CLI on the machine. Deploy from there, not from the
Google Drive copy.

Why not from Drive: `npm install` writes thousands of small files, and Google
Drive's sync layer invalidates file handles mid-write, which corrupts
`node_modules`. Nothing about the app needs Drive; it is only where the folder
happens to live. Both folders are clones of the same GitHub repo, so
`git pull` keeps the local one current.

**`functions/.env` already exists** in both checkouts, including
`C:\Users\Josep\Code\physicals-tracker\functions\.env`, filled in with safe
starting values. It is gitignored, so it never leaves your machine. Open it and
change these two when you are ready:

```
MAIL_FROM="Annual Physicals <onboarding@resend.dev>"
APP_URL="https://josephrobillardbacp.github.io/physicals-tracker/"
```

- `MAIL_FROM` starts as `onboarding@resend.dev`, which Resend lets anyone send
  from without verifying anything. Once your domain is verified in step 5.2,
  change it to `physicals@blueangelclinical.com`.
- `APP_URL` starts as the github.io address. Change it to
  `https://physicals.blueangelclinical.com` once the custom domain is live.

Changing either one means redeploying for it to take effect.

Then deploy:

```bash
cd C:\Users\Josep\Code\physicals-tracker
git pull

firebase login

firebase functions:secrets:set RESEND_API_KEY
# paste the re_... key from step 5.2 when prompted

firebase functions:secrets:set TRIGGER_KEY
# paste any random string you invent. This is only the password for the
# manual test URL in step 5.5, nothing else. Keep a copy.

firebase deploy --only functions
```

The project is pinned in `.firebaserc`, so there is no project to select and no
way to deploy to the wrong one by accident. The first deploy asks to enable a
few Google APIs, Cloud Scheduler among them. Say yes.

### 5.4 Choose who gets the email

In the app, pick a practice and click **Email settings** at the top right.
Add the front office addresses for that practice and save. Do the same for the
other practice. Each list only ever hears about its own patients.

### 5.5 Test it

The very first run quietly records who is already overdue without emailing, so
you do not get a blast about the existing backlog. To prove the whole path
works, run it once to seed, then deliberately make one patient newly due.

**a. Add recipients first** (step 5.4), or the run has nobody to email.

**b. Seed the state.** Open Cloud Scheduler:

```
https://console.cloud.google.com/cloudscheduler?project=travel-medicine-workflow-ee312
```

Find the job whose name contains `dailyOutreachEmail`, click the three dots on
its row, and choose **Force run**.

**c. Check the logs.** Firebase console → Functions → Logs, or:

```
https://console.cloud.google.com/logs/query?project=travel-medicine-workflow-ee312
```

You should see a line per practice reading
`first run, recorded N already due, no email sent`. That alone proves the
function reached Firestore and read the right data.

**d. Make one patient newly due.** In the app, click **Add patient**, give it an
obvious test name, and leave the last physical blank. A patient with no physical
on record counts as needing outreach immediately.

**e. Force run again.** The logs should now read
`emailed 1 recipient(s) about 1 newly due`, and the email should arrive. That is
the real production path, not a special test mode.

**f. Tidy up.** Delete the test patient with the **x** on its row.

A third force run should report `nothing new`, which is the behaviour you asked
for: no repeat emails about patients already in the pile.

> The `runOutreachCheckNow` HTTP function also exists, but your organization's
> policy blocks public access to Cloud Run services, so a plain browser request
> gets a Google 403 before reaching it. That policy is a sensible default and
> not worth weakening for a test endpoint. Calling it needs a Google identity
> token; the Cloud Scheduler route above is easier.

---

## If something goes wrong

| What you see | What it means |
| --- | --- |
| "Sign-in isn't configured yet" | The seven variables are missing, or the workflow ran before you added them. Add them, then re-run the workflow. |
| A Google error about an unauthorised domain | Step 1.2 was skipped for that address. |
| "You don't have access to the physicals data" | The rules in step 1.3 were not published, or were pasted outside the `match /databases/{database}/documents` block. |
| Sign-in works but the list never loads | Open the browser console. A `permission-denied` message points back at step 1.3. |
| The page loads blank | Check the Actions run finished green, and that Pages source is set to GitHub Actions. |
| No email ever arrives | Check the Email settings list is not empty, then check Functions logs. A line saying "nobody is on the recipient list" means step 5.4. |
| The test URL returns a Google 403 page | Expected. Org policy blocks public Cloud Run access. Use the Cloud Scheduler force run in step 5.5 instead. |
| Build fails: "missing permission on the build service account" | Grant **Cloud Build Service Account** to `<project-number>-compute@developer.gserviceaccount.com` on the project IAM page. Projects under an organization do not get this automatically. |
| Build fails: "lib/index.js does not exist" | `lib` is being excluded by the `ignore` list in firebase.json. It must ship. |
| Logs say "first run, recorded N already due" | Expected on the very first run. Add `&force=1` to actually send. |
| Resend returns 403 | The domain is not verified yet, or the from address does not match the verified domain. |

## Granting access to someone outside the domain

Add their address to the `emails` map in the `admin/allowlist` document in
Firestore, the same document the travel medicine admin page manages. They then
get in with a Google account on that address.
