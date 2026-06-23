import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting database seed...");

  // Create Achievements
  console.log("Creating achievements...");
  const achievements = await Promise.all([
    prisma.achievement.upsert({
      where: { type: "HOMEWORK_MASTER" },
      update: {},
      create: {
        type: "HOMEWORK_MASTER",
        name: "Homework Master",
        description: "Complete 50 homework assignments",
        icon: "📚",
        points: 100,
      },
    }),
    prisma.achievement.upsert({
      where: { type: "SPEAKING_CHAMPION" },
      update: {},
      create: {
        type: "SPEAKING_CHAMPION",
        name: "Speaking Champion",
        description: "Attend 50 speaking sessions",
        icon: "🗣️",
        points: 150,
      },
    }),
    prisma.achievement.upsert({
      where: { type: "READING_EXPERT" },
      update: {},
      create: {
        type: "READING_EXPERT",
        name: "Reading Expert",
        description: "Complete 100 reading tests",
        icon: "📖",
        points: 120,
      },
    }),
    prisma.achievement.upsert({
      where: { type: "WRITING_GURU" },
      update: {},
      create: {
        type: "WRITING_GURU",
        name: "Writing Guru",
        description: "Score 7.5+ on 20 writing tasks",
        icon: "✍️",
        points: 200,
      },
    }),
    prisma.achievement.upsert({
      where: { type: "LISTENING_MASTER" },
      update: {},
      create: {
        type: "LISTENING_MASTER",
        name: "Listening Master",
        description: "Complete 100 listening tests",
        icon: "🎧",
        points: 120,
      },
    }),
    prisma.achievement.upsert({
      where: { type: "TOP_PERFORMER" },
      update: {},
      create: {
        type: "TOP_PERFORMER",
        name: "Top Performer",
        description: "Reach Top 10 in global rankings",
        icon: "🏆",
        points: 300,
      },
    }),
    prisma.achievement.upsert({
      where: { type: "STREAK_WARRIOR" },
      update: {},
      create: {
        type: "STREAK_WARRIOR",
        name: "Streak Warrior",
        description: "Maintain a 30-day study streak",
        icon: "🔥",
        points: 250,
      },
    }),
    prisma.achievement.upsert({
      where: { type: "EARLY_BIRD" },
      update: {},
      create: {
        type: "EARLY_BIRD",
        name: "Early Bird",
        description: "Submit homework first 10 times",
        icon: "🐦",
        points: 100,
      },
    }),
  ]);
  console.log(`✅ Created ${achievements.length} achievements`);

  // Create Daily Quotes
  console.log("Creating daily quotes...");
  const quotes = [
    {
      text: "Success is the sum of small efforts repeated every day.",
      author: "Robert Collier",
    },
    {
      text: "Your future IELTS score depends on today's effort.",
      author: "Averna Team",
    },
    {
      text: "Every expert was once a beginner. Keep pushing!",
      author: "Helen Hayes",
    },
    {
      text: "The only way to do great work is to love what you do.",
      author: "Steve Jobs",
    },
    {
      text: "Believe in yourself and all that you are.",
      author: "Christian D. Larson",
    },
    {
      text: "Dream bigger. Do bigger.",
      author: "Unknown",
    },
    {
      text: "Success doesn't just find you. You have to go out and get it.",
      author: "Unknown",
    },
    {
      text: "The harder you work for something, the greater you'll feel when you achieve it.",
      author: "Unknown",
    },
    {
      text: "Don't stop when you're tired. Stop when you're done.",
      author: "Unknown",
    },
    {
      text: "Your limitation—it's only your imagination.",
      author: "Unknown",
    },
  ];

  for (const quote of quotes) {
    await prisma.dailyQuote.create({
      data: quote,
    });
  }
  console.log(`✅ Created ${quotes.length} daily quotes`);

  // Create Admin User
  console.log("Creating admin user...");
  const hashedPassword = await hash("admin123", 12);
  const adminUser = await prisma.user.upsert({
    where: { email: "admin@averna.com" },
    update: {},
    create: {
      email: "admin@averna.com",
      name: "Admin User",
      password: hashedPassword,
      role: "ADMIN",
      emailVerified: new Date(),
    },
  });
  console.log("✅ Created admin user: admin@averna.com (password: admin123)");

  // Create Sample Teacher
  console.log("Creating sample teacher...");
  const teacherPassword = await hash("teacher123", 12);
  const teacherUser = await prisma.user.upsert({
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

  const teacher = await prisma.teacher.upsert({
    where: { userId: teacherUser.id },
    update: {},
    create: {
      userId: teacherUser.id,
      bio: "Experienced IELTS instructor with 10+ years of teaching. Specializing in Writing and Speaking modules.",
      specialty: "Writing & Speaking",
    },
  });
  console.log("✅ Created teacher: teacher@averna.com (password: teacher123)");

  // Create Sample Group (idempotent — match by name+teacher)
  console.log("Ensuring sample group...");
  const groupName = "IELTS Preparation - Advanced";
  let group = await prisma.group.findFirst({
    where: { name: groupName, teacherId: teacher.id },
  });
  if (!group) {
    group = await prisma.group.create({
      data: {
        name: groupName,
        teacherId: teacher.id,
        description: "Advanced IELTS preparation course for students targeting 7.5+",
      },
    });
    console.log(`✅ Created group: ${group.name}`);
  } else {
    console.log(`↺ Group already exists: ${group.name}`);
  }

  // Create Sample Students (idempotent — upsert user + student profile)
  console.log("Ensuring sample students...");
  const studentNames = [
    "Alex Thompson",
    "Maria Garcia",
    "John Smith",
    "Emma Wilson",
    "David Lee",
  ];

  for (let i = 0; i < studentNames.length; i++) {
    const email = `student${i + 1}@averna.com`;
    const studentPassword = await hash("student123", 12);
    const studentUser = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        name: studentNames[i],
        password: studentPassword,
        role: "STUDENT",
        emailVerified: new Date(),
      },
    });

    await prisma.student.upsert({
      where: { userId: studentUser.id },
      update: { groupId: group.id },
      create: {
        userId: studentUser.id,
        groupId: group.id,
        personalGoal: ["IELTS 7.5+", "Study Abroad", "Work Opportunities"][i % 3],
        totalPoints: Math.floor(Math.random() * 500) + 100,
        currentStreak: Math.floor(Math.random() * 15) + 1,
      },
    });

    console.log(`✅ Ensured student: ${email} (password: student123)`);
  }

  // Create Sample Homework (skip if already present for this group)
  console.log("Ensuring sample homework...");
  const hwTitle = "IELTS Writing Task 2: Technology and Education";
  const existingHw = await prisma.homework.findFirst({
    where: { title: hwTitle, groupId: group.id },
  });
  if (existingHw) {
    console.log(`↺ Homework already exists: ${hwTitle}`);
    console.log("\n🎉 Database seeding completed successfully!");
    console.log("\n📝 Test Accounts:");
    console.log("Admin: admin@averna.com / admin123");
    console.log("Teacher: teacher@averna.com / teacher123");
    console.log("Students: student1-5@averna.com / student123");
    return;
  }
  const homework = await prisma.homework.create({
    data: {
      title: hwTitle,
      description: `Write an essay on the following topic:

"Some people believe that technology has made learning easier and more accessible, while others think it has made students lazy and less focused. Discuss both views and give your own opinion."

Guidelines:
- Write at least 250 words
- Include clear introduction and conclusion
- Use relevant examples
- Organize your ideas with paragraphs
- Submit before the deadline for bonus points!`,
      teacherId: teacher.id,
      groupId: group.id,
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      points: 50,
      difficulty: 3,
      module: "WRITING",
    },
  });
  console.log(`✅ Created homework: ${homework.title}`);

  console.log("\n🎉 Database seeding completed successfully!");
  console.log("\n📝 Test Accounts:");
  console.log("Admin: admin@averna.com / admin123");
  console.log("Teacher: teacher@averna.com / teacher123");
  console.log("Students: student1-5@averna.com / student123");
}

main()
  .catch((e) => {
    console.error("❌ Error during seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
