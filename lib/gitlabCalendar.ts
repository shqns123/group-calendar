import "server-only";

import type { CalendarFileResult } from "./attendanceReport";

const DEFAULT_GITLAB_API_URL = "https://gitlab.com/api/v4";

function requiredEnv(name: "GITLAB_PROJECT_ID" | "GITLAB_ACCESS_TOKEN") {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} 환경 변수가 설정되지 않았습니다.`);
  return value;
}

function getGitLabApiUrl() {
  return (process.env.GITLAB_API_URL?.trim() || DEFAULT_GITLAB_API_URL).replace(/\/+$/, "");
}

function getGitLabBranch() {
  return process.env.GITLAB_BRANCH?.trim() || "main";
}

function repositoryFileUrl(fileName: string) {
  return `${getGitLabApiUrl()}/projects/${encodeURIComponent(requiredEnv("GITLAB_PROJECT_ID"))}/repository/files/${encodeURIComponent(fileName)}`;
}

async function gitLabRequest(fileName: string, method: "POST" | "PUT", body: Record<string, string>) {
  const response = await fetch(repositoryFileUrl(fileName), {
    method,
    headers: { "Content-Type": "application/json", "PRIVATE-TOKEN": requiredEnv("GITLAB_ACCESS_TOKEN") },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (response.ok) return;
  const detail = await response.text();
  throw new Error(`GitLab ${fileName} ${method === "POST" ? "생성" : "갱신"} 실패 (${response.status}): ${detail}`);
}

async function calendarFileExists(fileName: string) {
  const response = await fetch(`${repositoryFileUrl(fileName)}?ref=${encodeURIComponent(getGitLabBranch())}`, {
    headers: { "PRIVATE-TOKEN": requiredEnv("GITLAB_ACCESS_TOKEN") },
    cache: "no-store",
  });
  if (response.status === 404) return false;
  if (response.ok) return true;
  const detail = await response.text();
  throw new Error(`GitLab ${fileName} 확인 실패 (${response.status}): ${detail}`);
}

export async function uploadCalendarToGitLab(calendar: CalendarFileResult) {
  const body = {
    branch: getGitLabBranch(),
    content: `${JSON.stringify(calendar.payload, null, 2)}\n`,
    commit_message: `chore: update ${calendar.fileName} (${calendar.payload.reportDate})`,
  };
  const exists = await calendarFileExists(calendar.fileName);
  await gitLabRequest(calendar.fileName, exists ? "PUT" : "POST", body);
  return { action: exists ? ("updated" as const) : ("created" as const), count: calendar.count, fileName: calendar.fileName };
}
