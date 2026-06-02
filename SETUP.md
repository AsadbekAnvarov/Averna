# 🚀 Averna Learning Platform - Setup Guide

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

This will install all required packages including:
- Next.js 14
- React 18
- TypeScript
- Tailwind CSS
- Prisma ORM
- NextAuth.js v5
- OpenAI SDK
- Radix UI components
- Framer Motion
- TanStack React Query
- Zustand

### 2. Database Setup

#### Option A: Local PostgreSQL

1. Install PostgreSQL on your machine
2. Create a new database:
```sql
CREATE DATABASE averna_db;
```

3. Update `.env`:
```env
DATABASE_URL="postgresql://username:password@localhost:5432/averna_db?schema=public"
```

#### Option B: Cloud PostgreSQL (Recommended)

Use a managed PostgreSQL service:
- **Vercel Postgres**: Easiest if deploying to Vercel
- **Supabase**: Free tier with 500MB
- **Railway**: Simple setup with free tier
- **Neon**: Serverless PostgreSQL

Example with Supabase:
```env
DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres"
```

### 3. Environment Variables

Create `.env` file in the root directory:

```env
# Database
DATABASE_URL="your-database-url-here"

# NextAuth - REQUIRED
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"

# OpenAI API - For AI Features
OPENAI_API_KEY="sk-your-openai-api-key"

# Daily.co - For Speaking Time (Optional, can implement later)
DAILY_API_KEY="your-daily-api-key"

# Pusher - For Real-time Features (Optional)
PUSHER_APP_ID="your-app-id"
PUSHER_KEY="your-key"
PUSHER_SECRET="your-secret"
PUSHER_CLUSTER="your-cluster"
```

#### Generate NEXTAUTH_SECRET:
```bash
openssl rand -base64 32
```

### 4. Initialize Database

Push the Prisma schema to your database:

```bash
npm run db:push
```

This will create all tables, relationships, and indexes.

### 5. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📦 Available Scripts

```bash
# Development
npm run dev              # Start dev server on localhost:3000

# Database
npm run db:push          # Push schema changes to database
npm run db:studio        # Open Prisma Studio (database GUI)
npm run db:generate      # Generate Prisma Client

# Production
npm run build            # Build for production
npm run start            # Start production server

# Code Quality
npm run lint             # Run ESLint
```

## 🎨 Project Structure Details

```
averna-learning-platform/
│
├── app/                          # Next.js 14 App Router
│   ├── layout.tsx               # Root layout
│   ├── page.tsx                 # Landing page
│   ├── globals.css              # Global styles
│   │
│   ├── (auth)/                  # Auth group (no layout)
│   │   ├── signin/
│   │   └── signup/
│   │
│   ├── dashboard/               # Student Dashboard
│   │   ├── page.tsx            # Main dashboard
│   │   ├── profile/
│   │   └── settings/
│   │
│   ├── learning/                # IELTS Modules
│   │   ├── writing/
│   │   │   ├── task1/
│   │   │   └── task2/
│   │   ├── reading/
│   │   ├── listening/
│   │   └── speaking/
│   │
│   ├── homework/                # Homework System
│   │   ├── page.tsx            # List assignments
│   │   └── [id]/               # Individual homework
│   │
│   ├── rankings/                # Leaderboards
│   │   ├── global/
│   │   └── group/
│   │
│   ├── teacher/                 # Teacher Panel
│   │   ├── dashboard/
│   │   ├── homework/
│   │   └── students/
│   │
│   └── api/                     # API Routes
│       ├── auth/
│       ├── homework/
│       ├── rankings/
│       ├── ai/
│       └── speaking/
│
├── components/                   # React Components
│   ├── ui/                      # Base UI (Button, Card, etc.)
│   ├── dashboard/               # Dashboard components
│   ├── learning/                # Learning components
│   ├── homework/                # Homework components
│   └── shared/                  # Shared components
│
├── lib/                         # Utilities
│   ├── db.ts                   # Prisma client
│   ├── auth.ts                 # NextAuth config
│   ├── ai.ts                   # OpenAI functions
│   └── utils.ts                # Helper functions
│
├── prisma/
│   └── schema.prisma           # Database schema
│
└── public/                      # Static assets
    ├── images/
    └── icons/
```

## 🔑 Getting API Keys

### OpenAI API (Required for AI Features)
1. Visit [platform.openai.com](https://platform.openai.com)
2. Sign up or log in
3. Go to API Keys section
4. Create new secret key
5. Add to `.env` as `OPENAI_API_KEY`

**Note**: You'll need credits/billing set up. GPT-4o is recommended for best results.

### Daily.co (For Speaking Time Feature)
1. Visit [daily.co](https://www.daily.co)
2. Sign up for free account (up to 10,000 minutes/month free)
3. Get API key from dashboard
4. Add to `.env` as `DAILY_API_KEY`

**Alternative**: Agora.io for voice/video

### Pusher (For Real-time Features)
1. Visit [pusher.com](https://pusher.com)
2. Create free account
3. Create new Channels app
4. Copy credentials to `.env`

**Alternative**: Socket.io (self-hosted)

## 🗄️ Database Seeding (Optional)

Create initial data for testing:

```bash
# Create seed script
npx prisma db seed
```

You can create a seed file at `prisma/seed.ts`:

```typescript
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // Create achievements
  await prisma.achievement.createMany({
    data: [
      {
        type: 'HOMEWORK_MASTER',
        name: 'Homework Master',
        description: 'Complete 50 homework assignments',
        icon: '📚',
        points: 100,
      },
      // Add more...
    ],
  })
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect())
```

Add to `package.json`:
```json
"prisma": {
  "seed": "ts-node --compiler-options {\"module\":\"CommonJS\"} prisma/seed.ts"
}
```

## 🚀 Deployment

### Vercel (Recommended)

1. Push code to GitHub
2. Import project to Vercel
3. Add environment variables
4. Deploy

Vercel automatically:
- Detects Next.js
- Installs dependencies
- Builds the project
- Sets up continuous deployment

### Database for Production

Use managed PostgreSQL:
- **Vercel Postgres**: Integrated with Vercel
- **Supabase**: Free tier available
- **Railway**: Easy setup
- **AWS RDS**: Enterprise option

## 🔧 Troubleshooting

### Database Connection Issues
```bash
# Test connection
npx prisma db pull

# Reset database
npx prisma migrate reset
```

### Prisma Client Issues
```bash
# Regenerate Prisma Client
npx prisma generate

# Clear cache
rm -rf node_modules/.prisma
npm run db:generate
```

### Port Already in Use
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Or use different port
PORT=3001 npm run dev
```

## 📚 Next Steps

After setup:

1. ✅ Create first user account
2. ✅ Set up admin user in database
3. ✅ Create sample group
4. ✅ Add test homework
5. ✅ Test AI writing assessment
6. ✅ Configure Speaking Time
7. ✅ Customize brand colors if needed

## 🆘 Support

For issues or questions:
- Check documentation
- Review error logs
- Contact development team

---

**Setup complete! 🎉 Ready to build the future of IELTS learning!**
