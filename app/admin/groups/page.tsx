export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Layers, Plus, Users, Trash2, UserPlus, UserRound, UserRoundX, GraduationCap } from "lucide-react";
import { AccountNotice } from "@/components/account-notice";
import { AdminHeader } from "@/components/admin/admin-header";
import { PageHeader } from "@/components/ui/page-header";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { SortControl } from "@/components/admin/sort-control";
import { recordAudit } from "@/lib/audit";
import { deleteGroupCascade } from "@/lib/cascade-delete";

const LEVELS = ["Boshlangʻich (A2)", "Oʻrta (B1)", "Oʻrtadan yuqori (B2)", "Yuqori (C1)", "IELTS standart (6.0–6.5)", "IELTS yuqori (7.5+)"];

const GROUP_SORTS = [
  { value: "name", label: "Nom" },
  { value: "size", label: "Aʼzolar soni" },
  { value: "level", label: "Daraja" },
  { value: "teacher", label: "Oʻqituvchi" },
];

async function createGroup(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/auth/signin");

  const name = (formData.get("name") as string)?.trim();
  const teacherId = formData.get("teacherId") as string;
  const level = (formData.get("level") as string)?.trim();
  const schedule = (formData.get("schedule") as string)?.trim();
  if (!name || !teacherId) return;

  await db.group.create({
    data: { name, teacherId, level: level || null, schedule: schedule || null, description: `${level ?? ""} group` },
  });
  await recordAudit(
    { id: session.user.id, name: session.user.name, role: session.user.role },
    "Created group",
    `name=${name}`
  );
  revalidatePath("/admin/groups");
  redirect("/admin/groups?saved=1");
}

async function updateGroup(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/auth/signin");
  const id = formData.get("id") as string;
  const teacherId = formData.get("teacherId") as string;
  const level = (formData.get("level") as string)?.trim();
  const schedule = (formData.get("schedule") as string)?.trim();
  if (!id) return;
  await db.group.update({
    where: { id },
    data: { teacherId: teacherId || undefined, level: level || null, schedule: schedule || null },
  });
  revalidatePath("/admin/groups");
}

async function duplicateGroup(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/auth/signin");
  const id = formData.get("id") as string;
  const original = await db.group.findUnique({ where: { id } });
  if (!original) return;
  await db.group.create({
    data: {
      name: `${original.name} (nusxa)`,
      teacherId: original.teacherId,
      level: original.level,
      schedule: original.schedule,
      description: original.description,
    },
  });
  revalidatePath("/admin/groups");
  redirect("/admin/groups?saved=1");
}

async function deleteGroup(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/auth/signin");
  const id = formData.get("id") as string;
  if (!id) return;
  const group = await db.group.findUnique({ where: { id }, select: { name: true } });
  await deleteGroupCascade(id);
  await recordAudit(
    { id: session.user.id, name: session.user.name, role: session.user.role },
    "Deleted group",
    `name=${group?.name ?? "?"}`
  );
  revalidatePath("/admin/groups");
  redirect("/admin/groups?deleted=1");
}

/** Add a student who has no site account to a group's register. */
async function addRosterMember(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/auth/signin");

  const groupId = formData.get("groupId") as string;
  const fullName = (formData.get("fullName") as string)?.trim();
  const parentName = (formData.get("parentName") as string)?.trim();
  const phone = (formData.get("phone") as string)?.trim();
  const ageRaw = parseInt(formData.get("age") as string, 10);
  const age = Number.isFinite(ageRaw) && ageRaw > 0 && ageRaw < 120 ? ageRaw : null;
  const note = (formData.get("note") as string)?.trim();
  if (!groupId || !fullName) return;

  try {
    await db.rosterStudent.create({
      data: {
        groupId,
        fullName,
        parentName: parentName || null,
        phone: phone || null,
        age,
        note: note || null,
      },
    });
    await recordAudit(
      { id: session.user.id, name: session.user.name, role: session.user.role },
      "Added roster student",
      `name=${fullName} groupId=${groupId}`
    );
  } catch {
    /* table may not be migrated yet — never crash the panel */
  }
  revalidatePath("/admin/groups");
}

async function deleteRosterMember(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/auth/signin");
  const id = formData.get("id") as string;
  if (!id) return;
  try {
    const m = await db.rosterStudent.findUnique({ where: { id }, select: { fullName: true } });
    await db.rosterStudent.delete({ where: { id } });
    await recordAudit(
      { id: session.user.id, name: session.user.name, role: session.user.role },
      "Removed roster student",
      `name=${m?.fullName ?? "?"}`
    );
  } catch {
    /* ignore */
  }
  revalidatePath("/admin/groups");
}

