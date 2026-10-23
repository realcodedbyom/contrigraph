# Contributing

Start with the setup in [README](README.md). Keep changes in `apps/web` and `services/api`; `proto` preserves the original browser prototype.

Before submitting a change, run `npm test` and `npm run build`. Add regression tests for scheduling, permission, persistence, or approval behavior. Use isolated test data for browser checks.

Scheduling changes must preserve skill eligibility, dependency order, one shared calendar per linked identity, and explicit unknown forecasts. Redistribution previews are read-only; approval must revalidate the complete snapshot and record its reason atomically.

Never commit environment files, credentials, session cookies, database files, or raw browser captures. Use placeholder values in `.env.example`. Screenshots belong in `docs/screenshots` and should show sample data.

Report bugs with reproduction steps, expected behavior, and a sanitized screenshot. Do not attach real team data or credentials to public issues.
