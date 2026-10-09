# Admin finance register — rollout and limitations

## Scope

Replaces the old Moliya demo view and adds a finance workspace to the admin Dashboard. Uzbek UI, whole UZS, Asia/Tashkent dates, shared Averna dark/light theme tokens and glass cards, and mobile summary cards. Embedded finance is a section, not a nested page/main with a separate background. Only ADMIN sessions can read or write finance API data. No student Billing is reintroduced.

Modules: learner registry/tariffs, monthly invoices/debts, partial tuition receipts, cash/card/terminal/bank-transfer channels, teacher/center shares, advances, salary payouts, fixed salary/bonus/correction accruals, operating expenses, other income, intake leads, immutable journal/CSV export, opening balances and month closure.

This is a manual internal register, **not a bank connection, payment processor, statutory payroll, tax return or reconciled accounting system**. Recording salary or a refund does not send money. No workbook data is seeded, automatically uploaded or committed to GitHub.

## Workbook audit informed the design

The source workbook combines a finance summary, month close, settings/group mappings, staff learner ledgers and intake sheets. It has 12 sheets (2 hidden) and 23 configured group mappings. Audit findings requiring human review:

- Summary formulas and staff subtotals have inconsistent source ranges; a group can be omitted.
- Salary advances and receipts are mixed in the month-close logic.
- Numbered/formatted rows without learner names can contain signed debts.
- A date has year 3132; cached zeros and blank receipt columns are not evidence of actual zero income.
- Hidden intake sheets, checkboxes, signed debts and identities cannot be assigned operational meaning automatically.

No real names, contacts, salaries or original workbook are included here. Formula/schema audit is not a certification of the center's financial statements.

## Admin usability follow-up

- Four primary Dashboard tabs (all visible in a two-column layout on phones; the mobile tab bar does not stick over forms): overview, people/intake, finance, analytics/tools. The duplicate Manage tab is folded into a clearly labelled expandable tools section; old `?tab=manage` and remembered Manage selections map to analytics/tools. Tools/routes and account controls remain available.
- Daily quick actions stay on overview. Intake leads live with people, not in the cash workspace. The demo-seeding shortcut is removed from normal learner admission; no records or seed API are deleted by this UI change.
- Finance has six task tabs and reuses global theme variables, glass surfaces and brand accents. Embedded mode removes duplicate back-link, identity badge, page background and oversized heading. Standalone Moliya remains accessible.
- Payment action on an unpaid invoice or mobile learner card chooses its exact ID, fills its remaining amount and focuses the editable amount. Staff can reduce it for a partial payment. Existing invoices are excluded from bulk billing selection; each batch is capped at 200.
- Entered cash forms survive write/refresh failure and retain the same retry key. Successful forms clear only after both write and refresh succeed; fields/tab changes are locked while pending, with a synchronous rapid-submit guard.
- Dashboard summary/finance/intake reuse one authorized React request-scoped snapshot. No persistent/global financial cache is introduced.
- No additional database/schema, access-policy or financial-calculation changes are part of this design follow-up. Hosted migration/concurrency release gates below still apply.

## Register semantics

- Invoices are unique per learner/month. Learner name, group, staff name and agreed share are snapshotted when billed; later tariff/share edits affect future invoices only.
- Tuition is linked to an invoice. Partial payments and payments toward prior-month invoices are supported; invoice overpayment and paying a future invoice in an earlier period are rejected.
- Commission is earned on each actual tuition receipt, half-up rounded to whole UZS using the invoice share. Center share is net tuition less commission (not overall profit).
- Fixed salary/bonus/corrections create noncash payroll obligations. Salary/advance cash outflows are separate, avoiding double-counted expense. Salary payouts cannot exceed the lifetime known obligation; advances can exceed it and remain negative carry balances.
- Payroll availability is cumulative, not a statutory as-of-date payroll calculation. Opening staff obligations from Excel are not imported; reconcile and document any approved starting accrual separately.
- Refunds link to a real unreversed tuition receipt and cannot exceed its remaining amount or predate it. The final refund removes exactly the remaining commission. A later open period may refund an earlier closed period receipt.
- Correction appends an exact inverse entry with a required reason; no delete/edit endpoint for posted cash. Active refunds must be handled before reversing a receipt. Reversing a refund is blocked if later receipts would create invoice overpayment.
- Result = net receipts − operating expenses − accrued salary. Cash balance = confirmed channel opening balances + signed cash movements. Neither is an official accounting profit figure.
- Closing a month freezes that period's cash/accrual totals and prevents new period postings. Current receivables for its invoices may still change when paid/refunded in later periods. There is no reopen endpoint.
- Financial learners/staff are separate from login accounts; optional platform IDs are trace references, not cascading foreign keys. Deleting a platform account does not delete financial history. Define retention/deletion policies separately.
- Lead ENROLLED status does not create a login or a financial learner.
- Legacy Payment rows are a separate read-only archive and excluded from new financial totals. Zero platform balance is not treated as debt.

## Database release gate