interface RosterMemberRow {
  id: string;
  fullName: string;
  parentName: string | null;
  phone: string | null;
  age: number | null;
  note: string | null;
}

type GroupWithMembers = {
  id: string;
  name: string;
  level: string | null;
  teacherId: string;
  schedule: string | null;
  teacher: { user: { name: string | null } } | null;
  students: { id: string; level: string | null; totalPoints: number; user: { name: string | null; email: string } }[];
  rosterMembers: RosterMemberRow[];
};

export default async function AdminGroupsPage({
  searchParams,
}: {
  searchParams: { saved?: string; deleted?: string; sort?: string };
}) {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  if (session.user.role !== "ADMIN") {
    return <AccountNotice title="Faqat adminlar uchun" message="Bu boʻlim faqat administratorlar uchun." />;
  }

  let groups: GroupWithMembers[] = [];
  let teachers: { id: string; user: { name: string | null } }[] = [];
  try {
    [groups, teachers] = await Promise.all([
      db.group.findMany({
        include: {
          teacher: { select: { user: { select: { name: true } } } },
          students: {
            select: { id: true, level: true, totalPoints: true, user: { select: { name: true, email: true } } },
          },
          rosterMembers: {
            select: { id: true, fullName: true, parentName: true, phone: true, age: true, note: true },
          },
        },
      }),
      db.teacher.findMany({ select: { id: true, user: { select: { name: true } } } }),
    ]);
  } catch {
    // `rosterMembers` relation not migrated yet — fall back so the page still works.
    [groups, teachers] = await Promise.all([
      db.group
        .findMany({
          include: {
            teacher: { select: { user: { select: { name: true } } } },
            students: {
              select: { id: true, level: true, totalPoints: true, user: { select: { name: true, email: true } } },
            },
          },
        })
        .then((gs) => gs.map((g) => ({ ...g, rosterMembers: [] as RosterMemberRow[] }))),
      db.teacher.findMany({ select: { id: true, user: { select: { name: true } } } }),
    ]);
  }

  // --- Professional, deterministic ordering (server-side, from ?sort=) ---
  const collator = new Intl.Collator("uz");
  const memberCount = (g: GroupWithMembers) => g.students.length + g.rosterMembers.length;
  const sort = searchParams.sort ?? "name";
  const sorted = [...groups].sort((a, b) => {
    if (sort === "size") return memberCount(b) - memberCount(a) || collator.compare(a.name, b.name);
    if (sort === "level") return collator.compare(a.level ?? "яяя", b.level ?? "яяя") || collator.compare(a.name, b.name);
    if (sort === "teacher")
      return collator.compare(a.teacher?.user?.name ?? "яяя", b.teacher?.user?.name ?? "яяя") || collator.compare(a.name, b.name);
    return collator.compare(a.name, b.name);
  });

  const teacherOptions = [...teachers].sort((a, b) => collator.compare(a.user.name ?? "", b.user.name ?? ""));

  const totalRegistered = groups.reduce((s, g) => s + g.students.length, 0);
  const totalRoster = groups.reduce((s, g) => s + g.rosterMembers.length, 0);

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <AdminHeader user={{ name: session.user.name ?? "Admin", email: session.user.email ?? "" }} />
        <PageHeader
          back={{ href: "/admin/dashboard", label: "Admin paneliga qaytish" }}
          icon={Layers}
          iconClassName="text-averna-purple"
          title={<>Guruhlarni <span className="neon-text-purple">boshqarish</span></>}
          subtitle="Guruhlar yarating, oʻqituvchi biriktiring, hamda har bir guruhning toʻliq oʻquvchilar roʻyxatini yuriting — saytga kirmaydigan kichik oʻquvchilar ham."
        />

        {searchParams.saved && <div className="mb-6 p-3 rounded-lg bg-averna-neon/10 border border-averna-neon/30 text-averna-neon">✓ Guruh yaratildi!</div>}
        {searchParams.deleted && <div className="mb-6 p-3 rounded-lg bg-averna-neon/10 border border-averna-neon/30 text-averna-neon">✓ Guruh oʻchirildi.</div>}

        {/* Create group */}
        <Card className="glass border-averna-purple/30 mb-8">
          <CardHeader><CardTitle className="flex items-center gap-2 text-averna-purple"><Plus className="h-5 w-5" /> Yangi guruh</CardTitle></CardHeader>
          <CardContent>
            <form action={createGroup} className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="name">Guruh nomi *</Label>
                <Input id="name" name="name" placeholder="masalan, IELTS Advanced — Kechki" className="bg-background/50" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="teacherId">Oʻqituvchi *</Label>
                <select id="teacherId" name="teacherId" required className="w-full rounded-md border border-input bg-background/60 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-averna-purple">
                  {teacherOptions.map((t) => <option key={t.id} value={t.id} className="bg-averna-dark">{t.user.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="level">Daraja</Label>
                <select id="level" name="level" className="w-full rounded-md border border-input bg-background/60 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-averna-cyan">
                  <option value="" className="bg-averna-dark">— Daraja —</option>
                  {LEVELS.map((l) => <option key={l} value={l} className="bg-averna-dark">{l}</option>)}
                </select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="schedule">Jadval</Label>
                <Input id="schedule" name="schedule" placeholder="masalan, Dush, Chor, Jum · 18:00–20:00" className="bg-background/50" />
              </div>
              <div className="sm:col-span-2">
                <Button type="submit" className="w-full neon-button bg-averna-primary hover:bg-averna-light">Guruh yaratish</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Existing groups */}
        <Card className="glass border-averna-cyan/30">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="text-averna-cyan">Barcha guruhlar ({groups.length})</CardTitle>
              {groups.length > 1 && <SortControl options={GROUP_SORTS} />}
            </div>
            <p className="text-xs text-gray-400">
              Jami {totalRegistered + totalRoster} ta oʻquvchi — {totalRegistered} ta hisobli, {totalRoster} ta hisobsiz.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {sorted.length === 0 ? (
              <p className="text-gray-400 text-sm">Hozircha guruhlar yoʻq.</p>
            ) : (
              sorted.map((g) => (
                <GroupCard key={g.id} g={g} teachers={teacherOptions} />
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/** One group: settings, plus its full, collapsible roster (registered members
 *  and account-less roster students together). Server component. */
function GroupCard({
  g,
  teachers,
}: {
  g: GroupWithMembers;
  teachers: { id: string; user: { name: string | null } }[];
}) {
    const collator = new Intl.Collator("uz");
    const count = g.students.length + g.rosterMembers.length;

    // One merged, alphabetical member list — the truthful roster, with each row
    // marked as having an account or not.
    const members = [
      ...g.students.map((s) => ({
        key: `acc-${s.id}`,
        name: s.user.name ?? "Nomsiz",
        account: true as const,
        sub: `${s.user.email}${s.level ? ` · ${s.level}` : ""} · ${s.totalPoints} ball`,
        rosterId: null as string | null,
      })),
      ...g.rosterMembers.map((m) => ({
        key: `ros-${m.id}`,
        name: m.fullName,
        account: false as const,
        sub: [m.age ? `${m.age} yosh` : null, m.parentName ? `ota-ona: ${m.parentName}` : null, m.phone, m.note]
          .filter(Boolean)
          .join(" · "),
        rosterId: m.id,
      })),
    ].sort((a, b) => collator.compare(a.name, b.name));

    return (
      <div className="rounded-lg bg-white/5 border border-white/10">
        {/* Group settings */}
        <form action={updateGroup} className="p-3 space-y-2">
          <input type="hidden" name="id" value={g.id} />
          <div className="flex items-center justify-between gap-2">
            <p className="text-white font-medium truncate">{g.name}</p>
            <span className="text-xs text-gray-400 flex items-center gap-1 shrink-0"><Users className="h-3 w-3" /> {count}</span>
          </div>
          <div className="grid sm:grid-cols-3 gap-2">
            <select name="teacherId" defaultValue={g.teacherId} className="rounded-md border border-input bg-background/60 px-2 py-2 text-xs text-white">
              {teachers.map((t) => <option key={t.id} value={t.id} className="bg-averna-dark">{t.user.name}</option>)}
            </select>
            <select name="level" defaultValue={g.level ?? ""} className="rounded-md border border-input bg-background/60 px-2 py-2 text-xs text-white">
              <option value="" className="bg-averna-dark">— Daraja —</option>
              {LEVELS.map((l) => <option key={l} value={l} className="bg-averna-dark">{l}</option>)}
            </select>
            <Input name="schedule" defaultValue={g.schedule ?? ""} placeholder="Jadval" className="bg-background/50 h-9 text-xs" />
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button type="submit" size="sm" variant="outline" className="border-averna-cyan/40 text-averna-cyan">Oʻzgarishlarni saqlash</Button>
            <button formAction={duplicateGroup} className="text-xs px-3 py-1.5 rounded-md border border-averna-purple/40 text-averna-purple hover:bg-averna-purple/10">
              Nusxalash
            </button>
            <ConfirmButton
              formAction={deleteGroup}
              message={`"${g.name}" guruhini oʻchirasizmi? Uning uy vazifalari, davomat va dars yozuvlari olib tashlanadi, ${g.students.length} ta hisobli oʻquvchi biriktirilmagan holatga oʻtadi (oʻchirilmaydi), va ${g.rosterMembers.length} ta hisobsiz oʻquvchi roʻyxatdan oʻchiriladi. Buni qaytarib boʻlmaydi.`}
              title="Guruhni oʻchirish"
              className="ml-auto text-xs px-3 py-1.5 rounded-md border border-red-500/30 text-red-400 hover:bg-red-500/10"
            >
              <Trash2 className="h-3.5 w-3.5" /> Oʻchirish
            </ConfirmButton>
          </div>
        </form>

        {/* Full roster — collapsible so the page stays tidy with many groups */}
        <details className="group border-t border-white/10">
          <summary className="flex items-center justify-between gap-2 px-3 py-2 cursor-pointer list-none text-sm text-gray-300 hover:text-white select-none">
            <span className="inline-flex items-center gap-2">
              <Users className="h-4 w-4 text-averna-cyan" />
              Oʻquvchilar roʻyxati ({count})
            </span>
            <span className="text-[11px] text-gray-500 group-open:hidden">koʻrsatish ▾</span>
            <span className="text-[11px] text-gray-500 hidden group-open:inline">yashirish ▴</span>
          </summary>

          <div className="px-3 pb-3 space-y-3">
            {members.length === 0 ? (
              <p className="text-xs text-gray-500">Bu guruhda hali oʻquvchi yoʻq.</p>
            ) : (
              <ol className="space-y-1.5">
                {members.map((m, i) => (
                  <li
                    key={m.key}
                    className="flex items-center gap-2.5 rounded-md bg-averna-dark/40 border border-white/5 px-2.5 py-1.5"
                  >
                    <span className="w-5 shrink-0 text-right text-[11px] tabular-nums text-gray-500">{i + 1}.</span>
                    {m.account ? (
                      <UserRound className="h-3.5 w-3.5 shrink-0 text-averna-neon" />
                    ) : (
                      <UserRoundX className="h-3.5 w-3.5 shrink-0 text-amber-300" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-white truncate">{m.name}</p>
                      {m.sub && <p className="text-[11px] text-gray-500 truncate">{m.sub}</p>}
                    </div>
                    <span
                      className={
                        m.account
                          ? "shrink-0 text-[10px] px-1.5 py-0.5 rounded-full border border-averna-neon/40 bg-averna-neon/10 text-averna-neon"
                          : "shrink-0 text-[10px] px-1.5 py-0.5 rounded-full border border-amber-400/40 bg-amber-400/10 text-amber-300"
                      }
                    >
                      {m.account ? "hisob bor" : "hisobsiz"}
                    </span>
                    {m.rosterId && (
                      <form action={deleteRosterMember} className="shrink-0">
                        <input type="hidden" name="id" value={m.rosterId} />
                        <ConfirmButton
                          message={`"${m.name}"ni roʻyxatdan oʻchirasizmi?`}
                          title="Roʻyxatdan oʻchirish"
                          className="h-7 w-7 rounded-md border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </ConfirmButton>
                      </form>
                    )}
                  </li>
                ))}
              </ol>
            )}

            {/* Add an account-less student to this group's register */}
            <form
              action={addRosterMember}
              className="rounded-md border border-dashed border-white/15 bg-white/[0.02] p-2.5 space-y-2"
            >
              <input type="hidden" name="groupId" value={g.id} />
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-averna-cyan">
                <UserPlus className="h-3.5 w-3.5" /> Hisobsiz oʻquvchi qoʻshish
              </p>
              <div className="grid sm:grid-cols-4 gap-2">
                <Input name="fullName" placeholder="Toʻliq ism *" required className="bg-background/50 h-9 text-xs sm:col-span-2" />
                <Input name="age" type="number" min="1" max="119" placeholder="Yosh" className="bg-background/50 h-9 text-xs" />
                <Input name="phone" placeholder="Telefon" className="bg-background/50 h-9 text-xs" />
                <Input name="parentName" placeholder="Ota-ona ismi" className="bg-background/50 h-9 text-xs sm:col-span-2" />
                <Input name="note" placeholder="Izoh (ixtiyoriy)" className="bg-background/50 h-9 text-xs sm:col-span-2" />
              </div>
              <Button type="submit" size="sm" variant="outline" className="border-averna-cyan/40 text-averna-cyan">
                Roʻyxatga qoʻshish
              </Button>
            </form>
          </div>
        </details>
      </div>
    );
}
