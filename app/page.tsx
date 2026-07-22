import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Sparkles, Trophy, Target, Users, PenTool, Headphones, Mic, BookOpen,
  BarChart3, Layers, Star, CheckCircle2, ArrowRight, Quote, GraduationCap,
} from "lucide-react";
import { Logo } from "@/components/logo";

export default function HomePage() {
  return (
    <div className="min-h-screen premium-gradient relative overflow-hidden aurora-bg">
      {/* Top nav */}
      <header className="container mx-auto px-4 py-5 flex items-center justify-between">
        <Logo size={40} className="text-xl" />
        <div className="flex items-center gap-2">
          <Link href="/auth/signin">
            <Button variant="ghost" className="text-gray-200 hover:text-white">Sign in</Button>
          </Link>
          <Link href="/auth/signin">
            <Button className="neon-button bg-averna-primary hover:bg-averna-light">Get Started</Button>
          </Link>
        </div>
      </header>

      <div className="container mx-auto px-4 pb-16">
        {/* Hero */}
        <section className="text-center pt-10 pb-8 animate-fade-in">
          <div className="flex justify-center mb-6">
            <Logo size={88} showText={false} className="animate-float" />
          </div>

          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass-vibrant text-averna-neon text-xs font-medium mb-6">
            <Sparkles className="h-3.5 w-3.5" /> AI-powered IELTS preparation
          </span>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-4 leading-tight">
            Reach your <span className="text-gradient-animate">target band</span>
            <br className="hidden sm:block" /> faster with Averna
          </h1>
          <p className="text-gray-300 text-base sm:text-lg max-w-2xl mx-auto mb-8">
            Instant AI feedback on Writing & Speaking, full mock exams, spaced-repetition vocabulary,
            live speaking sessions and a game that keeps you coming back — all in one place.
          </p>

          <div className="flex flex-wrap gap-4 justify-center">
            <Link href="/auth/signin">
              <Button className="neon-button bg-averna-primary hover:bg-averna-light text-white px-8 py-6 text-lg">
                <Sparkles className="mr-2" /> Start free
              </Button>
            </Link>
            <Link href="/about">
              <Button variant="outline" className="border-averna-neon text-averna-neon hover:bg-averna-primary/20 px-8 py-6 text-lg">
                Learn more
              </Button>
            </Link>
          </div>

          {/* Trust chips */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3 text-sm">
            <TrustChip icon={<Users className="h-4 w-4 text-averna-cyan" />} text="500+ active students" />
            <TrustChip icon={<GraduationCap className="h-4 w-4 text-averna-purple" />} text="10,000+ tests completed" />
            <TrustChip icon={<Star className="h-4 w-4 text-amber-400" />} text="4.9/5 average rating" />
          </div>
        </section>

        {/* How it works */}
        <section className="mt-20">
          <SectionTitle eyebrow="How it works" title="Your path to a higher band" />
          <div className="grid md:grid-cols-3 gap-6">
            <StepCard n={1} icon={<Target className="h-6 w-6" />} title="Set your goal" desc="Tell us your target band and exam date — your dashboard, plan and reminders adapt to you." />
            <StepCard n={2} icon={<PenTool className="h-6 w-6" />} title="Practice with AI" desc="Do reading, listening, writing & speaking tasks with instant, examiner-style feedback." />
            <StepCard n={3} icon={<BarChart3 className="h-6 w-6" />} title="Track & improve" desc="Watch your skills grow, review mistakes at the right time, and close the gap to your goal." />
          </div>
        </section>

        {/* Features */}
        <section className="mt-20">
          <SectionTitle eyebrow="Everything in one place" title="Built for real IELTS results" />
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard icon={<PenTool className="w-10 h-10 text-averna-neon" />} title="AI Writing & Speaking" description="Band-scored feedback with inline fixes on your essays and spoken answers." />
            <FeatureCard icon={<GraduationCap className="w-10 h-10 text-averna-cyan" />} title="Full Mock Exams" description="Timed, realistic Reading, Listening, Writing & Speaking under exam conditions." />
            <FeatureCard icon={<Layers className="w-10 h-10 text-averna-purple" />} title="Smart Vocabulary" description="Spaced-repetition flashcards that resurface words exactly when you need them." />
            <FeatureCard icon={<Mic className="w-10 h-10 text-orange-400" />} title="Live Speaking Time" description="Daily 1-on-1 voice sessions with partners and teachers (19:00–21:00)." />
            <FeatureCard icon={<Trophy className="w-10 h-10 text-amber-400" />} title="Levels, XP & Rewards" description="Streaks, achievements, leagues and real prizes keep motivation high." />
            <FeatureCard icon={<BarChart3 className="w-10 h-10 text-averna-pink" />} title="Progress Analytics" description="Skill radar, band prediction and a clear countdown to your exam." />
          </div>
        </section>

        {/* Testimonials */}
        <section className="mt-20">
          <SectionTitle eyebrow="Loved by learners" title="Students reach their goals here" />
          <div className="grid md:grid-cols-3 gap-6">
            <Testimonial quote="The AI feedback on my essays was like having a teacher available 24/7. I went from 6.0 to 7.0 in eight weeks." name="Dilnoza" meta="Band 7.0 · Study abroad" />
            <Testimonial quote="Speaking Time and the daily challenges made practice a habit. My fluency improved so much." name="Jasur" meta="Band 7.5 · Immigration" />
            <Testimonial quote="Mock exams felt exactly like the real test, so on exam day I wasn't nervous at all." name="Malika" meta="Band 8.0 · University" />
          </div>
          <p className="text-center text-[11px] text-gray-600 mt-4">Sample reviews — replace with your centre&apos;s real testimonials.</p>
        </section>

        {/* Stats */}
        <section className="mt-20 glass rounded-3xl p-10 sm:p-12">
          <div className="grid md:grid-cols-3 gap-8 text-center">
            <StatCard number="500+" label="Active students" />
            <StatCard number="50+" label="Expert teachers" />
            <StatCard number="10,000+" label="Practice tests completed" />
          </div>
        </section>

        {/* Final CTA */}
        <section className="mt-16">
          <div className="glass-vibrant rounded-3xl p-10 sm:p-14 text-center relative overflow-hidden aurora-bg">
            <h2 className="text-3xl sm:text-4xl font-bold text-white">
              Ready to <span className="text-gradient">hit your band</span>?
            </h2>
            <p className="text-gray-300 mt-3 max-w-xl mx-auto">
              Join Averna today and turn daily practice into real IELTS results.
            </p>
            <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mt-6 text-sm text-gray-300">
              <li className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-averna-neon" /> No credit card</li>
              <li className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-averna-neon" /> Start in 30 seconds</li>
              <li className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-averna-neon" /> Works on any device</li>
            </ul>
            <Link href="/auth/signin" className="inline-block mt-8">
              <Button className="neon-button bg-averna-primary hover:bg-averna-light text-white px-8 py-6 text-lg">
                Get Started <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-16 pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Logo size={28} className="text-sm" />
          <p className="text-xs text-gray-500">© {new Date().getFullYear()} Averna Learning Centre. All rights reserved.</p>
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <Link href="/about" className="hover:text-white transition-colors">About</Link>
            <Link href="/auth/signin" className="hover:text-white transition-colors">Sign in</Link>
          </div>
        </footer>
      </div>
    </div>
  );
}

function TrustChip({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass border border-white/10 text-gray-200">
      {icon} {text}
    </span>
  );
}

function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="text-center mb-10">
      <p className="text-xs uppercase tracking-[0.2em] text-averna-neon mb-2">{eyebrow}</p>
      <h2 className="text-3xl sm:text-4xl font-bold text-white">{title}</h2>
    </div>
  );
}

