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
        extraHeaders: JSON.stringify({
          "x-vercel-protection-bypass": bypass,
          "x-vercel-set-bypass-cookie": "samesitenone",
        }),
      },
    },
  },
};
