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
  PanelLeft,
  Share2,
  Copy,
  Check,
  RefreshCw,
  X,
} from "lucide-react";
import CalendarView from "./CalendarView";
import GroupPanel from "./GroupPanel";
import GroupModal, { type GroupFromApi } from "./GroupModal";
import JoinGroupModal from "./JoinGroupModal";
import EventSummary from "./EventSummary";
import AdminModal from "./AdminModal";

type UserInfo = {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
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
  creatorId: string;
  groupId: string | null;
  creator: { id: string; name: string | null; email: string | null; image: string | null };
};

type Props = {
  user: UserInfo;
  initialGroups: Group[];
};


export function DashboardClient({ user, initialGroups }: Props) {
  const [groups, setGroups] = useState<Group[]>(initialGroups);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(
    initialGroups[0]?.id ?? null
  );
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showGroupPanel, setShowGroupPanel] = useState(false);
  const [showInviteSheet, setShowInviteSheet] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [summaryOpen, setSummaryOpen] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [pendingEvent, setPendingEvent] = useState<CalEvent | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [refreshingCode, setRefreshingCode] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);

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
    return role === "admin" || role === "leader";
  };

  const isGlobalAdmin = groups.some((g) => g.leaderId === user.id);

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
      if (res.ok) await refreshGroups();
    } finally {
      setRefreshingCode(false);
    }
  };

  const sidebarStyle: React.CSSProperties = isMobile
    ? {
        position: "fixed",
        top: 0,
        left: 0,
        height: "100%",
        width: 260,
        zIndex: 50,
        transform: sidebarOpen ? "translateX(0)" : "translateX(-100%)",
        transition: "transform 0.25s cubic-bezier(0.4,0,0.2,1)",
        background: "var(--surface)",
        borderRight: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }
    : {
        width: sidebarOpen ? 224 : 0,
        overflow: "hidden",
        flexShrink: 0,
        background: "var(--surface)",
        borderRight: "1px solid var(--border)",
        transition: "width 0.25s cubic-bezier(0.4,0,0.2,1)",
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
            padding: "16px 16px 14px",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              background: "var(--text-primary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Calendar style={{ width: 14, height: 14, color: "var(--accent-muted)" }} />
          </div>
          <span
            style={{
              fontWeight: 700,
              fontSize: "0.875rem",
              letterSpacing: "-0.02em",
              color: "var(--text-primary)",
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
              borderRadius: 4,
              color: "var(--text-tertiary)",
              display: "flex",
              alignItems: "center",
            }}
          >
            <PanelLeftClose style={{ width: 15, height: 15 }} />
          </button>
        </div>

        {/* 그룹 목록 */}
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 10px" }}>
          <p
            style={{
              fontSize: "0.65rem",
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--text-tertiary)",
              padding: "0 8px",
              marginBottom: 6,
            }}
          >
            내 그룹
          </p>

          <NavItem
            selected={selectedGroupId === null}
            onClick={() => setSelectedGroupId(null)}
            icon={<User style={{ width: 14, height: 14 }} />}
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
                    width: 20,
                    height: 20,
                    borderRadius: 5,
                    background:
                      selectedGroupId === g.id
                        ? "var(--accent)"
                        : "var(--surface-raised)",
                    border: `1px solid ${selectedGroupId === g.id ? "var(--accent)" : "var(--border)"}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.6rem",
                    fontWeight: 700,
                    color: selectedGroupId === g.id ? "white" : "var(--text-secondary)",
                    flexShrink: 0,
                  }}
                >
                  {g.name.charAt(0).toUpperCase()}
                </span>
              }
              label={g.name}
              badge={(() => {
                const pendingCnt = isElevated(g) ? g.members.filter(m => m.status === "PENDING").length : 0;
                const roleBadge = myRole(g) === "admin" ? (
                  <span
                    style={{
                      marginLeft: "auto",
                      fontSize: "0.6rem",
                      fontWeight: 600,
                      padding: "1px 5px",
                      borderRadius: 4,
                      background: "var(--text-primary)",
                      color: "var(--surface)",
                      letterSpacing: "0.02em",
                      flexShrink: 0,
                    }}
                  >
                    관리자
                  </span>
                ) : myRole(g) === "leader" ? (
                  <span
                    style={{
                      marginLeft: "auto",
                      fontSize: "0.6rem",
                      fontWeight: 600,
                      padding: "1px 5px",
                      borderRadius: 4,
                      background: "var(--accent-light)",
                      color: "var(--accent)",
                      letterSpacing: "0.02em",
                      flexShrink: 0,
                    }}
                  >
                    {g.members.find((m) => m.userId === user.id)?.role ?? "리더"}
                  </span>
                ) : null;
                return (
                  <div style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: "auto" }}>
                    {pendingCnt > 0 && (
                      <span style={{ minWidth: 16, height: 16, borderRadius: 8, background: "#F59E0B", color: "white", fontSize: "0.58rem", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px" }}>
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
                color: "var(--text-tertiary)",
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
            padding: "10px",
            borderTop: "1px solid var(--border-subtle)",
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          <SideAction
            icon={<Plus style={{ width: 13, height: 13 }} />}
            label="새 그룹 만들기"
            onClick={() => setShowGroupModal(true)}
            accent
          />
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
            padding: "10px 12px",
            borderTop: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
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
                color: "var(--text-tertiary)",
                display: "flex",
                alignItems: "center",
                flexShrink: 0,
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.color = "var(--accent)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.color = "var(--text-tertiary)")
              }
            >
              <Settings style={{ width: 13, height: 13 }} />
            </button>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p
              style={{
                fontSize: "0.78rem",
                fontWeight: 600,
                color: "var(--text-primary)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                letterSpacing: "-0.01em",
              }}
            >
              {user.name || user.email}
            </p>
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
              color: "var(--text-tertiary)",
              display: "flex",
              alignItems: "center",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.color = "var(--text-secondary)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.color = "var(--text-tertiary)")
            }
          >
            <LogOut style={{ width: 13, height: 13 }} />
          </button>
        </div>
      </aside>

      {/* ── 일정 요약 패널 ── */}
      {summaryOpen && !isMobile && (
        <EventSummary
          userId={user.id}
          group={selectedGroup}
          isLeader={isElevated(selectedGroup ?? { leaderId: "", members: [] } as unknown as Group)}
          onEventClick={(event) => setPendingEvent(event)}
          refreshKey={refreshKey}
          onClose={() => setSummaryOpen(false)}
        />
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
          {/* 사이드바 열기 버튼 (닫혀있을 때) */}
          {!sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(true)}
              title="사이드바 열기"
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 4,
                borderRadius: 4,
                color: "var(--text-tertiary)",
                display: "flex",
                alignItems: "center",
              }}
            >
              <PanelLeft style={{ width: 16, height: 16 }} />
            </button>
          )}

          {/* 일정 요약 열기 버튼 (닫혀있을 때, 데스크톱만) */}
          {!summaryOpen && !isMobile && (
            <button
              onClick={() => setSummaryOpen(true)}
              title="일정 요약 열기"
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 4,
                borderRadius: 4,
                color: "var(--text-tertiary)",
                display: "flex",
                alignItems: "center",
              }}
            >
              <Calendar style={{ width: 15, height: 15 }} />
            </button>
          )}

          {/* 모바일: 일정 요약 버튼 */}
          {isMobile && (
            <button
              onClick={() => setSummaryOpen(!summaryOpen)}
              title="일정 요약"
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 4,
                borderRadius: 4,
                color: summaryOpen ? "var(--accent)" : "var(--text-tertiary)",
                display: "flex",
                alignItems: "center",
              }}
            >
              <Calendar style={{ width: 15, height: 15 }} />
            </button>
          )}

          <div
            style={{
              width: 1,
              height: 16,
              background: "var(--border)",
              flexShrink: 0,
            }}
          />

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

        {/* 모바일 일정 요약 (슬라이드다운) */}
        {isMobile && summaryOpen && (
          <div style={{ flexShrink: 0, maxHeight: "40vh", overflow: "hidden", borderBottom: "1px solid var(--border)" }}>
            <EventSummary
              userId={user.id}
              group={selectedGroup}
              isLeader={isElevated(selectedGroup ?? { leaderId: "", members: [] } as unknown as Group)}
              onEventClick={(event) => { setPendingEvent(event); setSummaryOpen(false); }}
              refreshKey={refreshKey}
              onClose={() => setSummaryOpen(false)}
            />
          </div>
        )}

        {/* 캘린더 */}
        <div style={{ flex: 1, overflow: "hidden", padding: isMobile ? 8 : 16 }}>
          <CalendarView
            userId={user.id}
            group={selectedGroup}
            isLeader={
              selectedGroup?.leaderId === user.id ||
              ["그룹장", "파트장"].includes(selectedGroup?.members.find((m) => m.userId === user.id)?.role ?? "")
            }
            pendingEvent={pendingEvent}
            onPendingEventHandled={() => setPendingEvent(null)}
            onEventSaved={handleEventSaved}
          />
        </div>
      </main>

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
            alignItems: "flex-end",
            justifyContent: "center",
            zIndex: 50,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowInviteSheet(false); }}
        >
          <div
            style={{
              background: "var(--surface)",
              borderRadius: "14px 14px 0 0",
              width: "100%",
              maxWidth: 420,
              padding: "20px 20px 32px",
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
            <p style={{ fontSize: "0.78rem", color: "var(--text-secondary)", margin: 0 }}>
              코드를 공유하여 멤버를 초대하세요.
            </p>
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
        gap: 8,
        padding: "6px 8px",
        borderRadius: 6,
        border: "none",
        background: selected ? "var(--accent-light)" : "transparent",
        color: selected ? "var(--accent)" : "var(--text-secondary)",
        fontSize: "0.825rem",
        fontWeight: selected ? 600 : 400,
        cursor: "pointer",
        letterSpacing: "-0.01em",
        textAlign: "left",
        marginBottom: 1,
        fontFamily: "inherit",
        transition: "background 0.1s ease, color 0.1s ease",
      }}
      onMouseEnter={(e) => {
        if (!selected) e.currentTarget.style.background = "var(--surface-hover)";
      }}
      onMouseLeave={(e) => {
        if (!selected) e.currentTarget.style.background = "transparent";
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
        gap: 6,
        padding: "5px 8px",
        borderRadius: 5,
        border: "none",
        background: "transparent",
        color: accent ? "var(--accent)" : "var(--text-tertiary)",
        fontSize: "0.78rem",
        fontWeight: accent ? 600 : 400,
        cursor: "pointer",
        letterSpacing: "-0.01em",
        fontFamily: "inherit",
      }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.background = "var(--surface-hover)")
      }
      onMouseLeave={(e) =>
        (e.currentTarget.style.background = "transparent")
      }
    >
      {icon}
      {label}
    </button>
  );
}
