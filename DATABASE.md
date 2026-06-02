# 🗄️ Averna Learning Platform - Database Documentation

## Database Schema Overview

The Averna platform uses **PostgreSQL** with **Prisma ORM** for type-safe database access.

## Entity Relationship Diagram (Textual)

```
User (1) ─── (0-1) Student
User (1) ─── (0-1) Teacher
User (1) ─── (n) Session
User (1) ─── (n) Account

Teacher (1) ─── (n) Group
Teacher (1) ─── (n) Homework
Teacher (1) ─── (n) HomeworkSubmission (grader)
Teacher (1) ─── (n) SpeakingSession

Group (1) ─── (n) Student
Group (1) ─── (n) Homework

Student (1) ─── (n) HomeworkSubmission
Student (1) ─── (n) IELTSTest
Student (1) ─── (n) StudentAchievement
Student (1) ─── (n) SpeakingSession
Student (1) ─── (n) ActivityLog
Student (1) ─── (n) ParentStudentLink

Homework (1) ─── (n) HomeworkSubmission

Achievement (1) ─── (n) StudentAchievement
```

## Core Models

### 👤 User
**Purpose**: Base authentication model for all user types.

| Field         | Type     | Description                          |
|---------------|----------|--------------------------------------|
| id            | String   | Unique identifier (CUID)             |
| email         | String   | Unique email address                 |
| name          | String?  | User's full name                     |
| password      | String   | Hashed password                      |
| role          | Enum     | STUDENT / TEACHER / PARENT / ADMIN   |
| image         | String?  | Profile picture URL                  |
| emailVerified | DateTime?| Email verification timestamp         |

**Relations**: student, teacher, sessions, accounts

### 🎓 Student
**Purpose**: Extended profile for student users with gamification data.

| Field          | Type     | Description                          |
|----------------|----------|--------------------------------------|
| id             | String   | Unique identifier                    |
| userId         | String   | Link to User                         |
| groupId        | String?  | Assigned learning group              |
| personalGoal   | String?  | Why they're learning English         |
| totalPoints    | Int      | Total points earned                  |
| globalRank     | Int      | Position in global leaderboard       |
| groupRank      | Int      | Position in group leaderboard        |
| currentStreak  | Int      | Consecutive days active              |
| longestStreak  | Int      | Longest streak achieved              |
| lastActiveDate | DateTime | Last login date                      |

**Relations**: user, group, homeworkSubmissions, ieltsTests, achievements, speakingSessions, activityLogs, parentLinks

**Indexes**: groupId, totalPoints (for efficient ranking queries)

### 👨‍🏫 Teacher
**Purpose**: Extended profile for teacher users.

| Field     | Type    | Description                    |
|-----------|---------|--------------------------------|
| id        | String  | Unique identifier              |
| userId    | String  | Link to User                   |
| bio       | String? | Teacher biography              |
| specialty | String? | Teaching specialty (e.g., Writing) |

**Relations**: user, groups, homework, homeworkGrades, speakingSessions

### 👥 Group
**Purpose**: Learning groups/classes managed by teachers.

| Field       | Type    | Description              |
|-------------|---------|--------------------------|
| id          | String  | Unique identifier        |
| name        | String  | Group name               |
| teacherId   | String  | Assigned teacher         |
| description | String? | Group description        |

**Relations**: teacher, students, homework

### 📝 Homework
**Purpose**: Assignments created by teachers for groups.

| Field       | Type        | Description                      |
|-------------|-------------|----------------------------------|
| id          | String      | Unique identifier                |
| title       | String      | Assignment title                 |
| description | Text        | Detailed instructions            |
| teacherId   | String      | Creator teacher                  |
| groupId     | String      | Target group                     |
| dueDate     | DateTime    | Submission deadline              |
| points      | Int         | Base points (default: 10)        |
| difficulty  | Int         | Difficulty level 1-5             |
| module      | IELTSModule | WRITING/READING/LISTENING/SPEAKING |

**Relations**: teacher, group, submissions

