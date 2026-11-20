import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "./prisma";
import { consumePendingInviteForUser } from "./pendingInvite";
import { createGoogleProviderOptions } from "./googleAuthOptions";
import { saveGoogleSignupIntent } from "./signupIdentity";

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  providers: [
    Google(createGoogleProviderOptions()),
    Credentials({
      id: "guest",
      name: "Guest login",
      credentials: { name: { label: "Name", type: "text" }, employeeId: { label: "Employee ID", type: "text" } },
      async authorize(credentials) {
        const name = typeof credentials?.name === "string" ? credentials.name.trim() : "";
        const employeeId = typeof credentials?.employeeId === "string" ? credentials.employeeId.trim() : "";
        if (!name || !employeeId) return null;
        const user = await prisma.user.findUnique({ where: { employeeId } });
        if (!user || user.name !== name || user.status !== "ACTIVE") return null;
        return { id: user.id, name: user.name, email: user.email, image: user.image };
      },
    }),
  ],
  events: {
    async createUser({ user }) {
      // Only the configured operator can bootstrap without an invitation. Every other
      // new Google account is redirected by signIn before the adapter creates a user.
      const operator = !!process.env.OPERATOR_EMAIL && user.email?.toLowerCase() === process.env.OPERATOR_EMAIL.toLowerCase();
      if (!operator) throw new Error("Signup requires a verified invitation.");
      await prisma.user.update({ where: { id: user.id }, data: { status: "ACTIVE", isOperator: true } });
    },
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "google") {
        if (!user.email || profile?.email_verified !== true) return false;
        const email = user.email.toLowerCase();
        const operator = !!process.env.OPERATOR_EMAIL && email === process.env.OPERATOR_EMAIL.toLowerCase();
        const dbUser = await prisma.user.findUnique({ where: { email } });
        if (operator) {
          if (dbUser) await prisma.user.update({ where: { id: dbUser.id }, data: { status: "ACTIVE", isOperator: true } });
          return true;
        }
        if (!dbUser || (dbUser.status === "PENDING" && !dbUser.signupVerifiedAt)) {
          await saveGoogleSignupIntent({ sub: account.providerAccountId, email, name: user.name ?? undefined, picture: user.image ?? undefined });
          return "/login?signup=qr&view=web";
        }
        if (dbUser.status !== "ACTIVE" && dbUser.status !== "PENDING") return false;
        if (dbUser.status === "ACTIVE" && dbUser.pendingInviteCode) await consumePendingInviteForUser(dbUser.id);
      }
      if (account?.provider === "guest" && user.id) {
        const guest = await prisma.user.findUnique({ where: { id: user.id }, select: { pendingInviteCode: true } });
        if (guest?.pendingInviteCode) await consumePendingInviteForUser(user.id);
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { status: true, isOperator: true } });
        token.status = dbUser?.status ?? "PENDING";
        token.isOperator = dbUser?.isOperator ?? false;
      }
      return token;
    },
    async session({ session, token }) {
      if (token?.id) session.user.id = token.id as string;
      session.user.status = (token.status as string) ?? "PENDING";
      session.user.isOperator = (token.isOperator as boolean) ?? false;
      return session;
    },
  },
  pages: { signIn: "/login" },
});
