# Notification Panel And Group Management Relocation Design

## Summary

Move the per-group management action from the top-right header into each group row in the sidebar, placing it immediately to the left of the default-group star. Replace the current header group-management slot with a bell icon that opens a dropdown notification panel.

The notification system will use a dedicated database table instead of transient UI-only state. Notifications are visible only to privileged viewers and are scoped to the currently selected group by default. Push delivery is explicitly out of scope; notifications live inside the web/PWA experience only, with unread counts shown in the UI and mirrored to the installed PWA app badge when browser support exists.

## Goals

- Move group management access into the sidebar group list next to the default-group star.
- Add a top-right bell icon with unread count badge.
- Show a dropdown notification panel with four tabs:
  - `전체`
  - `일정`
  - `읽지않음`
  - `승인대기`
- Persist notifications in the database so unread counts, approval state, and PWA badge counts remain stable across sessions.
- Support these notification sources:
  - Overtime availability marked as available
  - Event creation
  - Group join requests
- Avoid browser/mobile push delivery for these notifications.

## Non-Goals

- No standalone notification page for the web app.
- No native push, web push, or service-worker-delivered toast for the new notification types.
- No long-term immutable notification history for overtime and event notifications once the source object is removed or invalidated.
- No redesign of the existing schedule notification modal beyond coexistence with the new bell panel.

## UX Design

### Sidebar Group Row

Each group row in the sidebar currently exposes a default-group star action. Add a second inline action immediately to the left of that star:

- Left action: group management icon
- Right action: default-group star

This action is shown only when the current user can manage that group under the existing role rules used by the current group-management entrypoint.

### Header Bell Entry

Replace the current top-right group-management button in the main header with:

- Bell icon button
- Numeric unread badge

The badge shows unread notifications visible to the current user under the current group scope.

### Notification Panel

Bell click opens a dropdown panel anchored to the header button. The panel contains:

- Header title: `알림`
- `모두 읽음` action
- Four tabs:
  - `전체`: all visible notifications for the current scope
  - `일정`: overtime-available + event-created notifications
  - `읽지않음`: notifications where `readAt` is null
  - `승인대기`: unresolved join-request notifications

Each row shows:

- Colored square icon
- Title
- Relative time
- Body
- Unread dot when `readAt` is null

Join-request rows additionally show:

- `승인`
- `거절`

### PWA Icon Update

Update the installed PWA icon assets to visually match the colored square icon style used by the event-registration notification row, replacing the current install icon appearance.

## Visibility Rules

The notification bell and panel are visible to:

- Operators: `user.isOperator === true`
- Group leaders/admins under the current group role model
- Group members with `canNotify === true`

Default notification scope:

- Only notifications for the currently selected group are shown

Operator exception:

- Operators may see join-request notifications across groups in the `승인대기` view when needed

## Notification Data Model

Add a dedicated notification table.

### Model

`Notification`

- `id`
- `groupId`
- `type`
  - `OVERTIME_AVAILABLE`
  - `EVENT_CREATED`
  - `JOIN_REQUEST_PENDING`
- `actorUserId`
- `eventId?`
- `groupMemberId?`
- `targetDate?`
- `title`
- `body`
- `readAt?`
- `resolvedAt?`
- `createdAt`
- `updatedAt`

### Recommended Constraints

- Unique `(groupId, type, actorUserId, targetDate)` for overtime-available notifications
- Unique `(eventId, type)` for event-created notifications
- Unique `(groupMemberId, type)` for join-request notifications

These constraints guarantee the intended one-record-per-source behavior and make upsert/delete flows straightforward.

## Notification Lifecycle

### Overtime Availability

Only `available` state creates a notification.

Behavior:

- When a user marks a specific date as overtime available, create or upsert one notification for that user/date/group.
- If the same user changes that date to unavailable, delete the corresponding notification.
- If the overtime-only event is removed entirely, delete the corresponding notification.

Body copy example:

- `홍길동님이 5월 30일 특근 가능으로 표시했습니다.`

There is no overtime notification for the unavailable state.

### Event Creation

One event produces one notification record.

Behavior:

- On event creation, create or upsert one notification bound to the event.
- If the event changes enough to affect the visible message, update the notification body.
- If the event is deleted, delete the notification.

Body formatting:

- Use the event title plus assigned names.
- Prefer personnel names, not just the creator.
- If many names exist, truncate to a compact form:
  - `홍길동, 김철수 외 2명`
- If personnel is empty, fall back to the creator display name.

