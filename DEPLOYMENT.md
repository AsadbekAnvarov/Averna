# 🚀 Averna Learning Platform - Deployment Guide

## Prerequisites

- Node.js 18+ installed
- PostgreSQL database (local or cloud)
- OpenAI API key
- Git repository

## Quick Deploy to Vercel

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit - Averna Learning Platform"
git branch -M main
git remote add origin <your-github-repo-url>
git push -u origin main
```

### 2. Deploy to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click "Import Project"
3. Select your GitHub repository
4. Configure environment variables (see below)
5. Click "Deploy"

### 3. Environment Variables (Vercel)

Add these in Vercel Dashboard → Settings → Environment Variables:

```
DATABASE_URL=your-postgres-connection-string
NEXTAUTH_URL=https://your-vercel-domain.vercel.app
NEXTAUTH_SECRET=generate-with-openssl-rand-base64-32
OPENAI_API_KEY=your-openai-api-key
```

### 4. Database Setup

After deployment:

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Run Prisma commands
vercel env pull .env.local
npm run db:push
```

## Database Options

### Option 1: Vercel Postgres (Recommended)

1. In Vercel Dashboard → Storage → Create → Postgres
2. Copy connection string to `DATABASE_URL`
3. Auto-configured and scalable

### Option 2: Supabase

1. Create project at [supabase.com](https://supabase.com)
2. Copy postgres connection string
3. Free tier: 500MB, 2GB bandwidth

### Option 3: Railway

1. Create project at [railway.app](https://railway.app)
2. Add PostgreSQL service
3. Copy connection string

## Local Development

```bash
# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env with your credentials

# Run database migrations
npm run db:push

# Seed database with test data
npx prisma db seed

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Production Build

```bash
# Build for production
npm run build

# Start production server
npm start
```

## Database Seeding

After deployment, seed the database:

```bash
npx prisma db seed
```

This creates:
- Admin account: `admin@averna.com` / `admin123`
- Teacher account: `teacher@averna.com` / `teacher123`
- 5 Student accounts: `student1-5@averna.com` / `student123`
- Sample homework
- Achievements
- Daily quotes

## Environment Variables Explained

| Variable | Description | Required | Example |
|----------|-------------|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string | ✅ Yes | `postgresql://user:pass@host:5432/db` |
| `NEXTAUTH_URL` | Your deployment URL | ✅ Yes | `https://averna.vercel.app` |
| `NEXTAUTH_SECRET` | Auth secret key | ✅ Yes | Generate with `openssl rand -base64 32` |
| `OPENAI_API_KEY` | OpenAI API key for AI features | ✅ Yes | `sk-...` |
| `DAILY_API_KEY` | Daily.co for Speaking Time | ❌ No | Optional feature |

## Post-Deployment Checklist

- [ ] Database migrated successfully
- [ ] Database seeded with initial data
- [ ] Can login with test accounts
- [ ] Writing AI assessment working
- [ ] Reading tests loading correctly
- [ ] Homework submission working
- [ ] Rankings displaying
- [ ] AI Mentor responding

## Troubleshooting

### Build Errors

```bash
# Clear cache
rm -rf .next
rm -rf node_modules
npm install
npm run build
```

### Database Connection Issues

```bash
# Test connection
npx prisma studio

# Re-generate Prisma Client
npx prisma generate
```

### AI Features Not Working

- Verify `OPENAI_API_KEY` is set correctly
- Check OpenAI account has credits
- Review API logs in OpenAI dashboard

## Monitoring

### Vercel Analytics

Enable in Vercel Dashboard:
- Real-time traffic
- Core Web Vitals
- Error tracking

### Database Monitoring

```bash
# Open Prisma Studio
npm run db:studio
```

## Scaling Considerations

### Database

- Upgrade to paid plan for more connections
- Enable connection pooling (PgBouncer)
- Regular backups (automatic on most providers)

### API Rate Limits

- OpenAI: Monitor usage in dashboard
- Implement caching for repeated queries
- Add request throttling if needed

## Security Best Practices

✅ **Implemented:**
- Password hashing (bcryptjs)
- JWT sessions
- SQL injection prevention (Prisma)
- Environment variables for secrets
- Role-based access control

🔒 **Recommended:**
- Enable HTTPS (automatic on Vercel)
- Add rate limiting
- Implement CORS properly
- Regular dependency updates

## Backup Strategy

### Database Backups

Most providers offer automatic backups:

**Vercel Postgres:**
```bash
vercel env pull
# Backups automatic
```

**Manual backup:**
```bash
pg_dump $DATABASE_URL > backup.sql
```

## Cost Estimation

### Free Tier (Development)

- **Vercel:** Free (hobby plan)
- **Vercel Postgres:** Free (256MB storage)
- **OpenAI:** Pay-as-you-go (~$10-50/month for small usage)

### Production (100-500 users)

- **Vercel Pro:** $20/month
- **Database:** $25-50/month
- **OpenAI:** $50-200/month
- **Total:** ~$100-300/month

## Support & Maintenance

### Regular Tasks

- Update dependencies monthly
- Review error logs weekly
- Database optimization quarterly
- Feature updates as needed

### Monitoring Tools

- Vercel Dashboard (errors, analytics)
- Prisma Studio (database)
- OpenAI Dashboard (API usage)

---

## Quick Commands Reference

```bash
# Development
npm run dev              # Start dev server
npm run build            # Build for production
npm start                # Start production server

# Database
npm run db:push          # Push schema to database
npm run db:studio        # Open Prisma Studio
npm run db:generate      # Generate Prisma Client
npx prisma db seed       # Seed database

# Deployment
vercel                   # Deploy to Vercel
vercel --prod            # Deploy to production
vercel env pull          # Pull environment variables
```

---

**🎉 Platform is production-ready!**

Demo: [https://your-domain.vercel.app](https://your-domain.vercel.app)

Login with: `student1@averna.com` / `student123`
