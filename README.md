# Storybook Web

Public account-support pages for the Storybook iOS app. No analytics or tracking.

## Pages

- `/auth/confirmed/`: email confirmation result, with immediate URL cleanup.
- `/auth/reset-password/`: explicit recovery-link verification and a new password
  form. Uses only the public Supabase project key. Never add a service-role key.
  Recovery sessions are memory-only; URL credentials are removed immediately.

## Hosted rollout (pending)

1. Publish the reset page to GitHub Pages and verify HTTPS and assets.
2. Add `https://elierrgm.github.io/storybook-web/auth/reset-password/` to Supabase
   Auth's redirect allowlist; retain the existing confirmation redirect.
3. Set the Reset Password email body to the reviewed `recovery-email.html` template.
   The request must provide the exact reset redirect. Do not change confirmation.
4. Set the Supabase Email provider's minimum password length to 15; leave character
   mixture requirements unset. Existing users keep signing in with their passwords.
5. A person requests a live reset email, opens it, updates their own password and
   confirms app sign-in. Verify expired/reused links and another-device recovery.

The template puts the token hash in the fragment. Verification occurs on Continue,
so passive link scanners do not consume it. Do not log credentials or tokens.
The form uses 15 Unicode code points, spaces allowed, matching the iOS policy.

Run tests: `node --test auth/reset-password/recovery-core.test.mjs`.

## Release blocker

Replace the temporary GitHub Pages address with an app-branded domain before
production release. Update app URLs, web config/CSP, Supabase redirects and email
links together, then repeat live confirmation and recovery checks.
