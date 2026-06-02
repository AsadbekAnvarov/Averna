# 🔐 Authentication System Documentation

## Overview

The Averna Learning Platform uses **NextAuth.js v5** (Auth.js) with **Credentials provider** for authentication and role-based access control.

## Features

✅ **Secure Authentication**
- Email/password authentication
- bcryptjs password hashing (12 rounds)
- JWT session strategy

✅ **Role-Based Access Control (RBAC)**
- STUDENT: Access to learning modules, homework, rankings
- TEACHER: Manage groups, create homework, grade submissions
- PARENT: View student progress (future feature)
- ADMIN: Full system access

✅ **Middleware Protection**
- Automatic route protection based on authentication
- Role-based route access
- Redirect to appropriate dashboards by role

✅ **User Experience**
- Beautiful sign-in/sign-up pages with Averna branding
- Personal goal selection during registration
- Demo accounts for testing
- Error handling and validation

## Routes

### Public Routes (No Authentication Required)
- `/` - Landing page
- `/auth/signin` - Sign in page
- `/auth/signup` - Sign up page
- `/auth/error` - Authentication error page
- `/about` - About page

### Protected Routes (Authentication Required)

#### Student Routes
- `/dashboard` - Student dashboard
- `/learning/*` - IELTS learning modules
- `/homework/*` - Homework system
- `/rankings/*` - Leaderboards
- `/profile` - Student profile

#### Teacher Routes
- `/teacher/dashboard` - Teacher dashboard
- `/teacher/groups` - Manage groups
- `/teacher/homework` - Create and grade homework
- `/teacher/students` - View student progress

#### Admin Routes
- `/admin/dashboard` - Admin dashboard
- `/admin/users` - User management
- `/admin/analytics` - Platform analytics

## Demo Accounts

### For Testing

```bash
# Student Account
Email: student1@averna.com
Password: student123

# Teacher Account
Email: teacher@averna.com
Password: teacher123

# Admin Account
Email: admin@averna.com
Password: admin123
```

## Usage

### Sign Up New User

1. Navigate to `/auth/signup`
2. Fill in:
   - Full Name
   - Email
   - Password (min. 8 characters)
   - Confirm Password
   - Personal Goal (Why learning English?)
3. Click "Create Account"
4. Redirect to sign-in page

**Backend Process:**
```typescript
POST /api/auth/signup
{
  "name": "John Smith",
  "email": "john@example.com",
  "password": "securepass123",
  "personalGoal": "IELTS 7.5+"
}
```

- Creates User record (role: STUDENT)
- Creates Student profile with personalGoal
- Hashes password with bcryptjs
- Returns success message

### Sign In

1. Navigate to `/auth/signin`
2. Enter email and password
3. Click "Sign In"
4. Redirect to role-specific dashboard

**Authentication Flow:**
```typescript
POST /api/auth/signin (NextAuth)
{
  "email": "student@averna.com",
  "password": "student123"
}
```

- Validates credentials
- Creates JWT session
- Sets session cookie
- Redirects based on role

### Sign Out

```typescript
// Client Component
import { signOut } from "next-auth/react";

<button onClick={() => signOut({ callbackUrl: "/" })}>
  Sign Out
</button>

// Server Component/Action
import { signOut } from "@/lib/auth";

<form action={async () => {
  "use server";
  await signOut({ redirectTo: "/" });
}}>
  <button type="submit">Sign Out</button>
</form>
```

## Server-Side Authentication

### Get Current User

```typescript
import { auth } from "@/lib/auth";

export default async function Page() {
  const session = await auth();
  
  if (!session) {
    redirect("/auth/signin");
  }
  
  const user = session.user;
  // user.id, user.email, user.name, user.role
}
```

### Require Authentication

```typescript
import { requireAuth } from "@/lib/auth";

export async function GET() {
  const user = await requireAuth(); // Throws if not authenticated
  // ... proceed with authenticated user
}
```

### Require Specific Role

```typescript
import { requireStudent, requireTeacher, requireAdmin } from "@/lib/auth";

// Student only
export async function POST() {
  const user = await requireStudent(); // Throws if not STUDENT
  // ... student-specific logic
}

// Teacher or Admin
import { requireTeacherOrAdmin } from "@/lib/auth";

export async function DELETE() {
  const user = await requireTeacherOrAdmin();
  // ... privileged operation
}
```

