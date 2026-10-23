-- Run with a database owner. Application data is deliberately NOT exposed via PostgREST.
-- FastAPI enforces per-project membership and roles. Its DB connection stays server-only.
CREATE SCHEMA IF NOT EXISTS contrigraph_private;
REVOKE ALL ON SCHEMA contrigraph_private FROM PUBLIC;
SET search_path TO contrigraph_private;
CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL, password_hash TEXT, provider TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires DOUBLE PRECISION NOT NULL);
CREATE TABLE IF NOT EXISTS projects(id TEXT PRIMARY KEY, data TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, created TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS memberships(project_id TEXT REFERENCES projects(id), member_id TEXT NOT NULL, user_id TEXT REFERENCES users(id), invite_hash TEXT, PRIMARY KEY(project_id,member_id));
CREATE INDEX IF NOT EXISTS membership_user ON memberships(user_id);
CREATE TABLE IF NOT EXISTS events(id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), actor TEXT NOT NULL, actor_name TEXT NOT NULL, kind TEXT NOT NULL, task_id TEXT, text TEXT NOT NULL, time TEXT NOT NULL, meta TEXT NOT NULL DEFAULT '{}');
CREATE INDEX IF NOT EXISTS events_project ON events(project_id,time);
CREATE TABLE IF NOT EXISTS attachments(id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), task_id TEXT NOT NULL, name TEXT NOT NULL, media_type TEXT NOT NULL, content BYTEA NOT NULL, uploaded_by TEXT NOT NULL);
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA contrigraph_private FROM PUBLIC;
