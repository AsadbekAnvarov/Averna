import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Authorization for the seed endpoint.
 *
 * In production, the endpoint is disabled unless ALLOW_SEED=true is set, AND
 * the request carries `Authorization: Bearer <SEED_TOKEN>` matching the
 * SEED_TOKEN env var. Outside production we still require the bearer token if
 * SEED_TOKEN is set; otherwise (local dev with no token) we allow it.
 */
function isSeedAuthorized(req: NextRequest): { ok: true } | { ok: false; reason: string; status: number } {
  const inProd = process.env.NODE_ENV === "production";
  const allowed = process.env.ALLOW_SEED === "true";
  const expectedToken = process.env.SEED_TOKEN;

  if (inProd && !allowed) {
    return { ok: false, reason: "Seeding is disabled in production. Set ALLOW_SEED=true to enable.", status: 404 };
  }

  if (expectedToken) {
    const header = req.headers.get("authorization") ?? "";
    const presented = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
    if (presented !== expectedToken) {
      return { ok: false, reason: "Unauthorized.", status: 401 };
    }
  } else if (inProd) {
    return { ok: false, reason: "SEED_TOKEN must be set in production.", status: 500 };
  }

  return { ok: true };
}

/**
 * One-time setup endpoint.
 * Visit /api/seed in the browser once after deployment.
 *
 * Seeds DATA only (demo accounts, achievements, quotes, sample content), and is
 * idempotent — safe to run multiple times. It does NOT create or alter tables:
 * the schema is owned solely by prisma/schema.prisma and applied on deploy.
 * If the tables don't exist yet, the handler reports a clear P2021 error.
 */

// NOTE: this endpoint no longer creates tables.
// The database schema has exactly ONE source of truth: prisma/schema.prisma
// (applied on deploy by `prisma db push` / `prisma migrate deploy`). A second,
// hand-written DDL list used to live here and had drifted from the schema
// (missing newer models and columns), which is what forced a destructive
// reconciliation on deploy and wiped data. Keep this file DATA-ONLY.

function findDatabaseUrl(): string | undefined {
  const candidates = [
    process.env.DATABASE_URL,
    process.env.POSTGRES_PRISMA_URL,
    process.env.POSTGRES_URL,
    process.env.DATABASE_URL_UNPOOLED,
    process.env.POSTGRES_URL_NON_POOLING,
    process.env.NEON_DATABASE_URL,
  ];
  return candidates.find(
    (url) =>
      !!url &&
      url.length > 0 &&
      !url.includes("localhost") &&
      !url.includes("placeholder")
  );
}

