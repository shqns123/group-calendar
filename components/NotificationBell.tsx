"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  CalendarPlus2,
  Check,
  CircleDot,
  Clock3,
  MoreVertical,
  UserPlus2,
  X,
} from "lucide-react";
import {
  filterNotificationsByTab,
  type NotificationListItem,
  type NotificationTab,
} from "@/lib/notifications";
import { formatSeoulDateTimeLabel } from "@/lib/seoulTime";

export type NotificationPanelItem = NotificationListItem & {
  groupId: string;
  actorUserId: string | null;
  eventId: string | null;
  groupMemberId: string | null;
  targetDate: string | null;
};

type Props = {
  canView: boolean;
  isMobile: boolean;
  unreadCount: number;
  items: NotificationPanelItem[];
  onMarkRead: (notificationId: string) => void;
  onMarkAllRead: (notificationIds: string[]) => void;
  onClearAll: () => void;
  onApproveJoin: (item: NotificationPanelItem) => void;
  onRejectJoin: (item: NotificationPanelItem) => void;
};

const TAB_ITEMS: Array<{ id: NotificationTab; label: string }> = [
  { id: "all", label: "전체" },
  { id: "schedule", label: "일정" },
  { id: "unread", label: "읽지않음" },
  { id: "pending", label: "승인대기" },
];

function getItemIcon(type: NotificationPanelItem["type"]) {
  switch (type) {
    case "OVERTIME_AVAILABLE":
      return <Clock3 style={{ width: 16, height: 16 }} />;
    case "JOIN_REQUEST_PENDING":
      return <UserPlus2 style={{ width: 16, height: 16 }} />;
    case "EVENT_CREATED":
    default:
      return <CalendarPlus2 style={{ width: 16, height: 16 }} />;
  }
}

