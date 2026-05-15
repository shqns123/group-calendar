import { auth } from "@/lib/auth";
import { consumePendingInviteForUser } from "@/lib/pendingInvite";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { status: true },
  });

  if (!user || user.status !== "ACTIVE") {
    return Response.json({ consumed: false, pendingAccount: true });
  }

  const result = await consumePendingInviteForUser(session.user.id);

  if (result.status === "created") {
    return Response.json({
      consumed: true,
      active: result.autoApproved,
      joinPending: !result.autoApproved,
      groupName: result.groupName,
    });
  }
  if (result.status === "exists") {
    return Response.json({ consumed: true, alreadyMember: true, groupName: result.groupName });
  }
  if (result.status === "invalid") {
    return Response.json({ consumed: true, invalid: true });
  }

  return Response.json({ consumed: false });
}
