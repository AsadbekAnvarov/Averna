/** Whole UZS, exact integer arithmetic. No binary-floating-point payroll calculations. */
export const CHANNELS = ["CASH", "CARD", "TERMINAL", "TRANSFER"] as const;
export const EXPENSE_CATEGORIES = ["RENT", "UTILITIES", "BOOKS", "SUPPLIES", "OTHER"] as const;
export const KINDS = ["TUITION", "OTHER_INCOME", "EXPENSE", "ADVANCE", "SALARY", "REFUND"] as const;
export const MONEY_LIMIT = 1_000_000_000_000n;
export class FinanceError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export function money(value: unknown, signed = false): bigint {
  const s = String(value ?? "").trim();
  if (!(signed ? /^-?\d{1,13}$/ : /^\d{1,13}$/).test(s)) throw new FinanceError("Summa butun UZS soni boʻlishi kerak.");
  const amount = BigInt(s);
  if ((!signed && amount < 0n) || amount > MONEY_LIMIT || amount < -MONEY_LIMIT) throw new FinanceError("Summa ruxsat etilgan oraliqdan tashqarida.");
  return amount;
}
export function positiveMoney(value: unknown): bigint {
  const amount = money(value); if (amount === 0n) throw new FinanceError("Summa noldan katta boʻlishi kerak."); return amount;
}
export function monthKey(value: unknown): string {
  const s = String(value ?? ""); if (!/^(20\d\d)-(0[1-9]|1[0-2])$/.test(s)) throw new FinanceError("Oy formati YYYY-MM."); return s;
}
export function todayTashkent(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tashkent", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
export function localDay(value: unknown): Date {
  const s = String(value ?? "");
  if (!/^20\d\d-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(s)) throw new FinanceError("Sana notoʻgʻri.");
  const d = new Date(`${s}T07:00:00.000Z`); // Noon Tashkent; no midnight timezone shifts.
  if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0,10) !== s) throw new FinanceError("Sana mavjud emas.");
  return d;
}
export function shareOf(amount: bigint, bps: number): bigint {
  if (!Number.isInteger(bps) || bps < 0 || bps > 10000) throw new FinanceError("Ulush 0–100% oraligʻida boʻlishi kerak.");
  if (amount < 0n) throw new FinanceError("Ulush bazasi manfiy boʻlmasligi kerak.");
  return (amount * BigInt(bps) + 5000n) / 10000n;
}
export function refundShare(original: bigint, originalEarned: bigint, alreadyRefunded: bigint, alreadyEarnedRefunded: bigint, amount: bigint, bps: number): bigint {
  if (amount <= 0n || amount > original - alreadyRefunded) throw new FinanceError("Qaytarish summasi qolgan tushumdan oshdi.");
  // Final refund removes exactly the remaining commission; partial refunds cannot overdraw it.
  if (amount === original - alreadyRefunded) return originalEarned - alreadyEarnedRefunded;
  const rounded = shareOf(amount, bps);
  return rounded < originalEarned - alreadyEarnedRefunded ? rounded : originalEarned - alreadyEarnedRefunded;
}
export interface MoneyEntry { kind: string; amount: string; earned: string; channel: string; staffId: string | null; reversesId?: string | null; originalKind?: string | null }
export function totals(entries: MoneyEntry[], opening: Record<string,string>, accrual: string = "0") {
  let received=0n, refunds=0n, expenses=0n, paid=0n, earned=BigInt(accrual), net=0n;
  const channels: Record<string,bigint> = Object.fromEntries(CHANNELS.map(c=>[c,0n]));
  for (const e of entries) {
    const a=BigInt(e.amount); net+=a; channels[e.channel]=(channels[e.channel]??0n)+a; earned+=BigInt(e.earned);
    const kind=e.kind==="REVERSAL" ? e.originalKind : e.kind;
    if (kind==="TUITION" || kind==="OTHER_INCOME") received+=a;
    if (kind==="REFUND") refunds-=a;
    if (kind==="EXPENSE") expenses-=a;
    if (kind==="ADVANCE" || kind==="SALARY") paid-=a;
  }
  const income=received-refunds; const openingTotal=CHANNELS.reduce((s,c)=>s+BigInt(opening[c]??"0"),0n);
  return { received:received.toString(), refunds:refunds.toString(), income:income.toString(), expenses:expenses.toString(), payrollPaid:paid.toString(), payrollEarned:earned.toString(), payrollDue:(earned-paid).toString(), net:net.toString(), balance:(openingTotal+net).toString(), result:(income-expenses-earned).toString(), channels:Object.fromEntries(CHANNELS.map(c=>[c,{flow:channels[c].toString(),balance:(channels[c]+BigInt(opening[c]??"0")).toString()}])) };
}
export function formatUzs(value: string | number | bigint): string {
  return new Intl.NumberFormat("uz-UZ").format(BigInt(value));
}
export function safeCsvCell(value: unknown): string {
  let s=String(value??""); if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s="'"+s;
  return '"'+s.replaceAll('"','""')+'"';
}
