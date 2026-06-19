import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import JoinOnboardingClient from "./JoinOnboardingClient";

type Props = {
  params: Promise<{ inviteCode: string }>;
};

export default async function JoinInvitePage({ params }: Props) {
  const { inviteCode } = await params;

  const group = await prisma.group.findUnique({
    where: { inviteCode },
    select: { inviteCode: true, name: true },
  });

  if (!group) {
    redirect("/login");
  }

  return <JoinOnboardingClient inviteCode={group.inviteCode} groupName={group.name} />;
}
