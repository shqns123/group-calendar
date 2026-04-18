import { auth } from "@/lib/auth";
import { eventBus } from "@/lib/eventBus";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const groupId = new URL(request.url).searchParams.get("groupId") ?? "";

  const stream = new ReadableStream({
    start(controller) {
      const send = (gid: string) => {
        if (gid !== groupId) return;
        try {
          controller.enqueue(`data: refresh\n\n`);
        } catch {
          // client disconnected
        }
      };

      const unsubscribe = eventBus.subscribe(send);

      request.signal.addEventListener("abort", () => {
        unsubscribe();
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