export async function GET(req: NextRequest) {
  try {
    const auth = isSeedAuthorized(req);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.reason }, { status: auth.status });
    }

    // --- Step 0: diagnostic - make sure we actually have a DB connection ---
    const dbUrl = findDatabaseUrl();
    if (!dbUrl) {
      const dbEnvKeys = Object.keys(process.env).filter((k) =>
        /DATABASE|POSTGRES|PG|NEON|PRISMA/i.test(k)
      );
      return NextResponse.json(
        {
          success: false,
          error: "No valid database connection string found in environment.",
          availableDbEnvVars: dbEnvKeys,
          hint:
            "Add an environment variable named DATABASE_URL with your Neon connection string in Vercel -> Settings -> Environment Variables, then Redeploy. If your Neon variable has a different name, tell me the name shown in 'availableDbEnvVars'.",
        },
        { status: 500 }
      );
    }

    // Tables are created/updated by Prisma on deploy (schema.prisma is the only
    // source of truth). This endpoint only seeds DATA, idempotently.
    const created: string[] = [];

    // --- Achievements (idempotent via upsert) ---
    const achievements = [
      { type: "HOMEWORK_MASTER", name: "Homework Master", description: "Complete 50 homework assignments", icon: "📚", points: 100 },
      { type: "SPEAKING_CHAMPION", name: "Speaking Champion", description: "Attend 50 speaking sessions", icon: "🗣️", points: 150 },
      { type: "READING_EXPERT", name: "Reading Expert", description: "Complete 100 reading tests", icon: "📖", points: 120 },
      { type: "WRITING_GURU", name: "Writing Guru", description: "Score 7.5+ on 20 writing tasks", icon: "✍️", points: 200 },
      { type: "LISTENING_MASTER", name: "Listening Master", description: "Complete 100 listening tests", icon: "🎧", points: 120 },
      { type: "TOP_PERFORMER", name: "Top Performer", description: "Reach Top 10 in global rankings", icon: "🏆", points: 300 },
      { type: "STREAK_WARRIOR", name: "Streak Warrior", description: "Maintain a 30-day study streak", icon: "🔥", points: 250 },
      { type: "EARLY_BIRD", name: "Early Bird", description: "Submit homework first 10 times", icon: "🐦", points: 100 },
    ] as const;

    for (const a of achievements) {
      await db.achievement.upsert({
        where: { type: a.type },
        update: {},
        create: a,
      });
    }

    // --- Daily quotes (only if none exist) ---
    if ((await db.dailyQuote.count()) === 0) {
      const quotes = [
        { text: "Success is the sum of small efforts repeated every day.", author: "Robert Collier" },
        { text: "Your future IELTS score depends on today's effort.", author: "Averna Team" },
        { text: "Every expert was once a beginner. Keep pushing!", author: "Helen Hayes" },
      ];
      let offset = 0;
      for (const q of quotes) {
        const date = new Date(Date.now() - offset * 86400000);
        offset += 1;
        await db.dailyQuote.create({ data: { ...q, date } });
      }
    }

    // --- Admin (force role so an existing account is corrected too) ---
    await db.user.upsert({
      where: { email: "admin@averna.com" },
      update: { role: "ADMIN" },
      create: {
        email: "admin@averna.com",
        name: "Admin User",
        password: await hash("admin123", 12),
        role: "ADMIN",
        emailVerified: new Date(),
      },
    });
    created.push("admin@averna.com / admin123");

    // --- Teacher + profile ---
    const teacherUser = await db.user.upsert({
      where: { email: "teacher@averna.com" },
      update: {},
      create: {
        email: "teacher@averna.com",
        name: "Sarah Johnson",
        password: await hash("teacher123", 12),
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

    // --- Group (only if none) ---
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
    // Ensure the main group has a level + schedule
    await db.group.update({
      where: { id: group.id },
      data: { level: "Advanced (IELTS 7.5+)", schedule: "Mon, Wed, Fri · 18:00–19:30" },
    });

    // --- Extra groups (different levels & schedules), created once ---
    const extraGroups = [
      { name: "Intermediate Evening", level: "Intermediate (B1)", schedule: "Tue, Thu · 17:00–18:30" },
      { name: "IELTS Standard", level: "IELTS Standard (6.0–6.5)", schedule: "Mon, Wed · 19:00–20:30" },
      { name: "Beginner Foundations", level: "Beginner (A2)", schedule: "Sat · 10:00–12:00" },
      { name: "Speaking Booster", level: "Upper-Intermediate (B2)", schedule: "Thu · 20:00–21:00" },
    ];
    for (const g of extraGroups) {
      const exists = await db.group.findFirst({
        where: { teacherId: teacher.id, name: g.name },
      });
      if (!exists) {
        await db.group.create({
          data: {
            name: g.name,
            level: g.level,
            schedule: g.schedule,
            teacherId: teacher.id,
            description: `${g.level} group`,
          },
        });
      }
    }

    // --- Second Teacher (1-on-1 tutoring) ---
    const secondTeacherUser = await db.user.upsert({
      where: { email: "teacher2@averna.com" },
      update: {},
      create: {
        email: "teacher2@averna.com",
        name: "Michael Chen",
        password: await hash("teacher123", 12),
        role: "TEACHER",
        emailVerified: new Date(),
      },
    });
    const secondTeacher = await db.teacher.upsert({
      where: { userId: secondTeacherUser.id },
      update: { isSecondTeacher: true },
      create: {
        userId: secondTeacherUser.id,
        bio: "Friendly speaking & conversation coach for 1-on-1 practice sessions.",
        specialty: "Speaking & Pronunciation",
        isSecondTeacher: true,
      },
    });
    created.push("teacher2@averna.com / teacher123 (Second Teacher)");

    // --- Open tutoring slots for the second teacher (once) ---
    if ((await db.tutorSlot.count({ where: { teacherId: secondTeacher.id } })) === 0) {
      const slots = [
        { day: "Monday", startTime: "16:00", endTime: "16:30", topic: "Speaking warm-up" },
        { day: "Monday", startTime: "16:30", endTime: "17:00", topic: "IELTS Part 2 cue cards" },
        { day: "Wednesday", startTime: "18:00", endTime: "18:30", topic: "Pronunciation drills" },
        { day: "Friday", startTime: "17:00", endTime: "17:30", topic: "Free conversation" },
        { day: "Friday", startTime: "17:30", endTime: "18:00", topic: "Mock interview" },
      ];
      for (const s of slots) {
        await db.tutorSlot.create({ data: { ...s, teacherId: secondTeacher.id } });
      }
    }

    // --- Students ---
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

    // --- Sample homework (only if none) ---
    if ((await db.homework.count()) === 0) {
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

    // --- Rewards store catalog (only if none) ---
    if ((await db.reward.count()) === 0) {
      const rewards = [
        { name: "Free Trial Lesson", description: "A free 1-on-1 trial lesson with a teacher.", cost: 300, icon: "🎟️" },
        { name: "Homework Pass", description: "Skip one homework deadline penalty.", cost: 150, icon: "📝" },
        { name: "Averna Sticker Pack", description: "Cool branded stickers.", cost: 100, icon: "✨" },
        { name: "Averna T-Shirt", description: "Official Averna Learning Centre t-shirt.", cost: 800, icon: "👕" },
        { name: "10% Course Discount", description: "10% off your next course payment.", cost: 1000, icon: "💸" },
        { name: "VIP Badge (1 month)", description: "Show off a VIP badge on your profile for a month.", cost: 500, icon: "👑" },
      ];
      for (const r of rewards) {
        await db.reward.create({ data: r });
      }
    }

    // --- Study materials bank (only if none) ---
    if ((await db.studyMaterial.count()) === 0) {
      const materials = [
        { title: "Writing Task 2: Opinion Essay Structure", module: "WRITING", level: "All", description: "A clear 4-paragraph template for opinion essays with linking phrases." },
        { title: "Writing Task 1: Describing Graphs", module: "WRITING", level: "Intermediate", description: "Key vocabulary for trends (rise, plummet, plateau) and a model answer." },
        { title: "Reading: Skimming & Scanning Guide", module: "READING", level: "All", description: "How to find answers fast without reading every word." },
        { title: "Reading: True/False/Not Given Strategy", module: "READING", level: "Intermediate", description: "Avoid the classic traps with a step-by-step method." },
        { title: "Listening: Map & Diagram Questions", module: "LISTENING", level: "Advanced", description: "Directions vocabulary and practice tips for Section 2." },
        { title: "Speaking: Part 2 Cue Card Bank", module: "SPEAKING", level: "All", description: "30 common cue cards with idea prompts." },
        { title: "Speaking: Fluency & Linking Phrases", module: "SPEAKING", level: "Intermediate", description: "Natural connectors to sound more fluent." },
        { title: "Academic Vocabulary List (AWL)", module: "VOCABULARY", level: "Advanced", description: "The most important academic words for Band 7+." },
        { title: "Top 100 Collocations for IELTS", module: "VOCABULARY", level: "All", description: "Word partnerships examiners love to see." },
        { title: "IELTS Band Descriptors Explained", module: "GENERAL", level: "All", description: "Understand exactly how you're scored in each skill." },
      ];
      for (const m of materials) {
        await db.studyMaterial.create({ data: m });
      }
    }

    // --- Daily article (only if none today) ---
    if ((await db.dailyArticle.count()) === 0) {
      await db.dailyArticle.create({
        data: {
          title: "Why Reading Every Day Boosts Your English",
          body:
            "Reading in English for just fifteen minutes a day can dramatically improve your vocabulary, grammar and writing. " +
            "When you read regularly, you absorb how natural sentences are built and you encounter words in context, which makes them easier to remember. " +
            "Experts recommend choosing material slightly above your current level — challenging enough to learn from, but not so hard that you give up. " +
            "News articles, short stories and even subtitles are all excellent sources. The key is consistency: a small amount every day beats a huge effort once a week.",
          vocabulary: [
            { word: "dramatically", meaning: "in a sudden and impressive way" },
            { word: "absorb", meaning: "to take in information gradually" },
            { word: "in context", meaning: "within a surrounding situation that gives meaning" },
            { word: "consistency", meaning: "doing something regularly in the same way" },
          ],
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: "✅ Database is ready and demo accounts are created! You can now log in.",
      accounts: created,
      login: {
        admin: "admin@averna.com / admin123",
        teacher: "teacher@averna.com / teacher123",
        secondTeacher: "teacher2@averna.com / teacher123",
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
        hint: "Make sure DATABASE_URL is set in the Vercel project settings (Neon connection string).",
      },
      { status: 500 }
    );
  }
}
