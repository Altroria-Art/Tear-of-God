# Interface copy and OTP animation deployment — 9 October 2026

- User requested Cloudflare deployment of the current changes.
- Production: https://tear-of-god.pages.dev
- Production deployment: `1c8f31ff-ada3-4b70-9cfe-50db0241a8ac`, https://1c8f31ff.tear-of-god.pages.dev
- Preview deployment: `a5b72987-dc05-43d0-925f-01eda702e632`, https://a5b72987.tear-of-god.pages.dev
- Deployed working-tree changes from source revision `310c445` with `--commit-dirty=true`. No commit or Git push was performed during this deployment.

## Changes

Includes the English/Thai interface and export copy covered in `ui-copy-audit-2026-10-09.md`, localized API error presentation, bilingual password reset email, and OTP orbit animation slowed from 2.8 to 5.6 seconds per revolution. Verification requests and code expiry were not delayed.

## Verification

- Current build passed. Lint passed with four existing Fast Refresh warnings.
- UI copy coverage and password reset regression suites passed, including delivery failure, rate limiting, expiry, single use, atomic verification and session revocation.
- Preview passed before Production deployment.
- Both environments passed read-only API checks for auth, templates, rankings and hashtags, and 20 Chromium screens: Home, Discover, topic list, Forgot Password and Reset Password, each in English/Thai and desktop/mobile.
- Verified deployed asset names and CSS contents against the local build. Browser computed OTP animation duration is `5.6s`. No runtime errors, visible translation keys or horizontal overflow appeared in these checks.
- Confirmed Preview uses its separate D1/R2 resources and Production retains the intended D1/R2 resources and email secret binding. No migration or resource configuration change was made.
- Evidence and the read-only smoke script are in ignored `.wrangler/release-20261009/`.

## Limits and rollback

These deployment checks did not send an email, reset a password, upload an R2 object, or create/delete live content. Actual email reset succeeded for the user before this deployment; that does not establish delivery latency after deployment. D1 reads were checked; R2 configuration was checked without an upload. Safari/Firefox, authenticated mutations and every Admin/Duel state were not rerun. Earlier wider local fixture coverage is recorded in the copy audit.

Previous Production deployment: `abc1a045-ae8a-44a9-9870-3268c1ffa408`, https://abc1a045.tear-of-god.pages.dev.
