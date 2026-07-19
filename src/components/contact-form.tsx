"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Localized copy for the contact form. Passed in from the single-language
 * page (English /contact/, German /de/kontakt/) so this one client component
 * serves both without pulling the strings into the i18n message files - the
 * same approach the root legal pages use for their hardcoded copy.
 */
export type ContactFormLabels = {
  name: string;
  email: string;
  /** Optional ICAO reference field (pre-filled from a detail-page link). */
  icao: string;
  subject: string;
  message: string;
  send: string;
  sending: string;
  success: string;
  error: string;
  /** Shown in place of the widget/button when Turnstile is not configured. */
  unavailable: string;
  /** Screen-reader hint that the human-verification widget is loading. */
  verifying: string;
};

type Status = "idle" | "submitting" | "success" | "error";

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        opts: {
          sitekey: string;
          callback: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
        },
      ) => string;
      reset: (widgetId?: string) => void;
    };
  }
}

const TURNSTILE_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

export function ContactForm({
  siteKey,
  labels,
  initialIcao,
  initialSubject,
  initialMessage,
}: {
  /** Turnstile site key, or undefined when the form is not provisioned. */
  siteKey?: string;
  labels: ContactFormLabels;
  /** Pre-filled ICAO (from an airport detail-page "report a problem" link). */
  initialIcao?: string;
  /** Pre-filled subject line (set when arriving with an aerodrome reference). */
  initialSubject?: string;
  /** Pre-filled message placeholder text. */
  initialMessage?: string;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [token, setToken] = useState<string>("");
  // The ICAO is the only controlled field, seeded from the link so it shows the
  // referenced aerodrome yet stays editable. Subject/message use defaultValue
  // (uncontrolled, like the other fields) so a prefill seeds them without
  // freezing the user's edits.
  const [icao, setIcao] = useState<string>(initialIcao ?? "");
  const widgetHost = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);

  // Explicitly render the Turnstile widget once its script has loaded. The
  // token flows into state via the callback; expiry/error clear it so a submit
  // always carries a fresh token.
  useEffect(() => {
    if (!siteKey) return;

    const render = () => {
      if (!window.turnstile || !widgetHost.current || widgetId.current) return;
      widgetId.current = window.turnstile.render(widgetHost.current, {
        sitekey: siteKey,
        callback: (t) => setToken(t),
        "expired-callback": () => setToken(""),
        "error-callback": () => setToken(""),
      });
    };

    if (window.turnstile) {
      render();
      return;
    }
    let script = document.getElementById(
      "cf-turnstile-script",
    ) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement("script");
      script.id = "cf-turnstile-script";
      script.src = TURNSTILE_SRC;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
    script.addEventListener("load", render);
    return () => script?.removeEventListener("load", render);
  }, [siteKey]);

  if (!siteKey) {
    return (
      <p className="text-drossgray-dark rounded-md bg-amber-50 p-4 text-sm">
        {labels.unavailable}
      </p>
    );
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === "submitting") return;
    const form = e.currentTarget;
    const data = new FormData(form);

    if (!token) {
      setStatus("error");
      setErrorMsg(labels.verifying);
      return;
    }

    setStatus("submitting");
    setErrorMsg("");
    try {
      const res = await fetch("/api/contact/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.get("name"),
          email: data.get("email"),
          icao: data.get("icao"),
          subject: data.get("subject"),
          message: data.get("message"),
          company: data.get("company"),
          token,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setStatus("success");
      form.reset();
      setIcao("");
      setToken("");
      if (widgetId.current && window.turnstile) {
        window.turnstile.reset(widgetId.current);
      }
    } catch {
      setStatus("error");
      setErrorMsg(labels.error);
    }
  }

  const fieldLabel = "block text-sm font-medium text-drossgray-dark";
  // Grey fill (drossgray, #f0f2f2) on the white card, with a solid drossgray-dark
  // (#626262) border so the field boundary clears WCAG 1.4.11 non-text contrast
  // (~6:1 vs the white card, ~5:1 vs the fill) - the former bg-white + /20 border
  // was well under the 3:1 minimum. Text stays near-black on the light fill
  // (AA text contrast); focus swaps the border/ring to drossblue.
  const fieldInput =
    "mt-1 block w-full rounded-md border border-drossgray-dark bg-drossgray px-3 py-2 text-base shadow-sm focus-visible:border-drossblue focus-visible:ring-1 focus-visible:ring-drossblue focus-visible:outline-none";

  if (status === "success") {
    return (
      <p
        role="status"
        className="rounded-md bg-green-50 p-4 text-sm font-medium text-green-800"
      >
        {labels.success}
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      <div>
        <label htmlFor="contact-name" className={fieldLabel}>
          {labels.name}
        </label>
        <input
          id="contact-name"
          name="name"
          type="text"
          required
          maxLength={100}
          autoComplete="name"
          className={fieldInput}
        />
      </div>

      <div>
        <label htmlFor="contact-email" className={fieldLabel}>
          {labels.email}
        </label>
        <input
          id="contact-email"
          name="email"
          type="email"
          required
          maxLength={200}
          autoComplete="email"
          className={fieldInput}
        />
      </div>

      <div>
        <label htmlFor="contact-icao" className={fieldLabel}>
          {labels.icao}
        </label>
        <input
          id="contact-icao"
          name="icao"
          type="text"
          value={icao}
          onChange={(e) => setIcao(e.currentTarget.value.toUpperCase())}
          maxLength={8}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          className={fieldInput}
        />
      </div>

      <div>
        <label htmlFor="contact-subject" className={fieldLabel}>
          {labels.subject}
        </label>
        <input
          id="contact-subject"
          name="subject"
          type="text"
          maxLength={200}
          defaultValue={initialSubject}
          className={fieldInput}
        />
      </div>

      <div>
        <label htmlFor="contact-message" className={fieldLabel}>
          {labels.message}
        </label>
        <textarea
          id="contact-message"
          name="message"
          required
          maxLength={5000}
          rows={6}
          defaultValue={initialMessage}
          className={fieldInput}
        />
      </div>

      {/* Honeypot: visually hidden, off the tab order, must stay empty. */}
      <div aria-hidden="true" className="hidden">
        <label htmlFor="contact-company">Company (leave blank)</label>
        <input
          id="contact-company"
          name="company"
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      {/* Cloudflare Turnstile widget renders here. */}
      <div ref={widgetHost} />

      {status === "error" && (
        <p role="alert" className="text-sm font-medium text-red-700">
          {errorMsg || labels.error}
        </p>
      )}

      <button
        type="submit"
        disabled={status === "submitting"}
        className="bg-drossblue hover:bg-drossblue-light inline-flex min-h-11 items-center justify-center rounded-md px-6 py-2.5 font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-60"
      >
        {status === "submitting" ? labels.sending : labels.send}
      </button>
    </form>
  );
}
