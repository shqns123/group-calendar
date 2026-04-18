"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginForm() {
  const [tab, setTab] = useState<"google" | "guest">("google");
  const [name, setName] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleGuestLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !employeeId.trim()) {
      setError("이름과 사번을 입력해주세요.");
      return;
    }
    setLoading(true);
    setError("");
    const res = await signIn("guest", {
      name: name.trim(),
      employeeId: employeeId.trim(),
      redirect: false,
    });
    setLoading(false);
    if (res?.ok) {
      router.push("/");
      router.refresh();
    } else {
      setError("로그인에 실패했습니다. 다시 시도해주세요.");
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "0.625rem 0.875rem",
    border: "1px solid var(--border)",
    borderRadius: "8px",
    fontSize: "0.875rem",
    background: "var(--surface)",
    color: "var(--text-primary)",
    outline: "none",
    transition: "border-color 0.15s ease",
    fontFamily: "inherit",
    letterSpacing: "-0.01em",
  };

  return (
    <div>
      {/* 탭 */}
      <div
        className="flex rounded-lg p-0.5 mb-6"
        style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}
      >
        {(["google", "guest"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="flex-1 py-2 text-sm font-medium rounded-md transition-all"
            style={{
              background: tab === t ? "var(--surface)" : "transparent",
              color: tab === t ? "var(--text-primary)" : "var(--text-tertiary)",
              boxShadow: tab === t ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
              border: "none",
              cursor: "pointer",
              fontFamily: "inherit",
              letterSpacing: "-0.01em",
            }}
          >
            {t === "google" ? "Google" : "Guest"}
          </button>
        ))}
      </div>

      {tab === "google" ? (
        <button
          type="button"
          disabled={loading}
          onClick={async () => {
            setLoading(true);
            await signIn("google", { callbackUrl: "/" });
          }}
          className="w-full flex items-center justify-center gap-3 transition-all"
          style={{
            padding: "0.75rem 1rem",
            border: "2px solid var(--border)",
            borderRadius: "8px",
            background: "var(--surface)",
            color: "var(--text-primary)",
            fontSize: "0.875rem",
            fontWeight: 500,
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.5 : 1,
            fontFamily: "inherit",
            letterSpacing: "-0.01em",
          }}
        >
          <svg viewBox="0 0 24 24" style={{ width: 18, height: 18, flexShrink: 0 }}>
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Google로 계속하기
        </button>
      ) : (
        <form onSubmit={handleGuestLogin} style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
          <input
            type="text"
            placeholder="이름"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={inputStyle}
            onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
            onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
            maxLength={20}
          />
          <input
            type="text"
            placeholder="사번"
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            style={inputStyle}
            onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
            onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
            maxLength={20}
          />
          {error && (
            <p style={{ fontSize: "0.75rem", color: "#DC2626", margin: "0" }}>{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: "0.25rem",
              padding: "0.75rem 1rem",
              background: loading ? "var(--text-tertiary)" : "var(--text-primary)",
              color: "var(--surface)",
              border: "none",
              borderRadius: "8px",
              fontSize: "0.875rem",
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              fontFamily: "inherit",
              letterSpacing: "-0.01em",
              transition: "background 0.15s ease",
            }}
          >
            {loading ? "로그인 중..." : "로그인"}
          </button>
          <p style={{ fontSize: "0.72rem", color: "var(--text-tertiary)", textAlign: "center", margin: 0 }}>
            같은 기기에서는 자동으로 로그인됩니다
          </p>
        </form>
      )}
    </div>
  );
}
