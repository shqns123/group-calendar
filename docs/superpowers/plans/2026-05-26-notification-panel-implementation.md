# Notification Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a scoped notification bell panel, persist notification records, relocate group management into the sidebar row, and update PWA badge/icon behavior without sending push notifications.

**Architecture:** Add a dedicated Prisma `Notification` model plus server-side helpers that keep notifications synchronized with overtime availability, event lifecycle, and pending join requests. Expose scoped read/update APIs for the dashboard bell panel, then wire the dashboard UI and PWA badge sync to those APIs while moving the group-management affordance into the sidebar row.

**Tech Stack:** Next.js App Router, React 19, Prisma + SQLite, Node test runner, PWA manifest/icons

---

### Task 1: Notification schema and helper coverage

**Files:**
- Create: `lib/notifications.ts`
- Create: `tests/notifications.test.ts`
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260526000000_add_notifications/migration.sql`

- [ ] Define notification types, filter helpers, viewer rules, and message formatting helpers in `lib/notifications.ts`.
- [ ] Write failing Node tests for overtime notification keys, event body truncation, tab filtering, and viewer eligibility in `tests/notifications.test.ts`.
- [ ] Run `node --experimental-strip-types --test tests/notifications.test.ts` and verify the new tests fail for missing exports or behavior mismatches.
- [ ] Implement the minimal helper code to pass the tests.
- [ ] Add Prisma `Notification` model and SQL migration matching the approved spec.

### Task 2: Notification persistence and source synchronization

**Files:**
- Modify: `app/api/events/route.ts`
- Modify: `app/api/events/[eventId]/route.ts`
- Modify: `app/api/groups/join/route.ts`
- Modify: `app/api/admin/approve/route.ts`
- Create: `lib/notificationStore.ts`

- [ ] Extract notification persistence helpers into `lib/notificationStore.ts` for create/update/delete flows tied to events and join requests.
- [ ] Write a failing test for server-side notification store helpers if they can be unit-tested without the database; otherwise add focused helper coverage around message/key generation before route changes.
- [ ] Update event create/update/delete routes so overtime-available and event-created notifications are upserted or deleted according to the spec.
- [ ] Update join request create/approve/reject flows so pending notifications are created and resolved/deleted.
- [ ] Re-run the focused test command plus typecheck to verify route changes compile.

### Task 3: Notification read APIs and dashboard data flow

**Files:**
- Create: `app/api/notifications/route.ts`
- Create: `app/api/notifications/read-all/route.ts`
- Create: `app/api/notifications/[notificationId]/read/route.ts`
- Modify: `lib/groupPermissions.ts`

- [ ] Add a helper in `lib/groupPermissions.ts` for bell visibility using operator, leader/admin, or `canNotify`.
- [ ] Write failing tests for tab filtering and permission helper behavior if new pure helpers are introduced.
- [ ] Implement `GET /api/notifications` with current-group scope and operator pending-request exception.
- [ ] Implement read endpoints for single notification and scoped mark-all-read.
- [ ] Run tests and `npx tsc --noEmit` to verify API signatures and types.

### Task 4: Dashboard bell UI and group-management relocation

**Files:**
- Modify: `components/DashboardClient.tsx`
- Create: `components/NotificationBell.tsx`
- Create: `components/NotificationPanel.tsx`

- [ ] Write failing UI-oriented helper tests if any tab-label or badge-count logic is extracted into pure functions; otherwise rely on compile/lint verification for the React layer.
- [ ] Move the existing group-management trigger from the header into each sidebar group row, directly left of the default-group star.
- [ ] Replace the header management button with a bell button and unread badge.
- [ ] Add the dropdown notification panel with tabs `전체 / 일정 / 읽지않음 / 승인대기`, row rendering, read actions, and approve/reject actions.
- [ ] Keep the existing schedule notification button intact and separate from the new bell panel.

### Task 5: PWA badge sync and install icon refresh

**Files:**
- Modify: `public/manifest.json`
- Modify: `public/icon-192.png`
- Modify: `public/icon-512.png`
- Modify: `public/apple-touch-icon.png`
- Modify: `scripts/generate-icons.mjs`
- Create or Modify: any temporary icon source assets needed for regeneration

- [ ] Update icon generation so the installed app icon matches the colored square notification-card icon direction approved in the spec.
- [ ] Regenerate the PWA PNG assets.
- [ ] Add client-side badge sync using `navigator.setAppBadge` / `clearAppBadge` behind feature detection.
- [ ] Verify manifest references remain correct and no push behavior is introduced.

### Task 6: Verification

**Files:**
- Modify: `tests/notifications.test.ts` if extra cases are needed

- [ ] Run `node --experimental-strip-types --test tests/notifications.test.ts`
- [ ] Run `cmd /c npm run lint`
- [ ] Run `cmd /c npx tsc --noEmit`
- [ ] Review the implemented behavior against `docs/superpowers/specs/2026-05-26-notification-panel-design.md` and confirm every requirement is covered.
