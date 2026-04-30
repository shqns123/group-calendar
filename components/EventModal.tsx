"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  personnel: string | null;
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

const UI = {
  author: "\uC791\uC131\uC790",
  detail: "\uC77C\uC815 \uC0C1\uC138",
  edit: "\uC77C\uC815 \uC218\uC815",
  create: "\uC77C\uC815 \uCD94\uAC00",
  title: "\uC81C\uBAA9",
  description: "\uC124\uBA85 (\uC120\uD0DD)",
  personnel: "\uC778\uC6D0 \uC120\uD0DD",
  personnelPlaceholder: "\uC778\uC6D0 (\uBBF8\uC120\uD0DD\uC2DC : \uC791\uC131\uC790)",
  selectedSuffix: "\uBA85 \uC120\uD0DD",
  personnelHint: "\uD544\uC694\uD55C \uBA64\uBC84\uB9CC \uD0ED\uD574\uC11C \uC120\uD0DD\uD558\uC138\uC694.",
  defaultSuffix: "\uAE30\uBCF8\uAC12",
  defaultPersonnelPrefix: "\uC778\uC6D0 \uAE30\uBCF8\uAC12: ",
  start: "\uC2DC\uC791",
  end: "\uC885\uB8CC",
  color: "\uC0C9\uC0C1",
  privateOnly: "\uB098\uB9CC \uBCF4\uAE30",
  groupPublic: "\uADF8\uB8F9 \uACF5\uAC1C",
  privateHint: "\uB9AC\uB354\uC5D0\uAC8C\uB9CC \uBCF4\uC785\uB2C8\uB2E4.",
  publicHint: "\uADF8\uB8F9\uC6D0 \uBAA8\uB450\uC5D0\uAC8C \uBCF4\uC785\uB2C8\uB2E4.",
  saveFailed: "\uC800\uC7A5\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.",
  networkFailed: "\uB124\uD2B8\uC6CC\uD06C \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4.",
  titleRequired: "\uC81C\uBAA9\uC744 \uC785\uB825\uD574 \uC8FC\uC138\uC694.",
  endBeforeStart: "\uC885\uB8CC \uB0A0\uC9DC\uB294 \uC2DC\uC791 \uB0A0\uC9DC\uBCF4\uB2E4 \uBE60\uB97C \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.",
  overtimeAvailable: "\uC5F0\uC7A5 \uAC00\uB2A5",
  confirmDelete: "\uC815\uB9D0 \uC0AD\uC81C\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?",
  deleteFailed: "\uC0AD\uC81C\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.",
  createdBy: "\uC791\uC131\uC790: ",
  cancel: "\uCDE8\uC18C",
  delete: "\uC0AD\uC81C",
  save: "\uC800\uC7A5",
  saving: "\uC800\uC7A5 \uC911...",
  editSave: "\uC218\uC815",
  noName: "\uC774\uB984 \uC5C6\uC74C",
} as const;

const COLORS = [
  "#3B82F6",
  "#6366F1",
  "#8B5CF6",
  "#EC4899",
  "#EF4444",
  "#F97316",
  "#F59E0B",
  "#10B981",
  "#14B8A6",
  "#06B6D4",
];

function toDateLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function getDisplayName(
  group: Group | null,
  userId: string,
  fallbackName?: string | null,
  fallbackEmail?: string | null
) {
  const groupMember = group?.members.find((member) => member.userId === userId);

  return (
    groupMember?.nickname?.trim() ||
    groupMember?.user.name?.trim() ||
    fallbackName?.trim() ||
    fallbackEmail?.split("@")[0] ||
    UI.author
  );
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
  const dropdownRef = useRef<HTMLDivElement>(null);

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
  const [overtimeAvailable] = useState(event?.overtimeAvailable ?? false);
  const [personnelOpen, setPersonnelOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const creatorLabel = useMemo(
    () =>
      getDisplayName(
        group,
        event?.creatorId ?? userId,
        event?.creator.name,
        event?.creator.email
      ),
    [event, group, userId]
  );

  const memberOptions = useMemo(
    () =>
      (group?.members ?? []).map((member) => ({
        id: member.id,
        label: member.nickname?.trim() || member.user.name?.trim() || UI.noName,
      })),
    [group]
  );

  const [selectedPersonnel, setSelectedPersonnel] = useState<string[]>(() => {
    if (!event?.personnel || !group) return [];

    const allowedLabels = new Set(
      group.members.map(
        (member) => member.nickname?.trim() || member.user.name?.trim() || UI.noName
      )
    );

    return event.personnel
      .split(",")
      .map((value) => value.trim())
      .filter((value) => value && allowedLabels.has(value));
  });

  useEffect(() => {
    const handleClickOutside = (mouseEvent: MouseEvent) => {
      if (!dropdownRef.current?.contains(mouseEvent.target as Node)) {
        setPersonnelOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const personnelValue = selectedPersonnel.length > 0 ? selectedPersonnel.join(", ") : "";

  const handleStartDateChange = (value: string) => {
    setStartDate(value);
    if (value && endDate && new Date(value) > new Date(endDate)) {
      setEndDate(value);
    }
    setError("");
  };

  const handleEndDateChange = (value: string) => {
    setEndDate(value);
    if (value && startDate && new Date(value) < new Date(startDate)) {
      setError(UI.endBeforeStart);
    } else {
      setError("");
    }
  };

  const togglePersonnel = (label: string) => {
    setSelectedPersonnel((current) =>
      current.includes(label)
        ? current.filter((value) => value !== label)
        : [...current, label]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalTitle = title.trim() || (overtimeAvailable ? UI.overtimeAvailable : "");
    if (!finalTitle) {
      setError(UI.titleRequired);
      return;
    }
    if (new Date(endDate) < new Date(startDate)) {
      setError(UI.endBeforeStart);
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
      personnel: personnelValue,
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
        setError(data.error || UI.saveFailed);
        return;
      }
      onSaved();
    } catch {
      setError(UI.networkFailed);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!event || !confirm(UI.confirmDelete)) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/events/${event.id}`, { method: "DELETE" });
      if (res.ok) {
        onDeleted();
      } else {
        const data = await res.json();
        setError(data.error || UI.deleteFailed);
      }
    } catch {
      setError(UI.networkFailed);
    } finally {
      setLoading(false);
    }
  };

  if (isEdit && !canEdit) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
        <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-100 p-6">
            <h3 className="text-lg font-semibold text-slate-800">{UI.detail}</h3>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="space-y-4 p-6">
            <div className="flex items-center gap-3">
              <div className="h-4 w-4 rounded-full" style={{ backgroundColor: event.color }} />
              <h4 className="text-xl font-semibold text-slate-800">{event.title}</h4>
              {event.isPrivate && <Lock className="h-4 w-4 text-slate-400" />}
            </div>
            {event.description && <p className="text-sm text-slate-600">{event.description}</p>}
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Calendar className="h-4 w-4" />
              <span>
                {format(
                  new Date(event.startDate),
                  event.allDay ? "yyyy\uB144 MM\uC6D4 dd\uC77C" : "yyyy\uB144 MM\uC6D4 dd\uC77C HH:mm",
                  { locale: ko }
                )}
                {!event.allDay &&
                  ` ~ ${format(new Date(event.endDate), "HH:mm", { locale: ko })}`}
              </span>
            </div>
            {group && (
              <p className="text-xs text-slate-400">
                {UI.createdBy}
                {getDisplayName(group, event.creatorId, event.creator.name, event.creator.email)}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="modal-scale-in w-full max-w-md rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 p-6">
          <h3 className="text-lg font-semibold text-slate-800">
            {isEdit ? UI.edit : UI.create}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={UI.title}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-lg font-medium text-slate-800 placeholder-slate-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
          />

          <div className="flex flex-col gap-2">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={UI.description}
              rows={2}
              className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            {group ? (
              <div ref={dropdownRef} className="relative">
                <button
                  type="button"
                  onClick={() => setPersonnelOpen((current) => !current)}
                  className={`w-full rounded-2xl border px-4 py-3.5 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 ${
                    personnelOpen
                      ? "border-[var(--accent-muted)] bg-[var(--accent-light)]"
                      : "border-slate-200 bg-white hover:border-[var(--accent-muted)]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
                        {UI.personnel}
                      </p>
                      {selectedPersonnel.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {selectedPersonnel.map((label) => (
                            <span
                              key={label}
                              className="inline-flex items-center rounded-full border border-[var(--accent-muted)] bg-[var(--accent)] px-2.5 py-1 text-xs font-medium text-white"
                            >
                              {label}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-2 truncate text-sm text-stone-400">
                          {UI.personnelPlaceholder}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <span className="inline-flex rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-[var(--accent)] ring-1 ring-[var(--accent-muted)]">
                        {selectedPersonnel.length > 0
                          ? `${selectedPersonnel.length}${UI.selectedSuffix}`
                          : UI.defaultSuffix}
                      </span>
                    </div>
                  </div>
                </button>

                {personnelOpen && (
                  <div className="absolute left-0 right-0 top-[calc(100%+10px)] z-20 rounded-2xl border border-[var(--accent-muted)] bg-[color-mix(in_srgb,var(--surface)_86%,var(--accent-light))] p-3 shadow-[0_20px_40px_rgba(15,23,42,0.12)] backdrop-blur-sm">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <p className="text-xs font-semibold text-[var(--accent-hover)]">
                        {UI.personnel}
                      </p>
                      <span className="text-[11px] text-[var(--accent)]">
                        {selectedPersonnel.length > 0
                          ? `${selectedPersonnel.length}${UI.selectedSuffix}`
                          : UI.personnelHint}
                      </span>
                    </div>
                    <div className="max-h-56 overflow-y-auto">
                      <div className="flex flex-wrap gap-2">
                        {memberOptions.map((member) => {
                          const checked = selectedPersonnel.includes(member.label);

                          return (
                            <button
                              key={member.id}
                              type="button"
                              aria-pressed={checked}
                              onClick={() => togglePersonnel(member.label)}
                              className={`inline-flex min-h-9 items-center rounded-full border px-3.5 py-2 text-sm font-medium transition-colors ${
                                checked
                                  ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                                  : "border-stone-200 bg-white text-stone-700 hover:border-[var(--accent-muted)] hover:bg-[var(--accent-light)]"
                              }`}
                            >
                              <span className="truncate">{member.label}</span>
                              {checked && (
                                <span className="ml-2 inline-flex items-center rounded-full bg-white/90 px-1.5 py-0.5 text-[10px] font-bold text-[var(--accent)]">
                                  선택
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                {UI.defaultPersonnelPrefix}
                {creatorLabel}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">{UI.start}</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => handleStartDateChange(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">{UI.end}</label>
              <input
                type="date"
                value={endDate}
                min={startDate}
                onChange={(e) => handleEndDateChange(e.target.value)}
                className={`w-full rounded-lg border px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  error.includes(UI.end) ? "border-red-400 bg-red-50" : "border-slate-200"
                }`}
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium text-slate-500">{UI.color}</label>
            <div className="grid w-full grid-cols-10 gap-1.5">
              {COLORS.map((itemColor) => (
                <button
                  key={itemColor}
                  type="button"
                  onClick={() => setColor(itemColor)}
                  className={`aspect-square w-full rounded-full transition-transform ${
                    color === itemColor
                      ? "scale-110 ring-2 ring-slate-400 ring-offset-1"
                      : "hover:scale-105"
                  }`}
                  style={{ backgroundColor: itemColor }}
                />
              ))}
            </div>
          </div>

          {group && (
            <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
              <button
                type="button"
                onClick={() => setIsPrivate(!isPrivate)}
                className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  isPrivate ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"
                }`}
              >
                {isPrivate ? (
                  <>
                    <Lock className="h-3.5 w-3.5" />
                    {UI.privateOnly}
                  </>
                ) : (
                  <>
                    <Globe className="h-3.5 w-3.5" />
                    {UI.groupPublic}
                  </>
                )}
              </button>
              <span className="text-xs text-slate-400">
                {isPrivate ? UI.privateHint : UI.publicHint}
              </span>
            </div>
          )}

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-500">{error}</p>
          )}

          <div className="flex gap-3 pt-2">
            {isEdit && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={loading}
                className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-red-500 transition-colors hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
                {UI.delete}
              </button>
            )}
            <div className="flex-1" />
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100"
            >
              {UI.cancel}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? UI.saving : isEdit ? UI.editSave : UI.save}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
