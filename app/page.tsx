import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Sparkles, Trophy, Target, Users } from "lucide-react";
import { Logo } from "@/components/logo";

export default function HomePage() {
  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto px-4 py-16">
        {/* Hero Section */}
        <div className="text-center mb-16 animate-fade-in">
          <div className="flex justify-center mb-8">
            <Logo size={96} showText={false} className="animate-float" />
          </div>
          <h1 className="text-6xl font-bold text-white mb-4">
            Averna Learning Centre
          </h1>
          <p className="text-2xl text-averna-neon mb-8">
            Transform Your IELTS Journey
          </p>
          <p className="text-gray-300 text-lg max-w-2xl mx-auto mb-12">
            Join the most advanced IELTS learning platform with AI-powered assessments,
            gamification, real-time speaking sessions, and a competitive community.
          </p>
          
          <div className="flex gap-4 justify-center">
            <Link href="/auth/signin">
              <Button className="neon-button bg-averna-primary hover:bg-averna-light text-white px-8 py-6 text-lg">
                <Sparkles className="mr-2" />
                Get Started
              </Button>
            </Link>
            <Link href="/about">
              <Button variant="outline" className="border-averna-neon text-averna-neon hover:bg-averna-primary/20 px-8 py-6 text-lg">
                Learn More
              </Button>
            </Link>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mt-20">
          <FeatureCard
            icon={<Target className="w-12 h-12 text-averna-neon" />}
            title="AI-Powered Learning"
            description="Get instant feedback on your Writing and Speaking with advanced AI assessment"
          />
          <FeatureCard
            icon={<Trophy className="w-12 h-12 text-averna-neon" />}
            title="Gamification & Rewards"
            description="Earn points, unlock achievements, and climb the leaderboards"
          />
          <FeatureCard
            icon={<Users className="w-12 h-12 text-averna-neon" />}
            title="Speaking Time"
            description="Join daily voice sessions (19:00-21:00) with teachers and students"
          />
          <FeatureCard
            icon={<Sparkles className="w-12 h-12 text-averna-neon" />}
            title="Track Progress"
            description="Monitor your improvement with detailed analytics and insights"
          />
        </div>

        {/* Stats Section */}
        <div className="mt-20 glass rounded-3xl p-12">
          <div className="grid md:grid-cols-3 gap-8 text-center">
            <StatCard number="500+" label="Active Students" />
            <StatCard number="50+" label="Expert Teachers" />
            <StatCard number="10,000+" label="Practice Tests Completed" />
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="glass rounded-2xl p-6 hover:shadow-neon-green transition-all duration-300 cursor-pointer">
      <div className="mb-4">{icon}</div>
      <h3 className="text-xl font-semibold text-white mb-2">{title}</h3>
      <p className="text-gray-400">{description}</p>
    </div>
  );
}

function StatCard({ number, label }: { number: string; label: string }) {
  return (
    <div>
      <div className="text-5xl font-bold text-averna-neon mb-2">{number}</div>
      <div className="text-gray-300 text-lg">{label}</div>
    </div>
  );
}