**Indexes**: groupId, teacherId, dueDate (for efficient queries)

### 📤 HomeworkSubmission
**Purpose**: Student homework submissions with grading.

| Field         | Type             | Description                    |
|---------------|------------------|--------------------------------|
| id            | String           | Unique identifier              |
| studentId     | String           | Submitting student             |
| homeworkId    | String           | Homework assignment            |
| content       | Text             | Submitted work                 |
| status        | HomeworkStatus   | PENDING/SUBMITTED/GRADED/LATE  |
| position      | Int?             | Submission position (1st, 2nd, 3rd) |
| pointsAwarded | Int              | Total points earned            |
| feedback      | Text?            | Teacher feedback               |
| gradedBy      | String?          | Grading teacher                |
| submittedAt   | DateTime         | Submission timestamp           |
| gradedAt      | DateTime?        | Grading timestamp              |

**Relations**: student, homework, teacher

**Unique Constraint**: (studentId, homeworkId) - one submission per student per homework

**Points Logic**:
- Base points from homework
- Position bonus:
  - 🥇 1st: +10 points
  - 🥈 2nd: +8 points
  - 🥉 3rd: +6 points

### 📊 IELTSTest
**Purpose**: Record of IELTS practice tests with AI analysis.

| Field       | Type        | Description                      |
|-------------|-------------|----------------------------------|
| id          | String      | Unique identifier                |
| studentId   | String      | Student who took test            |
| module      | IELTSModule | WRITING/READING/LISTENING/SPEAKING |
| score       | Float       | Test score (0-9 for IELTS band)  |
| answers     | JSON        | Student's answers                |
| aiAnalysis  | JSON?       | AI assessment details            |
| timeSpent   | Int         | Time in seconds                  |
| completedAt | DateTime    | Completion timestamp             |

**Relations**: student

**Indexes**: studentId, module (for test history queries)

### 🏆 Achievement
**Purpose**: Available achievements students can unlock.

| Field       | Type            | Description                |
|-------------|-----------------|----------------------------|
| id          | String          | Unique identifier          |
| type        | AchievementType | Unique achievement type    |
| name        | String          | Display name               |
| description | String          | How to unlock it           |
| icon        | String          | Emoji or icon              |
| points      | Int             | Points awarded             |

**Relations**: students (StudentAchievement)

**Achievement Types**:
- 📚 HOMEWORK_MASTER - Complete 50 homework (100 pts)
- 🗣️ SPEAKING_CHAMPION - Attend 50 sessions (150 pts)
- 📖 READING_EXPERT - Complete 100 reading tests (120 pts)
- ✍️ WRITING_GURU - Score 7.5+ on 20 writing tasks (200 pts)
- 🎧 LISTENING_MASTER - Complete 100 listening tests (120 pts)
- 🏆 TOP_PERFORMER - Reach Top 10 globally (300 pts)
- 🔥 STREAK_WARRIOR - 30-day streak (250 pts)
- 🐦 EARLY_BIRD - First submission 10 times (100 pts)

### 🎖️ StudentAchievement
**Purpose**: Junction table tracking unlocked achievements.

| Field         | Type     | Description           |
|---------------|----------|-----------------------|
| id            | String   | Unique identifier     |
| studentId     | String   | Student               |
| achievementId | String   | Achievement           |
| unlockedAt    | DateTime | When unlocked         |

**Relations**: student, achievement

**Unique Constraint**: (studentId, achievementId)

### 🎤 SpeakingSession
**Purpose**: Record of Speaking Time attendance (19:00-21:00 daily).

| Field     | Type     | Description                    |
|-----------|----------|--------------------------------|
| id        | String   | Unique identifier              |
| studentId | String   | Participating student          |
| teacherId | String?  | Supervising teacher            |
| duration  | Int      | Duration in minutes            |
| points    | Int      | Points earned                  |
| feedback  | Text?    | Teacher feedback               |
| rating    | Int?     | 1-5 stars from teacher         |
| date      | DateTime | Session date                   |

