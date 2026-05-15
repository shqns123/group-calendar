import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import JoinOnboardingClient from "./JoinOnboardingClient";

type Props = {
  params: Promise<{ token: string }>;
};

export default async function JoinQrPage({ params }: Props) {
  const { token } = await params;

  const qrToken = await prisma.qrInviteToken.findUnique({
    where: { token },
    select: {
      token: true,
      expiresAt: true,
      group: { select: { name: true } },
    },
  });

  if (!qrToken || qrToken.expiresAt < new Date()) {
    redirect("/login");
  }

  return <JoinOnboardingClient token={qrToken.token} groupName={qrToken.group.name} />;
}
