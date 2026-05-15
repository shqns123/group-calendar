"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PENDING_QR_TOKEN_COOKIE_NAME } from "@/lib/inviteOnboarding";

type Props = {
  token: string;
  groupName: string;
};

export default function JoinOnboardingClient({ token, groupName }: Props) {
  const router = useRouter();

  useEffect(() => {
    document.cookie = `${PENDING_QR_TOKEN_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; Max-Age=${60 * 60 * 24 * 30}; SameSite=Lax`;
    router.replace(`/login?groupName=${encodeURIComponent(groupName)}`);
  }, [groupName, router, token]);

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: "var(--bg)" }}>
      <div style={{ width: "100%", maxWidth: 420, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: "28px 24px", textAlign: "center", boxShadow: "0 20px 60px rgba(15,23,42,0.08)" }}>
        <p style={{ fontSize: "0.8rem", color: "var(--text-tertiary)", marginBottom: 8 }}>그룹 QR 초대 확인 중</p>
        <p style={{ fontSize: "1.05rem", fontWeight: 800, color: "var(--text-primary)" }}>{groupName}</p>
        <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)", marginTop: 10, lineHeight: 1.6 }}>
          로그인 또는 회원가입 후
          <br />
          계정 승인이 완료되면 이 그룹에 자동으로 연결됩니다.
        </p>
      </div>
    </div>
  );
}
