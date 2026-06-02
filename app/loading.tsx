import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="min-h-screen premium-gradient flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="h-16 w-16 animate-spin text-averna-neon mx-auto mb-4" />
        <p className="text-white text-lg font-semibold">Loading...</p>
        <p className="text-gray-400 text-sm mt-2">Please wait</p>
      </div>
    </div>
  );
}
