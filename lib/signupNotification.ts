import "server-only";
import { prisma } from "./prisma";
import { sendMobilePushToTokens } from "./mobilepush";
import { sendPushToUser } from "./webpush";

export async function notifySignupOperators(name: string, groupName: string) {
  const operators = await prisma.user.findMany({ where: { isOperator: true, status: "ACTIVE" },
    select: { pushSubscriptions: true, mobileDeviceTokens: true } });
  const payload = { title: "회원가입 요청", body: `${name} 님이 ${groupName} 초대 QR을 확인하고 가입 승인을 요청했습니다.`, url: "/" };
  // A delivery failure must not turn a committed signup into a failed request.
  const results = await Promise.allSettled([
    sendPushToUser(operators.flatMap((operator) => operator.pushSubscriptions), payload),
    sendMobilePushToTokens([...new Set(operators.flatMap((operator) => operator.mobileDeviceTokens.map((item) => item.token)))], payload),
  ]);
  for (const result of results) if (result.status === "rejected") console.error("Signup notification failed", result.reason);
}
