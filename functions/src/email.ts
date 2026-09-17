/**
 * The message the daily check sends. Kept free of side effects so it can be
 * rendered and sent on its own when testing the mail path.
 *
 * It carries a count and a link and nothing else: no names, no dates of birth,
 * no patient identifiers. That is deliberate, so no patient data leaves the
 * database just because someone is on a mailing list.
 */
export function outreachEmail(practice: string, count: number, url: string) {
  const noun = count === 1 ? "patient" : "patients";
  const verb = count === 1 ? "needs" : "need";

  const subject = `${count} new physical${count === 1 ? "" : "s"} to book — ${practice}`;

  const text =
    `${count} ${noun} on ${practice}'s list ${verb} a physical booked.\n\n` +
    `Open the tracker: ${url}\n\n` +
    `You are getting this because ${count === 1 ? "a patient" : "patients"} came due for outreach today. ` +
    `You will not be reminded again about the same ${noun}.`;

  const html = `<!doctype html>
<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#263D4F;line-height:1.5">
  <div style="background:#063862;color:#fff;padding:16px 20px;font-size:18px;font-weight:600">Annual Physicals Tracker</div>
  <div style="padding:20px">
    <p style="margin:0 0 16px;font-size:16px">
      <strong>${count} ${noun}</strong> on <strong>${practice}</strong>'s list ${verb} a physical booked.
    </p>
    <p style="margin:0 0 24px">
      <a href="${url}" style="background:#063862;color:#fff;text-decoration:none;padding:10px 18px;border-radius:999px;display:inline-block;font-weight:600">
        Open the tracker
      </a>
    </p>
    <p style="margin:0;color:#5B6B7C;font-size:13px">
      You are getting this because ${count === 1 ? "a patient" : "patients"} came due for outreach today.
      You will not be reminded again about the same ${noun}.
    </p>
  </div>
</div>`;

  return { subject, html, text };
}

/** Posts a message to Resend. Throws with the API's own words on failure. */
export async function sendViaResend(
  apiKey: string,
  from: string,
  to: string[],
  msg: { subject: string; html: string; text: string },
): Promise<string> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, ...msg }),
  });
  const payload = await res.text();
  if (!res.ok) throw new Error(`Resend returned ${res.status}: ${payload}`);
  return payload;
}
