// Runs the AI quick-add reader on a fixed set of sentences and checks each answer.
// Calls the real model (OpenRouter, about $0.0002 per sentence), so it needs OPENROUTER_API_KEY
// in the environment or in .env.local.
//
//   node scripts/quick-add-eval.mjs
//
// Context is fixed (today = 2026-11-14 Sat) so the expected dates never drift.
import { readFileSync } from "node:fs";
import { checkDraft, askModel } from "../lib/quickAddAi.ts";

if (!process.env.OPENROUTER_API_KEY) {
  try {
    for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
      const m = /^\s*(OPENROUTER_API_KEY|QUICK_ADD_MODEL)\s*=\s*"?([^"\r\n]*)"?\s*$/.exec(line);
      if (m) process.env[m[1]] = m[2];
    }
  } catch {
    // no .env.local
  }
}
if (!process.env.OPENROUTER_API_KEY) {
  console.error("OPENROUTER_API_KEY가 없습니다 (환경변수 또는 .env.local).");
  process.exit(1);
}

const base = {
  today: "2026-11-14",
  selected: "2026-11-14",
  me: "김민수",
  roster: ["김민수", "이서연", "박지훈", "최유진", "정하늘", "한도윤", "오세린"],
  recentTitles: ["남양연구소 출장", "인도 1공장 메인벽 구동부 교체", "화성 오토랜드 무빙창고", "광주 출장"],
};

// expect: only the fields listed are checked. title may be a RegExp.
const cases = [
  ["오후 3시 월차", { status: "ok", category: "ATTENDANCE", leaveType: "월휴", startDate: "2026-11-14", endDate: "2026-11-14", time: "15:00" }],
  ["3일뒤 남영연구소 출장", { status: "ok", category: "BUSINESS_TRIP", title: /남양연구소/, startDate: "2026-11-17", endDate: "2026-11-17" }],
  ["3일뒤 일주일간 광주출장", { status: "ok", category: "BUSINESS_TRIP", title: /광주/, startDate: "2026-11-17", endDate: "2026-11-23" }],
  ["이틀ㄷ ㅢ 광주 출장", { status: "ok", category: "BUSINESS_TRIP", title: /광주/, startDate: "2026-11-16", endDate: "2026-11-16" }],
  ["낼 민수랑 유진 화성 출쟝", { status: "ok", category: "BUSINESS_TRIP", title: /화성/, startDate: "2026-11-15", people: ["김민수", "최유진"] }],
  ["다음주 월요일부터 2박3일 울산", { status: "ok", category: "BUSINESS_TRIP", title: /울산/, startDate: "2026-11-16", endDate: "2026-11-18" }],
  ["20~22일 인도 1공장", { status: "ok", category: "BUSINESS_TRIP", title: /인도/, startDate: "2026-11-20", endDate: "2026-11-22" }],
  ["모레 반차", { status: "ok", category: "ATTENDANCE", leaveType: "기타", startDate: "2026-11-16" }],
  ["내일 공상", { status: "ok", category: "ATTENDANCE", leaveType: "유휴", startDate: "2026-11-15" }],
  ["식목일 휴가", { status: "ok", category: "ATTENDANCE", leaveType: "유휴", startDate: "2026-11-14" }],
  ["다음주 월요일 제헌절 휴무 박지훈", { status: "ok", category: "ATTENDANCE", leaveType: "유휴", startDate: "2026-11-16", people: ["박지훈"] }],
  ["철수 내일 광주", { status: "ok", category: "BUSINESS_TRIP", startDate: "2026-11-15", unknownPeople: ["철수"] }],
  ["안녕하세요", { status: "unclear" }],
];

const same = (a, b) => (b instanceof RegExp ? b.test(String(a)) : JSON.stringify(a) === JSON.stringify(b));
let passed = 0;
for (const [text, expect] of cases) {
  const t0 = Date.now();
  let draft;
  try {
    draft = checkDraft(await askModel({ ...base, text }), { ...base, text });
  } catch (e) {
    console.log(`✗ ${text}\n   오류: ${e.reason ?? ""} ${e.message}`);
    continue;
  }
  const ms = Date.now() - t0;
  const misses = Object.entries(expect).filter(([k, v]) => !same(draft[k], v));
  if (!misses.length) passed++;
  console.log(`${misses.length ? "✗" : "✓"} ${text}  (${ms}ms)`);
  console.log(`   → ${draft.status} ${draft.category} ${draft.leaveType ?? ""} "${draft.title}" ${draft.startDate}~${draft.endDate} ${draft.time ?? ""} [${draft.people}] ${draft.unknownPeople.length ? `없음:${draft.unknownPeople}` : ""} ${draft.detail} ${draft.note}`);
  for (const [k, v] of misses) console.log(`   ✗ ${k}: 기대 ${v instanceof RegExp ? v : JSON.stringify(v)}, 결과 ${JSON.stringify(draft[k])}`);
}
console.log(`\n${passed}/${cases.length} 통과`);
