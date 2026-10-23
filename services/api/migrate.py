"""Explicit, non-destructive schema setup. Secrets are read from .env, never printed."""
from pathlib import Path
import os
from store import connect, database_kind, init_db

if __name__ == '__main__':
    env_file = Path(__file__).parent / '.env'
    if env_file.exists():
        for line in env_file.read_text(encoding='utf-8-sig').splitlines():
            if '=' in line and not line.startswith('#'):
                key, value = line.split('=', 1)
                os.environ.setdefault(key, value.strip().strip('\"').strip("'"))
    if database_kind() != 'postgres':
        raise SystemExit('Set DATABASE_URL in services/api/.env to a Supabase Postgres connection string first.')
    with connect() as db:
        db.executescript((Path(__file__).parent / 'migrations/001_initial.sql').read_text())
    init_db()
    print('ContriGraph private schema is ready. Existing data was preserved.')
