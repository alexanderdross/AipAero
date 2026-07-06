// Lighthouse CI config. Passes Vercel's protection-bypass header so the
// CI job can reach the (otherwise 403-gated) preview URL.
//
// Requires Vercel project setting "Protection Bypass for Automation" to
// be enabled, and the secret stored as a GitHub Actions repository
// secret named VERCEL_AUTOMATION_BYPASS_SECRET. See lighthouse.yml.

const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET ?? "";

module.exports = {
  ci: {
    collect: {
      settings: {
        // The self-hosted runner executes as root in a container with a small
        // /dev/shm, so Chrome needs --no-sandbox and --disable-dev-shm-usage.
        chromeFlags: "--no-sandbox --disable-dev-shm-usage --headless=new",
        extraHeaders: JSON.stringify({
          "x-vercel-protection-bypass": bypass,
          "x-vercel-set-bypass-cookie": "samesitenone",
        }),
      },
    },
  },
};
