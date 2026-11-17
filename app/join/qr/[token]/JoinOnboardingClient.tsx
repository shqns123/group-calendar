"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  token: string;
  /** null: the code was already used or has expired. */
  groupName: string | null;
};

type State =
  | { kind: "working" }
  | { kind: "joined"; groupName: string; groupId: string; pending: boolean }
  | { kind: "accountPending"; groupName: string }
  | { kind: "error"; message: string };

const EXPIRED = "이미 사용됐거나 만료된 QR 코드예요. 새 QR 코드를 받아 다시 스캔해 주세요.";

export default function JoinOnboardingClient({ token, groupName }: Props) {
  const router = useRouter();
  const [state, setState] = useState<State>(groupName ? { kind: "working" } : { kind: "error", message: EXPIRED });
  const started = useRef(false);

  useEffect(() => {
    if (!groupName || started.current) return;
    started.current = true;
    void (async () => {
      try {
        const res = await fetch("/api/onboarding/qr-claim", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setState({ kind: "error", message: data.error || EXPIRED });
        } else if (data.joined) {
          setState({ kind: "joined", groupName: data.groupName, groupId: data.groupId, pending: !!data.pending });
        } else if (data.accountPending) {
          setState({ kind: "accountPending", groupName: data.groupName });
        } else {
          router.replace(`/login?groupName=${encodeURIComponent(data.groupName ?? groupName)}`);
        }
      } catch {
        setState({ kind: "error", message: "네트워크 오류가 발생했습니다. 다시 스캔해 주세요." });
      }
    })();
  }, [groupName, router, token]);

  let caption = "그룹 QR 초대 확인 중";
  let title = groupName ?? "QR 초대";
  let body: React.ReactNode = "잠시만 기다려 주세요.";
  let action: { label: string; href: string } | null = null;
  if (state.kind === "joined") {
    caption = state.pending ? "가입 요청을 보냈어요" : "그룹에 가입했어요";
    title = state.groupName;
    body = state.pending ? "그룹장·파트장이 승인하면 그룹 일정을 볼 수 있어요." : "지금 바로 그룹 일정을 볼 수 있어요.";
    action = { label: "캘린더로 가기", href: `/?groupId=${encodeURIComponent(state.groupId)}` };
  } else if (state.kind === "accountPending") {
    caption = "QR 초대를 받았어요";
    title = state.groupName;
    body = "계정 승인이 끝나면 이 그룹에 자동으로 연결돼요.";
  } else if (state.kind === "error") {
    caption = "QR 초대";
    body = state.message;
    action = { label: "처음으로", href: "/" };
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: "var(--bg)" }}>
      <div style={{ width: "100%", maxWidth: 420, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: "28px 24px", textAlign: "center", boxShadow: "0 20px 60px rgba(15,23,42,0.08)" }}>
        <p style={{ fontSize: "0.8rem", color: "var(--text-tertiary)", marginBottom: 8 }}>{caption}</p>
        <p style={{ fontSize: "1.05rem", fontWeight: 800, color: "var(--text-primary)" }}>{title}</p>
        <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)", marginTop: 10, lineHeight: 1.6 }}>{body}</p>
        {action ? (
          <a
            href={action.href}
            style={{ display: "inline-block", marginTop: 18, padding: "9px 20px", borderRadius: 8, background: "var(--accent, #2E63F6)", color: "#fff", fontSize: "0.85rem", fontWeight: 700, textDecoration: "none" }}
          >
            {action.label}
          </a>
        ) : null}
      </div>
    </div>
  );
}
