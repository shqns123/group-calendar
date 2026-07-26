import test from "node:test";
import assert from "node:assert/strict";

import {
  buildEventNotificationBody,
  buildOvertimeNotificationBody,
  canViewNotificationBell,
  filterNotificationsByTab,
  getEventNotificationNames,
  shouldCreateEventCreatedNotification,
  type NotificationListItem,
} from "../lib/notifications.ts";

test("builds overtime notification body for available status only", () => {
  assert.equal(
    buildOvertimeNotificationBody({
      actorName: "홍길동",
      dateLabel: "5월 30일 (토)",
    }),
    "홍길동님이 5월 30일 (토) 특근 가능으로 표시했습니다.",
  );
});

test("uses personnel names and truncates long event notification bodies", () => {
  assert.equal(
    buildEventNotificationBody({
      title: "야간 점검",
      dateLabel: "26.05.26 ~ 26.05.28",
      names: ["홍길동", "김철수", "이영희", "박민수"],
    }),
    "\"야간 점검\" 26.05.26 ~ 26.05.28 일정 등록 · 홍길동, 김철수 외 2명",
  );
});

test("falls back to actor name when personnel is empty", () => {
  assert.deepEqual(
    getEventNotificationNames({
      personnel: null,
      actorName: "홍길동",
    }),
    ["홍길동"],
  );
});

test("filters notifications by requested tab", () => {
  const notifications: NotificationListItem[] = [
    {
      id: "n1",
      type: "OVERTIME_AVAILABLE",
      title: "특근 가능",
      body: "body",
      createdAt: "2026-05-26T00:00:00.000Z",
      readAt: null,
      resolvedAt: null,
      eventCategory: "BUSINESS_TRIP",
    },
    {
      id: "n2",
      type: "EVENT_CREATED",
      title: "일정 등록",
      body: "body",
      createdAt: "2026-05-26T00:00:00.000Z",
      readAt: "2026-05-26T01:00:00.000Z",
      resolvedAt: null,
      eventCategory: "ATTENDANCE",
    },
    {
      id: "n3",
      type: "JOIN_REQUEST_PENDING",
      title: "승인 대기",
      body: "body",
      createdAt: "2026-05-26T00:00:00.000Z",
      readAt: null,
      resolvedAt: null,
    },
  ];

  assert.deepEqual(
    filterNotificationsByTab(notifications, "all").map((item) => item.id),
    ["n1", "n2", "n3"],
  );
  assert.deepEqual(
    filterNotificationsByTab(notifications, "attendance").map((item) => item.id),
    ["n2"],
  );
  assert.deepEqual(
    filterNotificationsByTab(notifications, "businessTrip").map((item) => item.id),
    ["n1"],
  );
  assert.deepEqual(
    filterNotificationsByTab(notifications, "unread").map((item) => item.id),
    ["n1", "n3"],
  );
  assert.deepEqual(
    filterNotificationsByTab(notifications, "pending").map((item) => item.id),
    ["n3"],
  );
});

test("allows bell only for operator, leader/admin, or canNotify member", () => {
  assert.equal(canViewNotificationBell({ isOperator: true }), true);
  assert.equal(canViewNotificationBell({ memberRole: "ADMIN" }), true);
  assert.equal(canViewNotificationBell({ memberRole: "그룹장" }), true);
  assert.equal(canViewNotificationBell({ canNotify: true }), true);
  assert.equal(
    canViewNotificationBell({ memberRole: "MEMBER", canNotify: false }),
    false,
  );
});

test("skips schedule notifications for overtime-only entries", () => {
  assert.equal(shouldCreateEventCreatedNotification(false), true);
  assert.equal(shouldCreateEventCreatedNotification(true), false);
});
