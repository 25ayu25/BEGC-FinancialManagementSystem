-- 1) Reconciliation run (per provider + period)
CREATE TABLE claim_recon_runs (
  id              SERIAL PRIMARY KEY,
  provider_name   VARCHAR(128) NOT NULL,          -- e.g. 'CIC'
  period_year     INT NOT NULL,
  period_month    INT NOT NULL,
  created_by      UUID NOT NULL,                  -- user id (optional if easier)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- summary stats
  total_claim_rows        INT NOT NULL DEFAULT 0,
  total_remittance_rows   INT NOT NULL DEFAULT 0,
  auto_matched            INT NOT NULL DEFAULT 0,
  partial_matched         INT NOT NULL DEFAULT 0,
  manual_review           INT NOT NULL DEFAULT 0
);

CREATE INDEX idx_claim_recon_runs_period
  ON claim_recon_runs (provider_name, period_year, period_month);

-- 2) Raw "Claims Submitted" rows
CREATE TABLE claim_recon_claims (
  id              SERIAL PRIMARY KEY,
  run_id          INT NOT NULL REFERENCES claim_recon_runs(id) ON DELETE CASCADE,

  member_number   VARCHAR(64) NOT NULL,
  patient_name    VARCHAR(256),
  service_date    DATE NOT NULL,
  invoice_number  VARCHAR(64),
  claim_type      VARCHAR(64),
  scheme_name     VARCHAR(256),
  benefit_desc    VARCHAR(256),

  billed_amount   NUMERIC(12,2) NOT NULL,
  currency        VARCHAR(3) NOT NULL DEFAULT 'SSP',

  -- reconciliation fields
  status          VARCHAR(32) NOT NULL DEFAULT 'submitted', -- submitted | paid | partially_paid | manual_review
  amount_paid     NUMERIC(12,2) NOT NULL DEFAULT 0,
  remittance_line_id INT,

  composite_key   VARCHAR(128) NOT NULL,

  raw_row         JSONB
);

CREATE INDEX idx_claim_recon_claims_run
  ON claim_recon_claims (run_id);

CREATE INDEX idx_claim_recon_claims_key
  ON claim_recon_claims (run_id, composite_key);

-- 3) Raw remittance lines
CREATE TABLE claim_recon_remittances (
  id              SERIAL PRIMARY KEY,
  run_id          INT NOT NULL REFERENCES claim_recon_runs(id) ON DELETE CASCADE,

  employer_name   VARCHAR(256),
  patient_name    VARCHAR(256),
  member_number   VARCHAR(64) NOT NULL,
  claim_number    VARCHAR(64),
  relationship    VARCHAR(64),
  service_date    DATE NOT NULL,
  claim_amount    NUMERIC(12,2) NOT NULL,
  paid_amount     NUMERIC(12,2) NOT NULL,
  payment_no      VARCHAR(64),
  payment_mode    VARCHAR(64),

  composite_key   VARCHAR(128) NOT NULL,

  matched_claim_id INT,   -- null = no match
  match_type       VARCHAR(32), -- exact | partial | none
  raw_row          JSONB
);

CREATE INDEX idx_claim_recon_remits_run
  ON claim_recon_remittances (run_id);

CREATE INDEX idx_claim_recon_remits_key
  ON claim_recon_remittances (run_id, composite_key);
