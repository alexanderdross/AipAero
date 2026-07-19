import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  contactConfigured,
  sendContactEmail,
  verifyTurnstile,
} from "~/lib/contact";

/**
 * Contact-form endpoint (POST) backing /contact/ and /de/kontakt/.
 *
 * Flow: validate body -> reject honeypot hits -> verify the Turnstile token
 * server-side -> deliver the message over Netcup SMTP. Returns 503 when the
 * endpoint is not provisioned (missing Turnstile secret / SMTP config), so
 * shipping the route exposes nothing until secrets are set.
 */

const contactSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(200),
  // Optional user-supplied subject line.
  subject: z.string().trim().max(200).optional().default(""),
  message: z.string().trim().min(1).max(5000),
  // Cloudflare Turnstile token (cf-turnstile-response).
  token: z.string().min(1).max(4096),
  // Honeypot: a hidden field real users never fill. Accept any value here so a
  // bot that fills it still passes validation - it is then silently dropped
  // below (a 400 would tell the bot the field is watched).
  company: z.string().max(200).optional(),
});

export async function POST(req: NextRequest) {
  if (!contactConfigured()) {
    return NextResponse.json(
      { error: "Contact form is not configured" },
      { status: 503 },
    );
  }

  let parsed: z.infer<typeof contactSchema>;
  try {
    parsed = contactSchema.parse(await req.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid submission", issues: error.issues },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: "Invalid submission" }, { status: 400 });
  }

  // Honeypot tripped: pretend success so bots get no signal.
  if (parsed.company) {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const ip =
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for") ||
    req.headers.get("x-real-ip");

  const human = await verifyTurnstile(parsed.token, ip);
  if (!human) {
    return NextResponse.json(
      { error: "Verification failed. Please try again." },
      { status: 400 },
    );
  }

  try {
    await sendContactEmail({
      name: parsed.name,
      email: parsed.email,
      subject: parsed.subject,
      message: parsed.message,
    });
  } catch (error) {
    console.error(
      "Contact form delivery failed:",
      error instanceof Error ? error.message : "unknown error",
    );
    return NextResponse.json(
      { error: "Could not send your message. Please try again later." },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
