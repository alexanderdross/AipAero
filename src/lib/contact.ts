/**
 * Server-only helpers for the contact form (/contact/, /de/kontakt/).
 *
 * Two responsibilities, both used exclusively by `src/app/api/contact/route.ts`:
 *  1. Verify the Cloudflare Turnstile token server-side (siteverify).
 *  2. Deliver the submitted message to the site inbox over Netcup SMTP.
 *
 * On the Cloudflare Workers runtime there is no classic Node SMTP (no raw
 * sockets via `net`), so the mail is sent with `worker-mailer`, which speaks
 * SMTP over Cloudflare's TCP socket API (`cloudflare:sockets`). That module
 * only exists on the Worker, so `worker-mailer` is imported dynamically inside
 * the send call - it is never pulled into the Node `next build` graph.
 */

import { env } from "~/env";

/** Where contact-form submissions are delivered (owner-provided inbox). */
export const CONTACT_RECIPIENT = "info@aip.aero";

/**
 * Cloudflare's documented "always passes" Turnstile test keys. Used only when
 * real keys are unset AND we are not in production, so the form is functional
 * in local dev / preview without provisioning a Turnstile widget. In production
 * missing keys make the API return 503 instead of falling back to these.
 * https://developers.cloudflare.com/turnstile/troubleshooting/testing/
 */
export const TURNSTILE_TEST_SITE_KEY = "1x00000000000000000000AA";
export const TURNSTILE_TEST_SECRET_KEY = "1x0000000000000000000000000000000AA";

/**
 * The Turnstile site key exposed to the widget. Public by design. Falls back to
 * the always-pass test key outside production so the form renders with no
 * config; `undefined` in production when unset (the page then hides the form).
 */
export function turnstileSiteKey(): string | undefined {
  if (env.TURNSTILE_SITE_KEY) return env.TURNSTILE_SITE_KEY;
  return env.NODE_ENV === "production" ? undefined : TURNSTILE_TEST_SITE_KEY;
}

/** Server-side secret counterpart to {@link turnstileSiteKey}. */
function turnstileSecretKey(): string | undefined {
  if (env.TURNSTILE_SECRET_KEY) return env.TURNSTILE_SECRET_KEY;
  return env.NODE_ENV === "production" ? undefined : TURNSTILE_TEST_SECRET_KEY;
}

/** True when the contact endpoint can both verify and deliver a submission. */
export function contactConfigured(): boolean {
  return Boolean(
    turnstileSecretKey() && env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS,
  );
}

/**
 * Validate a Turnstile token against Cloudflare's siteverify endpoint. Returns
 * false on any failure (network, malformed response, unsuccessful verdict) so
 * the caller can reject without leaking detail. Fails closed.
 */
export async function verifyTurnstile(
  token: string,
  remoteIp?: string | null,
): Promise<boolean> {
  const secret = turnstileSecretKey();
  if (!secret) return false;
  try {
    const body = new FormData();
    body.append("secret", secret);
    body.append("response", token);
    if (remoteIp) body.append("remoteip", remoteIp);
    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      { method: "POST", body },
    );
    if (!res.ok) return false;
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}

/** A validated contact-form submission ready to be mailed. */
export type ContactMessage = {
  name: string;
  email: string;
  subject: string;
  message: string;
};

/**
 * Send the submission to {@link CONTACT_RECIPIENT} over Netcup SMTP. The From
 * is our own mailbox (SMTP_FROM, else SMTP_USER) so SPF/DMARC pass; the
 * visitor's address is set as Reply-To so a reply reaches them directly.
 * Throws on delivery failure (the route maps it to a 502).
 */
export async function sendContactEmail(msg: ContactMessage): Promise<void> {
  const host = env.SMTP_HOST;
  const username = env.SMTP_USER;
  const password = env.SMTP_PASS;
  if (!host || !username || !password) {
    throw new Error("SMTP is not configured");
  }
  const port = Number(env.SMTP_PORT ?? "587");
  const from = env.SMTP_FROM ?? username;

  const subject = msg.subject
    ? `[AIP:Aero] ${msg.subject}`
    : `[AIP:Aero] Contact from ${msg.name}`;

  const text = [
    `Name:    ${msg.name}`,
    `Email:   ${msg.email}`,
    msg.subject ? `Subject: ${msg.subject}` : null,
    "",
    msg.message,
    "",
    "-- ",
    "Sent via the AIP:Aero contact form (aip.aero/contact).",
  ]
    .filter((line) => line !== null)
    .join("\n");

  // Dynamic import keeps `cloudflare:sockets` (a Worker-only builtin) out of the
  // Node build graph - it is only resolved at runtime on the Worker.
  const { WorkerMailer } = await import("worker-mailer");
  await WorkerMailer.send(
    {
      host,
      port,
      // 465 = implicit TLS; 587 (and others) negotiate STARTTLS after connect.
      secure: port === 465,
      startTls: port !== 465,
      credentials: { username, password },
      // Netcup mail servers advertise LOGIN and PLAIN - offer both.
      authType: ["plain", "login"],
    },
    {
      from: { name: "AIP:Aero", email: from },
      to: { email: CONTACT_RECIPIENT },
      reply: { name: msg.name, email: msg.email },
      subject,
      text,
    },
  );
}
