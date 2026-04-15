"use client";

import { useState, useCallback } from "react";
import { signOut } from "next-auth/react";
import {
  Calendar,
  Users,
  Plus,
  LogOut,
  ChevronRight,
  Settings,
  User,
  PanelLeft,
} from "lucide-react";
import CalendarView from "./CalendarView";
import GroupPanel from "./GroupPanel";
import GroupModal, { type GroupFromApi } from "./GroupModal";
import JoinGroupModal from "./JoinGroupModal";
import EventSummary from "./EventSummary";

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
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [summaryOpen, setSummaryOpen] = useState(true);
  // 캘린더와 요약 패널 동기화용 키
  const [refreshKey, setRefreshKey] = useState(0);
  // 요약에서 클릭한 이벤트를 캘린더 모달로 전달
  const [pendingEvent, setPendingEvent] = useState<CalEvent | null>(null);

  const selectedGroup = groups.find((g) => g.id === selectedGroupId) ?? null;

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

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* 그룹 사이드바 */}
      <aside
        className={`${
          sidebarOpen ? "w-56" : "w-0 overflow-hidden"
        } transition-all duration-300 bg-white border-r border-slate-200 flex flex-col flex-shrink-0`}
      >
        {/* 로고 */}
        <div className="p-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-slate-800 text-base">그룹 캘린더</span>
          </div>
        </div>

        {/* 그룹 목록 */}
        <div className="flex-1 overflow-y-auto p-3">
          <div className="px-2 mb-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              내 그룹
            </span>
          </div>

          <button
            onClick={() => setSelectedGroupId(null)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors mb-1 ${
              selectedGroupId === null
                ? "bg-blue-50 text-blue-700"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            <User className="w-4 h-4 flex-shrink-0" />
            <span>내 개인 일정</span>
          </button>

          {groups.map((g) => (
            <button
              key={g.id}
              onClick={() => setSelectedGroupId(g.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors mb-1 ${
                selectedGroupId === g.id
                  ? "bg-blue-50 text-blue-700"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center flex-shrink-0">
                <span className="text-white text-xs font-bold">
                  {g.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <span className="truncate">{g.name}</span>
              {g.leaderId === user.id && (
                <span className="ml-auto text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full flex-shrink-0">
                  리더
                </span>
              )}
            </button>
          ))}

          {groups.length === 0 && (
            <p className="text-xs text-slate-400 text-center py-4">
              아직 그룹이 없습니다
            </p>
          )}
        </div>

        {/* 그룹 추가/참가 */}
        <div className="p-3 border-t border-slate-100 space-y-1">
          <button
            onClick={() => setShowGroupModal(true)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-blue-600 hover:bg-blue-50 transition-colors font-medium"
          >
            <Plus className="w-4 h-4" />
            새 그룹 만들기
          </button>
          <button
            onClick={() => setShowJoinModal(true)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-slate-600 hover:bg-slate-50 transition-colors font-medium"
          >
            <Users className="w-4 h-4" />
            초대 코드로 참가
          </button>
        </div>

        {/* 사용자 정보 */}
        <div className="p-3 border-t border-slate-100">
          <div className="flex items-center gap-3 p-2">
            {user.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.image} alt={user.name || ""} className="w-8 h-8 rounded-full flex-shrink-0" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <span className="text-blue-600 text-sm font-semibold">
                  {(user.name || user.email || "?").charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-700 truncate">{user.name || user.email}</p>
              <p className="text-xs text-slate-400 truncate">{user.email}</p>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="text-slate-400 hover:text-slate-600 transition-colors"
              title="로그아웃"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* 일정 요약 패널 */}
      {summaryOpen && (
        <EventSummary
          userId={user.id}
          group={selectedGroup}
          isLeader={selectedGroup?.leaderId === user.id}
          onEventClick={(event) => setPendingEvent(event)}
          refreshKey={refreshKey}
        />
      )}

      {/* 메인 콘텐츠 */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* 헤더 */}
        <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3 flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-slate-400 hover:text-slate-600 transition-colors"
            title="그룹 목록"
          >
            <ChevronRight className={`w-5 h-5 transition-transform ${sidebarOpen ? "rotate-180" : ""}`} />
          </button>

          <button
            onClick={() => setSummaryOpen(!summaryOpen)}
            className={`transition-colors ${summaryOpen ? "text-blue-500" : "text-slate-400 hover:text-slate-600"}`}
            title="일정 요약"
          >
            <PanelLeft className="w-5 h-5" />
          </button>

          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-slate-800 truncate">
              {selectedGroup ? selectedGroup.name : "내 개인 일정"}
            </h2>
            {selectedGroup && (
              <p className="text-xs text-slate-400">
                멤버 {selectedGroup.members.length}명
                {selectedGroup.description && ` · ${selectedGroup.description}`}
              </p>
            )}
          </div>

          {selectedGroup && (
            <button
              onClick={() => setShowGroupPanel(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-slate-600 hover:bg-slate-100 transition-colors flex-shrink-0"
            >
              <Settings className="w-4 h-4" />
              그룹 관리
            </button>
          )}
        </header>

        {/* 캘린더 */}
        <div className="flex-1 overflow-hidden p-4">
          <CalendarView
            userId={user.id}
            group={selectedGroup}
            isLeader={selectedGroup?.leaderId === user.id}
            pendingEvent={pendingEvent}
            onPendingEventHandled={() => setPendingEvent(null)}
            onEventSaved={handleEventSaved}
          />
        </div>
      </main>

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
    </div>
  );
}
