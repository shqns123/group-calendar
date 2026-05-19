import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "./prisma";
import { sendMobilePushToTokens } from "./mobilepush";
import { consumePendingInviteForUser } from "./pendingInvite";

type NativeGoogleProfile = {
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
  picture?: string;
  aud: string;
};

async function notifyOperatorsAboutGoogleSignup(nameOrEmail: string) {
  const operators = await prisma.user.findMany({
    where: { isOperator: true },
    select: { pushSubscriptions: true, mobileDeviceTokens: true },
  });

  const webSubscriptions = operators.flatMap((operator) => operator.pushSubscriptions);
  const mobileTokens = operators.flatMap((operator) =>
    operator.mobileDeviceTokens.map((token) => token.token),
  );

  const payload = {
    title: "가입 요청",
    body: `${nameOrEmail} 님이 Google 계정으로 가입 승인을 요청했습니다.`,
    url: "/",
  };

  if (webSubscriptions.length > 0) {
    const { sendPushToUser } = await import("./webpush");
    await sendPushToUser(webSubscriptions, payload);
  }

  if (mobileTokens.length > 0) {
    await sendMobilePushToTokens(mobileTokens, payload);
  }
}

async function verifyNativeGoogleIdToken(idToken: string): Promise<NativeGoogleProfile> {
  const response = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
    { cache: "no-store" },
  );

  if (!response.ok) {
    throw new Error("Invalid Google ID token.");
  }

  const profile = (await response.json()) as Partial<NativeGoogleProfile>;
  if (!profile.email || !profile.sub || !profile.aud) {
    throw new Error("Google profile is incomplete.");
  }
  if (profile.aud !== process.env.GOOGLE_CLIENT_ID) {
    throw new Error("Google client ID does not match this app.");
  }
  if (!profile.email_verified) {
    throw new Error("Google email address is not verified.");
  }

  return profile as NativeGoogleProfile;
}

async function findOrCreateNativeGoogleUser(idToken: string) {
  const profile = await verifyNativeGoogleIdToken(idToken);
  const isOperator = Boolean(
    process.env.OPERATOR_EMAIL &&
      profile.email.toLowerCase() === process.env.OPERATOR_EMAIL.toLowerCase(),
  );

  const existingUser = await prisma.user.findUnique({
    where: { email: profile.email },
  });

  if (existingUser) {
    return prisma.user.update({
      where: { id: existingUser.id },
      data: {
        name: profile.name ?? existingUser.name,
        image: profile.picture ?? existingUser.image,
        isOperator: isOperator || existingUser.isOperator,
        status: isOperator ? "ACTIVE" : existingUser.status,
      },
    });
  }

  const createdUser = await prisma.user.create({
    data: {
      email: profile.email,
      name: profile.name,
      image: profile.picture,
      status: isOperator ? "ACTIVE" : "PENDING",
      isOperator,
    },
  });

  await prisma.account.upsert({
    where: {
      provider_providerAccountId: {
        provider: "google",
        providerAccountId: profile.sub,
      },
    },
    update: {
      userId: createdUser.id,
      type: "oauth",
    },
    create: {
      userId: createdUser.id,
      type: "oauth",
      provider: "google",
      providerAccountId: profile.sub,
    },
  });

  if (!isOperator) {
    await notifyOperatorsAboutGoogleSignup(createdUser.name ?? createdUser.email ?? "A user");
  }

  return createdUser;
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    Credentials({
      id: "google-native",
      name: "Google native login",
      credentials: {
        idToken: { label: "ID Token", type: "text" },
      },
      async authorize(credentials) {
        const idToken = (credentials?.idToken as string | undefined)?.trim();
        if (!idToken) return null;

        const user = await findOrCreateNativeGoogleUser(idToken);
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
        };
      },
    }),
    Credentials({
      id: "guest",
      name: "Guest login",
      credentials: {
        name: { label: "Name", type: "text" },
        employeeId: { label: "Employee ID", type: "text" },
      },
      async authorize(credentials) {
        const name = (credentials?.name as string)?.trim();
        const employeeId = (credentials?.employeeId as string)?.trim();
        if (!name || !employeeId) return null;

        const user = await prisma.user.findUnique({ where: { employeeId } });
        if (!user || user.name !== name || user.status !== "ACTIVE") return null;

        return { id: user.id, name: user.name, email: user.email, image: user.image };
      },
    }),
  ],
  events: {
    async createUser({ user }) {
      await prisma.user.update({
        where: { id: user.id },
        data: { status: "PENDING" },
      });
      await notifyOperatorsAboutGoogleSignup(user.name ?? user.email ?? "A user");
    },
  },
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google" || account?.provider === "google-native") {
        if (process.env.OPERATOR_EMAIL && user.email === process.env.OPERATOR_EMAIL) {
          await prisma.user.update({
            where: { email: user.email },
            data: { status: "ACTIVE", isOperator: true },
          });
          return true;
        }

        const dbUser = await prisma.user.findUnique({
          where: { email: user.email! },
          select: { id: true, status: true, pendingInviteCode: true },
        });

        if (dbUser?.status === "ACTIVE" && dbUser.pendingInviteCode) {
          await consumePendingInviteForUser(dbUser.id);
        }
        if (dbUser?.status === "PENDING") {
          return account.provider === "google-native" ? true : "/pending";
        }
      }

      if (account?.provider === "guest" && user.id) {
        const guestUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { pendingInviteCode: true },
        });
        if (guestUser?.pendingInviteCode) {
          await consumePendingInviteForUser(user.id);
        }
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
        if (!dbUser?.isOperator && user.email && user.email === process.env.OPERATOR_EMAIL) {
          await prisma.user.update({
            where: { id: user.id },
            data: { isOperator: true },
          });
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
      const sessionUser = session.user as any;
      sessionUser.status = token.status ?? "ACTIVE";
      sessionUser.isOperator = token.isOperator ?? false;
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
