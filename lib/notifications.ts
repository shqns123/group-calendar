export type NotificationType =
  | "OVERTIME_AVAILABLE"
  | "EVENT_CREATED"
  | "JOIN_REQUEST_PENDING";

export type NotificationTab = "all" | "attendance" | "businessTrip" | "unread" | "pending";

export type NotificationListItem = {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  createdAt: string;
  readAt: string | null;
  resolvedAt: string | null;
  eventCategory?: "BUSINESS_TRIP" | "ATTENDANCE" | null;
};

type EventNotificationNamesInput = {
  personnel: string | null;
  actorName: string;
};

type EventNotificationBodyInput = {
  title: string;
  dateLabel: string;
  names: string[];
};

type OvertimeNotificationBodyInput = {
  actorName: string;
  dateLabel: string;
};

type BellPermissionInput = {
  isOperator?: boolean;
  memberRole?: string | null;
  canNotify?: boolean;
};

const LEADER_ROLE_SET = new Set(["ADMIN", "LEADER", "그룹장", "파트장"]);

export function getEventNotificationNames({
  personnel,
  actorName,
}: EventNotificationNamesInput) {
  if (!personnel?.trim()) {
    return [actorName];
  }

  const names = personnel
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return names.length > 0 ? names : [actorName];
}

export function buildEventNotificationBody({
  title,
  dateLabel,
  names,
}: EventNotificationBodyInput) {
  const normalizedNames = names.map((value) => value.trim()).filter(Boolean);
  const visibleNames = normalizedNames.slice(0, 2).join(", ");
  const remainder = Math.max(0, normalizedNames.length - 2);
  const suffix = remainder > 0 ? ` 외 ${remainder}명` : "";

  return `"${title}" ${dateLabel} 일정 등록 · ${visibleNames}${suffix}`;
}

export function buildOvertimeNotificationBody({
  actorName,
  dateLabel,
}: OvertimeNotificationBodyInput) {
  return `${actorName}님이 ${dateLabel} 특근 가능으로 표시했습니다.`;
}

export function shouldCreateEventCreatedNotification(isOvertimeOnly: boolean) {
  return !isOvertimeOnly;
}

export function filterNotificationsByTab(
  notifications: NotificationListItem[],
  tab: NotificationTab,
) {
  switch (tab) {
    case "attendance":
      return notifications.filter(
        (item) =>
          (item.type === "OVERTIME_AVAILABLE" || item.type === "EVENT_CREATED") &&
          item.eventCategory === "ATTENDANCE",
      );
    case "businessTrip":
      return notifications.filter(
        (item) =>
          (item.type === "OVERTIME_AVAILABLE" || item.type === "EVENT_CREATED") &&
          item.eventCategory !== "ATTENDANCE",
      );
    case "unread":
      return notifications.filter((item) => item.readAt === null);
    case "pending":
      return notifications.filter(
        (item) =>
          item.type === "JOIN_REQUEST_PENDING" && item.resolvedAt === null,
      );
    case "all":
    default:
      return notifications;
  }
}

export function canViewNotificationBell({
  isOperator = false,
  memberRole,
  canNotify = false,
}: BellPermissionInput) {
  if (isOperator) return true;
  if (canNotify) return true;
  if (!memberRole) return false;

  return LEADER_ROLE_SET.has(memberRole);
}
