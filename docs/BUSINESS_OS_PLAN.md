# Averna Business OS — data-reality assessment & build plan

Goal: turn the Admin Dashboard into the operating system of the learning centre —
14 modules covering finance, expenses, profit, payroll, inventory, calendar, risk,
BI, health, automation, permissions and an AI business assistant.

This document exists because of one hard finding, verified against the schema:

> **9 of the 10 core business models do not exist.**
> `Expense`, `Payroll`/`Salary`, `Inventory`/`Asset`, `CalendarEvent`, `Invoice`,
> `Receipt`, `Vendor` — none are in `prisma/schema.prisma`. `Payment` exists but is
> minimal: `{ amount, type, description, status, createdAt, studentId }` — no
> payment method, no operator, no course link, no receipt, no notes.

So the modules split cleanly into *buildable now* and *blocked on schema*. Shipping
a "Net Profit" card computed from income alone would be worse than shipping nothing:
it would look authoritative and be wrong. Every blocked number renders as **"—"**
with a note saying why.

---

## Phase 1 — shipped (no schema change)

| Module | What landed |
|---|---|
| **M1 Executive Overview** (partial) | `ExecutiveOverview` above the existing KPI rows: today's revenue, monthly revenue with MoM growth, students in arrears, active/total students, 30-day attendance, groups + average size + under-enrolled count, cash vs other income. Every card links to its detail page. |
| **M11 Business Health Score** | One explainable 0-100 score with band (Ajoyib → Tanqidiy), per-driver sub-scores, weights and a plain-language reason for each, plus prioritised recommendations. Weights renormalise over drivers that have data, so a young centre isn't punished for what can't be measured. It also lists, openly, the dimensions it cannot score yet. |

Engine: `lib/engine/business-engine.ts` (`getExecutiveSnapshot`, `getBusinessHealth`).
Read-only, no schema change, existing card language, Uzbek admin UI.

**Deliberately returned as `null` (never guessed):** `expensesMonth`, `netProfitMonth`.

---

## Phase 2 — the ERP schema (unblocks M2–M8)

⚠️ **Must not start before S0b** (`docs/RUNBOOK_DB_MIGRATIONS.md`). Adding ~8 tables
via `db push` while schema drift exists is how the earlier data-loss incident
happened. With versioned migrations this becomes routine and reviewable.

Proposed additions (all additive):

```
Expense        id, category, amount, currency, method, vendor, invoiceNo,
               receiptUrl, responsibleId, status(draft|pending|approved|paid),
               recurringRule, incurredAt, notes
PaymentMethod  enum: CASH | CARD | TERMINAL | TRANSFER | SCHOLARSHIP | DISCOUNT
Payment        + method, operatorId, groupId(course), invoiceNo, receiptUrl,
               notes, kind(PAYMENT|REFUND|PARTIAL|CANCELLED)
Payroll        teacherId, period, salaryType(monthly|hourly|per-lesson), base,
               hourlyRate, lessons, bonuses, deductions, extraHours, status,
               approvedById, paidAt
Asset          name, category, purchaseDate, price, warrantyUntil, condition,
               location, assignedToId, maintenanceLog(Json), replaceForecastAt
BusinessEvent  type, title, amount?, startsAt, endsAt?, recurringRule,
               reminderAt, relatedId, notes
```

Then, in order:
1. **M2 Financial Center** — full transaction ledger, revenue by method / course / teacher, day-week-month-year rollups.
2. **M3 Expense Center** — categories, approvals, recurring, receipt upload, reports.
3. **M4 Profit Engine** — gross → operating → net, margins, cash flow, period comparison, forecast. *Only becomes truthful here.*
4. **M5 Payroll**, **M6 Student Payment Center** (installments, due dates, risk, AI prediction), **M7 Inventory**, **M8 Business Calendar**.

## Phase 3 — intelligence on top

- **M9 Risk Center** — extend the existing `admin-intel` event feed with financial
  risks (payment risk, expense spikes, contract/warranty expiry) once Phase 2 lands.
  Attendance/churn/occupancy risks are already derivable.
- **M10 Business Intelligence** — filtering, comparison, export, forecasting over
  the Phase 2 ledgers. Must use aggregates, never full-table scans (see the
  `groupBy` pattern in `admin-analytics-engine`).
- **M14 AI Business Assistant** — reuse the evidence-linked pattern from
  `averna-ai`: assemble a business snapshot, require every answer to cite the
  datum, refuse to speculate. Guarded by `ai-guard` for cost.

## Phase 4 — governance

- **M13 Security & Permissions** — needs `UserRole` extended beyond
  STUDENT/TEACHER/PARENT/ADMIN to FINANCE_MANAGER, RECEPTION, ACCOUNTANT, OWNER,
  plus a per-module permission matrix. Audit logging already exists (`AuditLog`,
  `recordAudit`) and every finance mutation should write to it.
- **M12 Automation** — reminders, monthly reports, scheduled exports. Needs a job
  runner (Vercel Cron) — the app currently has no scheduler.

---

## Non-negotiables carried from the Core Engine work

1. `prisma/schema.prisma` is the only schema source of truth.
2. No destructive deploy flags, ever.
3. A number with no data source renders "—", never an estimate presented as fact.
4. Money mutations are audited and, like XP, funnel through one authority.
5. Aggregate in SQL; never load whole tables to count them.
