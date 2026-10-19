# Storybook Web

Public account-support pages for the Storybook iOS app. No analytics or tracking.

## Pages

- `/auth/confirmed/`: email confirmation result, with immediate URL cleanup.
- `/auth/reset-password/`: explicit recovery-link verification and a new password
  form. Uses only the public Supabase project key. Never add a service-role key.
  Recovery sessions are memory-only; URL credentials are removed immediately.

## Hosted setup

1. Publish the reset page to GitHub Pages and verify HTTPS and assets.
2. Add `https://elierrgm.github.io/storybook-web/auth/reset-password/` to Supabase
   Auth's redirect allowlist; retain the existing confirmation redirect.
3. The default Supabase reset email is supported. Custom templates currently require
   custom SMTP or Pro. If enabled later, use `recovery-email.html`; do not change
   confirmation. No paid service is required for the current default-email flow.
4. Set the Supabase Email provider's minimum password length to 15 and require lowercase, uppercase,
   digits and symbols. Existing users keep signing in with their passwords.
5. A person requests a live reset email, opens it, updates their own password and
   confirms app sign-in. Verify expired/reused links and another-device recovery.

The optional custom template puts the token hash in the fragment and verifies on
Continue. Default emails verify the one-time link in Supabase first and redirect
with a recovery session in the fragment; the page validates that session on
Continue. Passive scanners may consume default email links; a new-link flow is
available for expired or used links. Do not log credentials or tokens.
The form requires 15 Unicode code points, uppercase and lowercase ASCII letters,
a digit and a Supabase-supported symbol. Spaces are allowed. This matches iOS.
Common/leaked-password protection is intentionally deferred; no paid plan enabled.

Run tests: `node --test auth/reset-password/recovery-core.test.mjs`.

## Release blocker

Replace the temporary GitHub Pages address with an app-branded domain before
production release. Update app URLs, web config/CSP, Supabase redirects and email
links together, then repeat live confirmation and recovery checks.
