CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  account_id UUID NOT NULL REFERENCES accounts(id),
  category_id UUID REFERENCES categories(id),
  type TEXT NOT NULL,
  amount NUMERIC(18,4) NOT NULL,
  currency CHAR(3) NOT NULL,
  merchant TEXT,
  note TEXT,
  transaction_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'posted',
  source TEXT NOT NULL DEFAULT 'manual',
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_transactions_user_date ON transactions(user_id, transaction_at DESC);
CREATE INDEX idx_transactions_account_date ON transactions(account_id, transaction_at DESC);
CREATE INDEX idx_transactions_category_date ON transactions(category_id, transaction_at DESC);
