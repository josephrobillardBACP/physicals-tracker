import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { defineSecret, defineString } from "firebase-functions/params";
import { logger } from "firebase-functions/v2";
import { onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { needsOutreach, PatientRecord } from "./due";
import { outreachEmail, sendViaResend } from "./email";

/**
 * Once a day, tell each practice's front office if any of their patients have
 * *newly* come due for outreach.
 *
 * "Newly" is the whole point: the run remembers which patients it has already
 * reported, so a patient sitting in the needs-outreach pile for a fortnight
 * only ever produces one email. The stored list is replaced with the current
 * due set each run, so a patient who is dealt with and later comes due again
 * does produce a fresh email.
 *
 * The email carries a count and a link, never patient names, so no protected
 * health information leaves the database.
 */

initializeApp();
const db = getFirestore();

const ROOT = "physicals";
const TIMEZONE = "America/Los_Angeles";

const RESEND_API_KEY = defineSecret("RESEND_API_KEY");
// Separate from the Resend key on purpose: this one travels in a URL, so it
// must not be a credential that can do anything else.
const TRIGGER_KEY = defineSecret("TRIGGER_KEY");
const MAIL_FROM = defineString("MAIL_FROM", { default: "Annual Physicals <physicals@blueangelclinical.com>" });
const APP_URL = defineString("APP_URL", { default: "https://physicals.blueangelclinical.com" });

interface PanelDoc {
  title?: string;
  notifyEmails?: unknown;
}

function recipients(d: PanelDoc): string[] {
  return Array.isArray(d.notifyEmails) ? d.notifyEmails.filter((x): x is string => typeof x === "string") : [];
}

/** Returns a short summary of what it did, for logs and the manual test route. */
async function runDailyCheck(force = false): Promise<string[]> {
  const notes: string[] = [];
  const asOf = new Date();
  const panels = await db.collection(ROOT).get();

  for (const panelDoc of panels.docs) {
    const data = panelDoc.data() as PanelDoc;
    const practice = data.title ?? panelDoc.id;

    const patients = await panelDoc.ref.collection("patients").get();
    const dueIds = patients.docs.filter((d) => needsOutreach(d.data() as PatientRecord, asOf)).map((d) => d.id);

    const stateRef = panelDoc.ref.collection("state").doc("notify");
    const state = await stateRef.get();

    // First ever run: record where things stand without emailing a backlog.
    if (!state.exists && !force) {
      await stateRef.set({ notifiedIds: dueIds, lastRunAt: asOf.toISOString(), seeded: true });
      notes.push(`${practice}: first run, recorded ${dueIds.length} already due, no email sent`);
      continue;
    }

    // `force` lets a manual run treat everything currently due as new, so the
    // email pipeline can be tested without waiting for a patient to cross over.
    const already = force ? new Set<string>() : new Set<string>((state.data()?.notifiedIds as string[] | undefined) ?? []);
    const newlyDue = dueIds.filter((id) => !already.has(id));

    // Always store the current set, so patients who were dealt with drop off
    // and will notify again if they ever come back round.
    const update: Record<string, unknown> = { notifiedIds: dueIds, lastRunAt: asOf.toISOString() };

    if (newlyDue.length === 0) {
      await stateRef.set(update, { merge: true });
      notes.push(`${practice}: nothing new (${dueIds.length} still open)`);
      continue;
    }

    const to = recipients(data);
    if (to.length === 0) {
      await stateRef.set(update, { merge: true });
      notes.push(`${practice}: ${newlyDue.length} newly due but nobody is on the recipient list`);
      continue;
    }

    const count = newlyDue.length;
    const msg = outreachEmail(practice, count, APP_URL.value());

    try {
      await sendViaResend(RESEND_API_KEY.value(), MAIL_FROM.value(), to, msg);
      update.lastEmailAt = asOf.toISOString();
      update.lastEmailCount = count;
      notes.push(`${practice}: emailed ${to.length} recipient(s) about ${count} newly due`);
    } catch (e) {
      // Do not record these as notified, so tomorrow's run tries again.
      logger.error(`Email failed for ${practice}`, e);
      update.notifiedIds = [...already].filter((id) => dueIds.includes(id));
      update.lastError = (e as Error).message;
      notes.push(`${practice}: email FAILED, will retry tomorrow`);
    }

    await stateRef.set(update, { merge: true });
  }

  return notes;
}

export const dailyOutreachEmail = onSchedule(
  { schedule: "0 7 * * *", timeZone: TIMEZONE, secrets: [RESEND_API_KEY], region: "us-central1" },
  async () => {
    const notes = await runDailyCheck();
    notes.forEach((n) => logger.info(n));
  },
);

/**
 * Manual trigger for testing the wiring. Requires the shared secret so a URL
 * on its own is not enough to fire it.
 */
export const runOutreachCheckNow = onRequest(
  { secrets: [RESEND_API_KEY, TRIGGER_KEY], region: "us-central1" },
  async (req, res) => {
    const supplied = req.get("x-trigger-key") ?? req.query.key;
    const expected = TRIGGER_KEY.value();
    if (!expected || supplied !== expected) {
      res.status(403).send("Forbidden");
      return;
    }
    const notes = await runDailyCheck(req.query.force === "1");
    res.status(200).send(notes.join("\n") || "nothing to do");
  },
);
