import { getCalibration, mutateCalibration } from "@/lib/teacher-tools/calibration";
import { calibrationEnabled } from "@/lib/teacher-tools/rules";
import { toolActor, toolCommand, toolFailure, toolJson } from "@/lib/teacher-tools/http";
export const dynamic = "force-dynamic";
export async function GET(req: Request) { if (!calibrationEnabled()) return toolJson({ error: "Calibration practice is not enabled." }, 404); try { const params = new URL(req.url).searchParams; return toolJson({ view: await getCalibration(await toolActor(), params.get("reference") ?? undefined, Number(params.get("page") ?? 1)) }); } catch (e) { return toolFailure(e); } }
export async function POST(req: Request) { if (!calibrationEnabled()) return toolJson({ error: "Calibration practice is not enabled." }, 404); try { const actor = await toolActor(); const id = await mutateCalibration(actor, await toolCommand(req, "calibration-write", actor.id)); return toolJson({ view: await getCalibration(actor, id) }); } catch (e) { return toolFailure(e); } }
