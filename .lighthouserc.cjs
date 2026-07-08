// Lighthouse CI config. Used by two workflows:
//   - ci.yml  → gates PRs against a local `pnpm start` server (localhost URLs)
//   - lighthouse.yml → manual audit of a deployed Worker URL (workflow_dispatch)
//
// The site moved off Vercel to Cloudflare Workers, so there is no longer a
// protection-bypass header to send. SEO and accessibility are gated (stable,
// meaningful); best-practices and performance are warnings only, because
// container/CI performance numbers are noisy and we don't want flaky perf
// scores to block merges.

module.exports = {
  ci: {
    collect: {
      numberOfRuns: 1,
      settings: {
        // The self-hosted runner executes as root in a container with a small
        // /dev/shm, so Chrome needs --no-sandbox and --disable-dev-shm-usage.
        chromeFlags: "--no-sandbox --disable-dev-shm-usage --headless=new",
      },
    },
    assert: {
      assertions: {
        "categories:seo": ["error", { minScore: 0.9 }],
        "categories:accessibility": ["error", { minScore: 0.9 }],
        "categories:best-practices": ["warn", { minScore: 0.9 }],
        "categories:performance": ["warn", { minScore: 0.7 }],
      },
    },
  },
};
