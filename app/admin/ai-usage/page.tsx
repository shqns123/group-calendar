import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AiUsageAdmin from "@/components/AiUsageAdmin";

export const metadata = { title: "AI 사용량" };

// Operator-only: AI quick-add calls, cost and per-user monthly caps.
export default async function AiUsagePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { isOperator: true } });
  if (!me?.isOperator) redirect("/");
  return <AiUsageAdmin />;
}
