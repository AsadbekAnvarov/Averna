#!/bin/bash

echo "🗄️  Averna Database Setup Script"
echo "================================"
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERROR: DATABASE_URL is not set!"
    echo ""
    echo "Please run:"
    echo "  export DATABASE_URL=\"your-database-url-from-vercel\""
    echo ""
    echo "Or on Windows PowerShell:"
    echo "  \$env:DATABASE_URL=\"your-database-url-from-vercel\""
    echo ""
    exit 1
fi

echo "✅ DATABASE_URL is set"
echo ""

# Generate Prisma Client
echo "📦 Generating Prisma Client..."
npx prisma generate
if [ $? -ne 0 ]; then
    echo "❌ Failed to generate Prisma Client"
    exit 1
fi
echo "✅ Prisma Client generated"
echo ""

# Push database schema
echo "🗄️  Pushing database schema..."
npx prisma db push
if [ $? -ne 0 ]; then
    echo "❌ Failed to push database schema"
    exit 1
fi
echo "✅ Database schema pushed"
echo ""

# Seed database with test data
echo "🌱 Seeding database with test accounts..."
npx prisma db seed
if [ $? -ne 0 ]; then
    echo "⚠️  Warning: Failed to seed database"
    echo "You can create accounts manually on the website"
else
    echo "✅ Database seeded successfully"
    echo ""
    echo "🔑 Test Accounts Created:"
    echo "   Student:  student1@averna.com / student123"
    echo "   Teacher:  teacher@averna.com / teacher123"
    echo "   Admin:    admin@averna.com / admin123"
fi

echo ""
echo "🎉 Database setup complete!"
echo ""
echo "Next steps:"
echo "1. Open your Vercel site"
echo "2. Login with test account"
echo "3. Enjoy Averna! 🎓"
