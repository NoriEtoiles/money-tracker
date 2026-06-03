CREATE TABLE imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  filename TEXT NOT NULL,
  status TEXT NOT NULL,
  staged_rows JSONB,
  mapping JSONB,
  summary JSONB,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  CONSTRAINT fk_imports_user_id
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT chk_imports_status
    CHECK (status IN (
      'mapping_required',
      'validation_failed',
      'ready_to_import',
      'completed',
      'expired'
    ))
);

CREATE INDEX idx_imports_user_created
  ON imports(user_id, created_at DESC);

ALTER TABLE transactions
  ADD COLUMN import_id UUID,
  ADD COLUMN import_row_number INT,
  ADD CONSTRAINT fk_transactions_import_id
    FOREIGN KEY (import_id) REFERENCES imports(id)
    ON DELETE NO ACTION ON UPDATE NO ACTION,
  ADD CONSTRAINT chk_transactions_import_shape
    CHECK (
      (
        source = 'import'
        AND import_id IS NOT NULL
        AND import_row_number IS NOT NULL
        AND import_row_number >= 1
      )
      OR
      (
        source <> 'import'
        AND import_id IS NULL
        AND import_row_number IS NULL
      )
    );

CREATE UNIQUE INDEX ux_transactions_import_row
  ON transactions(user_id, import_id, import_row_number);

CREATE INDEX idx_transactions_import_id
  ON transactions(import_id);
