import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { prisma, prismaUnfiltered } from "./prisma";

// Validate required environment variables
function validateEnv() {
  const required = [
    "AUTH_SECRET",
    "AUTH_GOOGLE_ID",
    "AUTH_GOOGLE_SECRET",
    "SUPER_ADMIN_EMAIL",
  ];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}\n` +
      "Please check your .env file and ensure all required variables are set."
    );
  }

  // Warn if CRON_SECRET is missing
  if (!process.env.CRON_SECRET) {
    console.warn(
      "⚠️  CRON_SECRET is not set. Cron endpoints will not be accessible."
    );
  }

  // Warn if SMTP is not configured
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn(
      "⚠️  SMTP is not configured. Email notifications will be disabled. Set SMTP_HOST, SMTP_USER, SMTP_PASS in .env"
    );
  }
}

// Run validation on module load
validateEnv();

const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL?.toLowerCase();

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
    }),
  ],
  session: { 
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
  },
  callbacks: {
    async signIn({ user }) {
      const email = user.email?.toLowerCase();
      if (!email) return false;

      if (email === SUPER_ADMIN_EMAIL) return true;

      // Use unfiltered client to detect soft-deleted users
      const existing = await prismaUnfiltered.user.findUnique({
        where: { email },
        select: { id: true, globalRole: true, deletedAt: true },
      });

      // Block sign-in for soft-deleted users
      if (existing?.deletedAt) {
        return false;
      }

      if (existing) {
        return true;
      }

      // Also allow volunteers whose email matches a Volunteer record
      const volunteerRecord = await prisma.volunteer.findFirst({
        where: { email },
        select: { id: true },
      });

      return !!volunteerRecord;
    },
    async jwt({ token, user, trigger }) {
      const email = user?.email?.toLowerCase() ?? (token.email as string | undefined)?.toLowerCase();

      if (email) {
        const isSuperAdmin = email === SUPER_ADMIN_EMAIL;
        const isSignIn = trigger === "signIn" || trigger === "signUp";

        try {
          if (isSignIn) {
            // Block soft-deleted users from getting a valid JWT
            const existingUser = await prismaUnfiltered.user.findUnique({
              where: { email },
              select: { id: true, deletedAt: true },
            });
            if (existingUser?.deletedAt) {
              return token; // Return minimal token — signIn callback already rejected
            }

            // Check if a volunteer record exists with this email and no user linked yet
            const unlinkedVolunteer = await prisma.volunteer.findFirst({
              where: { email, userId: null },
              select: { id: true },
            });

            const dbUser = await prismaUnfiltered.user.upsert({
              where: { email },
              update: {
                name: user?.name ?? undefined,
                ...(isSuperAdmin ? { globalRole: "SUPER_ADMIN" } : {}),
              },
              create: {
                email,
                name: user?.name ?? (token.name as string) ?? email,
                globalRole: isSuperAdmin ? "SUPER_ADMIN" : unlinkedVolunteer ? "VOLUNTEER" : "VIEWER",
              },
              select: { id: true, globalRole: true },
            });

            // Link volunteer profile to the user account on first sign-in
            if (unlinkedVolunteer) {
              await prisma.volunteer.update({
                where: { id: unlinkedVolunteer.id },
                data: { userId: dbUser.id },
              });
            }

            token.id = dbUser.id;
            token.globalRole = dbUser.globalRole;
          } else {
            const dbUser = await prisma.user.findUnique({
              where: { email },
              select: { id: true, globalRole: true },
            });
            if (dbUser) {
              token.id = dbUser.id;
              token.globalRole = dbUser.globalRole;
            }
          }
        } catch {
          if (user) {
            token.id = user.id!;
            token.globalRole = isSuperAdmin ? "SUPER_ADMIN" : "VIEWER";
          }
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.globalRole = token.globalRole as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/",
    error: "/",
  },
});