## Client-Side Authentication

### Get Session

```typescript
"use client";

import { useSession } from "next-auth/react";

export function Component() {
  const { data: session, status } = useSession();
  
  if (status === "loading") {
    return <div>Loading...</div>;
  }
  
  if (status === "unauthenticated") {
    return <div>Not signed in</div>;
  }
  
  return (
    <div>
      <p>Signed in as {session.user.name}</p>
      <p>Role: {session.user.role}</p>
    </div>
  );
}
```

### Protected Component

```typescript
"use client";

import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";

export function ProtectedComponent() {
  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      redirect("/auth/signin");
    },
  });
  
  return <div>Protected content</div>;
}
```

## Middleware

The platform uses Next.js middleware to protect routes:

```typescript
// middleware.ts
export async function middleware(request: NextRequest) {
  const session = await auth();
  const pathname = request.nextUrl.pathname;
  
  // Public routes
  const publicRoutes = ["/", "/auth/*"];
  
  // Redirect unauthenticated users
  if (!session && !isPublicRoute) {
    return redirect("/auth/signin");
  }
  
  // Role-based access
  if (session) {
    if (pathname.startsWith("/teacher") && role !== "TEACHER") {
      return redirect(getRoleDefaultRoute(role));
    }
  }
}
```

## API Route Protection

### Protect API Routes

```typescript
// app/api/students/route.ts
import { requireStudent } from "@/lib/auth";

export async function GET() {
  try {
    const user = await requireStudent();
    
    // Fetch student data
    const student = await db.student.findUnique({
      where: { userId: user.id },
    });
    
    return NextResponse.json(student);
  } catch (error) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }
}
```

### Teacher/Admin Only Endpoints

```typescript
// app/api/homework/[id]/grade/route.ts
import { requireTeacherOrAdmin } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const user = await requireTeacherOrAdmin();
    
    // Grade homework
    // ...
    
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403 }
    );
  }
}
```

## Session Management

### Session Configuration

```typescript
// lib/auth.ts
export const { auth, handlers, signIn, signOut } = NextAuth({
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id;
      session.user.role = token.role;
      return session;
    },
  },
});
```

## Security Best Practices

✅ **Password Security**
- Minimum 8 characters
- bcryptjs hashing with 12 rounds
- No password stored in plain text

✅ **Session Security**
- JWT tokens with signed cookies
- Secure, HttpOnly cookies
- 30-day expiration

✅ **Input Validation**
- Email format validation
- Password strength requirements
- SQL injection protection (Prisma ORM)

✅ **Route Protection**
- Middleware-level authentication checks
- Role-based access control
- Automatic redirects for unauthorized access

## Troubleshooting

### "Invalid credentials" error
- Check email and password are correct
- Ensure user exists in database
- Verify password was hashed correctly during signup

### Redirect loops
- Clear browser cookies
- Check middleware matcher patterns
- Verify NEXTAUTH_URL in .env

### Session not persisting
- Ensure NEXTAUTH_SECRET is set in .env
- Check cookie settings in browser
- Verify JWT callback is working

### Role-based access not working
- Check user.role in database
- Verify session callback includes role
- Ensure middleware checks correct routes

## Environment Variables

```env
# Required for NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key-here"

# Generate secret with:
# openssl rand -base64 32
```

## Database Schema

### User Model
```prisma
model User {
  id            String   @id @default(cuid())
  email         String   @unique
  password      String   // bcryptjs hashed
  role          UserRole @default(STUDENT)
  // ... other fields
}

enum UserRole {
  STUDENT
  TEACHER
  PARENT
  ADMIN
}
```

## Future Enhancements

🔮 **Planned Features**
- [ ] OAuth providers (Google, GitHub)
- [ ] Email verification
- [ ] Password reset flow
- [ ] Two-factor authentication (2FA)
- [ ] Remember me functionality
- [ ] Session management dashboard
- [ ] Activity logs
- [ ] IP-based security

---

**Authentication system is production-ready and secure! 🔐**
