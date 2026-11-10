ALTER TABLE history_jobs DROP CONSTRAINT history_jobs_phase_check;
ALTER TABLE history_jobs ADD CONSTRAINT history_jobs_phase_check CHECK (phase IN ('day','october','history','automatic'));

CREATE TABLE automatic_sync (
  id integer PRIMARY KEY CHECK (id=1),
  config jsonb NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  active_job uuid REFERENCES history_jobs(id),
  last_daily_on date,
  daily_cycle_day date,
  daily_next_day date,
  next_at timestamptz NOT NULL DEFAULT now(),
  error_code text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- A persistent singleton plus a session lock prevents two schedulers from
-- scheduling the same batch. Page/checkpoint locks are shared with manual sync.
CREATE INDEX source_records_sync_observed ON source_records ((payload->>'sync_observed_at'));
