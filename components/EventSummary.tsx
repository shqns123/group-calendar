"use client";

import { useEffect, useState, useCallback } from "react";
import { format, isToday, isTomorrow, isThisWeek, isThisMonth, isPast, startOfDay } from "date-fns";
import { ko } from "date-fns/locale";
import { Clock, Lock, MapPin, RefreshCw } from "lucide-react";

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
  creatorNickname?: string | null;
  creator: { id: string; name: string | null; email: string | null; image: string | null };
};

type Group = {
  id: string;
  name: string;
  leaderId: string;
  members: Array<{
    id: string;
    userId: string;
    nickname: string | null;
    user: { id: string; name: string | null; email: string | null; image: string | null };
  }>;
};

type Props = {
  userId: string;
  group: Group | null;
  isLeader: boolean;
  onEventClick: (event: CalEvent) => void;
  refreshKey: number;
};

type GroupedEvents = {
  label: string;
  color: string;
  events: CalEvent[];
};

function getDateLabel(date: Date): string {
  const today = startOfDay(new Date());
  const eventDay = startOfDay(date);
  const diffDays = Math.round((eventDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (isToday(date)) return "오늘";
  if (isTomorrow(date)) return "내일";
  if (diffDays >= 2 && diffDays <= 6) return "이번 주";
  if (isThisMonth(date) && diffDays > 6) return "이번 달";
  if (diffDays > 31) return "다음 달 이후";
  return format(date, "M월", { locale: ko });
}

export default function EventSummary({ userId, group, isLeader, onEventClick, refreshKey }: Props) {
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      // 오늘부터 365일 후까지
      const future = new Date(today);
      future.setDate(future.getDate() + 365);

      const params = new URLSearchParams({
        start: today.toISOString(),
        end: future.toISOString(),
      });
      if (group) params.set("groupId", group.id);

      const res = await fetch(`/api/events?${params}`);
      if (res.ok) {
        const data: CalEvent[] = await res.json();
        // 시작일 기준 정렬
        data.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
        setEvents(data);
      }
    } finally {
      setLoading(false);
    }
  }, [group]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents, refreshKey]);

  // 날짜 그룹핑
  const grouped: GroupedEvents[] = [];
  const labelMap = new Map<string, CalEvent[]>();
  const labelOrder: string[] = [];

  for (const event of events) {
    const label = getDateLabel(new Date(event.startDate));
    if (!labelMap.has(label)) {
      labelMap.set(label, []);
      labelOrder.push(label);
    }
    labelMap.get(label)!.push(event);
  }

  const labelColors: Record<string, string> = {
    "오늘": "text-blue-600",
    "내일": "text-indigo-500",
    "이번 주": "text-violet-500",
    "이번 달": "text-slate-500",
    "다음 달 이후": "text-slate-400",
  };

  for (const label of labelOrder) {
    grouped.push({
      label,
      color: labelColors[label] ?? "text-slate-400",
      events: labelMap.get(label)!,
    });
  }

  const getCreatorName = (event: CalEvent) => {
    if (!group) return null;
    const member = group.members.find(m => m.userId === event.creatorId);
    return member?.nickname || event.creator.name || event.creator.email?.split("@")[0];
  };

  return (
    <div className="w-72 flex-shrink-0 bg-white border-r border-slate-200 flex flex-col overflow-hidden">
      {/* 헤더 */}
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
        <div>
          <h3 className="text-sm font-bold text-slate-700">일정 요약</h3>
          <p className="text-xs text-slate-400 mt-0.5">향후 365일</p>
        </div>
        <button
          onClick={fetchEvents}
          disabled={loading}
          className="text-slate-400 hover:text-slate-600 transition-colors"
          title="새로고침"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* 일정 목록 */}
      <div className="flex-1 overflow-y-auto">
        {events.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center h-40 text-slate-400">
            <Clock className="w-8 h-8 mb-2 opacity-40" />
            <p className="text-sm">예정된 일정이 없습니다</p>
          </div>
        )}

        {grouped.map((group) => (
          <div key={group.label}>
            {/* 날짜 그룹 헤더 */}
            <div className="sticky top-0 bg-slate-50 px-4 py-2 border-b border-slate-100 z-10">
              <span className={`text-xs font-bold uppercase tracking-wider ${group.color}`}>
                {group.label}
              </span>
              <span className="text-xs text-slate-400 ml-2">({group.events.length})</span>
            </div>

            {/* 해당 그룹 이벤트 */}
            {group.events.map((event) => {
              const isOwn = event.creatorId === userId;
              const isHidden = event.isPrivate && !isOwn && !isLeader;
              const creatorName = getCreatorName(event);
              const start = new Date(event.startDate);
              const end = new Date(event.endDate);
              const isPastEvent = isPast(end) && !isToday(end);

              return (
                <button
                  key={event.id}
                  onClick={() => onEventClick(event)}
                  className={`w-full text-left px-4 py-3 border-b border-slate-50 hover:bg-slate-50 transition-colors ${
                    isPastEvent ? "opacity-50" : ""
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* 색상 인디케이터 */}
                    <div
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1"
                      style={{ backgroundColor: event.color }}
                    />

                    <div className="flex-1 min-w-0">
                      {/* 제목 */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold text-slate-800 truncate">
                          {isHidden ? "비공개 일정" : event.title}
                        </span>
                        {event.isPrivate && (
                          <Lock className="w-3 h-3 text-slate-400 flex-shrink-0" />
                        )}
                      </div>

                      {/* 설명 (이름/장소) */}
                      {!isHidden && event.description && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 text-slate-400 flex-shrink-0" />
                          <span className="text-xs text-slate-500 truncate">
                            {event.description}
                          </span>
                        </div>
                      )}

                      {/* 날짜/시간 */}
                      <div className="flex items-center gap-1 mt-1">
                        <Clock className="w-3 h-3 text-slate-400 flex-shrink-0" />
                        <span className="text-xs text-slate-400">
                          {event.allDay
                            ? format(start, "MM/dd (E)", { locale: ko })
                            : `${format(start, "MM/dd HH:mm", { locale: ko })} ~ ${format(end, "HH:mm")}`
                          }
                        </span>
                      </div>

                      {/* 작성자 (그룹일 때) */}
                      {creatorName && (
                        <div className="mt-1">
                          <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">
                            {creatorName}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
