"use client";

import { useState, useCallback, useEffect } from "react";
import { signOut } from "next-auth/react";
import {
  Calendar,
  Users,
  Plus,
  LogOut,
  Settings,
  User,
  PanelLeftClose,
  Menu,
  Share2,
  Copy,
  Check,
  RefreshCw,
  X,
  BookOpen,
  Bell,
  UserCheck,
  UserX,
  CalendarClock,
} from "lucide-react";
import CalendarView from "./CalendarView";
import GroupPanel from "./GroupPanel";
import GroupModal, { type GroupFromApi } from "./GroupModal";
import JoinGroupModal from "./JoinGroupModal";
import EventSummary from "./EventSummary";
import AdminModal from "./AdminModal";
import ScheduleModal from "./ScheduleModal";

type UserInfo = {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  isOperator: boolean;
};

type Group = GroupFromApi;

type CalEvent = {
  id: string;
  title: string;
  description: string | null;
  startDate: string;
  endDate: string;
  allDay: boolean;
  color: string;
  isPrivate: boolean;
  overtimeAvailable: boolean;
  isOvertimeOnly: boolean;
  personnel: string | null;
  creatorId: string;
  groupId: string | null;
  creator: { id: string; name: string | null; email: string | null; image: string | null };
};

type Props = {
  user: UserInfo;
  initialGroups: Group[];
};


function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