export default function NotificationBell({
  canView,
  isMobile,
  unreadCount,
  items,
  onMarkRead,
  onMarkAllRead,
  onClearAll,
  onApproveJoin,
  onRejectJoin,
}: Props) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<NotificationTab>("all");
  const [menuOpen, setMenuOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const filteredItems = useMemo(
    () => filterNotificationsByTab(items, tab) as NotificationPanelItem[],
    [items, tab],
  );
  const unreadIds = useMemo(
    () => filteredItems.filter((item) => item.readAt === null).map((item) => item.id),
    [filteredItems],
  );

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setMenuOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  if (!canView) return null;

  return (
    <div ref={rootRef} style={{ position: "relative", flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "5px 10px",
          borderRadius: 6,
          border: "1px solid var(--border)",
          background: open ? "var(--surface-raised)" : "var(--surface)",
          color: "var(--text-secondary)",
          fontSize: "0.78rem",
          fontWeight: 500,
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        <Bell style={{ width: 14, height: 14 }} />
        {!isMobile && "알림"}
        {unreadCount > 0 && (
          <span
            style={{
              minWidth: 18,
              height: 18,
              padding: "0 5px",
              borderRadius: 999,
              background: "#E94B4B",
              color: "#fff",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "0.66rem",
              fontWeight: 700,
            }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="modal-scale-in"
          style={{
            position: "absolute",
            top: "calc(100% + 10px)",
            right: 0,
            width: isMobile ? "min(92vw, 360px)" : 390,
            maxHeight: "min(72vh, 620px)",
            borderRadius: 16,
            border: "1px solid var(--border)",
            background: "var(--surface)",
            boxShadow: "0 24px 60px rgba(0,0,0,0.18)",
            overflow: "hidden",
            zIndex: 120,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "16px 16px 12px",
              borderBottom: "1px solid var(--border-subtle)",
            }}
          >
            <div>
              <p style={{ margin: 0, fontSize: "0.92rem", fontWeight: 700, color: "var(--text-primary)" }}>
                알림
              </p>
              <p style={{ margin: "3px 0 0", fontSize: "0.72rem", color: "var(--text-tertiary)" }}>
                읽지 않은 알림 {unreadCount}개
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setMenuOpen(false);
                }}
                style={{
                  border: "none",
                  background: "none",
                  color: "var(--text-tertiary)",
                  display: "flex",
                  cursor: "pointer",
                  padding: 2,
                }}
              >
                <X style={{ width: 16, height: 16 }} />
              </button>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "12px 14px 10px",
              borderBottom: "1px solid var(--border-subtle)",
            }}
          >
            <div style={{ display: "flex", gap: 8, flex: 1, minWidth: 0 }}>
              {TAB_ITEMS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  style={{
                    border: "none",
                    borderRadius: 999,
                    padding: "7px 11px",
                    background: tab === item.id ? "var(--text-primary)" : "var(--surface-raised)",
                    color: tab === item.id ? "#fff" : "var(--text-secondary)",
                    fontSize: "0.74rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    whiteSpace: "nowrap",
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div style={{ position: "relative", flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => setMenuOpen((prev) => !prev)}
                aria-label="알림 작업 더보기"
                style={{
                  width: 34,
                  height: 34,
                  border: "none",
                  borderRadius: 999,
                  background: menuOpen ? "var(--surface-raised)" : "transparent",
                  color: "var(--text-secondary)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                <MoreVertical style={{ width: 16, height: 16 }} />
              </button>

              {menuOpen && (
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 8px)",
                    right: 0,
                    minWidth: 132,
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    background: "var(--surface)",
                    boxShadow: "0 16px 36px rgba(0,0,0,0.14)",
                    padding: 6,
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                    zIndex: 2,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      onMarkAllRead(unreadIds);
                      setMenuOpen(false);
                    }}
                    disabled={unreadIds.length === 0}
                    style={{
                      border: "none",
                      borderRadius: 8,
                      background: "transparent",
                      color: unreadIds.length === 0 ? "var(--text-tertiary)" : "var(--text-secondary)",
                      fontSize: "0.78rem",
                      fontWeight: 600,
                      cursor: unreadIds.length === 0 ? "default" : "pointer",
                      fontFamily: "inherit",
                      textAlign: "left",
                      padding: "9px 10px",
                    }}
                  >
                    모두 읽음
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onClearAll();
                      setMenuOpen(false);
                    }}
                    disabled={items.length === 0}
                    style={{
                      border: "none",
                      borderRadius: 8,
                      background: "transparent",
                      color: items.length === 0 ? "var(--text-tertiary)" : "#DC2626",
                      fontSize: "0.78rem",
                      fontWeight: 600,
                      cursor: items.length === 0 ? "default" : "pointer",
                      fontFamily: "inherit",
                      textAlign: "left",
                      padding: "9px 10px",
                    }}
                  >
                    모두 지우기
                  </button>
                </div>
              )}
            </div>
          </div>

          <div style={{ overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
            {filteredItems.length === 0 && (
              <div
                style={{
                  padding: "28px 16px",
                  borderRadius: 14,
                  background: "var(--surface-raised)",
                  textAlign: "center",
                  color: "var(--text-tertiary)",
                  fontSize: "0.8rem",
                }}
              >
                표시할 알림이 없습니다.
              </div>
            )}

            {filteredItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (item.readAt === null) {
                    onMarkRead(item.id);
                  }
                }}
                style={{
                  width: "100%",
                  textAlign: "left",
                  border: item.type === "JOIN_REQUEST_PENDING" ? "1px solid #F4D38A" : "1px solid var(--border)",
                  borderRadius: 14,
                  background: item.readAt === null ? "var(--surface)" : "var(--surface-raised)",
                  padding: "13px 14px",
                  display: "flex",
                  gap: 12,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 12,
                    background:
                      item.type === "JOIN_REQUEST_PENDING"
                        ? "#FFF3D8"
                        : item.type === "OVERTIME_AVAILABLE"
                          ? "#E7F6EF"
                          : "#EAF1FF",
                    color:
                      item.type === "JOIN_REQUEST_PENDING"
                        ? "#B7791F"
                        : item.type === "OVERTIME_AVAILABLE"
                          ? "#17804B"
                          : "#315BCF",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {getItemIcon(item.type)}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <p style={{ margin: 0, fontSize: "0.82rem", fontWeight: 700, color: "var(--text-primary)" }}>
                      {item.title}
                    </p>
                    {item.readAt === null && <CircleDot style={{ width: 12, height: 12, color: "#E94B4B" }} />}
                  </div>
                  <p
                    style={{
                      margin: "5px 0 0",
                      fontSize: "0.76rem",
                      lineHeight: 1.55,
                      color: "var(--text-secondary)",
                      wordBreak: "keep-all",
                    }}
                  >
                    {item.body}
                  </p>
                  <p style={{ margin: "7px 0 0", fontSize: "0.7rem", color: "var(--text-tertiary)" }}>
                    {formatSeoulDateTimeLabel(item.createdAt)}
                  </p>

                  {item.type === "JOIN_REQUEST_PENDING" && item.groupMemberId && item.resolvedAt === null && (
                    <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onApproveJoin(item);
                        }}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          border: "none",
                          borderRadius: 8,
                          background: "#DCFCE7",
                          color: "#166534",
                          padding: "7px 10px",
                          fontSize: "0.73rem",
                          fontWeight: 700,
                          cursor: "pointer",
                          fontFamily: "inherit",
                        }}
                      >
                        <Check style={{ width: 13, height: 13 }} />
                        승인
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onRejectJoin(item);
                        }}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          border: "none",
                          borderRadius: 8,
                          background: "#FEE2E2",
                          color: "#991B1B",
                          padding: "7px 10px",
                          fontSize: "0.73rem",
                          fontWeight: 700,
                          cursor: "pointer",
                          fontFamily: "inherit",
                        }}
                      >
                        <X style={{ width: 13, height: 13 }} />
                        거절
                      </button>
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
