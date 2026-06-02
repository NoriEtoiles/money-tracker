CREATE TABLE recurring_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  template_payload JSONB NOT NULL,
  frequency TEXT NOT NULL,
  interval_count INT NOT NULL DEFAULT 1,
  day_of_month INT,
  timezone TEXT NOT NULL,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  last_run_at TIMESTAMPTZ,
  paused_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  last_failed_at TIMESTAMPTZ,
  last_generation_error_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_recurring_rules_user_id
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT chk_recurring_rules_frequency
    CHECK (frequency IN ('daily', 'weekly', 'monthly')),
  CONSTRAINT chk_recurring_rules_interval_count
    CHECK (interval_count >= 1),
  CONSTRAINT chk_recurring_rules_day_of_month
    CHECK (
      (frequency = 'monthly' AND day_of_month BETWEEN 1 AND 31)
      OR
      (frequency IN ('daily', 'weekly') AND day_of_month IS NULL)
    ),
  CONSTRAINT chk_recurring_rules_date_order
    CHECK (end_at IS NULL OR end_at >= start_at)
);

CREATE INDEX idx_recurring_rules_user_next_run
  ON recurring_rules(user_id, next_run_at);

CREATE INDEX idx_recurring_rules_due
  ON recurring_rules(next_run_at);

ALTER TABLE transactions
  ADD COLUMN recurring_rule_id UUID,
  ADD COLUMN recurring_occurrence_at TIMESTAMPTZ,
  ADD CONSTRAINT fk_transactions_recurring_rule_id
    FOREIGN KEY (recurring_rule_id) REFERENCES recurring_rules(id)
    ON DELETE NO ACTION ON UPDATE NO ACTION,
  ADD CONSTRAINT chk_transactions_recurring_shape
    CHECK (
      (
        source = 'recurring'
        AND recurring_rule_id IS NOT NULL
        AND recurring_occurrence_at IS NOT NULL
      )
      OR
      (
        source <> 'recurring'
        AND recurring_rule_id IS NULL
        AND recurring_occurrence_at IS NULL
      )
    );

CREATE UNIQUE INDEX ux_transactions_recurring_occurrence
  ON transactions(user_id, recurring_rule_id, recurring_occurrence_at);

CREATE INDEX idx_transactions_recurring_rule_id
  ON transactions(recurring_rule_id);
