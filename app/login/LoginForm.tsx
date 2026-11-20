"use client";

import { useEffect, useState } from "react";
import SignupQrStep from "@/components/SignupQrStep";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

type GuestMode = "login" | "register";

export default function LoginForm() {
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<"google" | "guest">("google");
  const [guestMode, setGuestMode] = useState<GuestMode>("login");
  const [name, setName] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [qrStep, setQrStep] = useState(false);
  const [googleSignup, setGoogleSignup] = useState<{ name?: string; email: string } | null>(null);
  const [contextReady, setContextReady] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let live = true;
    void fetch("/api/auth/signup-context").then(async (res) => {
      if (!res.ok) throw new Error("가입 정보를 불러오지 못했어요. 새로고침해 주세요.");
      const context = await res.json();
      if (!live) return;
      setContextReady(true);
      if (context.google) { setGoogleSignup(context.google); setQrStep(true); }
      else if (searchParams.get("signup") === "qr") setError("Google 가입 정보가 만료됐어요. 다시 Google로 계속해 주세요.");
    }).catch((e) => { if (live) setError(e.message); });
    return () => { live = false; };
  }, [searchParams]);
  const invitedGroupName = searchParams.get("groupName");

  const reset = () => {
    setName("");
    setEmployeeId("");
    setError("");
    setPending(false);
    setQrStep(false);
    setGoogleSignup(null);
  };

  const handleGuestLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !employeeId.trim()) {
      setError("이름과 사번을 입력해 주세요.");
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
      setError("이름 또는 사번이 올바르지 않거나 아직 승인되지 않은 계정입니다.");
    }
  };

  const handleGuestRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !employeeId.trim()) {
      setError("이름과 사번을 입력해 주세요.");
      return;
    }
    if (!contextReady) { setError("가입 정보를 준비 중이에요. 잠시 후 다시 시도해 주세요."); return; }
    setError("");
    setGoogleSignup(null);
    setQrStep(true);
  };

  const submitInvitedSignup = async (qrToken: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qrToken, provider: googleSignup ? "google" : "guest", ...(googleSignup ? {} : { name: name.trim(), employeeId: employeeId.trim() }) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "회원가입 요청에 실패했습니다.");
      setQrStep(false);
      setPending(true);
    } catch (e) { setError(e instanceof Error ? e.message : "네트워크를 확인해 주세요."); }
    finally { setLoading(false); }
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

  if (pending) {
    return (
      <div style={{ padding: "24px 0", textAlign: "center", display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
        <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#FEF3C7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>
          !
        </div>
        <p style={{ fontWeight: 700, fontSize: "1rem", color: "var(--text-primary)" }}>가입 요청 완료</p>
        <p style={{ fontSize: "0.825rem", color: "var(--text-secondary)", lineHeight: 1.6 }}>
          운영자의 승인을 기다려 주세요.
          <br />
          승인 후 로그인하실 수 있습니다.
        </p>
        <button
          onClick={() => {
            setGuestMode("login");
            setPending(false);
            setName("");
            setEmployeeId("");
            setGoogleSignup(null);
          }}
          style={{ marginTop: 4, padding: "8px 20px", borderRadius: 8, border: "1px solid var(--border)", background: "none", color: "var(--text-secondary)", fontSize: "0.825rem", cursor: "pointer", fontFamily: "inherit" }}
        >
          로그인으로 돌아가기
        </button>
      </div>
    );
  }

  if (qrStep) return <SignupQrStep accountLabel={googleSignup ? googleSignup.email : `${name} · ${employeeId}`}
    onScan={submitInvitedSignup} busy={loading} error={error} onBack={() => {
      if (googleSignup) {
        void fetch("/api/auth/signup-context", { method: "DELETE" });
        setGoogleSignup(null);
      }
      setQrStep(false); setError("");
    }} />;

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight mb-1" style={{ color: "var(--text-primary)", letterSpacing: "-0.03em" }}>
        {tab === "guest" && guestMode === "register" ? "회원가입" : "로그인"}
      </h1>
      <p className="text-sm mb-8" style={{ color: "var(--text-secondary)" }}>
        {tab === "guest" && guestMode === "register" ? "가입 정보를 입력한 뒤 초대 QR을 확인해 주세요" : "계속하려면 로그인하세요"}
      </p>
      {invitedGroupName && (
        <div
          style={{
            marginBottom: 16,
            padding: "12px 14px",
            borderRadius: 10,
            border: "1px solid #BFDBFE",
            background: "#EFF6FF",
            color: "#1D4ED8",
            fontSize: "0.8rem",
            lineHeight: 1.6,
          }}
        >
          <strong style={{ fontWeight: 800 }}>{invitedGroupName}</strong> 그룹 초대 링크로 접속했습니다.
          <br />
          가입 정보를 입력한 뒤 초대 창의 QR을 다시 스캔해 주세요.
        </div>
      )}
      {showInfo && (
        <div
          onClick={() => setShowInfo(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: "var(--surface)", borderRadius: 14, width: "100%", maxWidth: 400, padding: "24px 24px 20px", display: "flex", flexDirection: "column", gap: 14, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <p style={{ fontWeight: 800, fontSize: "0.95rem", letterSpacing: "-0.03em", color: "var(--text-primary)" }}>이용 안내</p>
              <button onClick={() => setShowInfo(false)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1rem", color: "var(--text-tertiary)", lineHeight: 1 }}>×</button>
            </div>
            <div style={{ padding: "12px 14px", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 10, fontSize: "0.825rem", color: "#92400E", lineHeight: 1.6 }}>
              <strong style={{ fontWeight: 800 }}>신규 가입은 운영자 승인 후 이용 가능합니다</strong>
              <br />
              신규 계정은 초대 QR을 확인한 뒤 운영자에게 승인을 요청합니다.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { label: "Google 로그인", desc: "신규 계정은 Google 인증 후 초대 QR을 스캔합니다. 이미 승인된 계정은 바로 입장합니다." },
                { label: "Guest 회원가입", desc: "이름과 사번 입력 후 초대 QR을 스캔하면 가입을 요청합니다. 운영자 승인 후 로그인할 수 있습니다." },
                { label: "Guest 로그인", desc: "승인된 계정은 이름과 사번으로 바로 로그인합니다. 이름 또는 사번이 다르면 로그인할 수 없습니다." },
              ].map((item) => (
                <div key={item.label} style={{ display: "flex", gap: 10 }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--text-primary)", marginTop: 7, flexShrink: 0 }} />
                  <div>
                    <p style={{ fontSize: "0.825rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: 1 }}>{item.label}</p>
                    <p style={{ fontSize: "0.775rem", color: "var(--text-secondary)", lineHeight: 1.55 }}>{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => setShowInfo(false)}
              style={{ marginTop: 4, padding: "8px 0", background: "var(--text-primary)", color: "var(--surface)", border: "none", borderRadius: 8, fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
            >
              확인
            </button>
          </div>
        </div>
      )}

      <div className="mb-6 flex rounded-lg p-0.5" style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}>
        {(["google", "guest"] as const).map((t) => (
          <button
            key={t}
            onClick={() => {
              setTab(t);
              reset();
            }}
            className="flex-1 rounded-md py-2 text-sm font-medium transition-all"
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

      {error && tab === "google" && <p role="alert" style={{ color: "#B91C1C", fontSize: "0.875rem", marginBottom: 12 }}>{error}</p>}
      {tab === "google" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <button
            type="button"
            disabled={loading}
            onClick={async () => {
              setLoading(true);
              await signIn("google", { callbackUrl: "/" });
            }}
            className="flex w-full items-center justify-center gap-3 transition-all"
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
          <p style={{ fontSize: "0.72rem", color: "var(--text-tertiary)", textAlign: "center", margin: 0 }}>
            등록된 Google 계정만 로그인됩니다.
            <br />
            신규 계정은 초대 QR 확인과 운영자 승인 후 사용할 수 있습니다.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", borderRadius: 8, border: "1px solid var(--border)", overflow: "hidden" }}>
            {(["login", "register"] as GuestMode[]).map((m) => (
              <button
                key={m}
                onClick={() => {
                  setGuestMode(m);
                  reset();
                }}
                style={{
                  flex: 1,
                  padding: "8px 0",
                  border: "none",
                  background: guestMode === m ? "var(--text-primary)" : "var(--surface)",
                  color: guestMode === m ? "var(--surface)" : "var(--text-tertiary)",
                  fontSize: "0.825rem",
                  fontWeight: guestMode === m ? 600 : 400,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  transition: "all 0.15s ease",
                }}
              >
                {m === "login" ? "로그인" : "회원가입"}
              </button>
            ))}
          </div>

          <form
            onSubmit={guestMode === "login" ? handleGuestLogin : handleGuestRegister}
            style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}
          >
            <input
              type="text"
              aria-label="이름"
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
              aria-label="사번"
              placeholder="사번"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              style={inputStyle}
              onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
              onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
              maxLength={20}
            />
            {error && <p style={{ fontSize: "0.75rem", color: "#DC2626", margin: 0 }}>{error}</p>}
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
              {loading
                ? guestMode === "login" ? "로그인 중..." : "요청 중..."
                : guestMode === "login" ? "로그인" : "다음 · 초대 QR 확인"}
            </button>
            <p style={{ fontSize: "0.72rem", color: "var(--text-tertiary)", textAlign: "center", margin: 0 }}>
              {guestMode === "login"
                ? "이름과 사번이 정확히 일치해야 합니다."
                : "다음 단계에서 초대 QR을 스캔하면 가입 요청을 보냅니다."}
            </p>
          </form>
        </div>
      )}

      <div style={{ marginTop: 18, textAlign: "center" }}>
        <button
          onClick={() => setShowInfo(true)}
          style={{ background: "none", border: "none", cursor: "pointer", fontSize: "0.75rem", color: "var(--text-tertiary)", fontFamily: "inherit", textDecoration: "underline", textUnderlineOffset: 2 }}
        >
          이용 안내 보기
        </button>
      </div>
    </div>
  );
}
