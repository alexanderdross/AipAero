# OpenNext / worker-mailer patches - maintenance runbook

**Read this whenever `@opennextjs/cloudflare` (or `worker-mailer`) is upgraded.**

The contact form (`/contact/`, `/de/kontakt/`) delivers mail over Netcup SMTP
with `worker-mailer`, which speaks SMTP through the `cloudflare:sockets` workerd
builtin. Two `pnpm` patches make that module survive the OpenNext build as a
native Worker import. They are **version-pinned** and easy to break on an
upgrade, so they need an explicit re-check.

## The two patches

- **`patches/@opennextjs__cloudflare@1.20.1.patch`** - adds `"cloudflare:sockets"`
  to the esbuild `external` list in **both** server-bundle passes:
  - `dist/cli/build/bundle-server.js` (final Worker bundle)
  - `dist/cli/build/open-next/createServerBundle.js` (upstream server bundle)

  Without it, esbuild fails the build with `Could not resolve cloudflare:sockets`.
- **`patches/worker-mailer@1.2.1.patch`** - points the package's `main` at its
  **ESM** build (`dist/index.mjs`, which uses a static
  `import { connect } from "cloudflare:sockets"`) instead of the CJS build
  (`dist/index.js`, `require("cloudflare:sockets")`). Combined with the external
  above, the built Worker keeps a native `import ... "cloudflare:sockets"` that
  workerd resolves at runtime.

Both are registered under `pnpm.patchedDependencies` in `package.json`.

## Why it is needed (background)

- A **static** `require("cloudflare:sockets")` fails the OpenNext esbuild build
  ("Could not resolve").
- A **dynamic** `require(...)` workaround builds, but throws at runtime -
  `Dynamic require of "cloudflare:sockets" is not supported` - which returned a
  **502** on every contact-form submission (root-caused 19.07.2026, PR #356).
- `@opennextjs/cloudflare` (1.20.1) exposes **no supported config hook** to
  externalize the module (its `OpenNextConfig` only offers cache overrides,
  `useWorkerdCondition`, `skewProtection`), so patching the adapter is the only
  lever. Do **not** switch the contact form to a different mail provider to dodge
  this - Netcup SMTP is a deliberate owner decision.

## Upgrade checklist (`@opennextjs/cloudflare` bump)

1. The adapter patch is keyed to **1.20.1**. After bumping, `pnpm install` will
   likely **fail to apply** it (version mismatch) or apply it to shifted lines.
   Re-create it: `pnpm patch "@opennextjs/cloudflare@<new-version>"`, add
   `"cloudflare:sockets"` to the `external: [...]` array in **both**
   `dist/cli/build/bundle-server.js` and
   `dist/cli/build/open-next/createServerBundle.js`, then `pnpm patch-commit`.
   Remove the stale `@1.20.1` patch file + `patchedDependencies` entry.
2. Confirm both `external:` arrays still exist and still need the entry (upstream
   may one day externalize `cloudflare:*` itself - then the adapter patch can be
   dropped).
3. Rebuild and verify:
   - `pnpm cf-build` **succeeds** (previously failed on `cloudflare:sockets`).
   - The built Worker carries a native import, not a dynamic-require shim:
     `grep -o 'from"cloudflare:sockets"' .open-next/server-functions/default/handler.mjs`
     returns a match, and `grep -c 'require("cloudflare:sockets")' <same>` is `0`.
   - `pnpm preview`, then `POST /api/contact/` (test Turnstile keys + a dummy
     `SMTP_*` in `.dev.vars`): the log reaches `WorkerMailer ... Connecting to
     SMTP server` and fails only on the dummy connection - i.e. no "Dynamic
     require" error. (See PR #356's description for the exact commands.)

## Upgrade checklist (`worker-mailer` bump)

- The patch only rewrites `package.json` `main` -> `./dist/index.mjs`. Confirm
  the new version still ships an ESM `dist/index.mjs` with a **static**
  `import ... "cloudflare:sockets"` (not a `require`). If the package adds a
  proper `exports` map that already resolves ESM under the `workerd`/`import`
  condition, this patch may become unnecessary - re-verify with the build +
  preview checks above before removing it.

## Production note

The Netcup `SMTP_*` values must be Worker **secrets** (`wrangler secret put`),
never plaintext `vars` - plaintext vars set in the dashboard are wiped by every
`wrangler deploy`. `TURNSTILE_SECRET_KEY` is likewise a secret; `TURNSTILE_SITE_KEY`
is a public var.
