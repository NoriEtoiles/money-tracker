CREATE TABLE budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  category_id UUID NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  amount NUMERIC(18,4) NOT NULL,
  currency CHAR(3) NOT NULL,
  threshold_percentage NUMERIC(5,2) NOT NULL DEFAULT 80,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_budgets_user_id
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT fk_budgets_category_id
    FOREIGN KEY (category_id) REFERENCES categories(id)
    ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT chk_budgets_amount_positive
    CHECK (amount > 0),
  CONSTRAINT chk_budgets_threshold_range
    CHECK (threshold_percentage >= 1 AND threshold_percentage <= 100),
  CONSTRAINT chk_budgets_currency_format
    CHECK (currency ~ '^[A-Z]{3}$'),
  CONSTRAINT chk_budgets_period_order
    CHECK (period_end > period_start),
  CONSTRAINT chk_budgets_status
    CHECK (status IN ('active', 'archived'))
);

CREATE UNIQUE INDEX ux_budgets_user_category_period_currency
  ON budgets(user_id, category_id, period_start, currency);

CREATE INDEX idx_budgets_user_period_currency
  ON budgets(user_id, period_start, currency);
