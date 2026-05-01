"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { X, Trash2, Calendar } from "lucide-react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";

type Group = {
  id: string;
  name: string;
  leaderId: string;
  trackerOptions?: string | null;
  laptopOptions?: string | null;
  targetCount?: number;
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
  overtimeAvailable: boolean;
  isOvertimeOnly: boolean;
  personnel: string | null;
  equipment?: string | null;
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
  equipment: "\uC7A5\uBE44 \uC120\uD0DD",
  equipmentPlaceholder: "\uD2B8\uB798\uCEE4, \uB178\uD2B8\uBD81, \uD0C0\uAC9F \uC911 \uD544\uC694\uD55C \uC7A5\uBE44\uB97C \uACE0\uB974\uC138\uC694.",
  equipmentHint: "\uC88C\uC6B0\uB85C \uBC00\uC5B4 \uC7A5\uBE44 \uADF8\uB8F9\uC744 \uBC14\uAFC0 \uC218 \uC788\uC2B5\uB2C8\uB2E4.",
  equipmentSelectedSuffix: "\uAC1C \uC120\uD0DD",
  color: "\uC0C9\uC0C1",
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

const EQUIPMENT_GROUPS = [
  {
    id: "tracker",
    label: "\uD2B8\uB798\uCEE4",
    items: [] as string[],
  },
  {
    id: "laptop",
    label: "\uB178\uD2B8\uBD81",
    items: [] as string[],
  },
  {
    id: "target",
    label: "\uD0C0\uAC9F",
    items: [] as string[],
  },
] as const;

function parseEquipment(raw?: string | null) {
  if (!raw) return [] as string[];
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function parseTargetQuantity(values: string[]) {
  const targetToken = values.find((value) => /^Target x\d+$/i.test(value));
  if (!targetToken) return 0;
  const quantity = Number(targetToken.replace(/[^0-9]/g, ""));
  return Number.isFinite(quantity) ? quantity : 0;
}

function parseEquipmentOptions(raw?: string | null) {
  if (!raw) return [] as string[];
  return raw
    .split(/[\n,]/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function normalizeTargetCount(count?: number) {
  return Math.max(0, Math.min(100, count ?? 2));
}

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
  const equipmentRef = useRef<HTMLDivElement>(null);
  const touchStartXRef = useRef<number | null>(null);

  const now = new Date();
  const defaultStart = initialDates?.start ?? (event ? new Date(event.startDate) : now);
  const defaultEnd = initialDates?.end ?? (event ? new Date(event.endDate) : now);
  const allDay = true;

  const [title, setTitle] = useState(event?.title ?? "");
  const [description, setDescription] = useState(event?.description ?? "");
  const [startDate, setStartDate] = useState(toDateLocal(defaultStart));
  const [endDate, setEndDate] = useState(toDateLocal(defaultEnd));
  const [color, setColor] = useState(event?.color ?? "#3B82F6");
  const [overtimeAvailable] = useState(event?.overtimeAvailable ?? false);
  const [personnelOpen, setPersonnelOpen] = useState(false);
  const [equipmentOpen, setEquipmentOpen] = useState(false);
  const [equipmentGroupIndex, setEquipmentGroupIndex] = useState(0);
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
  const equipmentGroups = useMemo(
    () => [
      {
        ...EQUIPMENT_GROUPS[0],
        items: parseEquipmentOptions(group?.trackerOptions),
      },
      {
        ...EQUIPMENT_GROUPS[1],
        items: parseEquipmentOptions(group?.laptopOptions),
      },
      {
        ...EQUIPMENT_GROUPS[2],
        items: [],
      },
    ],
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
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>(() => {
    const parsed = parseEquipment(event?.equipment);
    return parsed.filter((value) => !/^Target x\d+$/i.test(value));
  });
  const [targetQuantity, setTargetQuantity] = useState(() =>
    parseTargetQuantity(parseEquipment(event?.equipment))
  );
  const [targetEnabled, setTargetEnabled] = useState(() =>
    parseTargetQuantity(parseEquipment(event?.equipment)) > 0
  );

  useEffect(() => {
    const handleClickOutside = (mouseEvent: MouseEvent) => {
      if (!dropdownRef.current?.contains(mouseEvent.target as Node)) {
        setPersonnelOpen(false);
      }
      if (!equipmentRef.current?.contains(mouseEvent.target as Node)) {
        setEquipmentOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const personnelValue = selectedPersonnel.length > 0 ? selectedPersonnel.join(", ") : "";
  const maxTargetCount = normalizeTargetCount(group?.targetCount);
  const equipmentSummary = [
    ...selectedEquipment,
    ...(targetEnabled && targetQuantity > 0 ? [`Target x${targetQuantity}`] : []),
  ];
  const activeEquipmentGroup = equipmentGroups[equipmentGroupIndex];

  const cycleEquipmentGroup = (direction: "prev" | "next") => {
    setEquipmentGroupIndex((current) => {
      const nextIndex = direction === "next" ? current + 1 : current - 1;
      if (nextIndex < 0) return equipmentGroups.length - 1;
      if (nextIndex >= equipmentGroups.length) return 0;
      return nextIndex;
    });
  };

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

  const toggleEquipment = (label: string) => {
    setSelectedEquipment((current) =>
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
      overtimeAvailable,
      isOvertimeOnly: finalIsOvertimeOnly,
      personnel: personnelValue,
      equipment: equipmentSummary.join(", "),
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
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3.5 transition-colors focus-within:border-[var(--accent-muted)] focus-within:ring-2 focus-within:ring-[var(--accent)]/20">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
              {UI.title}
            </p>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="일정 제목을 입력해주세요."
              className="mt-2 w-full bg-transparent text-sm text-slate-800 placeholder:text-xs placeholder:text-stone-400 focus:outline-none"
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-2">
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3.5 transition-colors focus-within:border-[var(--accent-muted)] focus-within:ring-2 focus-within:ring-[var(--accent)]/20">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
                {UI.description}
              </p>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="세부사항을 입력 해주세요."
              rows={1}
              className="mt-2 w-full resize-none bg-transparent text-sm text-slate-800 placeholder:text-xs placeholder:text-stone-400 focus:outline-none"
            />
            </div>

            <div ref={equipmentRef} className="relative">
              <button
                type="button"
                onClick={() => {
                  setEquipmentOpen((current) => {
                    if (!current) setEquipmentGroupIndex(0);
                    return !current;
                  });
                }}
                className={`w-full rounded-2xl border px-4 py-3.5 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 ${
                  equipmentOpen
                    ? "border-[var(--accent-muted)] bg-[var(--accent-light)]"
                    : "border-slate-200 bg-white hover:border-[var(--accent-muted)]"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
                      {UI.equipment}
                    </p>
                    {equipmentSummary.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {equipmentSummary.map((label) => (
                          <span
                            key={label}
                            className="inline-flex items-center rounded-full border border-[var(--accent-muted)] bg-white px-2.5 py-1 text-xs font-medium text-[var(--accent)]"
                          >
                            {label}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 truncate text-xs text-stone-400">
                        {UI.equipmentPlaceholder}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="inline-flex rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-[var(--accent)] ring-1 ring-[var(--accent-muted)]">
                      {equipmentSummary.length > 0
                        ? `${equipmentSummary.length}${UI.equipmentSelectedSuffix}`
                        : activeEquipmentGroup.label}
                    </span>
                  </div>
                </div>
              </button>

              {equipmentOpen && (
                <div
                  className="absolute left-0 right-0 top-[calc(100%+10px)] z-20 overflow-hidden rounded-2xl border border-[var(--accent-muted)] bg-[color-mix(in_srgb,var(--surface)_88%,var(--accent-light))] shadow-[0_20px_40px_rgba(15,23,42,0.12)] backdrop-blur-sm"
                  style={{ maxHeight: "min(26rem, calc(100vh - 12rem))" }}
                  onTouchStart={(touchEvent) => {
                    touchStartXRef.current = touchEvent.touches[0]?.clientX ?? null;
                  }}
                  onTouchEnd={(touchEvent) => {
                    const startX = touchStartXRef.current;
                    const endX = touchEvent.changedTouches[0]?.clientX ?? null;
                    touchStartXRef.current = null;
                    if (startX === null || endX === null) return;
                    const deltaX = endX - startX;
                    if (Math.abs(deltaX) < 36) return;
                    cycleEquipmentGroup(deltaX < 0 ? "next" : "prev");
                  }}
                >
                  <div className="flex items-center justify-between border-b border-[var(--accent-muted)] px-4 py-3">
                    <button
                      type="button"
                      onClick={() => cycleEquipmentGroup("prev")}
                      className="rounded-full border border-[var(--accent-muted)] bg-white px-2.5 py-1 text-xs font-semibold text-[var(--accent)]"
                    >
                      {"<"}
                    </button>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-[var(--accent-hover)]">
                        {activeEquipmentGroup.label}
                      </p>
                      <p className="mt-0.5 text-[10px] text-[var(--accent)]">
                        {UI.equipmentHint}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => cycleEquipmentGroup("next")}
                      className="rounded-full border border-[var(--accent-muted)] bg-white px-2.5 py-1 text-xs font-semibold text-[var(--accent)]"
                    >
                      {">"}
                    </button>
                  </div>

                  <div className="flex max-h-[calc(min(26rem,calc(100vh-12rem))-3.75rem)] flex-col p-3">
                    <div className="mb-3 flex items-center justify-center gap-2">
                      {equipmentGroups.map((groupItem, index) => (
                        <button
                          key={groupItem.id}
                          type="button"
                          onClick={() => setEquipmentGroupIndex(index)}
                          className={`h-2.5 rounded-full transition-all ${
                            index === equipmentGroupIndex
                              ? "w-6 bg-[var(--accent)]"
                              : "w-2.5 bg-[var(--accent-muted)]"
                          }`}
                          aria-label={groupItem.label}
                        />
                      ))}
                    </div>

                    <div className="overflow-y-auto pr-1">
                      <div className="flex flex-wrap gap-2">
                      {activeEquipmentGroup.id === "target" ? (
                        <div
                          className={`w-full rounded-xl border p-4 transition-colors ${
                            targetEnabled
                              ? "border-indigo-200 bg-indigo-50/90"
                              : "border-[var(--accent-muted)] bg-white/80"
                          }`}
                        >
                          <div className="flex flex-col gap-3">
                            <button
  type="button"
  aria-pressed={targetEnabled}
  onClick={() => {
    setTargetEnabled((current) => {
      const next = !current;
      if (next) {
        setTargetQuantity((quantity) =>
          quantity > 0 ? quantity : Math.min(1, maxTargetCount)
        );
      } else {
        setTargetQuantity(0);
      }
      return next;
    });
  }}
  className="flex w-full items-center gap-3 rounded-xl text-left transition-colors"
>
  <span
    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border text-xs font-bold transition-colors ${
      targetEnabled
        ? "border-indigo-500 bg-indigo-500 text-white"
        : "border-stone-300 bg-white text-transparent"
    }`}
  >
    ✓
  </span>
  <span className="text-sm font-semibold text-[var(--accent-hover)]">
    타겟 사용
  </span>
</button>
                            <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-[var(--accent-hover)]">타겟 수량</p>
                          <p className="mt-1 text-[11px] text-stone-500">
                            최대 {maxTargetCount}개까지 입력할 수 있습니다.
                          </p>
                            </div>
                            <input
                              type="number"
                              min={1}
                              max={maxTargetCount}
                              disabled={!targetEnabled || maxTargetCount === 0}
                              value={targetEnabled ? Math.max(targetQuantity, 1) : ""}
                              onChange={(e) => {
                                const nextValue = Math.max(
                                  1,
                                  Math.min(maxTargetCount, Number(e.target.value) || 1)
                                );
                                setTargetQuantity(nextValue);
                              }}
                                className="w-24 rounded-xl border border-[var(--accent-muted)] px-3 py-2 text-right text-sm font-semibold text-[var(--accent-hover)] outline-none focus:border-[var(--accent)] disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-400"
                              />
                            </div>
                          </div>
                        </div>
                      ) : activeEquipmentGroup.items.length === 0 ? (
                        <p className="w-full rounded-xl border border-dashed border-[var(--accent-muted)] bg-white/70 px-3 py-4 text-center text-sm text-stone-500">
                          {activeEquipmentGroup.label} ??ぉ???놁뒿?덈떎. 洹몃９ 愿由ъ뿉??異붽???二쇱꽭??
                        </p>
                      ) : activeEquipmentGroup.items.map((item) => {
                        const checked = selectedEquipment.includes(item);

                        return (
                          <button
                            key={item}
                            type="button"
                            aria-pressed={checked}
                            onClick={() => toggleEquipment(item)}
                            className={`inline-flex min-h-9 items-center rounded-full border px-3.5 py-2 text-sm font-medium transition-colors ${
                              checked
                                ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                                : "border-stone-200 bg-white text-stone-700 hover:border-[var(--accent-muted)] hover:bg-[var(--accent-light)]"
                            }`}
                          >
                            <span className="truncate">{item}</span>
                          </button>
                        );
                      })}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

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
                  <div className="min-w-0">
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
                        <p className="mt-2 truncate text-xs text-stone-400">
                          {UI.personnelPlaceholder}
                        </p>
                      )}
                    </div>
                  </div>
                </button>

                {personnelOpen && (
                  <div className="absolute left-0 right-0 top-[calc(100%+10px)] z-20 rounded-2xl border border-[var(--accent-muted)] bg-[color-mix(in_srgb,var(--surface)_86%,var(--accent-light))] p-3 shadow-[0_20px_40px_rgba(15,23,42,0.12)] backdrop-blur-sm">
                    <div className="mb-3">
                      <p className="text-xs font-semibold text-[var(--accent-hover)]">
                        {UI.personnel}
                      </p>
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


