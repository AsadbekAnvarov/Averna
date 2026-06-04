"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft, Award } from "lucide-react";
import { Logo } from "@/components/logo";

interface Props {
  name: string;
  level: string;
  points: number;
  achievements: number;
  teacher: string;
  groupName: string;
  issued: string;
}

export function CertificateView({ name, level, points, achievements, teacher, groupName, issued }: Props) {
  return (
    <div className="min-h-screen premium-gradient py-8 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Controls (hidden when printing) */}
        <div className="flex items-center justify-between mb-6 print:hidden">
          <Link href="/dashboard" className="text-averna-neon hover:underline text-sm flex items-center gap-1">
            <ArrowLeft className="h-4 w-4" /> Back to Dashboard
          </Link>
          <Button onClick={() => window.print()} className="neon-button bg-averna-primary hover:bg-averna-light">
            <Printer className="mr-2 h-4 w-4" /> Print / Save as PDF
          </Button>
        </div>

        {/* Certificate */}
        <div className="certificate bg-white text-slate-800 rounded-xl p-10 shadow-2xl border-[6px] border-double border-averna-primary relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none opacity-5 flex items-center justify-center">
            <Award className="h-[420px] w-[420px]" />
          </div>
          <div className="relative text-center">
            <div className="flex justify-center mb-3">
              <Logo size={56} showText={false} />
            </div>
            <p className="tracking-[0.3em] text-averna-primary font-semibold text-sm">AVERNA LEARNING CENTRE</p>
            <h1 className="text-3xl font-bold mt-4 mb-1">Certificate of Achievement</h1>
            <p className="text-slate-500 text-sm mb-6">This certificate is proudly presented to</p>

            <p className="text-4xl font-bold text-averna-primary mb-2" style={{ fontFamily: "Georgia, serif" }}>{name}</p>
            <p className="text-slate-600 max-w-lg mx-auto mb-6">
              for outstanding dedication and progress in IELTS preparation at {groupName}.
            </p>

            <div className="grid grid-cols-3 gap-4 max-w-md mx-auto mb-8">
              <Stat label="Level" value={level.split("·")[0].trim()} />
              <Stat label="Points" value={String(points)} />
              <Stat label="Badges" value={String(achievements)} />
            </div>

            <div className="flex items-end justify-between mt-10 pt-6">
              <div className="text-center">
                <p className="font-semibold border-t border-slate-300 pt-1 px-6">{teacher}</p>
                <p className="text-xs text-slate-500">Teacher</p>
              </div>
              <div className="text-averna-primary">
                <Award className="h-12 w-12 mx-auto" />
                <p className="text-[10px] text-slate-500 mt-1">Official Seal</p>
              </div>
              <div className="text-center">
                <p className="font-semibold border-t border-slate-300 pt-1 px-6">{issued}</p>
                <p className="text-xs text-slate-500">Date issued</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          body { background: white !important; }
          .premium-gradient { background: white !important; }
          @page { size: landscape; margin: 1cm; }
        }
      `}</style>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-averna-primary/10 border border-averna-primary/20 py-3">
      <p className="text-xl font-bold text-averna-primary">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}