function StepCard({ n, icon, title, desc }: { n: number; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="glass card-hover rounded-2xl p-6 relative">
      <span className="absolute top-4 right-5 text-5xl font-black text-white/5">{n}</span>
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-averna-primary/20 text-averna-neon glow-ring">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      <p className="text-gray-400 text-sm">{desc}</p>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="glass card-hover rounded-2xl p-6 hover:shadow-neon-green">
      <div className="mb-4">{icon}</div>
      <h3 className="text-xl font-semibold text-white mb-2">{title}</h3>
      <p className="text-gray-400 text-sm">{description}</p>
    </div>
  );
}

function Testimonial({ quote, name, meta }: { quote: string; name: string; meta: string }) {
  return (
    <div className="glass rounded-2xl p-6 flex flex-col">
      <Quote className="h-6 w-6 text-averna-purple mb-3" />
      <p className="text-gray-200 text-sm leading-relaxed flex-1">&ldquo;{quote}&rdquo;</p>
      <div className="mt-5 flex items-center gap-3">
        <div className="h-9 w-9 rounded-full bg-averna-primary/30 grid place-items-center text-white text-sm font-semibold">
          {name[0]}
        </div>
        <div>
          <p className="text-sm text-white font-medium">{name}</p>
          <p className="text-[11px] text-averna-neon">{meta}</p>
        </div>
      </div>
    </div>
  );
}

function StatCard({ number, label }: { number: string; label: string }) {
  return (
    <div>
      <div className="text-5xl font-bold text-gradient mb-2">{number}</div>
      <div className="text-gray-300 text-lg">{label}</div>
    </div>
  );
}
