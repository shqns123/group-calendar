import { timingSafeEqual } from "crypto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RequestActor = {
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
  };
};

function tokenMatches(candidate: string, expected: string) {
  const candidateBuffer = Buffer.from(candidate);
  const expectedBuffer = Buffer.from(expected);
  return candidateBuffer.length === expectedBuffer.length && timingSafeEqual(candidateBuffer, expectedBuffer);
}

/**
 * Resolves a normal browser session, or the narrowly-scoped MCP service identity.
 * The token is intentionally validated in the web app so MCP never needs database access.
 */
export async function getRequestActor(request: Request): Promise<RequestActor | null> {
  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";
  const configuredToken = process.env.MCP_API_TOKEN;
  const serviceEmail = process.env.MCP_SERVICE_USER_EMAIL;

  if (token && configuredToken && serviceEmail && tokenMatches(token, configuredToken)) {
    const user = await prisma.user.findUnique({
      where: { email: serviceEmail },
      select: { id: true, name: true, email: true },
    });
    return user ? { user } : null;
  }

  const session = await auth();
  return session?.user?.id ? { user: session.user } : null;
}
