import { startScheduler } from "@/lib/scheduler";

export function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    startScheduler();
  }
}
