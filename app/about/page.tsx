import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import {
  Award,
  Clock,
  Sparkles,
  Brain,
  Users,
  Trophy,
  Mic,
  CalendarCheck,
  Gift,
  Target,
  CheckCircle2,
  Star,
} from "lucide-react";

export default function AboutPage() {
  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto px-4 py-12 max-w-5xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-12">
          <Logo href="/" size={40} className="text-xl" />
          <Link href="/auth/signin">
            <Button className="neon-button bg-averna-primary hover:bg-averna-light">
              Get Started
            </Button>
          </Link>
        </div>

        {/* Hero */}
        <div className="text-center mb-16 animate-fade-in">
          <div className="flex justify-center mb-6">
            <Logo size={88} showText={false} className="animate-float" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            Why <span className="neon-text">Averna</span> is Different
          </h1>
          <p className="text-gray-300 text-lg max-w-2xl mx-auto">
            We&apos;re not a typical IELTS centre. Here&apos;s what sets Averna Learning Centre
            apart and why our students reach their target band faster.
          </p>
        </div>

        {/* Key differentiators */}
        <div className="grid md:grid-cols-2 gap-6 mb-16">
          {/* Elite teachers */}
          <div className="glass rounded-2xl p-8 border border-averna-neon/30">
            <div className="flex items-center gap-3 mb-4">
              <Award className="h-10 w-10 text-averna-neon" />
              <h2 className="text-2xl font-bold text-white">Elite Teachers</h2>
            </div>
            <p className="text-gray-300 mb-4">
              Every single one of our teachers is a proven high-scorer. We don&apos;t hire
              anyone who hasn&apos;t walked the path themselves.
            </p>
            <ul className="space-y-2 text-gray-200">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-averna-neon shrink-0" />
                <span><strong>All teachers score IELTS 8.0+</strong> — real, verified results</span>
              </li>
              <li className="flex items-center gap-2">
                <Star className="h-5 w-5 text-yellow-400 shrink-0" />
                <span>One of our teachers holds a <strong className="neon-text-cyan">perfect Band 9.0</strong> 🏆</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-averna-neon shrink-0" />
                <span>Years of real teaching experience, not just high scores</span>
              </li>
            </ul>
          </div>

          {/* Longer lessons */}
          <div className="glass rounded-2xl p-8 border border-averna-cyan/30">
            <div className="flex items-center gap-3 mb-4">
              <Clock className="h-10 w-10 text-averna-cyan" />
              <h2 className="text-2xl font-bold text-white">Longer Lessons</h2>
            </div>
            <p className="text-gray-300 mb-4">
              More time in class means more practice, more feedback, and faster progress.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-white/5 border border-white/10 p-4 text-center">
                <p className="text-xs text-gray-400">Typical centres</p>
                <p className="text-3xl font-bold text-gray-400">1.5h</p>
                <p className="text-xs text-gray-500">per lesson</p>
              </div>
              <div className="rounded-xl bg-averna-cyan/10 border border-averna-cyan/40 p-4 text-center">
                <p className="text-xs text-averna-cyan">At Averna</p>
                <p className="text-3xl font-bold neon-text-cyan">2h+</p>
                <p className="text-xs text-gray-400">per lesson</p>
              </div>
            </div>
            <p className="text-sm text-gray-400 mt-4">
              That&apos;s <strong className="text-white">30+ extra minutes</strong> of focused
              learning every single lesson — it adds up to weeks of extra study over a course.
            </p>
          </div>
        </div>

        {/* Comparison table */}
        <div className="glass rounded-2xl p-6 sm:p-8 border border-averna-primary/30 mb-16">
          <h2 className="text-2xl font-bold text-white mb-6 text-center">
            Averna vs. a Typical Centre
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-sm border-b border-white/10">
                  <th className="py-3 pr-4 text-gray-400 font-normal">Feature</th>
                  <th className="py-3 px-4 text-gray-400 font-normal text-center">Typical Centre</th>
                  <th className="py-3 pl-4 text-averna-neon font-semibold text-center">Averna</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {[
                  ["Teacher level", "Varies", "IELTS 8.0+ (one 9.0)"],
                  ["Lesson length", "1.5 hours", "2+ hours"],
                  ["AI Writing feedback", "—", "Instant, detailed"],
                  ["Daily Speaking Time", "Rare", "Every day 19:00–21:00"],
                  ["1-on-1 Second Teacher", "—", "Free bookable slots"],
                  ["Progress tracking", "Paper / none", "Live dashboard + analytics"],
                  ["Attendance journal", "Manual", "Digital, transparent"],
                  ["Motivation & rewards", "—", "Points, levels, prizes"],
                ].map(([feature, typical, averna]) => (
                  <tr key={feature} className="border-b border-white/5">
                    <td className="py-3 pr-4 text-white">{feature}</td>
                    <td className="py-3 px-4 text-gray-500 text-center">{typical}</td>
                    <td className="py-3 pl-4 text-averna-neon text-center font-medium">{averna}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* More details grid */}
        <h2 className="text-2xl font-bold text-white mb-6 text-center">And so much more…</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-16">
          <Detail icon={<Brain className="h-7 w-7 text-purple-400" />} title="AI-Powered Feedback"
            text="Instant analysis of your essays and pronunciation, plus a 24/7 AI mentor for any question." />
          <Detail icon={<Mic className="h-7 w-7 text-orange-400" />} title="Real Speaking Practice"
            text="Daily live speaking sessions, a Pronunciation Coach that scores your speech, and exam-style practice." />
          <Detail icon={<Users className="h-7 w-7 text-averna-cyan" />} title="Small, Focused Groups"
            text="Grouped by level (Beginner to IELTS 7.5+) so every lesson matches exactly where you are." />
          <Detail icon={<Trophy className="h-7 w-7 text-yellow-400" />} title="Healthy Competition"
            text="Global & group rankings, levels and achievements keep you motivated to come back daily." />
          <Detail icon={<CalendarCheck className="h-7 w-7 text-averna-neon" />} title="Full Transparency"
            text="Your schedule, attendance, grades and homework — all in one place, visible any time." />
          <Detail icon={<Gift className="h-7 w-7 text-averna-pink" />} title="Real Rewards"
            text="Earn points for everything you do and spend them on trial lessons, discounts and merch." />
          <Detail icon={<Target className="h-7 w-7 text-averna-neon" />} title="Mock IELTS Exams"
            text="Timed full mock tests with an estimated band score so you always know where you stand." />
          <Detail icon={<Sparkles className="h-7 w-7 text-averna-purple" />} title="Personal Goals"
            text="Set your target band and we tailor reminders, challenges and feedback around it." />
          <Detail icon={<Clock className="h-7 w-7 text-averna-cyan" />} title="Homework that Counts"
            text="Gamified homework with deadlines and bonus points for the first to finish." />
        </div>

        {/* CTA */}
        <div className="glass rounded-3xl p-10 text-center border border-averna-neon/30">
          <h2 className="text-3xl font-bold text-white mb-3">
            Ready to reach your target band? 🎯
          </h2>
          <p className="text-gray-300 mb-6 max-w-xl mx-auto">
            Join Averna Learning Centre and study with Band 8+ teachers, longer lessons,
            and a platform built to keep you motivated.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/auth/signup">
              <Button className="neon-button bg-averna-primary hover:bg-averna-light text-white px-8 py-6 text-lg">
                <Sparkles className="mr-2 h-5 w-5" /> Join Now
              </Button>
            </Link>
            <Link href="/">
              <Button variant="outline" className="border-averna-neon text-averna-neon hover:bg-averna-primary/20 px-8 py-6 text-lg">
                Back to Home
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function Detail({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="glass rounded-2xl p-6 border border-white/10 hover:border-averna-neon/30 transition-colors">
      <div className="mb-3">{icon}</div>
      <h3 className="text-lg font-semibold text-white mb-1">{title}</h3>
      <p className="text-sm text-gray-400">{text}</p>
    </div>
  );
}
