"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { FlaskConical, Loader2, AlertTriangle, HelpCircle, Bug, Lightbulb, ListChecks, Clock, LifeBuoy } from "lucide-react";

interface GroupBrief {
  id: string;
  name: string;
  level: string | null;
  size: number;
  avgBand: number | null;
  weakModule: string | null;
}
interface Simulation {
  difficultConcepts: string[];
  likelyQuestions: string[];
  commonMistakes: string[];
  examples: string[];
  exercises: string[];
  timing: string;
  backups: string[];
}

/**
 * F9 — Future Class Simulator. Before tomorrow's offline lesson, pick the class
 * and topic and the AI predicts the likely difficult concepts, student
 * questions, common mistakes, examples, exercises, timing and backup activities
 * — grounded in the group's real level and weakest skill. GPT-4o + fallback.
 */
export function FutureClassSimulator({ groups }: { groups: GroupBrief[] }) {
  const [groupId, setGroupId] = useState(groups[0]?.id ?? "");
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);
  const [sim, setSim] = useState<Simulation | null>(null);

  const run = async () => {
    if (topic.trim().length < 2) {
      toast.error("Enter tomorrow's topic.");
      return;
    }
    setLoading(true);
    setSim(null);
    try {
      const res = await fetch("/api/teacher/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, groupId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setSim(data as Simulation);
    } catch (e: any) {
      toast.error(e.message || "Couldn't run the simulation.");
    } finally {
      setLoading(false);
    }
  };

  const group = groups.find((g) => g.id === groupId);
  const block = (icon: any, title: string, items: string[], color: string) => {
    const Icon = icon;
    return (
      <div>
        <p className={`text-[11px] uppercase tracking-wider mb-1 flex items-center gap-1 ${color}`}>
          <Icon className="h-3.5 w-3.5" /> {title}
        </p>
        <ul className="space-y-1">{items.map((x, i) => <li key={i} className="text-sm text-gray-300">• {x}</li>)}</ul>
      </div>
    );
  };

  return (
    <Card className="glass border-averna-pink/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-averna-pink">
          <FlaskConical className="h-5 w-5" /> Future Class Simulator
        </CardTitle>
        <p className="text-xs text-gray-400">Preview tomorrow's lesson before it happens</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {groups.length === 0 ? (
          <p className="text-sm text-gray-400 py-3">Assign a group to simulate its next lesson.</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-1.5">
              {groups.map((g) => (
                <button
                  key={g.id}
                  onClick={() => setGroupId(g.id)}
                  className={`px-2.5 py-1 rounded-full text-xs border transition ${
                    groupId === g.id ? "border-averna-pink/60 bg-averna-pink/20 text-averna-pink" : "border-white/10 bg-white/5 text-gray-400 hover:text-white"
                  }`}
                >
                  {g.name}
                </button>
              ))}
            </div>
            {group && (
              <p className="text-[11px] text-gray-500">
                {group.size} students{group.level ? ` · ${group.level}` : ""}{group.avgBand != null ? ` · avg Band ${group.avgBand}` : ""}{group.weakModule ? ` · weakest: ${group.weakModule}` : ""}
              </p>
            )}
            <div className="flex gap-2">
              <Input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && run()}
                placeholder="Tomorrow's topic — e.g. Conditionals"
                className="bg-background/50"
              />
              <Button onClick={run} disabled={loading} className="neon-button bg-averna-pink hover:bg-averna-pink/80 text-white shrink-0">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}
              </Button>
            </div>

            {sim && (
              <div className="space-y-3 pt-1">
                {block(AlertTriangle, "Likely difficult concepts", sim.difficultConcepts, "text-amber-300")}
                {block(HelpCircle, "Questions students may ask", sim.likelyQuestions, "text-averna-cyan")}
                {block(Bug, "Common mistakes", sim.commonMistakes, "text-red-300")}
                {block(Lightbulb, "Recommended examples", sim.examples, "text-averna-neon")}
                {block(ListChecks, "Suggested exercises", sim.exercises, "text-averna-purple")}
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-gray-400 mb-1 flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> Timing</p>
                  <p className="text-sm text-gray-300">{sim.timing}</p>
                </div>
                {block(LifeBuoy, "If they finish early", sim.backups, "text-averna-cyan")}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
