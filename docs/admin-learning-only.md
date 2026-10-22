# Administration without accounting

The Averna admin portal now manages students/admissions, teachers, groups, educational analytics, content, assessment, points/rewards, communication, audit and system administration only.

## Removed from the active portal

- Moliya sidebar, dashboard tab, mobile destination, command palette entry, voice command and shortcuts.
- Financial executive/business-health overview, revenue/debt/payroll/cash summary, pending-payment attention chip and revenue forecasts.
- Finance inputs to Mission Control / AI briefing and payment counts in admin Telegram summaries.
- Old `/admin/finance` page returns authenticated admins to `/admin/dashboard`. Old remembered/deep-linked finance tabs map to overview.
- Old `/api/admin/finance` GET/POST/export and `/api/admin/finance/import` POST return 410 for admins, preserve session/role/origin protection, and never read, import, export or write financial data.
- Legacy financial dashboard/widget exports are no-ops, so stale internal imports cannot revive accounting cards.

## Preserved

- Existing students/accounts/groups/teachers, academic KPIs, learning outcomes, attendance, content, CDI tests/recordings, Mock sessions and focus mode.
- Rewards/XP are learning incentives, not a financial ledger, and remain.
- Admissions contacts and trial lessons were disentangled from the old combined financial snapshot: standalone bounded admin-only `/api/admin/leads` API and contact UI. Only contact fields and lead status are selected/updated. Creation retries use a stable client ID; no invoices, balances, ledger or automatic platform-account creation. The historical `finance_leads` table name is retained to preserve existing contacts; it does not expose any accounting fields.
- Historical financial records, audit history, schema and archived accounting implementation remain intact for a separately planned accounting site. No records are migrated, deleted, exported or synchronized by this change. No accounting-site URL or integration is guessed.

## Verification

- Unit/regression tests cover removed destinations, retired endpoints, legacy finance tab fallback, denied financial reads/writes/import/export, admissions permissions/validation/rate limiting and contact-only persistence.
- Local Chromium QA uses synthetic contacts and mocked APIs; verifies create/status requests hit only the admissions API, and inspects desktop/mobile overview, admissions and menu.
- No destructive migrations or production test-student writes are needed.
