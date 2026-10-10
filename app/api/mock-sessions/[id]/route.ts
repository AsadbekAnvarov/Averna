import { groupRequest } from "@/lib/group-mock/api";
export const dynamic="force-dynamic";
export const maxDuration=60;
type Props={params:Promise<{id:string}>};
export const GET=async(r:Request,p:Props)=>groupRequest(r,(await p.params).id);
export const POST=async(r:Request,p:Props)=>groupRequest(r,(await p.params).id);
export const PUT=async(r:Request,p:Props)=>groupRequest(r,(await p.params).id);