Body copy example:

- `"야간 점검" 일정 등록 · 홍길동, 김철수 외 2명`

### Group Join Request

Join requests are approval workflow notifications.

Behavior:

- When a member joins with pending status, create one unresolved notification.
- When approved or rejected, mark `resolvedAt` and hide from the default `승인대기` list or delete it immediately depending on implementation simplicity.
- Approval actions from the panel call the existing approval/rejection APIs, then update notification state.

Body copy example:

- `이민수님이 운영팀 A조 참가를 요청했습니다.`

## Read State And Badge Behavior

- Opening the panel does not automatically mark everything as read.
- Individual notification click may mark that notification as read.
- `모두 읽음` sets `readAt` for all visible unread notifications in scope.
- Bell badge count = visible unread notifications for the current user.
- PWA icon badge mirrors the same unread count:
  - Use `navigator.setAppBadge(unreadCount)` when supported
  - Use `navigator.clearAppBadge()` when unread count reaches zero
  - Fall back silently on unsupported browsers

## API Design

Add notification endpoints alongside existing event/group flows.

### Read APIs

- `GET /api/notifications`
  - Query params:
    - `groupId`
    - `tab=all|schedule|unread|pending`
  - Returns only notifications the current user may view
- `POST /api/notifications/read-all`
  - Marks scoped notifications as read
- `POST /api/notifications/[id]/read`
  - Marks a single notification as read

### Action APIs

Use existing join-approval endpoints where possible. If current endpoints are awkward for panel actions, add thin wrappers that call existing logic.

### Trigger Points

- Event creation/update/delete routes maintain `EVENT_CREATED`
- Overtime availability create/delete paths maintain `OVERTIME_AVAILABLE`
- Join-request create/approve/reject flows maintain `JOIN_REQUEST_PENDING`

## Frontend Integration

Primary affected file:

- `components/DashboardClient.tsx`

Additional expected frontend pieces:

- New dropdown panel component
- New notification row component
- New notification data hooks or fetch helpers
- PWA badge sync helper

### UI Changes

- Replace header group-management button with bell button
- Move group management entry into each sidebar group row
- Keep existing schedule notification button separate from the new bell panel unless a later follow-up intentionally consolidates them

## Data Flow

1. User action changes a source object:
   - overtime availability
   - event
   - pending join request
2. Source route upserts/deletes the corresponding notification record
3. Frontend fetches scoped notifications
4. Bell badge count updates
5. Supported browsers sync the PWA app badge

## Error Handling

- If notification creation fails during a source mutation, the source mutation should still succeed unless transaction boundaries intentionally require coupled failure.
- Prefer transactional behavior when source record and notification record are tightly linked and can be safely committed together.
- Bell panel fetch failures should degrade to:
  - bell visible
  - badge hidden or stale-cleared
  - retry on next open/focus

## Testing Strategy

### Database

- Create notification on overtime available
- Delete overtime notification on unavailable/delete
- Create one notification per event
- Delete event notification on event delete
- Create and resolve join-request notifications

### Permissions

- Member without elevated privileges and without `canNotify` cannot see bell
- Leader/admin can see current-group notifications
- `canNotify` member can see current-group notifications
- Operator can see pending join requests across groups as designed

### UI

- Group management icon renders to the left of the default star
- Bell badge count updates with unread count
- Tabs filter correctly:
  - all
  - schedule/event-related
  - unread
  - pending approvals
- `모두 읽음` clears unread counts
- Approve/reject buttons update both member status and notification state

### PWA

- Installed app badge updates when unread count changes on supported browsers
- Unsupported browsers fail gracefully without console-breaking runtime behavior

## Files Expected To Be Affected

- `components/DashboardClient.tsx`
- `components/*` new notification panel components
- `app/api/events/route.ts`
- `app/api/events/[eventId]/route.ts`
- join-request-related API routes
- `prisma/schema.prisma`
- new Prisma migration
- `public/manifest.json`
- `app/favicon.ico` and/or `public/icon-192.png`, `public/icon-512.png`, related app icon assets

## Open Questions Resolved

- Notification panel type: dropdown panel from bell icon
- Tabs: `전체 / 일정 / 읽지않음 / 승인대기`
- Scope: current selected group by default
- Visibility: operator, leader/admin, or `canNotify=true`
- Delivery: no push
- PWA badge: yes when supported
- Overtime notification: available only
- Event notification: one per event, deleted with event
- Event body: include names, truncated with `외 N명`
