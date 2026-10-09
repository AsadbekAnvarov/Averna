import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { ADMIN_NAV, TEACHER_NAV } from "@/components/layout/portal-navigation";
const source = (p:string) => readFileSync(p,"utf8");
describe("role-specific portal navigation", () => {
  const admin = ADMIN_NAV.flatMap(s=>s.items).map(i=>i.href);
  const teacher = TEACHER_NAV.flatMap(s=>s.items).map(i=>i.href);
  it("puts daily teaching and content preparation in teacher navigation", () => {expect(teacher).toEqual(expect.arrayContaining(["/teacher/reviews","/teacher/mock","/teacher/generate-tests","/teacher/listening-audio"]));expect(admin).not.toContain("/teacher/reviews");expect(admin).not.toContain("/admin/generate-tests");expect(admin).not.toContain("/admin/listening-audio");});
  it("keeps finances, admissions and reward administration in admin navigation", () => {expect(admin).toEqual(expect.arrayContaining(["/admin/finance","/admin/rewards","/admin/dashboard?tab=people"]));expect(teacher.some(h=>h.startsWith("/admin"))).toBe(false);});
  it("does not duplicate staff sidebar destinations", () => {expect(new Set(admin).size).toBe(admin.length);expect(new Set(teacher).size).toBe(teacher.length);});
  it("retains admin access to moved tools in the dashboard disclosure", () => {const s=source("app/admin/dashboard/page.tsx");for(const p of ["/teacher/reviews","/teacher/mock","/admin/content","/admin/generate-tests","/admin/listening-audio"])expect(s).toContain(p);expect(s).toContain("<AdminToolsDisclosure>");});
  it("stretches paired finance and dashboard panels without fixed heights", () => {expect(source("components/admin/finance/finance.css")).toContain("gap:24px;align-items:stretch}.finance-metrics");for(const p of ["app/admin/dashboard/page.tsx","app/teacher/dashboard/page.tsx"])expect(source(p)).toContain("gap-6 items-stretch [&>*]:h-full");});
  it("keeps global audio deletion admin-only while preparation uses teacher/admin auth", () => {for(const p of ["app/api/admin/listening-audio/route.ts","app/api/admin/listening-audio/render/route.ts"])expect(source(p)).toContain("requireTeacherOrAdmin");expect(source("app/api/admin/listening-audio/delete/route.ts")).toContain("await requireAdmin()");expect(source("app/admin/listening-audio/page.tsx")).toContain('canDelete={session.user.role === "ADMIN"}');});
});