**Relations**: student, teacher

**Points Logic**:
- 1 point per minute
- +10 bonus if rating ≥ 4 stars

### 📈 ActivityLog
**Purpose**: Detailed logging of all student activities for analytics.

| Field     | Type     | Description                    |
|-----------|----------|--------------------------------|
| id        | String   | Unique identifier              |
| studentId | String   | Student                        |
| action    | String   | Action type                    |
| details   | JSON?    | Additional data                |
| points    | Int      | Points awarded                 |
| createdAt | DateTime | Activity timestamp             |

**Relations**: student

**Action Types**:
- HOMEWORK_SUBMITTED
- IELTS_TEST_COMPLETED
- SPEAKING_SESSION_COMPLETED
- ACHIEVEMENT_UNLOCKED
- LOGIN
- etc.

### 👪 ParentStudentLink
**Purpose**: Link parents to student accounts for monitoring.

| Field       | Type     | Description           |
|-------------|----------|-----------------------|
| id          | String   | Unique identifier     |
| parentName  | String   | Parent's name         |
| parentEmail | String   | Parent's email        |
| studentId   | String   | Linked student        |

**Relations**: student

**Unique Constraint**: (parentEmail, studentId)

### 💬 DailyQuote
**Purpose**: Motivational quotes displayed daily.

| Field  | Type     | Description           |
|--------|----------|-----------------------|
| id     | String   | Unique identifier     |
| text   | Text     | Quote text            |
| author | String?  | Quote author          |
| date   | DateTime | Display date (unique) |

**Indexes**: date (for efficient daily lookup)

## Database Operations

### Setting Up Database

```bash
# Push schema to database
npm run db:push

# Generate Prisma Client
npm run db:generate

# Open Prisma Studio (GUI)
npm run db:studio

# Seed initial data
npm run db:seed
```

### Common Queries (using db-helpers.ts)

```typescript
import {
  getStudentProfile,
  updateStudentPoints,
  submitHomework,
  getGlobalRankings,
  saveIELTSTest,
  recordSpeakingSession,
} from "@/lib/db-helpers";

// Get student profile with all relations
const student = await getStudentProfile(userId);

// Award points and update rankings
await updateStudentPoints(studentId, 50);

// Submit homework
await submitHomework(studentId, homeworkId, content);

// Get leaderboards
const topStudents = await getGlobalRankings(50);

// Save test results
await saveIELTSTest(studentId, "WRITING", 7.5, answers, aiAnalysis, 3600);

// Record speaking session
await recordSpeakingSession(studentId, 45, teacherId, 5, "Excellent!");
```

## Indexes for Performance

**Optimized for**:
- Ranking queries (totalPoints)
- Group filtering (groupId)
- Date-based queries (dueDate, createdAt, date)
- Student activity lookups (studentId)
- Module-based test filtering (module)

## Data Integrity

**Cascading Deletes**:
- Deleting a User → deletes Student/Teacher, Sessions, Accounts
- All related records automatically cleaned up

**Unique Constraints**:
- User email
- (studentId, homeworkId) for submissions
- (studentId, achievementId) for achievements
- Achievement type
- Daily quote date

## Backup & Migration

```bash
# Export database
pg_dump averna_db > backup.sql

# Import database
psql averna_db < backup.sql

# Create migration (if using Prisma Migrate)
npx prisma migrate dev --name description
```

## Performance Considerations

1. **Indexes**: All foreign keys and frequently queried fields are indexed
2. **Pagination**: Use `take` and `skip` for large result sets
3. **Selective includes**: Only include relations you need
4. **Aggregations**: Use Prisma's aggregate functions for counts/sums

## Security

- ✅ Passwords hashed with bcryptjs (12 rounds)
- ✅ Email uniqueness enforced
- ✅ Cascade deletes protect data integrity
- ✅ Enum types prevent invalid data
- ✅ Required fields enforce data completeness

---

**Database is production-ready and optimized for the Averna platform! 🚀**
