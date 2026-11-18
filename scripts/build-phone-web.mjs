import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Build the same Expo Router screens that ship on the phone, with cookie-based web login.
const cwd = fileURLToPath(new URL("../mobile/", import.meta.url));
const cli = fileURLToPath(new URL("../mobile/node_modules/expo/bin/cli", import.meta.url));
if (!existsSync(cli)) {
  const install = spawnSync(process.platform === "win32" ? "npm.cmd" : "npm", ["ci"], {
    cwd, stdio: "inherit", shell: process.platform === "win32",
  });
  if (install.status !== 0) process.exit(1);
}
const result = spawnSync(process.execPath, [cli, "export", "--platform", "web", "--output-dir", "../public/login-ui"], {
  cwd, stdio: "inherit",
  env: { ...process.env, EXPO_NO_DOTENV: "1", APP_VARIANT: "development", EXPO_PUBLIC_HOSTED_WEB: "1", EXPO_PUBLIC_DEMO: "0", EXPO_PUBLIC_API_URL: "" },
});
if (result.status !== 0) process.exit(result.status ?? 1);
const html = new URL("../public/login-ui/index.html", import.meta.url);
const page = readFileSync(html, "utf8")
  .replace('<html lang="en">', '<html lang="ko">')
  .replace("shrink-to-fit=no", "viewport-fit=cover, interactive-widget=resizes-content")
  .replace("</head>", '<link rel="manifest" href="/manifest.json"><link rel="apple-touch-icon" href="/apple-touch-icon.png"></head>')
  .replace(/<title>[^<]*<\/title>/, "<title>그룹 캘린더</title>");
writeFileSync(html, page);
