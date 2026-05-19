# 11 Decisions and Assumptions

## Confirmed Product Decisions

- Build web app first.
- Design with mobile app future in mind.
- MVP is manual-first.
- Bank sync is not part of MVP.
- Finance data must be exportable.
- Multi-currency should be supported at schema level.
- Security and privacy are core requirements.
- Use modular architecture.

## Recommended Technical Decisions

- Next.js for frontend.
- NestJS for backend.
- PostgreSQL for database.
- Prisma for ORM.
- Expo React Native for future mobile.
- Redis/queue for background jobs.
- S3-compatible storage for attachments and exports.

## Open Decisions

These must be decided before final production launch:

| Topic | Options | Recommendation |
|---|---|---|
| Launch country | Indonesia / global / specific region | Start Indonesia-first but keep global-ready schema |
| Default currency | IDR / user-selected | IDR default, user-selectable |
| Auth provider | custom / managed auth | Managed OIDC-compatible auth is safer long-term |
| Billing | free / freemium / subscription | Freemium + Pro subscription |
| Mobile framework | React Native / Flutter | Expo React Native for TypeScript alignment |
| Bank sync provider | Plaid / TrueLayer / Tink / local partner | Decide after launch market fixed |
| OCR provider | Google / AWS / other | Decide in Phase 2 |
| Hosting | Vercel + managed API / all-in-one platform | Vercel for web + managed API container |

## Assumptions

- Initial user is a single user, but architecture should support multiple users.
- User will manually input most transactions during MVP.
- Reports can be calculated directly from transactions table in MVP.
- Advanced analytics can be optimized later.
- Mobile app should reuse API contract from web.
- User data privacy is more important than aggressive monetization.

## Risk Notes

### Risk: Scope Creep

Mitigation:
- Do not implement Phase 2 features before MVP completion.

### Risk: Financial Calculation Bugs

Mitigation:
- Use decimal.
- Add unit tests.
- Avoid floating point.

### Risk: User Data Leakage

Mitigation:
- Scope all queries by user.
- Add authorization tests.
- Consider PostgreSQL RLS later.

### Risk: Weak Onboarding

Mitigation:
- Default categories.
- Setup first account quickly.
- Show first insight as soon as possible.

### Risk: Bank Sync Complexity

Mitigation:
- Delay bank sync.
- Build manual ledger and import/export first.
