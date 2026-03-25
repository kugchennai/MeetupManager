import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { prisma, prismaUnfiltered } from "./prisma";

const googleClientId = process.env.AUTH_GOOGLE_ID;
const googleClientSecret = process.env.AUTH_GOOGLE_SECRET;
const hasGoogleOAuthConfig = Boolean(googleClientId && googleClientSecret);

if (googleClientId && !googleClientSecret) {
  console.warn("AUTH_GOOGLE_ID is set but AUTH_GOOGLE_SECRET is missing. Google sign-in is disabled.");
}

if (!googleClientId && googleClientSecret) {
  console.warn("AUTH_GOOGLE_SECRET is set but AUTH_GOOGLE_ID is missing. Google sign-in is disabled.");
}

if (!hasGoogleOAuthConfig) {
  console.warn("Google OAuth env vars are missing. Google sign-in is disabled until AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET are set.");
}

const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL?.toLowerCase();

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: hasGoogleOAuthConfig
    ? [
      Google({
        clientId: googleClientId,
        clientSecret: googleClientSecret,
      }),
    ]
    : [],
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
