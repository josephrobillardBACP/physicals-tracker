/**
 * Sends one sample outreach email, using the same template the scheduled
 * function uses. Proves the mail path on its own, without waiting for a
 * patient to come due.
 *
 *   cd functions
 *   npm run build
 *   node send-test-email.cjs you@blueangelclinical.com
 *
 * Reads the key from RESEND_API_KEY, or from a second argument. The key is
 * never stored in this repository.
 */
const { outreachEmail, sendViaResend } = require("./lib/email.js");

const to = process.argv[2];
const apiKey = process.env.RESEND_API_KEY || process.argv[3];
const from = process.env.MAIL_FROM || "Annual Physicals <onboarding@resend.dev>";
const url = process.env.APP_URL || "https://physicals.blueangelclinical.com";

if (!to || !apiKey) {
  console.error("Usage: node send-test-email.cjs <to-address> [resend-api-key]");
  console.error("       (or set RESEND_API_KEY in the environment)");
  process.exit(1);
}

const msg = outreachEmail("Dr. Sujansky", 3, url);
console.log(`Sending "${msg.subject}"\n  from ${from}\n  to   ${to}`);

sendViaResend(apiKey, from, [to], msg)
  .then((r) => console.log("Accepted by Resend:", r))
  .catch((e) => {
    console.error("Failed:", e.message);
    process.exit(1);
  });
