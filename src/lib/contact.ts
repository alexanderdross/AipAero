/**
 * Server-only helpers for the contact form (/contact/, /de/kontakt/).
 *
 * Two responsibilities, both used exclusively by `src/app/api/contact/route.ts`:
 *  1. Verify the Cloudflare Turnstile token server-side (siteverify).
 *  2. Deliver the submitted message to the site inbox via the Resend HTTP API.
 *
 * Mail is sent over Resend's plain HTTPS API (a `fetch`), NOT SMTP. SMTP on the
 * Cloudflare Workers runtime needs `cloudflare:sockets`, and the OpenNext esbuild
 * bundle cannot resolve/externalize that virtual module for the SMTP client
 * (`worker-mailer`) - a static require fails at build, a dynamic require fails at
 * runtime ("Dynamic require of cloudflare:sockets is not supported"). An HTTP
 * API sidesteps sockets entirely and is the reliable pattern on Workers.
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
  return Boolean(turnstileSecretKey() && env.RESEND_API_KEY);
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
  /** Aerodrome the message is about (from a detail-page link); "" when none. */
  icao?: string;
  subject: string;
  message: string;
};

/**
 * Deliver the submission to {@link CONTACT_RECIPIENT} via the Resend HTTP API.
 * The From is a mailbox on our Resend-verified domain (CONTACT_FROM, default a
 * no-reply on aip.aero) so SPF/DKIM pass; the visitor's address is set as
 * Reply-To so a reply reaches them directly. Throws on delivery failure (the
 * route maps it to a 502).
 */
export async function sendContactEmail(msg: ContactMessage): Promise<void> {
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("Resend is not configured");
  }
  // Sender must be on a Resend-verified domain (aip.aero). Override with
  // CONTACT_FROM (e.g. "AIP:Aero <kontakt@aip.aero>").
  const from = env.CONTACT_FROM ?? "AIP:Aero <noreply@aip.aero>";

  // Belt-and-braces: strip anything but alphanumerics before the ICAO reaches
  // the mail headers/body (the API schema already enforces this, but the mail
  // composer must not assume its caller validated - a stray CR/LF must never
  // reach the Subject line).
  const icao = msg.icao?.replace(/[^A-Za-z0-9]/g, "");
  const baseSubject = msg.subject
    ? `[AIP:Aero] ${msg.subject}`
    : `[AIP:Aero] Contact from ${msg.name}`;
  // Surface the aerodrome in the subject so a data-correction report is
  // recognisable in the inbox without opening it (skip if the subject already
  // names it, e.g. the "Data correction: EDNY" prefill).
  const subject =
    icao && !baseSubject.includes(icao)
      ? `${baseSubject} [${icao}]`
      : baseSubject;

  const text = [
    `Name:    ${msg.name}`,
    `Email:   ${msg.email}`,
    icao ? `ICAO:    ${icao}` : null,
    msg.subject ? `Subject: ${msg.subject}` : null,
    "",
    msg.message,
    "",
    "-- ",
    "Sent via the AIP:Aero contact form (aip.aero/contact).",
  ]
    .filter((line) => line !== null)
    .join("\n");

  // Plain HTTPS POST - no SMTP, no cloudflare:sockets (which the OpenNext bundle
  // cannot externalize). Reliable on the Workers runtime.
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [CONTACT_RECIPIENT],
      reply_to: msg.email,
      subject,
      text,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Resend API ${res.status}: ${detail.slice(0, 300)}`);
  }
}
