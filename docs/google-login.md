# Account sign-in

ContriGraph uses Clerk for Google and email sign-in. Supabase PostgreSQL stores application data; Supabase Auth is no longer used in Clerk mode.

The workspace mounts the React SDK only on `/app/`. The branded login screen contains Clerk sign-in and sign-up components, including verification and recovery. Callback URLs include `NEXT_PUBLIC_APP_BASE_PATH`. Email methods and Google must be enabled in the existing Clerk instance.

The API verifies short-lived RS256 Clerk session JWTs using its configured issuer and JWKS. It requires expiry, issued time, subject, session ID, and an authorized party matching APP_ORIGINS. Pending sessions are rejected. First access retrieves a verified primary email from Clerk and creates a stable internal account bound to the Clerk subject. It never merges an older account by matching email. Existing project membership checks still apply to every request.

## Configuration

- Web ignored `.env.local`: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`; build-time `NEXT_PUBLIC_APP_BASE_PATH=/contrigraph` on the VPS.
- API ignored `.env`: `AUTH_MODE=clerk`, `CLERK_ISSUER`, `CLERK_SECRET_KEY`, `APP_ORIGINS`, existing `DATABASE_URL`.
- Run `python migrate.py` before starting the API to add the private identity mapping table.
- Install Python requirements and web dependencies, build, then restart both services.
- Keep the Clerk frontend API hostname in the nginx CSP. Include Clerk image hosts and challenge/protection hosts per the official CSP documentation. Update the hostname when switching to production keys.

Clerk development keys are suitable for integration testing. A public production rollout needs the existing application’s production instance, domain/DNS setup, live keys, and production Google connection. Never place secret keys in frontend code, public files, or Git. Rotation should follow any credential exposure.

The legacy API password and Supabase callback routes are disabled in Clerk mode. The server logout route clears old application cookies; the UI also signs out of Clerk. JWT verification is local, so a revoked token can remain valid until its short expiry. File downloads can use the same-origin Clerk session cookie.

References: [Clerk React SDK](https://clerk.com/docs/reference/react/overview), [Clerk CSP](https://clerk.com/docs/guides/secure/best-practices/csp-headers), [production setup](https://clerk.com/docs/guides/development/deployment/production).
