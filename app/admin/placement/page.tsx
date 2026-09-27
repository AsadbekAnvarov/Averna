export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { CheckCircle2, Compass, Download, Filter, RotateCcw, Users } from "lucide-react";
import { auth } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { AccountNotice } from "@/components/account-notice";
import { AdminHeader } from "@/components/admin/admin-header";
import { PageHeader } from "@/components/ui/page-header";
import { ConfirmButton } from "@/components/ui/confirm-button";
import {
  ADMIN_LIMIT,
  allowPlacementRetake,
  filtersQuery,
  listPlacementResults,
  parsePlacementFilters,
  sectionCell,
  uzDate,
  uzDateTime,
  type AdminPlacementList,
  type AdminPlacementRow,
} from "@/lib/placement/admin";
import { RETAKE_DAYS, SECTION_TITLE_UZ } from "@/lib/placement/config";
import { CEFR_LEVELS, PLACEMENT_SECTIONS } from "@/lib/placement/types";
import { cn } from "@/lib/utils";

export const metadata = { title: "Daraja aniqlash testi" };

const FIELD =
  "w-full rounded-md border border-white/15 bg-background/60 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-averna-cyan";
const BTN =
  "inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-md px-3.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon/60 motion-reduce:transition-none";

/** Let the student sit the placement test again now (before the waiting period ends). */
async function allowRetake(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/auth/signin");
  const studentId = String(formData.get("studentId") ?? "");
  const name = String(formData.get("studentName") ?? "").slice(0, 120);
  const ok = await allowPlacementRetake(studentId, session.user.name ?? "Admin").catch((e: unknown) => {
    console.error("Placement retake permission failed:", e);
    return false;
  });
  if (ok) {
    await recordAudit(
      { id: session.user.id, name: session.user.name, role: session.user.role },
      "Allowed placement retake",
      `studentId=${studentId} name=${name}`
    );
  }
  revalidatePath("/admin/placement");
}

