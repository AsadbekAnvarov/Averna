import { getDailySessionData } from "@/lib/session/load";
import { getDaypart, tashkentHour } from "@/lib/utils";
import { ErrorPanel } from "@/components/progression/error-panel";
import { TodaySession } from "./today-session";

/** Server half of the Today hero: loads the session facts, then hands them to the client card. */
export async function TodaySessionHero({ studentId }: { studentId: string }) {
  const data = await getDailySessionData(studentId).catch((e) => {
    console.error("getDailySessionData failed:", e);
    return null;
  });
  if (!data) {
    return (
      <ErrorPanel
        title="We couldn't load today's session."
        detail="Your progress is safe — this is only a display problem."
        retryHref="/dashboard"
      />
    );
  }
  return (
    <TodaySession
      facts={data.facts}
      firstName={data.person.firstName}
      streak={data.person.streak}
      greeting={getDaypart(tashkentHour()).greeting}
    />
  );
}

/** Same footprint as the hero while it loads, so the page doesn't jump. */
export function TodaySessionSkeleton() {
  return (
    <div aria-hidden className="av-panel h-full min-h-[22rem] animate-pulse rounded-3xl p-4 sm:p-6">
      <div className="h-4 w-40 rounded bg-white/10" />
      <div className="mt-3 h-6 w-56 rounded bg-white/10" />
      <div className="mt-5 h-11 w-52 rounded-xl bg-white/5" />
      <div className="mt-4 space-y-2">
        <div className="h-12 rounded-2xl bg-white/5" />
        <div className="h-12 rounded-2xl bg-white/5" />
        <div className="h-12 rounded-2xl bg-white/5" />
      </div>
    </div>
  );
}
