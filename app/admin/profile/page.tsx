export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, Save, Mail, ShieldCheck } from "lucide-react";
import { AccountNotice } from "@/components/account-notice";
import { AdminHeader } from "@/components/admin/admin-header";
import { AvatarEditor } from "@/components/avatar-editor";

async function updateAdminProfile(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/auth/signin");
  const name = (formData.get("name") as string)?.trim();
  if (name) {
    await db.user.update({ where: { id: session.user.id }, data: { name } });
  }
  revalidatePath("/admin/profile");
  redirect("/admin/profile?saved=1");
}

export default async function AdminProfilePage({ searchParams }: { searchParams: { saved?: string } }) {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  if (session.user.role !== "ADMIN") {
    return <AccountNotice title="Admins only" message="This area is reserved for administrators." />;
  }

  const dbUser = await db.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true, image: true },
  });
  if (!dbUser) {
    return <AccountNotice title="Account not found" message="Please sign in again." />;
  }

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <AdminHeader user={{ name: dbUser.name ?? "Admin", email: dbUser.email, image: dbUser.image }} />

        <h1 className="text-4xl font-bold text-white mb-8 flex items-center gap-3">
          <ShieldCheck className="h-10 w-10 text-averna-purple" />
          Admin Profile
        </h1>

        {searchParams.saved && (
          <div className="mb-6 p-3 rounded-lg bg-averna-neon/10 border border-averna-neon/30 text-averna-neon">✓ Profile saved!</div>
        )}

        {/* Avatar editor */}
        <div className="mb-8">
          <AvatarEditor currentImage={dbUser.image ?? null} name={dbUser.name ?? "Admin"} />
        </div>

        {/* Basic info */}
        <Card className="glass border-averna-cyan/30">
          <CardHeader>
            <CardTitle>Account Details</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={updateAdminProfile} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name" className="flex items-center gap-2">
                  <User className="h-4 w-4" /> Full Name
                </Label>
                <Input id="name" name="name" defaultValue={dbUser.name ?? ""} placeholder="Your name" className="bg-background/50" />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Mail className="h-4 w-4" /> Email (read-only)
                </Label>
                <Input value={dbUser.email} disabled className="bg-background/50 opacity-75" />
              </div>
              <div className="pt-4 border-t border-averna-primary/20">
                <Button type="submit" className="neon-button bg-averna-primary hover:bg-averna-light">
                  <Save className="mr-2 h-4 w-4" /> Save Changes
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
