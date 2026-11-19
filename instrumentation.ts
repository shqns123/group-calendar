export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // One-off data fix that is safe to repeat: guests whose email still holds their employee ID.
    try {
      const [{ prisma }, { migrateLegacyGuestEmails }] = await Promise.all([
        import("@/lib/prisma"),
        import("@/lib/guestEmail"),
      ]);
      const moved = await migrateLegacyGuestEmails(prisma);
      if (moved > 0) console.log(`[guest-email] moved ${moved} guest account(s) to a random email`);
    } catch (error) {
      console.error("[guest-email] migration failed", error);
    }

    const { startScheduler } = await import("@/lib/scheduler");
    startScheduler();
  }
}
