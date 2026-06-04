"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Loader2, QrCode } from "lucide-react";

function CheckInInner() {
  const params = useSearchParams();
  const code = params.get("code");
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [message, setMessage] = useState("");

  const submit = async () => {
    if (!code) return;
    setStatus("loading");
    try {
      const res = await fetch("/api/attendance/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (res.ok) { setStatus("ok"); setMessage(data.message ?? "Checked in!"); }
      else { setStatus("error"); setMessage(data.error ?? "Could not check in."); }
    } catch {
      setStatus("error"); setMessage("Connection error.");
    }
  };

  useEffect(() => {
    if (code) submit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  return (
    <div className="min-h-screen premium-gradient flex items-center justify-center px-4">
      <Card className="glass border-averna-neon/30 max-w-md w-full">
        <CardContent className="py-10 text-center space-y-4">
          <QrCode className="h-12 w-12 text-averna-cyan mx-auto" />
          <h1 className="text-2xl font-bold text-white">Class Check-In</h1>

          {!code && <p className="text-gray-400">No check-in code found. Please scan the QR shown by your teacher.</p>}
          {status === "loading" && <Loader2 className="h-8 w-8 animate-spin text-averna-neon mx-auto" />}
          {status === "ok" && (
            <div className="space-y-2">
              <CheckCircle2 className="h-12 w-12 text-averna-neon mx-auto" />
              <p className="text-averna-neon font-semibold">{message}</p>
            </div>
          )}
          {status === "error" && (
            <div className="space-y-3">
              <XCircle className="h-12 w-12 text-red-400 mx-auto" />
              <p className="text-red-300">{message}</p>
              <Button onClick={submit} variant="outline" className="border-averna-cyan text-averna-cyan">Try again</Button>
            </div>
          )}

          <Link href="/dashboard" className="block">
            <Button className="neon-button bg-averna-primary hover:bg-averna-light w-full">Go to Dashboard</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

export default function CheckInPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen premium-gradient flex items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-averna-neon" />
        </div>
      }
    >
      <CheckInInner />
    </Suspense>
  );
}
