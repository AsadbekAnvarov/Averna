import Link from "next/link";
import { UserPlus,Wallet,Layers,MessageSquare } from "lucide-react";
import type { ReactNode } from "react";
export function AdminQuickActions(){
 return <div className="glass rounded-2xl p-4 sm:p-6">
                  <h2 className="text-lg font-semibold text-white">Tezkor amallar</h2>
                  <p className="text-sm text-gray-400 mt-1">Qabul, toʻlov va guruhlar — eng koʻp ishlatiladigan amallar.</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                    {[
                      {href:"/admin/dashboard?tab=people#enroll",label:"Oʻquvchini qabul qilish",icon:UserPlus},
                      {href:"/admin/dashboard?tab=finance",label:"Toʻlov va qarzlar",icon:Wallet},
                      {href:"/admin/groups",label:"Guruhlar",icon:Layers},
                      {href:"/messages",label:"Xabarlar",icon:MessageSquare},
                    ].map(action=><Link key={action.href} href={action.href} className="flex items-center gap-2 min-h-11 rounded-xl border border-averna-neon/20 bg-averna-neon/5 px-3 py-3 text-sm font-medium text-white hover:bg-averna-neon/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-averna-neon"><action.icon className="h-5 w-5 shrink-0 text-averna-neon"/>{action.label}</Link>)}
                  </div>
                </div>;
}
export function AdminToolsDisclosure({children}:{children:ReactNode}){
 return <details className="glass rounded-2xl p-4 sm:p-6">
  <summary className="cursor-pointer min-h-11 text-lg font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-averna-purple">Qoʻshimcha boshqaruv vositalari</summary>
  <p className="text-sm text-gray-400 mt-2 mb-5">Kontent, xabarlar va tizim vositalari. Kundalik amallar uchun yuqoridagi asosiy boʻlimlardan foydalaning.</p>
  {children}
 </details>;
}
