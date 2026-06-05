CREATE TABLE account_deletion_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_account_deletion_requests_user_id
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT chk_account_deletion_requests_status
    CHECK (status IN ('pending', 'cancelled', 'completed'))
);

CREATE INDEX idx_account_deletion_requests_user_requested
  ON account_deletion_requests(user_id, requested_at DESC);

CREATE UNIQUE INDEX ux_account_deletion_requests_user_pending
  ON account_deletion_requests(user_id)
  WHERE status = 'pending';
