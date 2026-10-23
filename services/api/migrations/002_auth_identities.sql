SET search_path TO contrigraph_private;
CREATE TABLE IF NOT EXISTS auth_identities(provider TEXT NOT NULL, subject TEXT NOT NULL, user_id TEXT NOT NULL REFERENCES users(id), PRIMARY KEY(provider, subject));
ALTER TABLE auth_identities ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON auth_identities FROM PUBLIC;
