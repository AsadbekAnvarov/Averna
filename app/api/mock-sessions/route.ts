import { groupRequest } from "@/lib/group-mock/api";
export const dynamic="force-dynamic";
export const maxDuration=60;
export const GET=(r:Request)=>groupRequest(r);
export const POST=(r:Request)=>groupRequest(r);
