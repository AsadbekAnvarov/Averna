import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * One-time setup endpoint.
 * Visit /api/seed in the browser once after deployment.
 *
 * It does two things, both idempotent (safe to run multiple times):
 *   1. Creates all database tables (runtime DDL, since DATABASE_URL is
 *      only available at runtime on Vercel + Neon, not at build time).
 *   2. Creates demo accounts and sample data.
 */

// --- 1. Schema (DDL) statements, run in dependency order ---
const SCHEMA_STATEMENTS: string[] = [
  // Enums (idempotent via DO/EXCEPTION)
  `DO $$ BEGIN CREATE TYPE "UserRole" AS ENUM ('STUDENT','TEACHER','PARENT','ADMIN'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
  `DO $$ BEGIN CREATE TYPE "HomeworkStatus" AS ENUM ('PENDING','SUBMITTED','GRADED','LATE'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
  `DO $$ BEGIN CREATE TYPE "IELTSModule" AS ENUM ('WRITING','READING','LISTENING','SPEAKING'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
  `DO $$ BEGIN CREATE TYPE "AchievementType" AS ENUM ('HOMEWORK_MASTER','SPEAKING_CHAMPION','READING_EXPERT','WRITING_GURU','LISTENING_MASTER','TOP_PERFORMER','STREAK_WARRIOR','EARLY_BIRD'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,

  // users
  `CREATE TABLE IF NOT EXISTS "users" (
    "id" TEXT PRIMARY KEY,
    "email" TEXT NOT NULL UNIQUE,
    "name" TEXT,
    "password" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'STUDENT',
    "image" TEXT,
    "emailVerified" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  );`,

  // teachers
  `CREATE TABLE IF NOT EXISTS "teachers" (
    "id" TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL UNIQUE,
    "bio" TEXT,
    "specialty" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "teachers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
  );`,

  // groups
  `CREATE TABLE IF NOT EXISTS "groups" (
    "id" TEXT PRIMARY KEY,
    "name" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "groups_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id")
  );`,

  // students
  `CREATE TABLE IF NOT EXISTS "students" (
    "id" TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL UNIQUE,
    "groupId" TEXT,
    "personalGoal" TEXT,
    "totalPoints" INTEGER NOT NULL DEFAULT 0,
    "globalRank" INTEGER NOT NULL DEFAULT 0,
    "groupRank" INTEGER NOT NULL DEFAULT 0,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "longestStreak" INTEGER NOT NULL DEFAULT 0,
    "lastActiveDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "students_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
    CONSTRAINT "students_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id")
  );`,

  // accounts
  `CREATE TABLE IF NOT EXISTS "accounts" (
    "id" TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    CONSTRAINT "accounts_provider_providerAccountId_key" UNIQUE ("provider","providerAccountId"),
    CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
  );`,

  // sessions
  `CREATE TABLE IF NOT EXISTS "sessions" (
    "id" TEXT PRIMARY KEY,
    "sessionToken" TEXT NOT NULL UNIQUE,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
  );`,

  // homework
  `CREATE TABLE IF NOT EXISTS "homework" (
    "id" TEXT PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 10,
    "difficulty" INTEGER NOT NULL DEFAULT 1,
    "module" "IELTSModule" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "homework_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id"),
    CONSTRAINT "homework_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id")
  );`,

  // homework_submissions
  `CREATE TABLE IF NOT EXISTS "homework_submissions" (
    "id" TEXT PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "homeworkId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" "HomeworkStatus" NOT NULL DEFAULT 'SUBMITTED',
    "position" INTEGER,
    "pointsAwarded" INTEGER NOT NULL DEFAULT 0,
    "feedback" TEXT,
    "gradedBy" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gradedAt" TIMESTAMP(3),
    CONSTRAINT "homework_submissions_studentId_homeworkId_key" UNIQUE ("studentId","homeworkId"),
    CONSTRAINT "homework_submissions_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id"),
    CONSTRAINT "homework_submissions_homeworkId_fkey" FOREIGN KEY ("homeworkId") REFERENCES "homework"("id"),
    CONSTRAINT "homework_submissions_gradedBy_fkey" FOREIGN KEY ("gradedBy") REFERENCES "teachers"("id")
  );`,

  // ielts_tests
  `CREATE TABLE IF NOT EXISTS "ielts_tests" (
    "id" TEXT PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "module" "IELTSModule" NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "answers" JSONB NOT NULL,
    "aiAnalysis" JSONB,
    "timeSpent" INTEGER NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ielts_tests_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id")
  );`,

  // achievements
  `CREATE TABLE IF NOT EXISTS "achievements" (
    "id" TEXT PRIMARY KEY,
    "type" "AchievementType" NOT NULL UNIQUE,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  );`,

  // student_achievements
  `CREATE TABLE IF NOT EXISTS "student_achievements" (
    "id" TEXT PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "student_achievements_studentId_achievementId_key" UNIQUE ("studentId","achievementId"),
    CONSTRAINT "student_achievements_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id"),
    CONSTRAINT "student_achievements_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "achievements"("id")
  );`,

  // speaking_sessions
  `CREATE TABLE IF NOT EXISTS "speaking_sessions" (
    "id" TEXT PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "teacherId" TEXT,
    "duration" INTEGER NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "feedback" TEXT,
    "rating" INTEGER,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "speaking_sessions_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id"),
    CONSTRAINT "speaking_sessions_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id")
  );`,

  // activity_logs
  `CREATE TABLE IF NOT EXISTS "activity_logs" (
    "id" TEXT PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" JSONB,
    "points" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "activity_logs_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id")
  );`,

  // parent_student_links
  `CREATE TABLE IF NOT EXISTS "parent_student_links" (
    "id" TEXT PRIMARY KEY,
    "parentName" TEXT NOT NULL,
    "parentEmail" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "parent_student_links_parentEmail_studentId_key" UNIQUE ("parentEmail","studentId"),
    CONSTRAINT "parent_student_links_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id")
  );`,

  // daily_quotes
  `CREATE TABLE IF NOT EXISTS "daily_quotes" (
    "id" TEXT PRIMARY KEY,
    "text" TEXT NOT NULL,
    "author" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP UNIQUE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  );`,

  // --- New columns (idempotent) for groups & teachers ---
  `ALTER TABLE "groups" ADD COLUMN IF NOT EXISTS "level" TEXT;`,
  `ALTER TABLE "groups" ADD COLUMN IF NOT EXISTS "schedule" TEXT;`,
  `ALTER TABLE "teachers" ADD COLUMN IF NOT EXISTS "isSecondTeacher" BOOLEAN NOT NULL DEFAULT false;`,

  // --- New student profile / enrollment columns (idempotent) ---
  `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "level" TEXT;`,
  `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "phone" TEXT;`,
  `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "nativeLanguage" TEXT;`,
  `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "targetBand" TEXT;`,
  `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "bio" TEXT;`,
  `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "enrolledAt" TIMESTAMP(3);`,

  // tutor_slots (Second Teacher booking system)
  `CREATE TABLE IF NOT EXISTS "tutor_slots" (
    "id" TEXT PRIMARY KEY,
    "teacherId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "topic" TEXT,
    "studentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tutor_slots_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id"),
    CONSTRAINT "tutor_slots_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id")
  );`,

  // attendance (roll-call / journal)
  `CREATE TABLE IF NOT EXISTS "attendance" (
    "id" TEXT PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "teacherId" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'PRESENT',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "attendance_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id"),
    CONSTRAINT "attendance_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id"),
    CONSTRAINT "attendance_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id")
  );`,

  // notifications
  `CREATE TABLE IF NOT EXISTS "notifications" (
    "id" TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'system',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "link" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
  );`,

  // grades (gradebook)
  `CREATE TABLE IF NOT EXISTS "grades" (
    "id" TEXT PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "teacherId" TEXT,
    "groupId" TEXT,
    "title" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "maxScore" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "comment" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "grades_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id"),
    CONSTRAINT "grades_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id")
  );`,

  // messages (teacher <-> student chat)
  `CREATE TABLE IF NOT EXISTS "messages" (
    "id" TEXT PRIMARY KEY,
    "senderId" TEXT NOT NULL,
    "receiverId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "messages_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE CASCADE,
    CONSTRAINT "messages_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "users"("id") ON DELETE CASCADE
  );`,

  // rewards (store catalog)
  `CREATE TABLE IF NOT EXISTS "rewards" (
    "id" TEXT PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "cost" INTEGER NOT NULL,
    "icon" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  );`,

  // reward_redemptions
  `CREATE TABLE IF NOT EXISTS "reward_redemptions" (
    "id" TEXT PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "rewardId" TEXT NOT NULL,
    "cost" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "reward_redemptions_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id"),
    CONSTRAINT "reward_redemptions_rewardId_fkey" FOREIGN KEY ("rewardId") REFERENCES "rewards"("id")
  );`,
];

async function createTables() {
  for (const stmt of SCHEMA_STATEMENTS) {
    await db.$executeRawUnsafe(stmt);
  }
}

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

export async function GET() {
  try {
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

    // --- Step 1: create tables (idempotent) ---
    await createTables();

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
