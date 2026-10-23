SET search_path TO contrigraph_private;
CREATE TABLE IF NOT EXISTS notifications(
id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
project_id TEXT NOT NULL REFERENCES projects(id), kind TEXT NOT NULL,
task_id TEXT NOT NULL, request_id TEXT NOT NULL, message TEXT NOT NULL,
created_at TEXT NOT NULL, read_at TEXT);
CREATE INDEX IF NOT EXISTS notifications_recipient ON notifications(user_id,created_at,id);
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON notifications FROM PUBLIC;
