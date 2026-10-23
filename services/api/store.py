import hashlib
import json
import os
import secrets
import sqlite3
import time
from contextlib import contextmanager
from pathlib import Path
from threading import Lock
from fastapi import HTTPException

_pool = None
_pool_lock = Lock()


def postgres_pool():
    global _pool
    with _pool_lock:
        if _pool is None:
            from psycopg_pool import ConnectionPool
            from psycopg.rows import dict_row
            def configure(connection):
                connection.execute('SET search_path TO contrigraph_private')
                connection.commit()
            _pool = ConnectionPool(os.environ['DATABASE_URL'], min_size=1, max_size=5, timeout=25,
                                   kwargs={'row_factory': dict_row, 'connect_timeout': 15, 'prepare_threshold': None},
                                   configure=configure, open=False)
            _pool.open()
    return _pool


def close_pool():
    global _pool
    if _pool is not None:
        _pool.close()
        _pool = None


class PostgresConnection:
    """Keep bound parameters and transaction semantics across both storage backends."""
    def __init__(self, connection):
        self.connection = connection

    def execute(self, sql, params=()):
        if sql == 'BEGIN IMMEDIATE':
            # Serialize aggregate writes, including invitation consumption, across API workers.
            return self.connection.execute('SELECT pg_advisory_xact_lock(78234601)')
        return self.connection.execute(sql.replace('?', '%s'), params)

    def executescript(self, script):
        for statement in script.split(';'):
            if statement.strip():
                self.connection.execute(statement)


def database_kind():
    return 'postgres' if os.environ.get('DATABASE_URL') else 'sqlite'


def db_path():
    return Path(os.environ.get('CONTRIGRAPH_DB', str(Path(__file__).parent / 'data' / 'contrigraph.db')))


@contextmanager
def connect():
    if database_kind() == 'postgres':
        with postgres_pool().connection() as connection:
            yield PostgresConnection(connection)
        return
    path = db_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(path, timeout=15)
    db.row_factory = sqlite3.Row
    db.execute('PRAGMA foreign_keys=ON')
    db.execute('PRAGMA journal_mode=WAL')
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def init_db():
    if database_kind() == 'postgres':
        # Deployment explicitly runs migrate.py; ordinary app startup needs no DDL rights.
        with connect() as db:
            db.execute('SELECT id FROM users LIMIT 0')
            db.execute('SELECT id FROM notifications LIMIT 0')
        return
    with connect() as db:
        db.executescript('''
        CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL, password_hash TEXT, provider TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires REAL NOT NULL);
        CREATE TABLE IF NOT EXISTS auth_identities(provider TEXT NOT NULL, subject TEXT NOT NULL, user_id TEXT NOT NULL REFERENCES users(id), PRIMARY KEY(provider,subject));
        CREATE TABLE IF NOT EXISTS projects(id TEXT PRIMARY KEY, data TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, created TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS memberships(project_id TEXT REFERENCES projects(id), member_id TEXT NOT NULL, user_id TEXT REFERENCES users(id), invite_hash TEXT, PRIMARY KEY(project_id,member_id));
        CREATE INDEX IF NOT EXISTS membership_user ON memberships(user_id);
        CREATE TABLE IF NOT EXISTS events(id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), actor TEXT NOT NULL, actor_name TEXT NOT NULL, kind TEXT NOT NULL, task_id TEXT, text TEXT NOT NULL, time TEXT NOT NULL, meta TEXT NOT NULL DEFAULT '{}');
        CREATE INDEX IF NOT EXISTS events_project ON events(project_id,time);
        CREATE TABLE IF NOT EXISTS attachments(id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), task_id TEXT NOT NULL, name TEXT NOT NULL, media_type TEXT NOT NULL, content BLOB NOT NULL, uploaded_by TEXT NOT NULL);
        ''')
        from notifications import SCHEMA
        db.executescript(SCHEMA)


def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()


def create_session(user_id):
    token = secrets.token_urlsafe(40)
    with connect() as db:
        db.execute('DELETE FROM sessions WHERE expires < ?', (time.time(),))
        db.execute('INSERT INTO sessions VALUES(?,?,?)', (digest(token), user_id, time.time() + 3600 * 24))
    return token


def load_project(db, project_id, user_id):
    row = db.execute('SELECT * FROM projects WHERE id=?', (project_id,)).fetchone()
    membership = db.execute('SELECT member_id FROM memberships WHERE project_id=? AND user_id=?', (project_id, user_id)).fetchone()
    if not row or not membership:
        raise HTTPException(404, 'Project not found.')
    return json.loads(row['data']), row['version'], membership['member_id']


def events_for(db, project_id):
    return [{**dict(r), 'taskId': r['task_id'], 'meta': json.loads(r['meta'])} for r in db.execute('SELECT * FROM events WHERE project_id=? ORDER BY time DESC,id DESC LIMIT 1000', (project_id,))]


def event(db, project_id, member, kind, text, task_id='', meta=None):
    from datetime import datetime, timezone
    db.execute('INSERT INTO events VALUES(?,?,?,?,?,?,?,?,?)',
               (secrets.token_hex(12), project_id, member['id'], member['name'], kind, task_id, text,
                datetime.now(timezone.utc).isoformat(), json.dumps(meta or {})))


def save_project(db, project_id, version, data, actor_id=''):
    previous = db.execute('SELECT data FROM projects WHERE id=?', (project_id,)).fetchone()
    result = db.execute('UPDATE projects SET data=?,version=version+1 WHERE id=? AND version=?', (json.dumps(data), project_id, version))
    if result.rowcount != 1:
        raise HTTPException(409, 'This project changed in another session. Reload and review the latest version.')
    from notifications import notify_changes
    notify_changes(db, project_id, json.loads(previous['data']), data, actor_id)
