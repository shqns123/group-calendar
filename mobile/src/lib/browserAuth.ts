/** Use the existing Auth.js endpoints so the web and phone layouts share one browser cookie. */
export async function browserAuth(action: string, fields: Record<string, string> = {}) {
  const { csrfToken } = await fetch("/api/auth/csrf").then((response) => response.json());
  const response = await fetch("/api/auth/" + action, {
    method: "POST",
    headers: { "X-Auth-Return-Redirect": "1" },
    body: new URLSearchParams({ csrfToken, callbackUrl: location.origin + "/", ...fields }),
  });
  const { url } = await response.json();
  if (!response.ok || !url || new URL(url, location.origin).searchParams.has("error")) {
    throw new Error("로그인 정보를 확인한 뒤 다시 시도해 주세요.");
  }
  location.assign(url);
}