export function DashboardClient({ user, initialGroups }: Props) {
  const [groups, setGroups] = useState<Group[]>(initialGroups);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(
    initialGroups[0]?.id ?? null
  );
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showGroupPanel, setShowGroupPanel] = useState(false);
  const [showInviteSheet, setShowInviteSheet] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [summaryOpen, setSummaryOpen] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [pendingEvent, setPendingEvent] = useState<CalEvent | null>(null);
  const [pendingDayDate, setPendingDayDate] = useState<Date | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [refreshingCode, setRefreshingCode] = useState(false);
  const [inviteTimeLeft, setInviteTimeLeft] = useState(180);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [pendingUsers, setPendingUsers] = useState<{ id: string; name: string | null; email: string | null; employeeId: string | null; createdAt: string }[]>([]);
  const [showPendingPanel, setShowPendingPanel] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showNotifBanner, setShowNotifBanner] = useState(false);

  const selectedGroup = groups.find((g) => g.id === selectedGroupId) ?? null;

  // Mobile detection
  useEffect(() => {
    const check = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) {
        setSidebarOpen(false);
        setSummaryOpen(false);
      }
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // 운영자 대기 유저 폴링
  const fetchPendingUsers = useCallback(async () => {
    if (!user.isOperator) return;
    const res = await fetch("/api/admin/pending");
    if (res.ok) setPendingUsers(await res.json());
  }, [user.isOperator]);

  useEffect(() => {
    fetchPendingUsers();
    const interval = setInterval(fetchPendingUsers, 30000);
    return () => clearInterval(interval);
  }, [fetchPendingUsers]);

  const handleApprove = async (userId: string, action: "approve" | "reject") => {
    await fetch("/api/admin/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, action }),
    });
    fetchPendingUsers();
  };

  const registerPushSubscription = useCallback(async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const keyRes = await fetch("/api/push/vapid-key");
      const { publicKey: vapidKey } = await keyRes.json();
      if (!vapidKey) return;
      const existing = await reg.pushManager.getSubscription();
      if (existing) await existing.unsubscribe();
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });
      const json = sub.toJSON();
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: sub.endpoint, keys: json.keys }),
      });
    } catch {
      // Push subscription failed silently
    }
  }, []);

  const handleAllowNotification = async () => {
    setShowNotifBanner(false);
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      await registerPushSubscription();
    }
  };

  const shouldReceiveNotifications = groups.length > 0;

  useEffect(() => {
    if (!shouldReceiveNotifications) return;
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "granted") {
      registerPushSubscription();
    } else if (Notification.permission === "default") {
      setShowNotifBanner(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldReceiveNotifications]);

  const refreshGroups = useCallback(async () => {
    const res = await fetch("/api/groups");
    if (res.ok) {
      const data = await res.json();
      setGroups(data);
    }
  }, []);

  const handleGroupCreated = useCallback(
    async (group: Group) => {
      await refreshGroups();
      setSelectedGroupId(group.id);
      setShowGroupModal(false);
    },
    [refreshGroups]
  );

  const handleGroupJoined = useCallback(
    async (groupId: string) => {
      await refreshGroups();
      setSelectedGroupId(groupId);
      setShowJoinModal(false);
    },
    [refreshGroups]
  );

  const handleEventSaved = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const myRole = (g: Group) => {
    if (g.leaderId === user.id) return "admin";
    const m = g.members.find((m) => m.userId === user.id);
    if (m?.role === "그룹장" || m?.role === "파트장") return "leader";
    return "member";
  };

  const isElevated = (g: Group) => {
    const role = myRole(g);
    return role === "admin" || role === "leader" || user.isOperator;
  };

  const isOperatorManagedOnly = (g: Group | null): boolean =>
    !!g && user.isOperator && g.leaderId !== user.id && !g.members.some((m) => m.userId === user.id);

  const isGlobalAdmin = user.isOperator;

  const copyInviteCode = (value: string) => {
    navigator.clipboard.writeText(value);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const refreshInviteCode = async () => {
    if (!selectedGroup) return;
    if (!confirm("초대 코드를 재생성하면 기존 코드는 사용할 수 없습니다.")) return;
    setRefreshingCode(true);
    try {
      const res = await fetch(`/api/groups/${selectedGroup.id}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) { await refreshGroups(); setInviteTimeLeft(180); }
    } finally {
      setRefreshingCode(false);
    }
  };

  useEffect(() => {
    if (!selectedGroup) return;
    setInviteTimeLeft(180);
    let t = 180;
    const interval = setInterval(async () => {
      t -= 1;
      setInviteTimeLeft(t);
      if (t <= 0) {
        const res = await fetch(`/api/groups/${selectedGroup.id}/invite`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        if (res.ok) await refreshGroups();
        t = 180;
        setInviteTimeLeft(180);
      }
    }, 1000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGroup?.id]);

  const sidebarStyle: React.CSSProperties = isMobile
    ? {
        position: "fixed",
        top: 0,
        left: 0,
        height: "100%",
        width: 260,
        zIndex: 50,
        transform: sidebarOpen ? "translateX(0)" : "translateX(-100%)",
        transition: "transform 0.28s cubic-bezier(0.4,0,0.2,1)",
        background: "var(--sidebar-bg)",
        borderRight: "1px solid var(--sidebar-border)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }
    : {
        width: sidebarOpen ? 240 : 0,
        overflow: "hidden",
        flexShrink: 0,
        background: "var(--sidebar-bg)",
        borderRight: "1px solid var(--sidebar-border)",
        transition: "width 0.28s cubic-bezier(0.4,0,0.2,1)",
        display: "flex",
        flexDirection: "column",
      };

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--bg)" }}>

      {/* Mobile overlay backdrop */}
      {isMobile && sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 45,
          }}
        />
      )}

      {/* ── 사이드바 ── */}
      <aside style={sidebarStyle}>
        {/* 로고 + 닫기 버튼 */}
        <div
          style={{
            padding: "16px 14px 14px",
            borderBottom: "1px solid var(--sidebar-border)",
            display: "flex",
            alignItems: "center",
            gap: 9,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 9,
              background: "var(--sidebar-accent)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Calendar style={{ width: 15, height: 15, color: "#fff" }} />
          </div>
          <span
            style={{
              fontWeight: 800,
              fontSize: "0.875rem",
              letterSpacing: "-0.03em",
              color: "var(--sidebar-text-active)",
              whiteSpace: "nowrap",
              flex: 1,
            }}
          >
            그룹 캘린더
          </span>
          <button
            onClick={() => setSidebarOpen(false)}
            title="사이드바 닫기"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 4,
              borderRadius: 5,
              color: "var(--sidebar-text)",
              display: "flex",
              alignItems: "center",
              transition: "color 0.12s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--sidebar-text-hover)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--sidebar-text)")}
          >
            <PanelLeftClose style={{ width: 14, height: 14 }} />
          </button>
        </div>

        {/* 그룹 목록 */}
        <div style={{ flex: 1, overflowY: "auto", padding: "10px 8px" }}>
          <p
            style={{
              fontSize: "0.62rem",
              fontWeight: 700,
              letterSpacing: "0.09em",
              textTransform: "uppercase",
              color: "var(--sidebar-text)",
              padding: "0 8px",
              marginBottom: 6,
              opacity: 0.7,
            }}
          >
            {user.isOperator ? "그룹 목록" : "내 그룹"}
          </p>

          <NavItem
            selected={selectedGroupId === null}
            onClick={() => setSelectedGroupId(null)}
            icon={<User style={{ width: 14, height: 14, color: "currentColor" }} />}
            label="개인 일정"
          />

          {groups.map((g) => (
            <NavItem
              key={g.id}
              selected={selectedGroupId === g.id}
              onClick={() => setSelectedGroupId(g.id)}
              icon={
                <span
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 6,
                    background: selectedGroupId === g.id ? ((g as {color?: string}).color || "var(--sidebar-accent)") : "var(--sidebar-border)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.62rem",
                    fontWeight: 800,
                    color: selectedGroupId === g.id ? "#fff" : "var(--sidebar-text)",
                    flexShrink: 0,
                  }}
                >
                  {g.name.charAt(0).toUpperCase()}
                </span>
              }
              label={g.name}
              badge={(() => {
                const isMgmtOnly = isOperatorManagedOnly(g);
                const pendingCnt = isElevated(g) ? g.members.filter(m => m.status === "PENDING").length : 0;
                const roleBadge = isMgmtOnly ? (
                  <span style={{ marginLeft: "auto", fontSize: "0.6rem", fontWeight: 700, padding: "1px 6px", borderRadius: 4, background: "var(--sidebar-item-active)", color: "var(--sidebar-accent)", flexShrink: 0 }}>관리</span>
                ) : myRole(g) === "admin" ? (
                  <span style={{ marginLeft: "auto", fontSize: "0.6rem", fontWeight: 700, padding: "1px 6px", borderRadius: 4, background: "var(--sidebar-item-active)", color: "var(--sidebar-accent)", flexShrink: 0 }}>
                    관리자
                  </span>
                ) : myRole(g) === "leader" ? (
                  <span style={{ marginLeft: "auto", fontSize: "0.6rem", fontWeight: 700, padding: "1px 6px", borderRadius: 4, background: "rgba(255,255,255,0.08)", color: "var(--sidebar-text-hover)", flexShrink: 0 }}>
                    {g.members.find((m) => m.userId === user.id)?.role ?? "리더"}
                  </span>
                ) : null;
                return (
                  <div style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: "auto" }}>
                    {pendingCnt > 0 && (
                      <span style={{ minWidth: 16, height: 16, borderRadius: 8, background: "#F59E0B", color: "#1E293B", fontSize: "0.58rem", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px" }}>
                        {pendingCnt}
                      </span>
                    )}
                    {roleBadge}
                  </div>
                );
              })()}
            />
          ))}

          {groups.length === 0 && (
            <p
              style={{
                fontSize: "0.78rem",
                color: "var(--sidebar-text)",
                textAlign: "center",
                padding: "16px 8px",
              }}
            >
              그룹이 없습니다
            </p>
          )}
        </div>

        {/* 그룹 추가/참가/초대코드 */}
        <div
          style={{
            padding: "8px",
            borderTop: "1px solid var(--sidebar-border)",
            display: "flex",
            flexDirection: "column",
            gap: 1,
          }}
        >
          {user.isOperator && (
            <SideAction
              icon={<Plus style={{ width: 13, height: 13 }} />}
              label="새 그룹 만들기"
              onClick={() => setShowGroupModal(true)}
              accent
            />
          )}
          {selectedGroup && isElevated(selectedGroup) && (
            <SideAction
              icon={<Share2 style={{ width: 13, height: 13 }} />}
              label="초대 코드 생성"
              onClick={() => setShowInviteSheet(true)}
            />
          )}
          <SideAction
            icon={<Users style={{ width: 13, height: 13 }} />}
            label="초대 코드로 참가"
            onClick={() => setShowJoinModal(true)}
          />
        </div>

        {/* 사용자 */}
        <div
          style={{
            padding: "10px 14px",
            borderTop: "1px solid var(--sidebar-border)",
            display: "flex",
            alignItems: "center",
            gap: 9,
          }}
        >
          <div style={{
            width: 28, height: 28, borderRadius: "50%",
            background: "rgba(99,102,241,0.2)",
            border: "1px solid rgba(99,102,241,0.3)",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--sidebar-accent)" }}>
              {(user.name || user.email || "?").charAt(0).toUpperCase()}
            </span>
          </div>
          {isGlobalAdmin && (
            <button
              onClick={() => setShowAdminModal(true)}
              title="사용자 관리"
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 4,
                borderRadius: 4,
                color: "var(--sidebar-text)",
                display: "flex",
                alignItems: "center",
                flexShrink: 0,
                transition: "color 0.12s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--sidebar-accent)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--sidebar-text)")}
            >
              <Settings style={{ width: 13, height: 13 }} />
            </button>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p
              style={{
                fontSize: "0.8rem",
                fontWeight: 600,
                color: "var(--sidebar-text-active)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                letterSpacing: "-0.01em",
              }}
            >
              {user.name || user.email}
            </p>
            {user.isOperator && (
              <p style={{ fontSize: "0.65rem", color: "var(--sidebar-text)", marginTop: 1 }}>운영자</p>
            )}
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            title="로그아웃"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 4,
              borderRadius: 4,
              color: "var(--sidebar-text)",
              display: "flex",
              alignItems: "center",
              transition: "color 0.12s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--sidebar-text-hover)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--sidebar-text)")}
          >
            <LogOut style={{ width: 13, height: 13 }} />
          </button>
        </div>
      </aside>

      {/* ── 일정 요약 패널 ── */}
      {!isMobile && (
        <div style={{ width: summaryOpen ? 280 : 0, flexShrink: 0, overflow: "hidden", transition: "width 0.28s cubic-bezier(0.4,0,0.2,1)" }}>
          <EventSummary
            userId={user.id}
            group={selectedGroup}
            isLeader={isElevated(selectedGroup ?? { leaderId: "", members: [] } as unknown as Group)}
            onEventClick={(event) => setPendingDayDate(new Date(event.startDate))}
            refreshKey={refreshKey}
            onClose={() => setSummaryOpen(false)}
          />
        </div>
      )}

      {/* ── 메인 콘텐츠 ── */}
      <main
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          minWidth: 0,
        }}
      >
        {/* 헤더 */}
        <header
          style={{
            background: "var(--surface)",
            borderBottom: "1px solid var(--border)",
            padding: "0 16px",
            height: 52,
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexShrink: 0,
          }}
        >
          {/* 사이드바 토글 — 항상 표시 */}
          <button
            onClick={() => setSidebarOpen(v => !v)}
            title={sidebarOpen ? "사이드바 닫기" : "사이드바 열기"}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 5,
              borderRadius: 6,
              color: sidebarOpen ? "var(--text-secondary)" : "var(--accent)",
              display: "flex",
              alignItems: "center",
              transition: "color 0.12s",
              flexShrink: 0,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = sidebarOpen ? "var(--text-secondary)" : "var(--accent)")}
          >
            <Menu style={{ width: 16, height: 16 }} />
          </button>

          {/* 일정 요약 토글 — 항상 표시 */}
          <button
            onClick={() => setSummaryOpen(v => !v)}
            title={summaryOpen ? "일정 요약 닫기" : "일정 요약 열기"}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 5,
              borderRadius: 6,
              color: summaryOpen ? "var(--text-secondary)" : "var(--accent)",
              display: "flex",
              alignItems: "center",
              transition: "color 0.12s",
              flexShrink: 0,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = summaryOpen ? "var(--text-secondary)" : "var(--accent)")}
          >
            <Calendar style={{ width: 15, height: 15 }} />
          </button>

          <div
            style={{
              width: 1,
              height: 16,
              background: "var(--border)",
              flexShrink: 0,
            }}
          />

          {/* 임시 디버그 버튼 */}
          <button
            onClick={async () => {
              const swSupport = "serviceWorker" in navigator;
              const notifPermission = "Notification" in window ? Notification.permission : "미지원";
              let swStatus = "없음";
              let subEndpoint = "없음";
              if (swSupport) {
                const regs = await navigator.serviceWorker.getRegistrations();
                swStatus = regs.length > 0 ? regs.map(r => r.active ? "active" : r.installing ? "installing" : "waiting").join(", ") : "미등록";
                if (regs.length > 0) {
                  const sub = await regs[0].pushManager.getSubscription();
                  subEndpoint = sub ? sub.endpoint.slice(0, 50) + "..." : "구독없음";
                }
              }
              const server = await fetch("/api/push/test").then(r => r.json());
              alert(`알림권한: ${notifPermission}\nSW상태: ${swStatus}\nSW구독: ${subEndpoint}\nDB구독수: ${server.subscriptionCount}`);
            }}
            style={{ fontSize: "0.7rem", padding: "3px 8px", borderRadius: 5, border: "1px solid var(--border)", background: "none", cursor: "pointer", color: "var(--text-tertiary)", fontFamily: "inherit", flexShrink: 0 }}
          >
            구독확인
          </button>
          <button
            onClick={async () => {
              const res = await fetch("/api/push/test", { method: "POST" });
              const data = await res.json();
              alert(JSON.stringify(data, null, 2));
            }}
            style={{ fontSize: "0.7rem", padding: "3px 8px", borderRadius: 5, border: "1px solid var(--border)", background: "none", cursor: "pointer", color: "var(--text-tertiary)", fontFamily: "inherit", flexShrink: 0 }}
          >
            테스트발송
          </button>
          <button
            onClick={async () => {
              if (!confirm("구독 초기화 후 재등록합니다.")) return;
              await fetch("/api/push/test", { method: "DELETE" });
              await registerPushSubscription();
              alert("재등록 완료. 테스트발송 눌러봐.");
            }}
            style={{ fontSize: "0.7rem", padding: "3px 8px", borderRadius: 5, border: "1px solid #FEE2E2", background: "none", cursor: "pointer", color: "#DC2626", fontFamily: "inherit", flexShrink: 0 }}
          >
            구독초기화
          </button>

          <div style={{ flex: 1, minWidth: 0 }}>
            <h2
              style={{
                fontSize: "0.875rem",
                fontWeight: 700,
                letterSpacing: "-0.02em",
                color: "var(--text-primary)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {selectedGroup ? selectedGroup.name : "개인 일정"}
            </h2>
            {selectedGroup && (
              <p style={{ fontSize: "0.72rem", color: "var(--text-tertiary)" }}>
                멤버 {selectedGroup.members.filter(m => m.status === "ACTIVE" || !m.status).length}명
                {selectedGroup.description && ` · ${selectedGroup.description}`}
              </p>
            )}
          </div>

          <button
            onClick={() => setShowGuide(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              padding: "5px 10px",
              borderRadius: 6,
              border: "1px solid var(--border)",
              background: "var(--surface)",
              color: "var(--text-secondary)",
              fontSize: "0.78rem",
              fontWeight: 500,
              cursor: "pointer",
              letterSpacing: "-0.01em",
              flexShrink: 0,
              fontFamily: "inherit",
              transition: "background 0.15s ease, border-color 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--surface-raised)";
              e.currentTarget.style.borderColor = "var(--text-tertiary)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "var(--surface)";
              e.currentTarget.style.borderColor = "var(--border)";
            }}
          >
            <BookOpen style={{ width: 13, height: 13 }} />
            {isMobile ? "" : "User Guide"}
          </button>

          {/* 알림 스케줄 버튼 (그룹장 + 알림 권한 부여된 멤버) */}
          {selectedGroup && (selectedGroup.leaderId === user.id || selectedGroup.members.some((m) => m.userId === user.id && (m as {canNotify?: boolean}).canNotify)) && (
            <button
              onClick={() => setShowScheduleModal(true)}
              style={{
                display: "flex", alignItems: "center", gap: 4,
                padding: "5px 10px", borderRadius: 6,
                border: "1px solid var(--border)",
                background: "var(--surface)",
                color: "var(--text-secondary)",
                fontSize: "0.75rem", fontWeight: 500,
                cursor: "pointer", fontFamily: "inherit", flexShrink: 0,
                transition: "background 0.15s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-raised)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "var(--surface)")}
            >
              <CalendarClock style={{ width: 13, height: 13 }} />
              {!isMobile && "알림 설정"}
            </button>
          )}

          {/* 가입 대기 알림 버튼 (운영자만) */}
          {user.isOperator && pendingUsers.length > 0 && (
            <button
              onClick={() => setShowPendingPanel(true)}
              style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                gap: 4,
                padding: "5px 10px",
                borderRadius: 6,
                border: "1px solid #FDE68A",
                background: "#FFFBEB",
                color: "#92400E",
                fontSize: "0.75rem",
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
                flexShrink: 0,
              }}
            >
              <Bell style={{ width: 13, height: 13 }} />
              {!isMobile && "가입 요청"}
              <span
                style={{
                  minWidth: 16,
                  height: 16,
                  borderRadius: "50%",
                  background: "#EF4444",
                  color: "white",
                  fontSize: "0.6rem",
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "0 3px",
                }}
              >
                {pendingUsers.length}
              </span>
            </button>
          )}

          {selectedGroup && (
            <button
              onClick={() => setShowGroupPanel(true)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                padding: "5px 10px",
                borderRadius: 6,
                border: "1px solid var(--border)",
                background: "var(--surface)",
                color: "var(--text-secondary)",
                fontSize: "0.78rem",
                fontWeight: 500,
                cursor: "pointer",
                letterSpacing: "-0.01em",
                flexShrink: 0,
                fontFamily: "inherit",
                transition: "background 0.15s ease, border-color 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--surface-raised)";
                e.currentTarget.style.borderColor = "var(--text-tertiary)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "var(--surface)";
                e.currentTarget.style.borderColor = "var(--border)";
              }}
            >
              <Settings style={{ width: 13, height: 13 }} />
              {isMobile ? "" : "그룹 관리"}
            </button>
          )}
        </header>


        {/* 캘린더 */}
        <div style={{ flex: 1, overflow: "hidden", padding: isMobile ? 8 : 16 }}>
          {isOperatorManagedOnly(selectedGroup) ? (
            <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
              <Settings style={{ width: 36, height: 36, color: "var(--text-tertiary)", opacity: 0.3 }} />
              <p style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--text-secondary)", letterSpacing: "-0.02em" }}>관리 전용 모드</p>
              <p style={{ fontSize: "0.8rem", color: "var(--text-tertiary)", textAlign: "center", lineHeight: 1.6 }}>
                이 그룹의 멤버가 아닙니다.<br />우상단 <strong>그룹 관리</strong> 버튼으로 관리만 가능합니다.
              </p>
            </div>
          ) : (
            <CalendarView
              userId={user.id}
              userName={user.name || user.email?.split("@")[0] || ""}
              group={selectedGroup}
              isLeader={
                selectedGroup?.leaderId === user.id ||
                ["그룹장", "파트장"].includes(selectedGroup?.members.find((m) => m.userId === user.id)?.role ?? "")
              }
              pendingEvent={pendingEvent}
              onPendingEventHandled={() => setPendingEvent(null)}
              pendingDayDate={pendingDayDate}
              onPendingDayDateHandled={() => setPendingDayDate(null)}
              onEventSaved={handleEventSaved}
            />
          )}
        </div>
      </main>

      {/* ── 모바일 일정 요약 드로어 ── */}
      {isMobile && (
        <>
          {summaryOpen && (
            <div
              onClick={() => setSummaryOpen(false)}
              style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 44 }}
            />
          )}
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              height: "100%",
              width: 280,
              zIndex: 45,
              transform: summaryOpen ? "translateX(0)" : "translateX(-100%)",
              transition: "transform 0.25s cubic-bezier(0.4,0,0.2,1)",
            }}
          >
            <EventSummary
              userId={user.id}
              group={selectedGroup}
              isLeader={isElevated(selectedGroup ?? { leaderId: "", members: [] } as unknown as Group)}
              onEventClick={(event) => { setPendingDayDate(new Date(event.startDate)); setSummaryOpen(false); }}
              refreshKey={refreshKey}
              onClose={() => setSummaryOpen(false)}
            />
          </div>
        </>
      )}

      {/* ── 모달들 ── */}
      {showGroupModal && (
        <GroupModal onClose={() => setShowGroupModal(false)} onCreated={handleGroupCreated} />
      )}
      {showJoinModal && (
        <JoinGroupModal onClose={() => setShowJoinModal(false)} onJoined={handleGroupJoined} />
      )}
      {showGroupPanel && selectedGroup && (
        <GroupPanel
          group={selectedGroup}
          userId={user.id}
          isOperator={user.isOperator}
          onClose={() => setShowGroupPanel(false)}
          onUpdated={refreshGroups}
        />
      )}

      {/* ── 사용자 관리 모달 ── */}
      {showAdminModal && (
        <AdminModal
          currentUserId={user.id}
          onClose={() => setShowAdminModal(false)}
        />
      )}

      {/* ── 초대 코드 시트 ── */}
      {showInviteSheet && selectedGroup && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
            padding: 24,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowInviteSheet(false); }}
        >
          <div
            className="modal-scale-in"
            style={{
              background: "var(--surface)",
              borderRadius: 14,
              width: "100%",
              maxWidth: 420,
              padding: "20px 20px 24px",
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
                초대 코드
              </span>
              <button
                onClick={() => setShowInviteSheet(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-tertiary)", display: "flex", padding: 4 }}
              >
                <X style={{ width: 16, height: 16 }} />
              </button>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <p style={{ fontSize: "0.78rem", color: "var(--text-secondary)", margin: 0 }}>
                코드를 공유하여 멤버를 초대하세요.
              </p>
              <span style={{ fontSize: "0.72rem", color: "var(--text-tertiary)", fontVariantNumeric: "tabular-nums" }}>
                {`${Math.floor(inviteTimeLeft / 60)}:${String(inviteTimeLeft % 60).padStart(2, "0")} 후 갱신`}
              </span>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "12px 16px",
                border: "1px solid var(--border)",
                borderRadius: 10,
                background: "var(--surface-raised)",
              }}
            >
              <code style={{ flex: 1, fontSize: "1rem", fontFamily: "monospace", color: "var(--text-primary)", letterSpacing: "0.1em", fontWeight: 600 }}>
                {selectedGroup.inviteCode}
              </code>
              <button
                onClick={() => copyInviteCode(selectedGroup.inviteCode)}
                title="복사"
                style={{ background: "none", border: "none", cursor: "pointer", padding: 6, borderRadius: 6, color: copiedCode ? "#16A34A" : "var(--text-tertiary)", display: "flex" }}
              >
                {copiedCode ? <Check style={{ width: 15, height: 15 }} /> : <Copy style={{ width: 15, height: 15 }} />}
              </button>
              <button
                onClick={refreshInviteCode}
                disabled={!!refreshingCode}
                title="재생성"
                style={{ background: "none", border: "none", cursor: "pointer", padding: 6, borderRadius: 6, color: "var(--text-tertiary)", display: "flex" }}
              >
                <RefreshCw style={{ width: 15, height: 15, ...(refreshingCode ? { animation: "spin 1s linear infinite" } : {}) }} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Guide 모달 */}
      {showGuide && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setShowGuide(false); }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 200,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: isMobile ? 0 : 24,
          }}
        >
          <div
            style={{
              position: "relative",
              width: "100%",
              maxWidth: 900,
              height: isMobile ? "100%" : "88vh",
              background: "#fff",
              borderRadius: isMobile ? 0 : 16,
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* 닫기 버튼 - 우상단 고정 */}
            <button
              onClick={() => setShowGuide(false)}
              style={{
                position: "absolute",
                top: 12,
                right: 12,
                zIndex: 10,
                width: 32,
                height: 32,
                borderRadius: "50%",
                border: "1px solid var(--border)",
                background: "var(--surface)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
              }}
            >
              <X style={{ width: 15, height: 15, color: "var(--text-secondary)" }} />
            </button>
            <iframe
              src="/guide.html"
              style={{ width: "100%", flex: 1, border: "none" }}
              title="User Guide"
            />
          </div>
        </div>
      )}

      {/* 알림 스케줄 모달 */}
      {showScheduleModal && selectedGroup && (
        <ScheduleModal
          groupId={selectedGroup.id}
          groupName={selectedGroup.name}
          onClose={() => setShowScheduleModal(false)}
        />
      )}

      {/* 알림 권한 배너 */}
      {showNotifBanner && (
        <div
          style={{
            position: "fixed",
            bottom: 20,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 400,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: "12px 16px",
            display: "flex",
            alignItems: "center",
            gap: 12,
            boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
            width: "min(400px, calc(100vw - 32px))",
          }}
        >
          <Bell style={{ width: 18, height: 18, color: "var(--accent)", flexShrink: 0 }} />
          <p style={{ flex: 1, fontSize: "0.8rem", color: "var(--text-primary)", lineHeight: 1.4 }}>
            스케줄 알림을 받으려면 알림을 허용해 주세요.
          </p>
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            <button
              onClick={() => setShowNotifBanner(false)}
              style={{ background: "none", border: "none", cursor: "pointer", padding: "5px 8px", borderRadius: 6, fontSize: "0.78rem", color: "var(--text-tertiary)", fontFamily: "inherit" }}
            >
              나중에
            </button>
            <button
              onClick={handleAllowNotification}
              style={{ padding: "5px 12px", borderRadius: 6, border: "none", background: "var(--accent)", color: "#fff", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
            >
              허용하기
            </button>
          </div>
        </div>
      )}

      {/* 가입 대기 승인 패널 */}
      {showPendingPanel && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setShowPendingPanel(false); }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 200,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <div
            className="modal-scale-in"
            style={{
              background: "var(--surface)",
              borderRadius: 14,
              width: "100%",
              maxWidth: 460,
              maxHeight: "80vh",
              display: "flex",
              flexDirection: "column",
              border: "1px solid var(--border)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
              overflow: "hidden",
            }}
          >
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
              <div>
                <p style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--text-primary)" }}>가입 승인 요청</p>
                <p style={{ fontSize: "0.72rem", color: "var(--text-tertiary)", marginTop: 2 }}>{pendingUsers.length}명 대기 중</p>
              </div>
              <button onClick={() => setShowPendingPanel(false)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "var(--text-tertiary)", display: "flex" }}>
                <X style={{ width: 16, height: 16 }} />
              </button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
              {pendingUsers.map((u) => (
                <div
                  key={u.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 14px",
                    border: "1px solid var(--border)",
                    borderRadius: 10,
                    background: "var(--surface)",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-primary)" }}>{u.name ?? "이름 없음"}</p>
                    <p style={{ fontSize: "0.72rem", color: "var(--text-tertiary)", marginTop: 2 }}>
                      {u.employeeId ? `사번: ${u.employeeId}` : u.email ?? ""}
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <button
                      onClick={() => handleApprove(u.id, "approve")}
                      style={{
                        display: "flex", alignItems: "center", gap: 4,
                        padding: "6px 12px", borderRadius: 6, border: "none",
                        background: "#DCFCE7", color: "#166534",
                        fontSize: "0.75rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                      }}
                    >
                      <UserCheck style={{ width: 13, height: 13 }} />
                      승인
                    </button>
                    <button
                      onClick={() => handleApprove(u.id, "reject")}
                      style={{
                        display: "flex", alignItems: "center", gap: 4,
                        padding: "6px 12px", borderRadius: 6, border: "none",
                        background: "#FEE2E2", color: "#991B1B",
                        fontSize: "0.75rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                      }}
                    >
                      <UserX style={{ width: 13, height: 13 }} />
                      거절
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── 내부 컴포넌트 ── */

function NavItem({
  selected,
  onClick,
  icon,
  label,
  badge,
}: {
  selected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  badge?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 9,
        padding: "7px 10px",
        borderRadius: 8,
        border: "none",
        background: selected ? "var(--sidebar-item-active)" : "transparent",
        color: selected ? "var(--sidebar-text-active)" : "var(--sidebar-text)",
        fontSize: "0.825rem",
        fontWeight: selected ? 600 : 400,
        cursor: "pointer",
        textAlign: "left",
        marginBottom: 1,
        fontFamily: "inherit",
        transition: "all 0.15s ease",
      }}
      onMouseEnter={(e) => {
        if (!selected) {
          e.currentTarget.style.background = "var(--sidebar-item-hover)";
          e.currentTarget.style.color = "var(--sidebar-text-hover)";
        }
      }}
      onMouseLeave={(e) => {
        if (!selected) {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.color = "var(--sidebar-text)";
        }
      }}
    >
      <span style={{ flexShrink: 0 }}>{icon}</span>
      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {label}
      </span>
      {badge}
    </button>
  );
}

function SideAction({
  icon,
  label,
  onClick,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  accent?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 7,
        padding: "6px 10px",
        borderRadius: 7,
        border: "none",
        background: "transparent",
        color: accent ? "var(--sidebar-accent)" : "var(--sidebar-text)",
        fontSize: "0.78rem",
        fontWeight: accent ? 600 : 400,
        cursor: "pointer",
        fontFamily: "inherit",
        transition: "all 0.12s ease",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--sidebar-item-hover)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      {icon}
      {label}
    </button>
  );
}
