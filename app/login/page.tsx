import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Calendar } from "lucide-react";
import LoginForm from "./LoginForm";

export default async function LoginPage() {
  const session = await auth();
  if (session) redirect("/");

  return (
    <div className="min-h-screen flex" style={{ background: "var(--bg)" }}>
      {/* 왼쪽 브랜드 패널 */}
      <div
        className="hidden lg:flex flex-col justify-between w-96 flex-shrink-0 p-10"
        style={{ background: "var(--text-primary)", color: "var(--bg)" }}
      >
        <div className="flex items-center gap-2.5">
          <Calendar className="w-5 h-5" style={{ color: "var(--accent-muted)" }} />
          <span className="text-sm font-semibold tracking-tight" style={{ color: "var(--surface)" }}>
            그룹 캘린더
          </span>
        </div>

        <div>
          <p
            className="text-3xl font-bold leading-tight tracking-tight mb-4"
            style={{ color: "var(--surface)" }}
          >
            팀의 모든 일정을<br />한 곳에서
          </p>
          <p className="text-sm leading-relaxed" style={{ color: "var(--text-tertiary)" }}>
            그룹을 만들고, 일정을 공유하고,<br />
            함께 움직이세요.
          </p>
        </div>

        <p className="text-xs" style={{ color: "#57534E" }}>
          © 2025 그룹 캘린더
        </p>
      </div>

      {/* 오른쪽 로그인 패널 */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          {/* 모바일에서만 보이는 로고 */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: "var(--text-primary)" }}
            >
              <Calendar className="w-4 h-4" style={{ color: "var(--accent-muted)" }} />
            </div>
            <span className="text-sm font-semibold tracking-tight">그룹 캘린더</span>
          </div>

          <h1
            className="text-2xl font-bold tracking-tight mb-1"
            style={{ color: "var(--text-primary)" }}
          >
            로그인
          </h1>
          <p className="text-sm mb-8" style={{ color: "var(--text-secondary)" }}>
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
