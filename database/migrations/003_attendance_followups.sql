-- Separate observations of attendance cohorts from orders counted as production.
ALTER TABLE history_clients ADD COLUMN captured_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE history_followup_attendances (
  job_id uuid NOT NULL REFERENCES history_jobs(id) ON DELETE CASCADE,
  month text NOT NULL CHECK (month ~ '^2026-[0-9]{2}$'),
  attendance_id text NOT NULL,
  opened_on date NOT NULL CHECK (opened_on >= DATE '2026-01-01' AND opened_on < DATE '2027-01-01'),
  observed_at timestamptz NOT NULL,
  reported_orders integer CHECK (reported_orders >= 0),
  received_orders integer NOT NULL CHECK (received_orders >= 0),
  PRIMARY KEY (job_id, attendance_id)
);
CREATE TABLE history_followup_orders (
  job_id uuid NOT NULL,
  attendance_id text NOT NULL,
  order_id text NOT NULL,
  payload jsonb NOT NULL,
  PRIMARY KEY (job_id, order_id),
  FOREIGN KEY (job_id, attendance_id) REFERENCES history_followup_attendances(job_id, attendance_id) ON DELETE CASCADE
);

-- Published snapshots retain zero-order attendances as well as one-to-many links.
CREATE TABLE attendance_followup_snapshots (
  attendance_id text NOT NULL,
  cutoff date NOT NULL CHECK (cutoff >= DATE '2026-01-01' AND cutoff < DATE '2027-01-01'),
  opened_on date NOT NULL,
  observed_at timestamptz NOT NULL,
  job_id uuid NOT NULL REFERENCES history_jobs(id),
  PRIMARY KEY (attendance_id, cutoff)
);
CREATE TABLE attendance_order_followups (
  attendance_id text NOT NULL,
  cutoff date NOT NULL,
  order_id text NOT NULL,
  payload jsonb NOT NULL,
  PRIMARY KEY (order_id, cutoff),
  FOREIGN KEY (attendance_id, cutoff) REFERENCES attendance_followup_snapshots(attendance_id, cutoff) ON DELETE CASCADE
);
CREATE INDEX history_followup_month ON history_followup_attendances(job_id, month);
CREATE INDEX followup_completion ON attendance_order_followups ((payload->>'concludedOn'));
