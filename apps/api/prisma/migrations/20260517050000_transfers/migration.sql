ALTER TABLE transactions
  ADD COLUMN transfer_group_id UUID,
  ADD COLUMN transfer_side TEXT;

ALTER TABLE transactions
  ADD CONSTRAINT chk_transactions_type
  CHECK (type IN ('income', 'expense', 'transfer'));

ALTER TABLE transactions
  ADD CONSTRAINT chk_transactions_transfer_side
  CHECK (transfer_side IS NULL OR transfer_side IN ('outflow', 'inflow'));

ALTER TABLE transactions
  ADD CONSTRAINT chk_transactions_transfer_shape
  CHECK (
    (
      type = 'transfer'
      AND transfer_group_id IS NOT NULL
      AND transfer_side IS NOT NULL
      AND category_id IS NULL
    )
    OR
    (
      type IN ('income', 'expense')
      AND transfer_group_id IS NULL
      AND transfer_side IS NULL
    )
  );

CREATE INDEX idx_transactions_user_transfer_group
  ON transactions(user_id, transfer_group_id);

CREATE INDEX idx_transactions_transfer_group_side
  ON transactions(transfer_group_id, transfer_side);

CREATE UNIQUE INDEX ux_transactions_active_transfer_side
  ON transactions(user_id, transfer_group_id, transfer_side)
  WHERE deleted_at IS NULL
    AND transfer_group_id IS NOT NULL
    AND transfer_side IS NOT NULL;

CREATE INDEX idx_transactions_user_transfer_outflow_date
  ON transactions(user_id, transaction_at DESC, created_at DESC)
  WHERE deleted_at IS NULL
    AND transfer_group_id IS NOT NULL
    AND transfer_side = 'outflow';
