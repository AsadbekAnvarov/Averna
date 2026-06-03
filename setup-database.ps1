# Averna Database Setup Script (Windows PowerShell)

Write-Host "🗄️  Averna Database Setup Script" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Check if DATABASE_URL is set
if (-not $env:DATABASE_URL) {
    Write-Host "❌ ERROR: DATABASE_URL is not set!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please run:" -ForegroundColor Yellow
    Write-Host '  $env:DATABASE_URL="your-database-url-from-vercel"' -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Get your DATABASE_URL from:" -ForegroundColor Yellow
    Write-Host "  Vercel → Settings → Environment Variables → DATABASE_URL" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

Write-Host "✅ DATABASE_URL is set" -ForegroundColor Green
Write-Host ""

# Generate Prisma Client
Write-Host "📦 Generating Prisma Client..." -ForegroundColor Cyan
npx prisma generate
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to generate Prisma Client" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Prisma Client generated" -ForegroundColor Green
Write-Host ""

# Push database schema
Write-Host "🗄️  Pushing database schema..." -ForegroundColor Cyan
npx prisma db push
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to push database schema" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Database schema pushed" -ForegroundColor Green
Write-Host ""

# Seed database with test data
Write-Host "🌱 Seeding database with test accounts..." -ForegroundColor Cyan
npx prisma db seed
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  Warning: Failed to seed database" -ForegroundColor Yellow
    Write-Host "You can create accounts manually on the website" -ForegroundColor Yellow
} else {
    Write-Host "✅ Database seeded successfully" -ForegroundColor Green
    Write-Host ""
    Write-Host "🔑 Test Accounts Created:" -ForegroundColor Cyan
    Write-Host "   Student:  student1@averna.com / student123" -ForegroundColor White
    Write-Host "   Teacher:  teacher@averna.com / teacher123" -ForegroundColor White
    Write-Host "   Admin:    admin@averna.com / admin123" -ForegroundColor White
}

Write-Host ""
Write-Host "🎉 Database setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Open your Vercel site" -ForegroundColor White
Write-Host "2. Login with test account" -ForegroundColor White
Write-Host "3. Enjoy Averna! 🎓" -ForegroundColor White
