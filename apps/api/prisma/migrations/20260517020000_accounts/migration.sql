CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'IDR',
  institution_name TEXT,
  initial_balance NUMERIC(18,4) NOT NULL DEFAULT 0,
  current_balance NUMERIC(18,4) NOT NULL DEFAULT 0,
  include_in_net_worth BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_accounts_user_id ON accounts(user_id);
CREATE INDEX idx_accounts_user_type ON accounts(user_id, type);