1. Use a restored **staging database** and verify backups/restoration. Reconcile the existing migration history using `docs/PRODUCTION_LEARNING_RELEASE.md`; never execute the baseline on populated tables.
2. Apply `20261008000400_admin_finance` only after prior migrations are correctly adopted. It adds 8 finance tables, indexes, RESTRICT foreign keys and validation checks. It does not backfill Payment rows or change student balances.
3. Compatibility `prisma/sql/deploy.sql` contains the same additive finance definitions and is rerunnable. **Vercel's default build executes this SQL**: preview must use a separate disposable/staging DATABASE_URL, never production. A draft PR does not prevent an automatic preview deployment.
4. If compatibility SQL has already created the tables, verify actual definitions, constraints and indexes before resolving the migration as applied; do not blindly mark history or run duplicate CREATE statements.
5. Never use `migrate reset`, `--accept-data-loss`, destructive schema push or DROP on live data. A read-only diff is not a backup.
6. Run real Prisma/PostgreSQL staging tests before release, then deliberately deploy in an approved release window. Local tests and PGlite do not establish live readiness.

Missing finance schema returns 503/a setup warning, not a claimed zero cash balance. An unopened period displays unknown amounts as “—”.

## Initial operational setup

1. Reconcile each channel balance against cash/bank evidence; enter explicitly confirmed opening balances (not income).
2. Create staff and confirm each agreed share. Do not infer a person/rate from a worksheet position.
3. Register or privately import verified learners; optionally link an existing platform/roster record. Confirm name/contact split, staff, group, fee, due day and active status.
4. Bill a selected month. Review every invoice before recording payments.
5. Record actual receipts, expenses, advances and salary payouts with dates/document references. Record fixed salary accruals separately.
6. Check channels, debts, payroll, journal and supporting evidence before typing YOPISH to close the month.

## Private workbook conversion/import

Python + openpyxl are required locally; neither runs in the app server. Example with **placeholder** mappings:

```json
{"Verified worksheet name": "finance-staff-id-from-settings"}
```

```sh
python scripts/convert-finance-workbook.py /private/source.xlsx \
  --staff-map /private/staff-map.json --namespace stable-center-register \
  --out /private/learners-review.csv
```

The converter reads visible configured numbered/name rows only, skips anonymous/formula-name rows, and emits stable sourceKey values plus a review JSON. Fees stay blank unless an explicitly confirmed common fee is supplied. It does not interpret hidden sheets, debt signs, cash receipts, checkbox states, expenses or salary advances. Review generated CSV privately; never commit it.

Required CSV: fullName, phone, groupName, staffId, monthlyFee, dueDay, sourceKey. Optional status/note. At most 200 rows/100KB per preview/commit. Preview sends private CSV only to the authorized application API, does not write accounts or financial records, and commit requires explicit confirmation. Repeat of an identical sourceKey is skipped; changed rows or conflicting name/group require manual matching. A stable source namespace is required. Unpriced (0 fee) records cannot be billed. Preview is not a guarantee of commit; commit revalidates atomically.

## Verification and staging acceptance

Local checks:

```sh
npm test
./node_modules/.bin/tsc --noEmit
npm run lint
npm run build
```

SQL verification uses an isolated PGlite installation outside the production dependency tree:

```sh
# In a disposable directory, install @electric-sql/pglite, then:
NODE_PATH=/path/to/disposable/node_modules node scripts/verify-finance-sql.cjs
```

It applies all migrations, repeats compatibility SQL, checks additive behavior, constraint guards, inverse entries, transactional rollback and historical retention. It does **not** verify concurrent Prisma connections/row locks on hosted PostgreSQL.

Required hosted staging exercises:

- ADMIN success; anonymous/STUDENT/TEACHER denial; foreign-origin writes denied; no-store responses.
- Two concurrent receipts against the same invoice; no overpayment. Two concurrent salary/refund requests; no overdraw. Two duplicate idempotency keys; exactly one committed posting/audit.
- Invoice snapshot survives staff share/tariff edits; prior-period debt can be paid in a new period.
- Partial/final refund rounding; refund-before-receipt rejection; refund reversal after subsequent receipt rejection.
- Closed-period cash/accrual writes fail; later-period refund works; close snapshot remains unchanged.
- Failure after cash write but before audit/idempotency commit rolls back all writes. Network loss after commit: retry same key, inspect journal, never submit an invented replacement transaction.
- Import preview does not write; changed-source/duplicate conflicts abort; account IDs must be verified. Verify deletion/retention policy and private CSV handling.
- Desktop/phone, dark/light, keyboard focus, loading/error/retry states and CSV formula-injection handling.

Client retry storage contains only an actor-scoped command hash and random request key, never the command payload. The same key is retained until write and refresh both succeed. Idempotency protects identical retries, not different keys/commands for the same business receipt; verify document references manually.

## Capacity and deferred work

This is a pilot-scale register: histories are read in memory; there is no bulk historical money importer. Selectors show up to 1,000 platform students/roster rows and 300 teachers; leads show the newest 200, legacy Payment archive the newest 200 with full count. Selected-period journal totals use all its entries; UI pagination is 30 rows. Very large histories need server pagination/aggregation and load tests before wider use.

Deferred: bank reconciliation/feed, official tax payroll, invoice cancellation/adjustment workflow, authorization beyond ADMIN, historical balance migration and payment-provider integration. No claims that original workbook amounts are reconciled or that deployed production has been exercised.
