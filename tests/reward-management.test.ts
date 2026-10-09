import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ auth: vi.fn(), updateMany: vi.fn(), update: vi.fn(), audit: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireAdmin: m.auth }));
vi.mock("@/lib/db", () => ({ db: { reward: { updateMany: m.updateMany, update: m.update } } }));
vi.mock("@/lib/audit", () => ({ recordAudit: m.audit }));
vi.mock("next/cache", () => ({ revalidatePath: m.revalidate }));
import { setRewardAvailability, updateReward } from "@/lib/admin/reward-actions";
import { MAX_LEVEL } from "@/lib/engine/progression/levels";
const form = (values: Record<string, string>) => { const f = new FormData(); Object.entries(values).forEach(([k,v]) => f.set(k,v)); return f; };
describe("admin reward management", () => {
  beforeEach(() => { vi.resetAllMocks(); m.auth.mockResolvedValue({id:"a",role:"ADMIN"}); m.updateMany.mockResolvedValue({count:1}); });
  it.each(["Unauthorized", "Forbidden: Insufficient permissions"])("does not mutate for %s", async error => {
    m.auth.mockRejectedValue(new Error(error)); await expect(setRewardAvailability(form({id:"r",action:"remove"}))).rejects.toThrow(error); expect(m.updateMany).not.toHaveBeenCalled();
  });
  it("removes only availability, retaining requests and spent-point history", async () => {
    await setRewardAvailability(form({id:"r",action:"remove"}));
    expect(m.updateMany).toHaveBeenCalledWith({where:{id:"r",active:true},data:{active:false}});
    expect(m.audit).toHaveBeenCalledTimes(1); expect(m.revalidate.mock.calls).toEqual([["/admin/rewards"],["/rewards"]]);
  });
  it("restores a removed reward", async () => { await setRewardAvailability(form({id:"r",action:"restore"})); expect(m.updateMany).toHaveBeenCalledWith({where:{id:"r",active:false},data:{active:true}}); });
  it("repeated removal is a safe no-op, without duplicate audit", async () => {m.updateMany.mockResolvedValue({count:0}); await setRewardAvailability(form({id:"r",action:"remove"}));expect(m.audit).not.toHaveBeenCalled();});
  it.each([{id:"",action:"remove"},{id:"r",action:"invalid"}])("rejects invalid availability input %j", async value => { await expect(setRewardAvailability(form(value))).rejects.toThrow(); expect(m.updateMany).not.toHaveBeenCalled(); });
  it("edits catalog fields only, not redemption cost snapshots", async () => { await updateReward(form({id:"r",name:" Edited ",cost:"120",minLevel:String(MAX_LEVEL),icon:"🎁",description:" Details "}));expect(m.update).toHaveBeenCalledWith({where:{id:"r"},data:{name:"Edited",cost:120,minLevel:MAX_LEVEL,icon:"🎁",description:"Details"}}); });
  it.each(["0","1.5","Infinity","2147483648"])("rejects unsafe cost %s", async cost => {await expect(updateReward(form({id:"r",name:"Gift",cost,minLevel:"1"}))).rejects.toThrow();expect(m.update).not.toHaveBeenCalled();});
  it("uses the real progression cap", async () => {await expect(updateReward(form({id:"r",name:"Gift",cost:"1",minLevel:String(MAX_LEVEL+1)}))).rejects.toThrow();expect(m.update).not.toHaveBeenCalled();});
});
