import { PhoneWebEntry } from "@/components/PhoneWebEntry";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { DashboardClient } from "@/components/DashboardClient";

export default async function Home() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  // Read status and operator rights from the DB: the session JWT keeps the values from sign-in,
  // so a demoted operator would otherwise still see every group.
  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { status: true, isOperator: true },
  });
  if (!dbUser) redirect("/login");
  if (dbUser.status === "PENDING") redirect("/pending");

  const isOperator = dbUser.isOperator;

  const groups = await prisma.group.findMany({
    where: isOperator ? undefined : {
      OR: [
        { leaderId: session.user.id },
        { members: { some: { userId: session.user.id, status: "ACTIVE" } } },
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
    <PhoneWebEntry><DashboardClient
      user={{
        id: session.user.id,
        name: session.user.name ?? null,
        email: session.user.email ?? null,
        image: session.user.image ?? null,
        isOperator,
      }}
      initialGroups={JSON.parse(JSON.stringify(groups))}
    /></PhoneWebEntry>
  );
}
