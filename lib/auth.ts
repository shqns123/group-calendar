import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "./prisma";

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    Credentials({
      id: "guest",
      name: "게스트 로그인",
      credentials: {
        name: { label: "이름", type: "text" },
        employeeId: { label: "사번", type: "text" },
      },
      async authorize(credentials) {
        const name = (credentials?.name as string)?.trim();
        const employeeId = (credentials?.employeeId as string)?.trim();

        if (!name || !employeeId) return null;

        const syntheticEmail = `guest_${employeeId}@local.guest`;

        let user = await prisma.user.findUnique({
          where: { employeeId },
        });

        if (!user) {
          user = await prisma.user.create({
            data: {
              name,
              email: syntheticEmail,
              employeeId,
            },
          });
        }

        return { id: user.id, name: user.name, email: user.email };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token?.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
