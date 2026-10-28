CREATE TABLE hubsoft_gate (
 id integer PRIMARY KEY CHECK(id=1),
 next_at timestamptz NOT NULL DEFAULT now(),
 cooldown_until timestamptz NOT NULL DEFAULT now(),
 oauth_next_at timestamptz NOT NULL DEFAULT now(),
 token_cipher text, token_expires_at timestamptz, token_scope text
);
INSERT INTO hubsoft_gate(id) VALUES(1);
CREATE TABLE hubsoft_call_metrics (
 id bigserial PRIMARY KEY, job_id uuid, method text NOT NULL, path text NOT NULL,
 status integer, latency_ms integer NOT NULL, policy text, retry_after_seconds numeric,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX hubsoft_call_metrics_job ON hubsoft_call_metrics(job_id,created_at);
CREATE TABLE history_jobs (
 id uuid PRIMARY KEY, phase text NOT NULL CHECK(phase IN ('day','october','history')),
 manifest jsonb NOT NULL, state text NOT NULL DEFAULT 'planned',
 month_index integer NOT NULL DEFAULT 0, next_at timestamptz NOT NULL DEFAULT now(),
 approved boolean NOT NULL DEFAULT false, error_code text, attempts integer NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE history_pages (
 job_id uuid REFERENCES history_jobs(id) ON DELETE CASCADE, day date NOT NULL,
 stream text NOT NULL, page integer NOT NULL, records jsonb NOT NULL,
 complete boolean NOT NULL, processed boolean NOT NULL DEFAULT false,
 PRIMARY KEY(job_id,day,stream,page)
);
CREATE TABLE history_clients (
 job_id uuid REFERENCES history_jobs(id) ON DELETE CASCADE, client_code text NOT NULL,
 day date NOT NULL, records jsonb NOT NULL, PRIMARY KEY(job_id,client_code,day)
);
CREATE TABLE history_records (
 job_id uuid REFERENCES history_jobs(id) ON DELETE CASCADE, month text NOT NULL,
 kind text NOT NULL, upstream_id text NOT NULL, payload jsonb NOT NULL,
 origin text NOT NULL, PRIMARY KEY(job_id,kind,upstream_id)
);
CREATE TABLE history_months (
 job_id uuid REFERENCES history_jobs(id) ON DELETE CASCADE, month text NOT NULL,
 state text NOT NULL DEFAULT 'collecting', reconciliation jsonb,
 PRIMARY KEY(job_id,month)
);
CREATE INDEX history_records_month ON history_records(job_id,month,kind);
CREATE INDEX source_records_business_key ON source_records(kind, (CASE WHEN kind='attendance' THEN payload->>'protocolo' ELSE payload->>'numero_ordem_servico' END));
