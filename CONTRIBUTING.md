# Contributing

Start with the setup in [README](README.md). Keep changes in `apps/web` and `services/api`.

Before submitting a change, run `npm test` and `npm run build`. Add regression tests for scheduling, permission, persistence, or approval behavior. Use isolated test data for browser checks.

Scheduling changes must preserve skill eligibility, dependency order, one shared calendar per linked identity, and explicit unknown forecasts. Redistribution previews are read-only; approval must revalidate the complete snapshot and record its reason atomically.

Never commit environment files, credentials, session cookies, database files, or raw browser captures. Use placeholder values in `.env.example`. Screenshots belong in `docs/screenshots` and should show sample data.

Keep generated launch videos, ZIP bundles and their render projects in the ignored `brag-output/` (or `brag-output-<timestamp>/`) directory. Local QA evidence belongs in `artifacts/`; the prototype remains in ignored `proto/`. Publish selected marketing assets deliberately instead of adding an entire generated directory.

Before committing, inspect `git status --short` and `git diff --cached --stat`. Stage specific files, and run `git diff --cached --check`. Ignore rules do not remove already tracked files: `git ls-files -ci --exclude-standard` should return nothing. Keep dependency lockfiles, deployment configuration and reviewed sample-data screenshots tracked.

Report bugs with reproduction steps, expected behavior, and a sanitized screenshot. Do not attach real team data or credentials to public issues.
