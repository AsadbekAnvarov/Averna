"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save, ArrowLeft, Sparkles, BookmarkPlus, Files } from "lucide-react";
import Link from "next/link";
import { toast } from "@/components/ui/toast";

interface Template {
  id: string;
  title: string;
  description: string;
  module: string;
  points: number;
}

export default function CreateHomeworkPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [aiTopic, setAiTopic] = useState("");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [savingTpl, setSavingTpl] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    module: "WRITING",
    difficulty: 2,
    points: 50,
    dueDate: "",
  });

  useEffect(() => {
    fetch("/api/teacher/homework/templates")
      .then((r) => r.json())
      .then((d) => setTemplates(d.templates ?? []))
      .catch(() => {});
  }, []);

  const applyTemplate = (id: string) => {
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    setFormData((f) => ({ ...f, title: t.title, description: t.description, module: t.module, points: t.points }));
  };

  const saveTemplate = async () => {
    if (!formData.title || !formData.description) {
      toast.error("Add a title and description first.");
      return;
    }
    setSavingTpl(true);
    try {
      const res = await fetch("/api/teacher/homework/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: formData.title, description: formData.description, module: formData.module, points: formData.points }),
      });
      const data = await res.json();
      if (data.template) setTemplates((prev) => [data.template, ...prev]);
    } finally {
      setSavingTpl(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/teacher/homework/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ module: formData.module, level: "Intermediate", topic: aiTopic }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setFormData((f) => ({ ...f, title: data.title, description: data.description }));
    } catch {
      toast.error("Could not generate homework. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch("/api/teacher/homework/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error("Failed to create homework");

      toast.success("Homework created successfully!");
      router.push("/teacher/homework");
    } catch (error) {
      toast.error("Failed to create homework. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Link href="/teacher/homework" className="text-averna-neon hover:underline text-sm mb-4 block">
          <ArrowLeft className="h-4 w-4 inline mr-1" />
          Back to Homework
        </Link>

        <h1 className="text-4xl font-bold text-white mb-8">Create New Homework</h1>

        <Card className="glass border-purple-500/30">
          <CardHeader>
            <CardTitle>Homework Details</CardTitle>
          </CardHeader>
          <CardContent>
            {/* AI generator */}
            <div className="mb-6 p-4 rounded-lg bg-averna-purple/10 border border-averna-purple/30">
              <p className="text-sm text-averna-purple font-semibold flex items-center gap-2 mb-2">
                <Sparkles className="h-4 w-4" /> AI Homework Generator
              </p>
              <p className="text-xs text-gray-400 mb-3">
                Pick a module above, optionally add a topic, and let AI draft the task for you. You can edit it after.
              </p>
              <div className="flex gap-2">
                <Input
                  value={aiTopic}
                  onChange={(e) => setAiTopic(e.target.value)}
                  placeholder="Optional topic, e.g. 'the environment'"
                  className="bg-background/50"
                />
                <Button
                  type="button"
                  onClick={handleGenerate}
                  disabled={generating}
                  className="neon-button bg-averna-purple/80 hover:bg-averna-purple shrink-0"
                >
                  {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  <span className="ml-1 hidden sm:inline">Generate</span>
                </Button>
              </div>
            </div>

            {/* Templates */}
            <div className="mb-6 p-4 rounded-lg bg-averna-cyan/10 border border-averna-cyan/30">
              <p className="text-sm text-averna-cyan font-semibold flex items-center gap-2 mb-2">
                <Files className="h-4 w-4" /> Templates
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <select
                  onChange={(e) => e.target.value && applyTemplate(e.target.value)}
                  defaultValue=""
                  className="flex-1 rounded-md border border-input bg-background/60 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-averna-cyan"
                >
                  <option value="" className="bg-averna-dark">
                    {templates.length ? "Load a saved template…" : "No saved templates yet"}
                  </option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id} className="bg-averna-dark">
                      {t.module} · {t.title}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  onClick={saveTemplate}
                  disabled={savingTpl}
                  variant="outline"
                  className="border-averna-cyan/40 text-averna-cyan shrink-0"
                >
                  {savingTpl ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookmarkPlus className="h-4 w-4" />}
                  <span className="ml-1">Save current as template</span>
                </Button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., IELTS Writing Task 2: Technology"
                  required
                  className="bg-background/50"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Detailed instructions for the homework..."
                  required
                  className="min-h-[200px] bg-background/50"
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="module">Module *</Label>
                  <Select
                    value={formData.module}
                    onValueChange={(value) => setFormData({ ...formData, module: value })}
                  >
                    <SelectTrigger className="bg-background/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="WRITING">Writing</SelectItem>
                      <SelectItem value="READING">Reading</SelectItem>
                      <SelectItem value="LISTENING">Listening</SelectItem>
                      <SelectItem value="SPEAKING">Speaking</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="difficulty">Difficulty (1-5) *</Label>
                  <Select
                    value={formData.difficulty.toString()}
                    onValueChange={(value) => setFormData({ ...formData, difficulty: parseInt(value) })}
                  >
                    <SelectTrigger className="bg-background/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5].map((level) => (
                        <SelectItem key={level} value={level.toString()}>
                          {"⭐".repeat(level)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="points">Base Points *</Label>
                  <Input
                    id="points"
                    type="number"
                    value={formData.points}
                    onChange={(e) => setFormData({ ...formData, points: parseInt(e.target.value) })}
                    min="10"
                    max="200"
                    required
                    className="bg-background/50"
                  />
                  <p className="text-xs text-gray-400">
                    +10 bonus for 1st, +8 for 2nd, +6 for 3rd
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dueDate">Due Date *</Label>
                  <Input
                    id="dueDate"
                    type="datetime-local"
                    value={formData.dueDate}
                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                    required
                    className="bg-background/50"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-averna-primary/20">
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full neon-button bg-purple-500 hover:bg-purple-600"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Create Homework
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
