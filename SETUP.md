# Connecting the tracker to Firebase

Everything below is done in a browser. No code changes are needed. Sign in as
**joseph@blueangelclinical.com** throughout.

Reusing the travel medicine Firebase project on purpose: staff already signed in
there, so nothing new has to be approved by them.

---

## Part 1 — Firebase console (about 10 minutes)

### 1.1 Open the project

1. Go to <https://console.firebase.google.com/>.
2. Open the project that runs the travel medicine workflow. It is the one whose
   ID starts with **travel-medicine-workflow**.

### 1.2 Register the app and copy its config

1. Click the **gear icon** beside "Project Overview", then **Project settings**.
2. Stay on the **General** tab and scroll to **Your apps**.
3. Click **Add app** and choose the web icon, **`</>`**.
4. App nickname: `Physicals Tracker`. **Leave "Also set up Firebase Hosting" unticked** — GitHub Pages does the hosting.
5. Click **Register app**.
6. A `firebaseConfig` block appears. Keep this tab open, you need six values from it:

   | In the config | Goes into the variable |
   | --- | --- |
   | `apiKey` | `VITE_FIREBASE_API_KEY` |
   | `authDomain` | `VITE_FIREBASE_AUTH_DOMAIN` |
   | `projectId` | `VITE_FIREBASE_PROJECT_ID` |
   | `storageBucket` | `VITE_FIREBASE_STORAGE_BUCKET` |
   | `messagingSenderId` | `VITE_FIREBASE_SENDER_ID` |
   | `appId` | `VITE_FIREBASE_APP_ID` |

   These are public values. They identify the project, they do not grant access.
   Access is decided by sign-in and by the rules in step 1.4.

   If you would rather not add an app, the existing travel medicine app's config
   works too. Only `appId` differs between apps in the same project.

### 1.3 Allow the site to sign people in

1. Left sidebar: **Build → Authentication**.
2. **Sign-in method** tab. Confirm **Google** is listed as Enabled. It will be, from travel medicine. If not, enable it.
3. **Settings** tab → **Authorised domains** → **Add domain**, twice:
   - `physicals.blueangelclinical.com`
   - `josephrobillardbacp.github.io`

   Sign-in fails with an "unauthorised domain" error if these are missing.

### 1.4 Add the security rules

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

      match /patients/{patientId} {
        allow read, write: if physicalsStaff();
      }
    }
```

Every name starts with `physicals` so nothing can clash with the rules already
there. The same block is kept in `firestore.rules` in this repository.

Nothing else is needed in Firestore. The app creates its own collections the
first time it runs.

---

## Part 2 — GitHub (about 5 minutes)

Go to <https://github.com/josephrobillardBACP/physicals-tracker>.

### 2.1 Turn on Pages

**Settings → Pages → Build and deployment → Source: GitHub Actions.**

### 2.2 Add the seven variables

**Settings → Secrets and variables → Actions → Variables** tab (not Secrets).
Click **New repository variable** and add each of these:

```
VITE_FIREBASE_API_KEY          <apiKey from step 1.2>
VITE_FIREBASE_AUTH_DOMAIN      <authDomain>
VITE_FIREBASE_PROJECT_ID       <projectId>
VITE_FIREBASE_STORAGE_BUCKET   <storageBucket>
VITE_FIREBASE_SENDER_ID        <messagingSenderId>
VITE_FIREBASE_APP_ID           <appId>
VITE_ALLOWED_DOMAIN            blueangelclinical.com
```

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

## If something goes wrong

| What you see | What it means |
| --- | --- |
| "Sign-in isn't configured yet" | The seven variables are missing or the workflow ran before you added them. Add them, then re-run the workflow. |
| A Google error about an unauthorised domain | Step 1.3 was skipped for that address. |
| "You don't have access to the physicals data" | The rules in step 1.4 were not published, or were pasted outside the `match /databases/{database}/documents` block. |
| Sign-in works but the list never loads | Open the browser console. A `permission-denied` message points back at step 1.4. |
| The page loads blank | Check the Actions run finished green, and that Pages source is set to GitHub Actions. |

## Granting access to someone outside the domain

Add their address to the `emails` map in the `admin/allowlist` document in
Firestore, the same document the travel medicine admin page manages. They then
get in with a Google account on that address.
