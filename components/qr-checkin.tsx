"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QrCode } from "lucide-react";

/**
 * Shows a QR code that students scan to self-check-in for today's lesson.
 * The QR encodes <origin>/checkin?code=<groupId>|<YYYY-MM-DD>.
 * Uses a public QR image service (no extra dependency).
 */
export function QrCheckin({ groupId, groupName }: { groupId: string; groupName: string }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const today = new Date().toISOString().slice(0, 10);
    const code = `${groupId}|${today}`;
    const link = `${window.location.origin}/checkin?code=${encodeURIComponent(code)}`;
    setUrl(link);
  }, [groupId]);

  const qrSrc = url
    ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(url)}`
    : "";

  return (
    <Card className="glass border-averna-cyan/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-averna-cyan">
          <QrCode className="h-5 w-5" /> QR Check-In — {groupName}
        </CardTitle>
      </CardHeader>
      <CardContent className="text-center">
        {!open ? (
          <Button onClick={() => setOpen(true)} className="neon-button bg-averna-primary hover:bg-averna-light">
            <QrCode className="mr-2 h-4 w-4" /> Show today&apos;s QR
          </Button>
        ) : (
          <div className="space-y-3">
            {qrSrc && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrSrc} alt="Check-in QR" className="mx-auto rounded-lg bg-white p-2" width={240} height={240} />
            )}
            <p className="text-xs text-gray-400">
              Students scan this to mark themselves present today. Valid for {new Date().toLocaleDateString("en-GB")} only.
            </p>
            <Button onClick={() => setOpen(false)} variant="outline" size="sm" className="border-white/20">Hide</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
