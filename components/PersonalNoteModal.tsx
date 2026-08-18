"use client";

import { FileText, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";

type PersonalNoteItem = { id: string; text: string };
type PersonalNote = { id: string; date: string; content: string; items: PersonalNoteItem[]; updatedAt: string } | null;
type Props = {
  dateKey: string;
  isSaving: boolean;
  note: PersonalNote;
  onClose: () => void;
  onSave: (items: PersonalNoteItem[]) => Promise<void>;
};

function createItem(): PersonalNoteItem {
  return { id: `memo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, text: "" };
}

export default function PersonalNoteModal({ dateKey, isSaving, note, onClose, onSave }: Props) {
  const [items, setItems] = useState<PersonalNoteItem[]>(() => note?.items ?? [createItem()]);
  const [error, setError] = useState<string | null>(null);
  const updateItem = (id: string, text: string) => setItems((current) => current.map((item) => item.id === id ? { ...item, text } : item));
  const removeItem = (id: string) => setItems((current) => current.filter((item) => item.id !== id));

  const handleSave = async () => {
    const filled = items.filter((item) => item.text.trim());
    if (filled.some((item) => item.text.trim().length > 1_000)) {
      setError("각 메모는 1,000자 이하로 입력해 주세요.");
      return;
    }
    try {
      setError(null);
      await onSave(filled);
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "메모 저장에 실패했습니다.");
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/60 p-6" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="modal-scale-in flex max-h-[82vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <div className="flex items-center gap-2.5"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent-light)] text-[var(--accent)]"><FileText className="h-4 w-4" /></span><div><p className="text-sm font-extrabold text-[var(--text-primary)]">개인 메모</p><p className="text-xs text-[var(--text-tertiary)]">{dateKey}</p></div></div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-[var(--text-tertiary)] hover:bg-[var(--surface-raised)]"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto p-5">
          {items.map((item, index) => (
            <div key={item.id} className="flex gap-2">
              <span className="pt-3 text-xs font-bold text-[var(--text-tertiary)]">{index + 1}</span>
              <textarea value={item.text} onChange={(event) => updateItem(item.id, event.target.value)} placeholder="메모를 입력해 주세요." rows={2} maxLength={1000} autoFocus={index === 0} className="min-w-0 flex-1 resize-none rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]" />
              <button type="button" onClick={() => removeItem(item.id)} className="h-10 rounded-lg p-2 text-red-500 hover:bg-red-50" aria-label="메모 삭제"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
          <button type="button" onClick={() => setItems((current) => [...current, createItem()])} className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-[var(--border)] py-2.5 text-sm font-bold text-[var(--accent)]"><Plus className="h-4 w-4" />메모 추가</button>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 border-t border-[var(--border)] px-5 py-4"><button type="button" onClick={onClose} className="rounded-lg border border-[var(--border)] px-3.5 py-2 text-sm font-semibold text-[var(--text-secondary)]">취소</button><button type="button" onClick={handleSave} disabled={isSaving} className="rounded-lg bg-[var(--accent)] px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-60">{isSaving ? "저장 중..." : "저장"}</button></div>
      </div>
    </div>
  );
}
