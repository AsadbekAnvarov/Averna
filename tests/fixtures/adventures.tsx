/** Synthetic content only. Bundled exclusively by the isolated Adventures QA script. */
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { Compass } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { AdventuresEntry } from "@/components/dashboard/adventures-entry";
import { AdventureHub } from "@/components/adventures/adventure-hub";
import { Series, Detective, Debate, Rescue } from "@/components/adventures/guided-tools";
import { QuestionWorkshop } from "@/components/adventures/question-workshop";
import { VoiceCapsules } from "@/components/adventures/voice-capsules";
import { TeacherWorkshops } from "@/components/adventures/teacher-workshops";
import { adventure } from "@/lib/adventures/catalog";
import { listCapsules, saveCapsule } from "@/lib/adventures/capsule-store";
import "@/components/adventures/adventures.css";
const q = new URLSearchParams(location.search); const mode = q.get("mode") || "hub";
const payload = { title: "A library for everyone", passage: "The library opens at nine and closes at five every weekday. Separate rooms are available for adults and children. The reading club meets on Fridays.", questions: [{ prompt: "When does the library open?", options: ["At seven", "At eight", "At nine", "At ten"], answer: 2, explanation: "The passage states that it opens at nine." }], rightsConfirmed: true as const };
let item = { id: "synthetic-workshop", title: payload.title, payload, status: "SUBMITTED", version: 1, feedback: null as string | null, createdAt: "2026-10-10T10:00:00.000Z", authorName: "Synthetic learner", groupName: "Synthetic class" }; let exists = true;
const mutations: unknown[] = [];
window.fetch = async (input, init) => { if (!String(input).includes("/api/adventures/workshop")) throw new Error("Unexpected network request"); if (q.get("state") === "offline") throw new Error("Synthetic offline state"); const method = init?.method || "GET"; if (method !== "GET") mutations.push({ method, body: JSON.parse(String(init?.body)) }); if (method === "PATCH") { const review = JSON.parse(String(init?.body)); if (review.version !== item.version) return Response.json({ error: "Review changed. Reload first." }, { status: 409 }); item = { ...item, status: review.decision, feedback: review.feedback, version: item.version + 1 }; } if (method === "DELETE") exists = false; if (method === "POST") return Response.json({ item }); if (method !== "GET") return Response.json({ item, ok: true }); const isClass = String(input).includes("mode=class"); return Response.json({ items: exists && (!isClass || item.status === "APPROVED") ? [item] : [], more: false }); };
Object.assign(window, { __mutations: mutations, __audioStore: { listCapsules, saveCapsule }, __qaPayload: payload });
function App() { const [owner, setOwner] = useState("synthetic-alice"); Object.assign(window, { __setOwner: setOwner }); const tool = adventure(mode); return <main className="min-h-screen premium-gradient"><div className="container mx-auto max-w-4xl px-4 py-6 pb-10 sm:py-8"><PageHeader className="adventure-header" icon={Compass} title={mode === "hub" ? "Adventures" : mode === "entry" ? "Today" : mode === "teacher" ? "Student Workshops" : tool!.title} subtitle={mode === "hub" ? "Make English something you do." : tool?.description} back={{ href: "/studio/adventures", label: "All adventures" }} /><div className="adventure-space">{mode === "entry" && <AdventuresEntry />}{mode === "hub" && <AdventureHub />}{mode === "series" && <Series owner={owner} />}{mode === "detective" && <Detective owner={owner} />}{mode === "debate" && <Debate owner={owner} />}{mode === "rescue" && <Rescue owner={owner} />}{mode === "builder" && <QuestionWorkshop owner={owner} sharing={q.get("sharing") === "on"} />}{mode === "capsules" && <VoiceCapsules owner={owner} />}{mode === "teacher" && <TeacherWorkshops owner={owner} enabled={q.get("sharing") === "on"} />}</div></div></main>; }
createRoot(document.getElementById("root")!).render(<App />);
