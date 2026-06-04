CREATE TABLE exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  export_type TEXT NOT NULL,
  status TEXT NOT NULL,
  filters JSONB NOT NULL,
  row_count INT,
  filename TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  CONSTRAINT fk_exports_user_id
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT chk_exports_type
    CHECK (export_type IN ('transactions_csv')),
  CONSTRAINT chk_exports_status
    CHECK (status IN ('ready', 'downloaded', 'expired')),
  CONSTRAINT chk_exports_row_count
    CHECK (row_count IS NULL OR row_count >= 0)
);

CREATE INDEX idx_exports_user_created
  ON exports(user_id, created_at DESC);
