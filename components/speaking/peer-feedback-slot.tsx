import { MessageSquareHeart } from "lucide-react";

/**
 * Where peer feedback (1–5 ratings, a strength and a tip) goes after a session.
 * Placeholder until Phase C (docs/peer-speaking.md, "Notes for Phase C").
 */
export function PeerFeedbackSlot({ roomId, partnerName }: { roomId: string; partnerName: string }) {
  return (
    <div data-room={roomId} className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-gray-300">
      <p className="flex items-center gap-2 font-medium text-white">
        <MessageSquareHeart className="h-4 w-4 text-averna-pink" aria-hidden /> Feedback for {partnerName}
      </p>
      <p className="mt-1">Feedback coming soon.</p>
    </div>
  );
}
