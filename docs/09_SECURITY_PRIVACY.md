# 09 Security and Privacy

## Security Position

Money Tracker handles sensitive financial data. Security is a core product feature.

## Security Requirements

### Authentication

MVP:
- Email/password.
- Strong password hashing.
- Refresh token/session management.
- Logout and revoke session.

Phase 2:
- MFA.
- OAuth/OIDC.
- Passkey/WebAuthn.
- Trusted devices.

### Authorization

Rules:
- All user-owned data must be scoped by `user_id`.
- Never allow access by ID alone.
- Use guards/middleware for protected routes.
- Add integration tests for cross-user access denial.

### Data Protection

- Use TLS in production.
- Encrypt sensitive tokens at rest.
- Store secrets in secret manager.
- Do not log sensitive financial payloads.
- Limit attachment file type and size.

### Audit Logs

Audit these events:
- register
- login
- logout
- failed login
- export data
- delete account request
- password change
- session revoke
- profile update with changed field names only
- bank connection create/disconnect in future

The MVP audit log view returns only authenticated user events and sanitizes
metadata through an explicit whitelist. It does not return arbitrary nested
metadata, secrets, tokens, raw URLs, server paths, notes, merchants, CSV content,
raw request bodies, password data, or unnecessary emails.

### Privacy

User must be able to:
- export data,
- delete account,
- understand what data is stored,
- disconnect external integrations,
- control notification preferences.

Step 14 implements delete account as a request/intent flow only. It records a
pending request and safe audit event, but does not hard-delete users or financial
records in the MVP.

## Data Retention

Recommended:
- active transaction data retained while account active,
- soft deleted data retained for recovery window,
- export files expire automatically,
- deleted account data hard-deleted after configured retention window unless legal requirement says otherwise.

## Attachment Security

For receipt upload:
- check MIME type,
- check file extension,
- limit file size,
- scan file when possible,
- store in private bucket,
- serve through signed URL only.

## Bank Sync Security

Not MVP.

When implemented:
- use provider-hosted consent flow,
- store provider token encrypted,
- allow user to disconnect,
- use webhook signature verification,
- use idempotency for webhook events,
- never store bank login credential directly.

## Security Testing Checklist

- Cross-user access tests.
- Token expiration tests.
- Logout revoke tests.
- Rate limit auth endpoints.
- Validate all request body schemas.
- Test upload constraints.
- Test export authorization.
