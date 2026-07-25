/**
 * Payment methods — how money actually arrived.
 *
 * Until now the method was not stored at all. The admin UI offered a
 * cash/card/terminal/transfer selector, but the choice was only pasted into the
 * free-text description, and cash additionally overwrote `type` with "CASH".
 * Two consequences, both fixed here:
 *
 *   1. No method could be totalled, because there was nothing to group by.
 *   2. `type` was used for two unrelated things, so the finance page's course
 *      income (which filters `type === "COURSE"`) silently dropped every cash
 *      payment. Cash was collected, receipted, and then missing from the figure
 *      an owner reads as course revenue.
 *
 * `type` (what was bought) and `method` (how it was paid) are now separate.
 *
 * Legacy rows have no `method`, so they are read through `paymentMethodOf`,
 * which recovers the method from the traces the old code left behind and
 * otherwise reports UNKNOWN. Unknown is surfaced as its own bucket rather than
 * folded into cash: a total that is quietly wrong is worse than one that admits
 * what it does not know.
 */

export type PaymentMethod = "CASH" | "CARD" | "TERMINAL" | "TRANSFER";
export type PaymentMethodKey = PaymentMethod | "UNKNOWN";

export const PAYMENT_METHODS: { key: PaymentMethod; label: string }[] = [
  { key: "CASH", label: "Naqd" },
  { key: "CARD", label: "Karta" },
  { key: "TERMINAL", label: "Terminal" },
  { key: "TRANSFER", label: "Bank oʻtkazmasi" },
];

const LABEL = new Map<PaymentMethodKey, string>([
  ...PAYMENT_METHODS.map((m) => [m.key, m.label] as [PaymentMethodKey, string]),
  ["UNKNOWN", "Usul koʻrsatilmagan"],
]);

export const paymentMethodLabel = (key: PaymentMethodKey) => LABEL.get(key) ?? key;

const VALID = new Set<string>(PAYMENT_METHODS.map((m) => m.key));

/** Normalise anything the form or an older row can carry into a known method. */
export function normaliseMethod(raw: string | null | undefined): PaymentMethod | null {
  if (!raw) return null;
  const key = raw.trim().toUpperCase();
  return VALID.has(key) ? (key as PaymentMethod) : null;
}

/** Rows as read from the database — only the fields needed to classify one. */
export interface ClassifiablePayment {
  amount: number;
  type: string;
  method?: string | null;
  description?: string | null;
}

/**
 * The method of a payment, recovering it for rows written before the column
 * existed.
 *
 * Recovery is deliberate, not guesswork: the old code wrote the chosen method
 * into the description as "Kurs toʻlovi (CARD)" and stamped admin-entered cash
 * with type "CASH". Both are exact records of what the admin selected, so
 * reading them back loses nothing. Anything without such a trace stays UNKNOWN.
 */
export function paymentMethodOf(p: ClassifiablePayment): PaymentMethodKey {
  const stored = normaliseMethod(p.method);
  if (stored) return stored;

  // Legacy: the method was written into the description in parentheses.
  const tagged = p.description?.toUpperCase() ?? "";
  for (const { key } of PAYMENT_METHODS) {
    if (tagged.includes(`(${key})`)) return key;
  }

  // Legacy: cash taken at the desk hijacked `type`, or said so in Uzbek.
  if (p.type === "CASH" || tagged.includes("NAQD")) return "CASH";

  return "UNKNOWN";
}

/**
 * Was this row money coming in for tuition?
 *
 * Covers the legacy "CASH" type, which is what the old course-income filter
 * missed. Negative amounts are balance charges (a student spending credit), not
 * incoming money, so they are excluded — counting them as income would double
 * count the original top-up.
 */
export function isCourseIncome(p: ClassifiablePayment): boolean {
  return p.amount > 0 && (p.type === "COURSE" || p.type === "CASH" || p.type === "SUBSCRIPTION");
}

export interface MethodTotal {
  key: PaymentMethodKey;
  label: string;
  amount: number;
  count: number;
  /** Share of the summarised total, 0-100. Null when there is nothing to share. */
  sharePct: number | null;
}

export interface MethodSummary {
  total: number;
  count: number;
  rows: MethodTotal[];
  /** True when at least one row could not be attributed to a method. */
  hasUnknown: boolean;
}

/**
 * Total incoming money per method.
 *
 * Only positive amounts are counted, for the reason given in `isCourseIncome`:
 * negative rows are internal balance spending, and mixing them in would make
 * the method totals disagree with revenue.
 *
 * Every known method is always returned, including zeroes — an owner comparing
 * months needs to see that terminal takings were zero, not have the row vanish.
 * UNKNOWN appears only when it actually has rows.
 */
export function summariseByMethod(payments: ClassifiablePayment[]): MethodSummary {
  const buckets = new Map<PaymentMethodKey, { amount: number; count: number }>();
  for (const { key } of PAYMENT_METHODS) buckets.set(key, { amount: 0, count: 0 });

  let total = 0;
  let count = 0;
  for (const p of payments) {
    if (p.amount <= 0) continue;
    const key = paymentMethodOf(p);
    const bucket = buckets.get(key) ?? { amount: 0, count: 0 };
    bucket.amount += p.amount;
    bucket.count += 1;
    buckets.set(key, bucket);
    total += p.amount;
    count += 1;
  }

  const unknown = buckets.get("UNKNOWN");
  const keys: PaymentMethodKey[] = [
    ...PAYMENT_METHODS.map((m) => m.key),
    ...(unknown && unknown.count > 0 ? (["UNKNOWN"] as PaymentMethodKey[]) : []),
  ];

  const rows: MethodTotal[] = keys.map((key) => {
    const b = buckets.get(key) ?? { amount: 0, count: 0 };
    return {
      key,
      label: paymentMethodLabel(key),
      amount: b.amount,
      count: b.count,
      sharePct: total > 0 ? Math.round((b.amount / total) * 100) : null,
    };
  });

  return { total, count, rows, hasUnknown: (unknown?.count ?? 0) > 0 };
}
