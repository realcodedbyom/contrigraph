# Production audit and operational follow-up

## Email delivery: provider setup required

Supabase's built-in mail sender is not suitable for public signup. It has a project-wide quota and restrictions on recipients. Keep confirmation enabled and connect a transactional SMTP provider with a verified sender domain.

1. Choose a transactional mail provider and verify a sending domain such as `mail.dsvv.live` using that provider's exact DNS records.
2. In Supabase Authentication → Email → SMTP Settings, configure the provider's host, port, username, SMTP password, sender address, and sender name.
3. Disable link tracking for authentication emails. Keep Site URL and the redirect allowlist at `https://dsvv.live/contrigraph/`.
4. Review Supabase Authentication → Users for unconfirmed accounts from previous attempts. Do not delete them simply because confirmation is pending.
5. Send one confirmation to an inbox you control, open the newest link, then verify login and an authenticated workspace request. Confirm email arrival, not only the HTTP response.

No SMTP provider is configured by this code. The API now distinguishes provider email quota failures (503) from authentication attempts throttled by the application (429). It does not silently disable verification.

## Edge configuration

`deploy/nginx/contrigraph.conf` provides short/revalidated document caching, immutable hashed assets, security headers, HTTP/2, an HTTPS canonical host, separate auth body limits, and IP-based edge auth throttling. The API also limits streamed request bodies and authentication attempts. Its in-memory throttle is per process; the Nginx zone is shared across its workers.

The CSP allows inline scripts/styles required by the current Next/React build. It blocks plugins and framing, restricts connection origins, and allows an optional Spline iframe. A nonce-based policy is a separate hardening step; do not describe this policy as eliminating all script injection risks.

The sandbox remains intentionally disabled in production and responds 404. OPTIONS describing a route does not mean anonymous access is enabled.

The earlier five-attempt login test did not reach the old 15-per-minute limit. The current API returns 429 with Retry-After after five attempts; the edge independently throttles auth POSTs. A 2 MB body was below the former 6 MB limit; the current limits are 16 KiB for auth, 1 MiB for other command bodies, and 6 MiB for attachment requests.

The VPS has AlmaLinux's `nginx-1.20.1-28.el9_8.5.alma.1` package. Its installed changelog includes 2026 security backports. An upstream version string alone does not establish whether this distribution package is unpatched. This change enables HTTP/2 and hides the version; it does not replace the host's package stream or promise HTTP/3 support.

## Verification

Run `npm test` for API regression tests and `node scripts/verify-production.mjs` for public production smoke checks. The smoke script checks document and asset cache policies, TLS for www, redirect scope, public metadata, headers, and oversized auth request rejection. It never creates accounts or sends confirmation email.

React and React DOM are pinned to released package versions. Next's App Router may bundle its own React canary build internally; changing the app's React version does not replace that bundled runtime. Next is updated within its stable release line.

## Visual integrations

Public product interactions use existing React Bits CountUp, GSAP, Lenis, Vengeance CornerButton, Skiper links, and an original WebGL shader. Reduced-motion preferences disable smooth scrolling and decorative animation. The recovery demo is explicitly illustrative and cannot change real project data.

Set `NEXT_PUBLIC_SPLINE_SCENE` at build time to an authorized published embed URL on `https://my.spline.design/` to offer the optional, click-to-load Spline scene. No scene was supplied, so the original shader is the live visual. A placeholder third-party scene is not silently embedded.
