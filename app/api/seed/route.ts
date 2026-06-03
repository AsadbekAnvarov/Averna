import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * One-time seed endpoint to create demo accounts and sample data.
 * Visit /api/seed in the browser once after deployment.
 * It is idempotent: running it again will not create duplicates.
 */
export async function GET() {
  try {
    const created: string[] = [];

    // --- Achievements (idempotent via upsert) ---
    const achievements: Array<{
      type:
        | "HOMEWORK_MASTER"
        | "SPEAKING_CHAMPION"
        | "READING_EXPERT"
        | "WRITING_GURU"
        | "LISTENING_MASTER"
        | "TOP_PERFORMER"
        | "STREAK_WARRIOR"
        | "EARLY_BIRD";
      name: string;
      description: string;
      icon: string;
      points: number;
    }> = [
      { type: "HOMEWORK_MASTER", name: "Homework Master", description: "Complete 50 homework assignments", icon: "📚", points: 100 },
      { type: "SPEAKING_CHAMPION", name: "Speaking Champion", description: "Attend 50 speaking sessions", icon: "🗣️", points: 150 },
      { type: "READING_EXPERT", name: "Reading Expert", description: "Complete 100 reading tests", icon: "📖", points: 120 },
      { type: "WRITING_GURU", name: "Writing Guru", description: "Score 7.5+ on 20 writing tasks", icon: "✍️", points: 200 },
      { type: "LISTENING_MASTER", name: "Listening Master", description: "Complete 100 listening tests", icon: "🎧", points: 120 },
      { type: "TOP_PERFORMER", name: "Top Performer", description: "Reach Top 10 in global rankings", icon: "🏆", points: 300 },
      { type: "STREAK_WARRIOR", name: "Streak Warrior", description: "Maintain a 30-day study streak", icon: "🔥", points: 250 },
      { type: "EARLY_BIRD", name: "Early Bird", description: "Submit homework first 10 times", icon: "🐦", points: 100 },
    ];

    for (const a of achievements) {
      await db.achievement.upsert({
        where: { type: a.type },
        update: {},
        create: a,
      });
    }

    // --- Daily quotes (only if none exist) ---
    const quoteCount = await db.dailyQuote.count();
    if (quoteCount === 0) {
      const quotes = [
        { text: "Success is the sum of small efforts repeated every day.", author: "Robert Collier" },
        { text: "Your future IELTS score depends on today's effort.", author: "Averna Team" },
        { text: "Every expert was once a beginner. Keep pushing!", author: "Helen Hayes" },
        { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
        { text: "Believe in yourself and all that you are.", author: "Christian D. Larson" },
      ];
      for (const q of quotes) {
        // dates are unique; offset each quote by a day to avoid collisions
        await db.dailyQuote.create({ data: q });
      }
    }

    // --- Admin user (idempotent) ---
    const adminPassword = await hash("admin123", 12);
    await db.user.upsert({
      where: { email: "admin@averna.com" },
      update: {},
      create: {
        email: "admin@averna.com",
        name: "Admin User",
        password: adminPassword,
        role: "ADMIN",
        emailVerified: new Date(),
      },
    });
    created.push("admin@averna.com / admin123");

    // --- Teacher user + profile (idempotent) ---
    const teacherPassword = await hash("teacher123", 12);
    const teacherUser = await db.user.upsert({
      where: { email: "teacher@averna.com" },
      update: {},
      create: {
        email: "teacher@averna.com",
        name: "Sarah Johnson",
        password: teacherPassword,
        role: "TEACHER",
        emailVerified: new Date(),
      },
    });

    const teacher = await db.teacher.upsert({
      where: { userId: teacherUser.id },
      update: {},
      create: {
        userId: teacherUser.id,
        bio: "Experienced IELTS instructor with 10+ years of teaching.",
        specialty: "Writing & Speaking",
      },
    });
    created.push("teacher@averna.com / teacher123");

    // --- Group (only if none exist) ---
    let group = await db.group.findFirst({ where: { teacherId: teacher.id } });
    if (!group) {
      group = await db.group.create({
        data: {
          name: "IELTS Preparation - Advanced",
          teacherId: teacher.id,
          description: "Advanced IELTS preparation course for students targeting 7.5+",
        },
      });
    }

    // --- Students (only create those that don't exist) ---
    const studentNames = ["Alex Thompson", "Maria Garcia", "John Smith", "Emma Wilson", "David Lee"];
    const studentPassword = await hash("student123", 12);

    for (let i = 0; i < studentNames.length; i++) {
      const email = `student${i + 1}@averna.com`;
      const existing = await db.user.findUnique({ where: { email } });
      if (existing) {
        created.push(`${email} / student123 (already existed)`);
        continue;
      }

      const studentUser = await db.user.create({
        data: {
          email,
          name: studentNames[i],
          password: studentPassword,
          role: "STUDENT",
          emailVerified: new Date(),
        },
      });

      await db.student.create({
        data: {
          userId: studentUser.id,
          groupId: group.id,
          personalGoal: ["IELTS 7.5+", "Study Abroad", "Work Opportunities"][i % 3],
          totalPoints: Math.floor(Math.random() * 500) + 100,
          currentStreak: Math.floor(Math.random() * 15) + 1,
        },
      });
      created.push(`${email} / student123`);
    }

    // --- Sample homework (only if none exist) ---
    const hwCount = await db.homework.count();
    if (hwCount === 0) {
      await db.homework.create({
        data: {
          title: "IELTS Writing Task 2: Technology and Education",
          description:
            'Write an essay: "Some people believe technology has made learning easier, while others think it has made students lazy. Discuss both views and give your opinion." Write at least 250 words.',
          teacherId: teacher.id,
          groupId: group.id,
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          points: 50,
          difficulty: 3,
          module: "WRITING",
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: "✅ Demo accounts are ready! You can now log in.",
      accounts: created,
      login: {
        admin: "admin@averna.com / admin123",
        teacher: "teacher@averna.com / teacher123",
        student: "student1@averna.com / student123",
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Seed error:", error);
    return NextResponse.json(
      {
        success: false,
        error: message,
        hint: "Make sure DATABASE_URL is set in Vercel and the database tables exist (they are created automatically during deployment).",
      },
      { status: 500 }
    );
  }
}
