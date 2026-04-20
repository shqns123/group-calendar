import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { DashboardClient } from "@/components/DashboardClient";

export default async function Home() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isOperator = (session.user as any).isOperator ?? false;

  const groups = await prisma.group.findMany({
    where: isOperator ? undefined : {
      OR: [
        { leaderId: session.user.id },
        { members: { some: { userId: session.user.id } } },
      ],
    },
    include: {
      leader: { select: { id: true, name: true, email: true, image: true } },
      members: {
        include: {
          user: { select: { id: true, name: true, email: true, image: true } },
        },
        orderBy: { joinedAt: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <DashboardClient
      user={{
        id: session.user.id,
        name: session.user.name ?? null,
        email: session.user.email ?? null,
        image: session.user.image ?? null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        isOperator: (session.user as any).isOperator ?? false,
      }}
      initialGroups={JSON.parse(JSON.stringify(groups))}
    />
  );
}
