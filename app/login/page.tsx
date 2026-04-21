import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Calendar, Check } from "lucide-react";
import LoginForm from "./LoginForm";

const FEATURES = ["실시간 일정 동기화", "그룹별 권한 관리", "특근 가능 알림"];

export default async function LoginPage() {
  const session = await auth();
  if (session) redirect("/");

  return (
    <div className="min-h-screen flex" style={{ background: "var(--bg)" }}>
      {/* 왼쪽 브랜드 패널 */}
      <div
        className="hidden lg:flex flex-col justify-between flex-shrink-0 p-10"
        style={{
          width: 380,
          background: "var(--sidebar-bg)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* 장식 원 */}
        <div style={{ position: "absolute", top: -80, right: -80, width: 300, height: 300, borderRadius: "50%", border: "1px solid var(--sidebar-border)", opacity: 0.4 }} />
        <div style={{ position: "absolute", top: -40, right: -40, width: 200, height: 200, borderRadius: "50%", border: "1px solid var(--sidebar-border)", opacity: 0.3 }} />
        <div style={{ position: "absolute", bottom: -100, left: -80, width: 320, height: 320, borderRadius: "50%", border: "1px solid var(--sidebar-border)", opacity: 0.3 }} />

        <div className="flex items-center gap-2.5" style={{ position: "relative", zIndex: 1 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: "var(--sidebar-accent)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Calendar style={{ width: 16, height: 16, color: "#fff" }} />
          </div>
          <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--sidebar-text-active)", letterSpacing: "-0.02em" }}>
            그룹 캘린더
          </span>
        </div>

        <div style={{ position: "relative", zIndex: 1 }}>
          <p style={{ fontSize: "1.9rem", fontWeight: 800, lineHeight: 1.25, letterSpacing: "-0.03em", color: "var(--sidebar-text-active)", marginBottom: 14 }}>
            팀의 모든 일정을<br />한 곳에서
          </p>
          <p style={{ fontSize: "0.875rem", lineHeight: 1.7, color: "var(--sidebar-text)" }}>
            그룹을 만들고, 일정을 공유하고,<br />
            함께 움직이세요.
          </p>
          {FEATURES.map(f => (
            <div key={f} style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14 }}>
              <div style={{ width: 18, height: 18, borderRadius: "50%", background: "var(--sidebar-item-active)", border: "1px solid rgba(217,119,6,0.27)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Check style={{ width: 10, height: 10, color: "var(--sidebar-accent)" }} />
              </div>
              <span style={{ fontSize: "0.825rem", color: "var(--sidebar-text-hover)" }}>{f}</span>
            </div>
          ))}
        </div>

        <p style={{ fontSize: "0.72rem", color: "var(--sidebar-text)", position: "relative", zIndex: 1 }}>
          © 2026 그룹 캘린더
        </p>
      </div>

      {/* 오른쪽 로그인 패널 */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          {/* 모바일에서만 보이는 로고 */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div style={{ width: 32, height: 32, borderRadius: 9, background: "var(--sidebar-bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Calendar style={{ width: 15, height: 15, color: "var(--sidebar-accent)" }} />
            </div>
            <span className="text-sm font-semibold tracking-tight">그룹 캘린더</span>
          </div>

          <h1
            className="text-2xl font-bold tracking-tight mb-1"
            style={{ color: "var(--text-primary)", letterSpacing: "-0.03em" }}
          >
            로그인
          </h1>
          <p className="text-sm mb-8" style={{ color: "var(--text-tertiary)" }}>
            계속하려면 로그인하세요
          </p>

          <LoginForm />

          <p className="text-xs mt-6" style={{ color: "var(--text-tertiary)" }}>
            로그인 시 서비스 이용약관에 동의합니다
          </p>
        </div>
      </div>
    </div>
  );
}
