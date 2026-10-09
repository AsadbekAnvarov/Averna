import { getClassroom, mutateClassroom } from "@/lib/teacher-tools/classroom";
import { classroomEnabled, object } from "@/lib/teacher-tools/rules";
import { toolActor, toolCommand, toolFailure, toolJson } from "@/lib/teacher-tools/http";
export const dynamic = "force-dynamic";
export async function GET(req: Request) { if (!classroomEnabled()) return toolJson({ error: "Live classroom is not enabled." }, 404); try { return toolJson({ view: await getClassroom(await toolActor(), new URL(req.url).searchParams.get("group") ?? "") }); } catch (e) { return toolFailure(e); } }
export async function POST(req: Request) { if (!classroomEnabled()) return toolJson({ error: "Live classroom is not enabled." }, 404); try { const actor = await toolActor(); const command = object(await toolCommand(req, "classroom-write", actor.id)); await mutateClassroom(actor, command); return toolJson({ view: await getClassroom(actor, String(command.groupId)) }); } catch (e) { return toolFailure(e); } }
