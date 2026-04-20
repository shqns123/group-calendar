"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Clock, LogOut } from "lucide-react";
import { signOut } from "next-auth/react";

export default function PendingPage() {
  const router = useRouter();

  // 승인 여부를 폴링 (10초마다)
  useEffect(() => {
    const check = async () => {
      const res = await fetch("/api/auth/status");
      if (res.ok) {
        const data = await res.json();
        if (data.status === "ACTIVE") {
          router.push("/");
          router.refresh();
        }
      }
    };

    check();
    const interval = setInterval(check, 10000);
    return () => clearInterval(interval);
  }, [router]);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg)",
        padding: 24,
      }}
    >
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 16,
          padding: "40px 32px",
          maxWidth: 400,
          width: "100%",
          textAlign: "center",
          boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            background: "#FEF3C7",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 20px",
          }}
        >
          <Clock style={{ width: 30, height: 30, color: "#D97706" }} />
        </div>

        <h1
          style={{
            fontSize: "1.25rem",
            fontWeight: 700,
            color: "var(--text-primary)",
            letterSpacing: "-0.02em",
            marginBottom: 8,
          }}
        >
          가입 승인 대기 중
        </h1>

        <p
          style={{
            fontSize: "0.875rem",
            color: "var(--text-secondary)",
            lineHeight: 1.6,
            marginBottom: 24,
          }}
        >
          관리자의 승인을 기다리고 있습니다.
          <br />
          승인되면 자동으로 이동합니다.
        </p>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            fontSize: "0.78rem",
            color: "var(--text-tertiary)",
            marginBottom: 24,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "#F59E0B",
              animation: "pulse 2s infinite",
              flexShrink: 0,
            }}
          />
          승인 확인 중...
        </div>

        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            width: "100%",
            padding: "10px 16px",
            border: "1px solid var(--border)",
            borderRadius: 8,
            background: "none",
            color: "var(--text-secondary)",
            fontSize: "0.825rem",
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          <LogOut style={{ width: 14, height: 14 }} />
          다른 계정으로 로그인
        </button>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}
