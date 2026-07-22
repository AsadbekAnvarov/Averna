export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Library, Plus, BookText } from "lucide-react";
import { AccountNotice } from "@/components/account-notice";
import { AdminHeader } from "@/components/admin/admin-header";
import { PageHeader } from "@/components/ui/page-header";

const MODULES = ["WRITING", "READING", "LISTENING", "SPEAKING", "VOCABULARY", "GENERAL"];
const LEVELS = ["All", "Beginner", "Intermediate", "Advanced"];

async function addMaterial(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/auth/signin");

  const title = (formData.get("title") as string)?.trim();
  const module = (formData.get("module") as string) || "GENERAL";
  const level = (formData.get("level") as string) || "All";
  const description = (formData.get("description") as string)?.trim();
  const url = (formData.get("url") as string)?.trim();
  if (!title) return;

  await db.studyMaterial.create({
    data: { title, module, level, description: description || null, url: url || null },
  });
  revalidatePath("/admin/content");
  redirect("/admin/content?saved=material");
}

export default async function AdminContentPage({ searchParams }: { searchParams: { saved?: string } }) {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  if (session.user.role !== "ADMIN") {
    return <AccountNotice title="Faqat adminlar uchun" message="Bu boʻlim faqat administratorlar uchun." />;
  }

  const materials = await db.studyMaterial.findMany({ orderBy: { createdAt: "desc" }, take: 50 });

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <AdminHeader user={{ name: session.user.name ?? "Admin", email: session.user.email ?? "" }} />
        <PageHeader
          back={{ href: "/admin/dashboard", label: "Admin paneliga qaytish" }}
          icon={Library}
          iconClassName="text-averna-cyan"
          title={<>Kontentni <span className="neon-text-cyan">boshqarish</span></>}
          subtitle="Materiallar boʻlimida oʻquvchilarga koʻrsatiladigan oʻquv materiallarini qoʻshing."
        />

        {searchParams.saved && <div className="mb-6 p-3 rounded-lg bg-averna-neon/10 border border-averna-neon/30 text-averna-neon">✓ Material qoʻshildi!</div>}

        {/* Add material */}
        <Card className="glass border-averna-cyan/30 mb-8">
          <CardHeader><CardTitle className="flex items-center gap-2 text-averna-cyan"><Plus className="h-5 w-5" /> Oʻquv materiali qoʻshish</CardTitle></CardHeader>
          <CardContent>
            <form action={addMaterial} className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="title">Sarlavha</Label>
                <Input id="title" name="title" placeholder="masalan, Writing Task 2: Bogʻlovchi iboralar" className="bg-background/50" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="module">Modul</Label>
                <select id="module" name="module" className="w-full rounded-md border border-input bg-background/60 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-averna-cyan">
                  {MODULES.map((m) => <option key={m} value={m} className="bg-averna-dark">{m}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="level">Daraja</Label>
                <select id="level" name="level" className="w-full rounded-md border border-input bg-background/60 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-averna-purple">
                  {LEVELS.map((l) => <option key={l} value={l} className="bg-averna-dark">{l}</option>)}
                </select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="description">Tavsif</Label>
                <Input id="description" name="description" placeholder="Qisqa tavsif" className="bg-background/50" />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="url">Havola (ixtiyoriy)</Label>
                <Input id="url" name="url" placeholder="https://..." className="bg-background/50" />
              </div>
              <div className="sm:col-span-2">
                <Button type="submit" className="w-full neon-button bg-averna-primary hover:bg-averna-light">Materialni eʼlon qilish</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* List */}
        <Card className="glass border-averna-purple/30">
          <CardHeader><CardTitle className="flex items-center gap-2 text-averna-purple"><BookText className="h-5 w-5" /> Eʼlon qilingan materiallar ({materials.length})</CardTitle></CardHeader>
          <CardContent>
            {materials.length === 0 ? (
              <p className="text-gray-400 text-sm">Hozircha materiallar yoʻq.</p>
            ) : (
              <div className="space-y-2">
                {materials.map((m) => (
                  <div key={m.id} className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-white/5 border border-white/10">
                    <div className="min-w-0">
                      <p className="text-white text-sm truncate">{m.title}</p>
                      {m.description && <p className="text-xs text-gray-400 truncate">{m.description}</p>}
                    </div>
                    <div className="flex gap-1 shrink-0 text-[10px]">
                      <span className="px-2 py-0.5 rounded-full bg-averna-cyan/15 text-averna-cyan border border-averna-cyan/30">{m.module}</span>
                      <span className="px-2 py-0.5 rounded-full bg-white/5 text-gray-400 border border-white/10">{m.level}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
