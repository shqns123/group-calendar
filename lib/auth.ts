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

        const user = await prisma.user.findUnique({ where: { employeeId } });

        // 미등록, 이름 불일치, PENDING 모두 거부
        if (!user || user.name !== name || user.status !== "ACTIVE") return null;

        return { id: user.id, name: user.name, email: user.email };
      },
    }),
  ],
  events: {
    // 신규 OAuth(Google) 유저 생성 시 PENDING으로 변경 + 운영자 푸시
    async createUser({ user }) {
      await prisma.user.update({ where: { id: user.id }, data: { status: "PENDING" } });

      const operators = await prisma.user.findMany({
        where: { isOperator: true },
        select: { pushSubscriptions: true },
      });
      const allSubs = operators.flatMap((u) => u.pushSubscriptions);
      if (allSubs.length > 0) {
        const { sendPushToUser } = await import("./webpush");
        await sendPushToUser(allSubs, {
          title: "새 가입 요청",
          body: `${user.name ?? user.email}님이 Google 계정으로 가입 승인을 요청했습니다.`,
          url: "/",
        });
      }
    },
  },
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        // 운영자 이메일이면 즉시 ACTIVE + isOperator 보장
        if (process.env.OPERATOR_EMAIL && user.email === process.env.OPERATOR_EMAIL) {
          await prisma.user.update({
            where: { email: user.email },
            data: { status: "ACTIVE", isOperator: true },
          });
          return true;
        }
        const dbUser = await prisma.user.findUnique({
          where: { email: user.email! },
          select: { status: true },
        });
        if (dbUser?.status === "PENDING") return "/pending";
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { status: true, isOperator: true },
        });
        token.status = dbUser?.status ?? "ACTIVE";
        // OPERATOR_EMAIL 환경변수와 일치하면 자동 운영자 부여
        if (!dbUser?.isOperator && user.email && user.email === process.env.OPERATOR_EMAIL) {
          await prisma.user.update({ where: { id: user.id }, data: { isOperator: true } });
          token.isOperator = true;
        } else {
          token.isOperator = dbUser?.isOperator ?? false;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token?.id) session.user.id = token.id as string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const u = session.user as any;
      u.status = token.status ?? "ACTIVE";
      u.isOperator = token.isOperator ?? false;
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