export default async function AdminPlacementPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  if (session.user.role !== "ADMIN") {
    return <AccountNotice title="Faqat adminlar uchun" message="Bu boʻlim faqat administratorlar uchun." />;
  }

  const filters = parsePlacementFilters(searchParams ?? {});
  let list: AdminPlacementList | null = null;
  try {
    list = await listPlacementResults(filters);
  } catch (e) {
    console.error("Admin placement list failed:", e);
  }
  const rows = list?.rows ?? [];
  const filtered = !!(filters.from || filters.to || filters.level || filters.noGroup);
  const byLevel = CEFR_LEVELS.map((l) => ({ level: l, count: rows.filter((r) => r.cefr === l).length }));
  const noGroup = rows.filter((r) => !r.group).length;

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto max-w-7xl px-4 py-8 pb-24 lg:pb-8">
        <AdminHeader user={{ name: session.user.name ?? "Admin", email: session.user.email ?? "" }} />
        <PageHeader
          back={{ href: "/admin/dashboard", label: "Admin paneliga qaytish" }}
          icon={Compass}
          iconClassName="text-averna-neon"
          title={
            <>
              Daraja aniqlash <span className="neon-text-cyan">testi</span>
            </>
          }
          subtitle="Yangi oʻquvchilarning kirish testi natijalari: CEFR darajasi, har bir boʻlim boʻyicha taxminiy IELTS bali va tavsiya etilgan kurs. Speaking birinchi darsda oʻqituvchi tomonidan baholanadi."
        />

        {/* Summary */}
        <section aria-label="Qisqacha" className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label={filtered ? "Filtrga mos natijalar" : "Natijalar"} value={rows.length} />
          <Stat label="Hozir test topshirmoqda" value={list?.active ?? 0} />
          <Stat label="Guruhga biriktirilmagan" value={noGroup} />
          <div className="glass rounded-xl border border-white/10 p-4">
            <p className="text-xs text-gray-400">Darajalar boʻyicha</p>
            <ul role="list" className="mt-2 flex flex-wrap gap-1.5">
              {byLevel.map((b) => (
                <li key={b.level} className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-gray-200">
                  <span className="font-semibold text-white">{b.level}</span> · {b.count}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Filters */}
        <section aria-labelledby="placement-filter-title" className="glass mb-6 rounded-xl border border-averna-cyan/30 p-4 sm:p-5">
          <h2 id="placement-filter-title" className="mb-3 flex items-center gap-2 text-sm font-semibold text-averna-cyan">
            <Filter className="h-4 w-4" aria-hidden />
            Filtr
          </h2>
          <form method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto] lg:items-end">
            <div className="space-y-1.5">
              <label htmlFor="pl-from" className="text-xs text-gray-400">
                Sana (dan)
              </label>
              <input id="pl-from" type="date" name="from" defaultValue={filters.from} className={FIELD} />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="pl-to" className="text-xs text-gray-400">
                Sana (gacha)
              </label>
              <input id="pl-to" type="date" name="to" defaultValue={filters.to} className={FIELD} />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="pl-level" className="text-xs text-gray-400">
                Daraja
              </label>
              <select id="pl-level" name="level" defaultValue={filters.level} className={FIELD}>
                <option value="" className="bg-averna-dark">
                  Barchasi
                </option>
                {CEFR_LEVELS.map((l) => (
                  <option key={l} value={l} className="bg-averna-dark">
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex min-h-[40px] items-center gap-2 text-sm text-gray-200">
              <input type="checkbox" name="nogroup" value="1" defaultChecked={filters.noGroup} className="h-4 w-4 accent-averna-neon" />
              Faqat guruhsizlar
            </label>
            <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-1">
              <button type="submit" className={cn(BTN, "bg-averna-primary text-white hover:bg-averna-light")}>
                <Filter className="h-4 w-4" aria-hidden />
                Filtrlash
              </button>
              {filtered && (
                <Link href="/admin/placement" className={cn(BTN, "border border-white/15 text-gray-200 hover:bg-white/5")}>
                  Tozalash
                </Link>
              )}
            </div>
          </form>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
            <p className="text-xs text-gray-400">
              Qayta topshirish oxirgi testdan {RETAKE_DAYS} kun oʻtgach ochiladi. Kerak boʻlsa, uni hozir ochib berishingiz mumkin.
            </p>
            <a
              href={`/api/admin/placement/export${filtersQuery(filters)}`}
              className={cn(BTN, "border border-averna-neon/40 text-averna-neon hover:bg-averna-neon/10")}
            >
              <Download className="h-4 w-4" aria-hidden />
              CSV yuklab olish
            </a>
          </div>
        </section>

        {/* Results */}
        <section aria-labelledby="placement-list-title" className="glass rounded-xl border border-white/10">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
            <h2 id="placement-list-title" className="flex items-center gap-2 text-sm font-semibold text-white">
              <Users className="h-4 w-4 text-averna-cyan" aria-hidden />
              Natijalar roʻyxati
            </h2>
            {list?.truncated && (
              <p className="text-xs text-amber-200">Faqat oxirgi {ADMIN_LIMIT} ta natija koʻrsatildi — sanalar oraligʻini toraytiring.</p>
            )}
          </div>

          {!list ? (
            <p role="alert" className="px-4 py-10 text-center text-sm text-red-200">
              Maʼlumotlarni yuklab boʻlmadi. Sahifani yangilab koʻring.
            </p>
          ) : rows.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-gray-400">
              {filtered ? "Filtrga mos natija topilmadi." : "Hozircha hech kim daraja aniqlash testini topshirmagan."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] border-collapse text-left text-sm">
                <caption className="sr-only">Daraja aniqlash testi natijalari, eng yangisi birinchi</caption>
                <thead>
                  <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-gray-400">
                    <th scope="col" className="px-4 py-2.5 font-semibold">Oʻquvchi</th>
                    <th scope="col" className="px-3 py-2.5 font-semibold">Sana</th>
                    <th scope="col" className="px-3 py-2.5 font-semibold">CEFR</th>
                    <th scope="col" className="px-3 py-2.5 font-semibold">IELTS</th>
                    {PLACEMENT_SECTIONS.map((s) => (
                      <th key={s} scope="col" className="px-3 py-2.5 font-semibold">
                        {SECTION_TITLE_UZ[s]}
                      </th>
                    ))}
                    <th scope="col" className="px-3 py-2.5 font-semibold">Tavsiya etilgan kurs</th>
                    <th scope="col" className="px-3 py-2.5 font-semibold">Guruh</th>
                    <th scope="col" className="px-4 py-2.5 font-semibold">Qayta topshirish</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <ResultRow key={r.attemptId} row={r} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="glass rounded-xl border border-white/10 p-4">
      <p className="text-xs text-gray-400">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-white">{value}</p>
    </div>
  );
}

function ResultRow({ row }: { row: AdminPlacementRow }) {
  const essay = row.sections.WRITING?.essay;
  return (
    <tr className={cn("border-b border-white/5 align-top", !row.latest && "opacity-70")}>
      <td className="px-4 py-3">
        <p className="font-medium text-white">{row.name}</p>
        <p className="text-xs text-gray-500">{row.email}</p>
      </td>
      <td className="whitespace-nowrap px-3 py-3 text-gray-300">{uzDateTime(row.finishedAt)}</td>
      <td className="px-3 py-3">
        {row.cefr ? (
          <span className="inline-flex rounded-full border border-averna-neon/40 bg-averna-neon/10 px-2 py-0.5 text-xs font-bold text-averna-neon">
            {row.cefr}
          </span>
        ) : (
          "—"
        )}
      </td>
      <td className="px-3 py-3 font-semibold tabular-nums text-white">{row.band != null ? row.band.toFixed(1) : "—"}</td>
      {PLACEMENT_SECTIONS.map((s) => (
        <td key={s} className="whitespace-nowrap px-3 py-3 tabular-nums text-gray-200">
          {sectionCell(s, row.sections[s])}
          {s === "WRITING" && essay && (
            <details className="mt-1 whitespace-normal">
              <summary className="cursor-pointer text-xs text-averna-cyan hover:underline">Matnni koʻrish</summary>
              <p className="mt-1 max-w-xs whitespace-pre-wrap rounded-md border border-white/10 bg-black/30 p-2 text-xs leading-relaxed text-gray-200">
                {essay}
              </p>
            </details>
          )}
        </td>
      ))}
      <td className="px-3 py-3 text-gray-200">{row.recommendation}</td>
      <td className="px-3 py-3">
        {row.group ? (
          <span className="text-gray-200">{row.group}</span>
        ) : (
          <span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-xs text-amber-200">Guruh yoʻq</span>
        )}
      </td>
      <td className="px-4 py-3">
        {!row.latest ? (
          <span className="text-xs text-gray-500">Oldingi natija</span>
        ) : row.retake.override ? (
          <span className="inline-flex items-center gap-1 text-xs text-averna-neon">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
            Ruxsat berilgan
          </span>
        ) : row.retake.allowed ? (
          <span className="text-xs text-gray-300">{RETAKE_DAYS} kun oʻtdi — topshira oladi</span>
        ) : (
          <form action={allowRetake} className="space-y-1">
            <input type="hidden" name="studentId" value={row.studentId} />
            <input type="hidden" name="studentName" value={row.name} />
            <ConfirmButton
              message={`${row.name}ga daraja aniqlash testini hozir qayta topshirishga ruxsat berasizmi? Yangi natija uning darajasini yangilaydi.`}
              title="Qayta topshirishga ruxsat berish"
              className="rounded-md border border-averna-cyan/40 px-2.5 py-1.5 text-xs font-semibold text-averna-cyan hover:bg-averna-cyan/10"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden />
              Qayta topshirishga ruxsat berish
            </ConfirmButton>
            {row.retake.nextAt && <p className="text-[11px] text-gray-500">Aks holda {uzDate(row.retake.nextAt)} dan</p>}
          </form>
        )}
      </td>
    </tr>
  );
}
