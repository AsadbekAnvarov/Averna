import Link from "next/link";
import { ArrowRight, Compass } from "lucide-react";
import "@/components/adventures/adventures.css";

/** A visible Today entry; no extra dashboard tab, data read or client-side state. */
export function AdventuresEntry() {
  return (
    <section className="adventure-space" aria-labelledby="dashboard-adventures-title">
      <div className="adv-card">
        <p className="adv-kicker"><Compass size={20} aria-hidden="true" /> Six ways to practise English</p>
        <h2 id="dashboard-adventures-title">Adventures</h2>
        <p className="adv-muted">Stories, mysteries, debates and real voice recordings. Choose a short adventure and make English something you do.</p>
        <Link href="/studio/adventures" className="adv-button adv-primary">Explore Adventures <ArrowRight size={18} aria-hidden="true" /></Link>
      </div>
    </section>
  );
}
