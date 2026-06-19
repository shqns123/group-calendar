"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PENDING_INVITE_COOKIE_NAME } from "@/lib/inviteOnboarding";

type Props = {
  inviteCode: string;
  groupName: string;
};

export default function JoinOnboardingClient({ inviteCode, groupName }: Props) {
  const router = useRouter();

  useEffect(() => {
    document.cookie = `${PENDING_INVITE_COOKIE_NAME}=${encodeURIComponent(inviteCode)}; Path=/; Max-Age=${60 * 60 * 24 * 30}; SameSite=Lax`;
    router.replace(`/login?groupName=${encodeURIComponent(groupName)}`);
  }, [groupName, inviteCode, router]);

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: "var(--bg)" }}>
      <div style={{ width: "100%", maxWidth: 420, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: "28px 24px", textAlign: "center", boxShadow: "0 20px 60px rgba(15,23,42,0.08)" }}>
        <p style={{ fontSize: "0.8rem", color: "var(--text-tertiary)", marginBottom: 8 }}>그룹 초대 링크 확인 중</p>
        <p style={{ fontSize: "1.05rem", fontWeight: 800, color: "var(--text-primary)" }}>{groupName}</p>
      </div>
    </div>
  );
}
