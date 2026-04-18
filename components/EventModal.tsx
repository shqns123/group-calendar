"use client";

import { useState } from "react";
import { X, Trash2, Lock, Globe, Calendar } from "lucide-react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";

type Group = {
  id: string;
  name: string;
  leaderId: string;
  members: Array<{
    id: string;
    userId: string;
    nickname: string | null;
    user: { id: string; name: string | null };
  }>;
};

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
  creator: { id: string; name: string | null; email: string | null };
};

type Props = {
  userId: string;
  group: Group | null;
  isLeader: boolean;
  event: CalEvent | null;
  initialDates: { start: Date; end: Date; allDay: boolean } | null;
  onSaved: () => void;
  onDeleted: () => void;
  onClose: () => void;
};

// 10가지 색상
const COLORS = [
  "#3B82F6", // 파랑
  "#6366F1", // 인디고
  "#8B5CF6", // 보라
  "#EC4899", // 핑크
  "#EF4444", // 빨강
  "#F97316", // 주황
  "#F59E0B", // 노랑
  "#10B981", // 초록
  "#14B8A6", // 청록
  "#06B6D4", // 하늘
];

function toDateTimeLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toDateLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export default function EventModal({
  userId,
  group,
  isLeader,
  event,
  initialDates,
  onSaved,
  onDeleted,
  onClose,
}: Props) {
  const isEdit = !!event;
  const canEdit = !event || event.creatorId === userId || isLeader;

  // 기본값: 오늘 날짜
  const now = new Date();
  const defaultStart = initialDates?.start ?? (event ? new Date(event.startDate) : now);
  const defaultEnd = initialDates?.end ?? (event ? new Date(event.endDate) : now);
  const allDay = true;

  const [title, setTitle] = useState(event?.title ?? "");
  const [description, setDescription] = useState(event?.description ?? "");
  const [startDate, setStartDate] = useState(toDateLocal(defaultStart));
  const [endDate, setEndDate] = useState(toDateLocal(defaultEnd));
  const [color, setColor] = useState(event?.color ?? "#3B82F6");
  const [isPrivate, setIsPrivate] = useState(event?.isPrivate ?? false);
  const [overtimeAvailable, setOvertimeAvailable] = useState(event?.overtimeAvailable ?? false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // 시작 날짜 변경 → 종료가 시작보다 이전이면 종료도 같이 조정
  const handleStartDateChange = (value: string) => {
    setStartDate(value);
    if (value && endDate && new Date(value) > new Date(endDate)) {
      setEndDate(value);
    }
    setError("");
  };

  // 종료 날짜 변경 → 시작보다 이전이면 오류
  const handleEndDateChange = (value: string) => {
    setEndDate(value);
    if (value && startDate && new Date(value) < new Date(startDate)) {
      setError("종료 날짜는 시작 날짜보다 이후여야 합니다");
    } else {
      setError("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalTitle = title.trim() || (overtimeAvailable ? "특근 가능" : "");
    if (!finalTitle) {
      setError("제목을 입력해주세요");
      return;
    }
    if (new Date(endDate) < new Date(startDate)) {
      setError("종료 날짜는 시작 날짜보다 이후여야 합니다");
      return;
    }
    setLoading(true);
    setError("");

    const finalIsOvertimeOnly = overtimeAvailable && !title.trim();
    const payload = {
      title: finalTitle,
      description: description.trim() || null,
      startDate: new Date(startDate).toISOString(),
      endDate: new Date(endDate).toISOString(),
      allDay,
      color,
      isPrivate,
      overtimeAvailable,
      isOvertimeOnly: finalIsOvertimeOnly,
      groupId: group?.id ?? null,
    };

    try {
      const res = isEdit
        ? await fetch(`/api/events/${event.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/events", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "저장에 실패했습니다");
        return;
      }
      onSaved();
    } catch {
      setError("네트워크 오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!event || !confirm("정말 삭제하시겠습니까?")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/events/${event.id}`, { method: "DELETE" });
      if (res.ok) {
        onDeleted();
      } else {
        const data = await res.json();
        setError(data.error || "삭제에 실패했습니다");
      }
    } catch {
      setError("네트워크 오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  };

  // 읽기 전용 뷰
  if (isEdit && !canEdit) {
    return (
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
          <div className="flex items-center justify-between p-6 border-b border-slate-100">
            <h3 className="text-lg font-semibold text-slate-800">일정 상세</h3>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: event.color }} />
              <h4 className="text-xl font-semibold text-slate-800">{event.title}</h4>
              {event.isPrivate && <Lock className="w-4 h-4 text-slate-400" />}
            </div>
            {event.description && (
              <p className="text-slate-600 text-sm">{event.description}</p>
            )}
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Calendar className="w-4 h-4" />
              <span>
                {format(new Date(event.startDate), event.allDay ? "yyyy년 MM월 dd일" : "yyyy년 MM월 dd일 HH:mm", { locale: ko })}
                {!event.allDay && " ~ " + format(new Date(event.endDate), "HH:mm", { locale: ko })}
              </span>
            </div>
            {group && (
              <p className="text-xs text-slate-400">
                작성자: {
                  group.members.find(m => m.userId === event.creatorId)?.nickname ||
                  event.creator.name
                }
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h3 className="text-lg font-semibold text-slate-800">
            {isEdit ? "일정 수정" : "새 일정"}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* 제목 */}
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="제목"
            className="w-full px-4 py-3 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg font-medium"
            autoFocus
          />

          {/* 설명 */}
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="설명 (선택)"
            rows={2}
            className="w-full px-4 py-3 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm"
          />

          {/* 날짜 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 font-medium mb-1 block">시작</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => handleStartDateChange(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 font-medium mb-1 block">종료</label>
              <input
                type="date"
                value={endDate}
                min={startDate}
                onChange={(e) => handleEndDateChange(e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  error.includes("종료") ? "border-red-400 bg-red-50" : "border-slate-200"
                }`}
              />
            </div>
          </div>

          {/* 색상 (10가지) - 전체 너비 균등 분배 */}
          <div>
            <label className="text-xs text-slate-500 font-medium mb-2 block">색상</label>
            <div className="grid grid-cols-10 gap-1.5 w-full">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`aspect-square w-full rounded-full transition-transform ${
                    color === c ? "scale-110 ring-2 ring-offset-1 ring-slate-400" : "hover:scale-105"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* 공개/비공개 */}
          {group && (
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
              <button
                type="button"
                onClick={() => setIsPrivate(!isPrivate)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  isPrivate ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"
                }`}
              >
                {isPrivate ? (
                  <><Lock className="w-3.5 h-3.5" />나만 보기</>
                ) : (
                  <><Globe className="w-3.5 h-3.5" />그룹 공개</>
                )}
              </button>
              <span className="text-xs text-slate-400">
                {isPrivate ? "리더에게도 보임" : "그룹원 모두에게 보임"}
              </span>
            </div>
          )}


          {error && (
            <p className="text-red-500 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}

          {/* 버튼 */}
          <div className="flex gap-3 pt-2">
            {isEdit && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2.5 text-red-500 hover:bg-red-50 rounded-xl transition-colors text-sm font-medium"
              >
                <Trash2 className="w-4 h-4" />
                삭제
              </button>
            )}
            <div className="flex-1" />
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors text-sm font-medium"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors text-sm font-semibold disabled:opacity-50"
            >
              {loading ? "저장 중..." : isEdit ? "수정" : "저장"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
