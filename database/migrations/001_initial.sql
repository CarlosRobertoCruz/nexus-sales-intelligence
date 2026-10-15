CREATE TABLE users (
 id uuid PRIMARY KEY, email text NOT NULL UNIQUE, name text NOT NULL,
 password_hash text NOT NULL, active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE user_sessions (
 token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX user_sessions_expiry ON user_sessions(expires_at);
CREATE TABLE source_records (
 kind text NOT NULL CHECK (kind IN ('attendance','serviceOrders')),
 id text NOT NULL, payload jsonb NOT NULL, source text NOT NULL CHECK(source IN ('spreadsheet','hubsoft')),
 updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(kind,id)
);
CREATE TABLE commercial_records (
 kind text NOT NULL CHECK (kind IN ('attendance','serviceOrders','sales','renewals','cancellations','reactivations')),
 id text NOT NULL, event_date timestamptz NOT NULL, payload jsonb NOT NULL,
 PRIMARY KEY(kind,id)
);
CREATE INDEX commercial_records_date ON commercial_records(event_date);
CREATE TABLE import_runs (
 id uuid PRIMARY KEY, source text NOT NULL, user_id uuid REFERENCES users(id),
 record_count integer NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE sync_cursors (
 day date NOT NULL, stream text NOT NULL, page integer NOT NULL DEFAULT 0,
 complete boolean NOT NULL DEFAULT false, updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(day,stream)
);
CREATE TABLE sync_runs (
 id uuid PRIMARY KEY, day date NOT NULL, user_id uuid REFERENCES users(id),
 status text NOT NULL, pages integer NOT NULL DEFAULT 0, records integer NOT NULL DEFAULT 0,
 error_code text, started_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz
);
CREATE TABLE application_settings (key text PRIMARY KEY, value jsonb NOT NULL);
