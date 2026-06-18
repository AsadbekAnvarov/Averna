/**
 * Soft, blurred colour orbs floating behind the dashboard for depth and a
 * premium feel. Purely decorative and click-through.
 */
export function AmbientBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      <div
        className="ambient-orb animate-float"
        style={{ top: "-5rem", left: "-4rem", width: "20rem", height: "20rem", background: "rgba(0,229,255,0.18)" }}
      />
      <div
        className="ambient-orb animate-float"
        style={{ top: "25%", right: "-6rem", width: "22rem", height: "22rem", background: "rgba(177,78,255,0.16)", animationDelay: "-2.5s" }}
      />
      <div
        className="ambient-orb animate-float"
        style={{ bottom: "-7rem", left: "35%", width: "24rem", height: "24rem", background: "rgba(255,61,187,0.12)", animationDelay: "-5s" }}
      />
    </div>
  );
}
