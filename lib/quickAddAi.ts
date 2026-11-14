// AI quick add: turns one loose Korean line ("3일뒤 일주일간 광주출장", "이틀ㄷ ㅢ 광주 출장",
// "오후 3시 월차") into an event draft with Claude Haiku 5.5 through OpenRouter.
// The model only reads the sentence; dates come from a table we build, people from the roster,
// and every field is checked here before it goes back to the app. Nothing is saved here.

export type AiLeaveType = "월휴" | "무휴" | "유휴" | "기타";

export type AiDraft = {
  status: "ok" | "unclear";
  category: "BUSINESS_TRIP" | "ATTENDANCE";
  leaveType: AiLeaveType | null;
  title: string;
  /** YYYY-MM-DD (Seoul) */
  startDate: string;
  endDate: string;
  /** HH:MM, or null */
  time: string | null;
  people: string[];
  unknownPeople: string[];
  /** The leave word as written (공상, 식목일 휴가, 연차 …), kept for the event description. */
  detail: string;
  /** Why it couldn't be read (status "unclear"), shown to the user. */
  note: string;
};

export type AiContext = {
  text: string;
  /** Seoul date key of today. */
  today: string;
  /** Date picked on the calendar (used when the sentence names no date). */
  selected: string;
  me: string;
  roster: string[];
  recentTitles: string[];
};

export const QUICK_ADD_MODEL = "anthropic/claude-haiku-5.5";
const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const TIMEOUT_MS = 8000;
const DATE_TABLE_DAYS = 21;
const MAX_SPAN_DAYS = 60;
const LEAVE_TYPES: AiLeaveType[] = ["월휴", "무휴", "유휴", "기타"];
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

// ---------- Prompt (stable rules only; per-request facts go in the user message) ----------

export const SYSTEM_PROMPT = `너는 그룹 캘린더 앱의 "빠른 일정 추가" 해석기다. 사용자가 한 줄로 대충 쓴 한국어 문장을
일정 하나로 바꿔 정해진 JSON 형식으로만 답한다. 설명이나 다른 말은 쓰지 않는다.

[일정 종류]
- ATTENDANCE(근태): 월휴, 무휴, 유휴, 기타 휴가. leaveType에 종류를 넣고, title도 같은 값으로 쓴다.
  · "월차" "월휴" → 월휴
  · "무급" "무휴" → 무휴
  · "유급" "연차" "유휴" → 유휴
  · "공상" "식목일" "제헌절" (휴가·휴무·쉼 등이 붙어도 같음) → 유휴
    예: "공상", "식목일 휴가", "제헌절 휴무", "식목일 쉼" → 유휴
  · "반차" "병가" "휴가" "외출" 등 그 밖의 휴무 → 기타 (title에 원래 단어를 쓴다, 예: "반차")
- 근태를 정한 원래 단어(공상, 식목일 휴가, 연차 등)가 있으면 detail에 그대로 쓴다. 없으면 빈 문자열.
- BUSINESS_TRIP(출장·업무): 근태가 아닌 모든 일정. leaveType은 null, detail은 빈 문자열.
  title은 장소와 목적을 짧게 정리한다. 예: "광주 출장", "남양연구소 출장".
  날짜·기간·사람 이름·시간 표현은 title에서 뺀다.

[날짜]
- 날짜는 반드시 사용자 메시지의 [날짜표]에 있는 날짜에서 고른다. 직접 계산하지 않는다.
  [날짜표]에 없는 먼 날짜("12월 24일", "3/5")는 [오늘]의 연도 기준으로 쓰되, 이미 지난 날짜면 다음 해로 본다.
- "오늘/내일/모레/글피", "N일 뒤", "이틀 뒤", "다음 주 월요일", "이번 주 금요일"은 [날짜표] 기준이다.
  · "N일 뒤/후" = 오늘 + N일.
  · "이번 주/다음 주"는 월요일~일요일 기준이다.
- 날짜 표현이 전혀 없으면 [선택한 날짜]를 쓴다.
- 기간:
  · "일주일간/1주일" = 시작일 포함 7일 (종료 = 시작 + 6일)
  · "N일간" = 시작일 포함 N일
  · "N박M일" = M일
  · "A~B", "A부터 B까지" = A부터 B까지
- 기간이 없으면 endDate = startDate.
- endDate가 startDate보다 앞이면 안 된다.

[시간]
- "오후 3시" → "15:00", "오전 9시 반" → "09:30", "14시" → "14:00". 시간이 없으면 null.
- 시간은 title에 넣지 않는다.

[사람]
- 여러 명은 쉼표(,), 공백, "랑/이랑/과/와/하고/및"으로 이어 쓴다. 언급된 사람을 모두 people에 넣는다.
  예: "김민수, 최유진 광주" / "민수 유진 광주" / "민수랑 유진이랑 광주" → ["김민수", "최유진"]
- 사람은 [인원 명단]에 있는 이름으로만 고른다. 오타나 성 빠진 이름은 가장 가까운 명단 이름으로 맞춘다
  (예: "민수" → "김민수"). 확실하지 않으면 people에 넣지 말고 unknownPeople에 원문을 넣는다.
- "나", "내가", "저"는 [작성자] 이름이다.
- 문장에 사람이 나오지 않으면 people은 빈 배열이다. 작성자를 마음대로 넣지 않는다
  (근태의 기본 인원은 앱이 정한다).

[오타]
- 자모가 흩어진 입력은 붙여서 읽는다. 예: "이틀ㄷ ㅢ" → "이틀 뒤", "낼" → "내일", "출쟝" → "출장".
- 출장지·업무명은 [기존 출장지]에서 비슷한 것을 먼저 찾는다. 글자 한두 개가 다르거나, 띄어쓰기·
  받침·모음만 다른 오타면 [기존 출장지]의 표기로 고친다.
  예: "남영연구소" → "남양연구소", "화성오토랜드" → "화성 오토랜드", "인도1공장" → "인도 1공장"
- 사용자가 쓴 만큼만 쓴다. 지역 이름만 썼으면("화성", "광주") 더 긴 기존 제목으로 늘리지 않는다.
  예: "화성 출쟝" → "화성 출장" (O), "화성 오토랜드 무빙창고" (X)
  [기존 출장지]의 일정 제목에 "출장" 같은 말이 붙어 있어도 장소 부분만 가져와 title을 만든다.
  비슷한 것이 없으면 원문 표기를 띄어쓰기만 다듬어 쓴다. 없는 장소를 지어내지 않는다.

[판단할 수 없을 때]
- 일정으로 볼 수 없는 문장(인사, 질문, 의미 없는 글자)이거나 날짜가 서로 모순되면
  status를 "unclear"로 하고 note에 이유를 15자 안팎으로 쓴다 (예: "날짜를 알 수 없어요").
  이때 나머지 필드는 [선택한 날짜] 기준 기본값으로 채운다.
- status가 "ok"이면 note는 빈 문자열이다.`;

export const QUICK_ADD_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["status", "category", "leaveType", "title", "startDate", "endDate", "time", "people", "unknownPeople", "detail", "note"],
  properties: {
    status: { type: "string", enum: ["ok", "unclear"] },
    category: { type: "string", enum: ["BUSINESS_TRIP", "ATTENDANCE"] },
    // anyOf, not a type list with null inside enum: Anthropic's schema check rejects the latter.
    leaveType: { anyOf: [{ type: "string", enum: ["월휴", "무휴", "유휴", "기타"] }, { type: "null" }] },
    title: { type: "string" },
    startDate: { type: "string", description: "YYYY-MM-DD" },
    endDate: { type: "string", description: "YYYY-MM-DD" },
    time: { type: ["string", "null"], description: "HH:MM, 24시간" },
    people: { type: "array", items: { type: "string" } },
    unknownPeople: { type: "array", items: { type: "string" } },
    detail: { type: "string" },
    note: { type: "string" },
  },
} as const;

// ---------- Date keys (Seoul calendar days as YYYY-MM-DD, plain UTC math) ----------

const KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

function keyDate(key: string) {
  const m = KEY.exec(key);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  // Rejects 2026-02-30 etc.
  return d.toISOString().slice(0, 10) === key ? d : null;
}

export function addDaysKey(key: string, days: number) {
  const d = keyDate(key)!;
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function weekdayOf(key: string) {
  return keyDate(key)!.getUTCDay();
}

function dayDiff(a: string, b: string) {
  return Math.round((keyDate(b)!.getTime() - keyDate(a)!.getTime()) / 86_400_000);
}

/** Seoul "today" as YYYY-MM-DD. */
export function seoulToday(now = new Date()) {
  return new Date(now.getTime() + 9 * 3_600_000).toISOString().slice(0, 10);
}

/** "2026-11-16 월 모레 / 다음 주 월요일" lines from today on, so the model never does date math. */
function dateTable(today: string) {
  const sinceMonday = (weekdayOf(today) + 6) % 7;
  const thisMonday = addDaysKey(today, -sinceMonday);
  const nextMonday = addDaysKey(thisMonday, 7);
  const lines: string[] = [];
  for (let i = 0; i < DATE_TABLE_DAYS; i++) {
    const k = addDaysKey(today, i);
    const wd = WEEKDAYS[weekdayOf(k)];
    const names: string[] = [];
    if (i === 0) names.push("오늘");
    else if (i === 1) names.push("내일");
    else if (i === 2) names.push("모레");
    else if (i === 3) names.push("글피");
    if (i > 0) names.push(`${i}일 뒤`);
    const weekStart = dayDiff(thisMonday, k) < 7 ? "이번 주" : dayDiff(nextMonday, k) < 7 ? "다음 주" : dayDiff(nextMonday, k) < 14 ? "다다음 주" : null;
    if (weekStart) names.push(`${weekStart} ${wd}요일`);
    lines.push(`${k} ${wd} ${names.join(" / ")}`);
  }
  return lines.join("\n");
}

export function buildUserMessage(ctx: AiContext) {
  const wd = (k: string) => WEEKDAYS[weekdayOf(k)];
  return [
    `[오늘] ${ctx.today} (${wd(ctx.today)})`,
    `[선택한 날짜] ${ctx.selected} (${wd(ctx.selected)})`,
    `[날짜표]\n${dateTable(ctx.today)}`,
    `[작성자] ${ctx.me}`,
    `[인원 명단] ${ctx.roster.join(", ") || "(없음)"}`,
    `[기존 출장지] ${ctx.recentTitles.join(", ") || "(없음)"}`,
    "",
    "[입력]",
    ctx.text,
  ].join("\n");
}

// ---------- OpenRouter call ----------

export type QuickAddAiFailure = "not_configured" | "timeout" | "rate_limited" | "upstream" | "bad_output";

// Plain field (no constructor parameter property) so `node` can run this file directly for the
// test script (scripts/quick-add-eval.mjs).
export class QuickAddAiError extends Error {
  reason: QuickAddAiFailure;
  constructor(reason: QuickAddAiFailure, message: string) {
    super(message);
    this.reason = reason;
  }
}

export async function askModel(ctx: AiContext): Promise<unknown> {
  const key = process.env.OPENROUTER_API_KEY?.trim();
  if (!key) throw new QuickAddAiError("not_configured", "OPENROUTER_API_KEY is not set");

  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.QUICK_ADD_MODEL?.trim() || QUICK_ADD_MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildUserMessage(ctx) },
        ],
        response_format: { type: "json_schema", json_schema: { name: "quick_add", strict: true, schema: QUICK_ADD_SCHEMA } },
        // One short sentence: keep the model's thinking short (faster, cheaper).
        reasoning: { effort: "low" },
        // Includes the thinking tokens, so leave room.
        max_tokens: 1000,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    const name = (e as Error)?.name;
    throw new QuickAddAiError(name === "TimeoutError" || name === "AbortError" ? "timeout" : "upstream", String(e));
  }
  if (res.status === 429) throw new QuickAddAiError("rate_limited", "OpenRouter rate limit");
  if (!res.ok) throw new QuickAddAiError("upstream", `OpenRouter ${res.status}: ${(await res.text().catch(() => "")).slice(0, 300)}`);

  const json = (await res.json().catch(() => null)) as { choices?: { message?: { content?: unknown } }[] } | null;
  const content = json?.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new QuickAddAiError("bad_output", "no content in response");
  try {
    return JSON.parse(content);
  } catch {
    throw new QuickAddAiError("bad_output", `not JSON: ${content.slice(0, 200)}`);
  }
}

// ---------- Checks (the model's answer is a suggestion, not trusted) ----------

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const strList = (v: unknown) => (Array.isArray(v) ? v.map(str).filter(Boolean) : []);
const compact = (s: string) => s.replace(/\s+/g, "");

/** Exact roster name, or a unique roster name that ends with / contains it ("민수" → "김민수"). */
function matchRoster(name: string, roster: string[]) {
  const n = compact(name);
  const exact = roster.find((r) => compact(r) === n);
  if (exact) return exact;
  const near = roster.filter((r) => compact(r).endsWith(n) || (n.length >= 2 && compact(r).includes(n)));
  return near.length === 1 ? near[0] : null;
}

export function checkDraft(raw: unknown, ctx: AiContext): AiDraft {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const fallbackDay = ctx.selected;

  let start = str(o.startDate);
  let end = str(o.endDate);
  const lo = addDaysKey(ctx.today, -366);
  const hi = addDaysKey(ctx.today, 366);
  const okDay = (k: string) => !!keyDate(k) && k >= lo && k <= hi;
  if (!okDay(start)) start = fallbackDay;
  if (!okDay(end) || end < start || dayDiff(start, end) > MAX_SPAN_DAYS) end = start;

  const category = o.category === "ATTENDANCE" ? "ATTENDANCE" : "BUSINESS_TRIP";
  let leaveType: AiLeaveType | null = null;
  if (category === "ATTENDANCE") leaveType = LEAVE_TYPES.includes(o.leaveType as AiLeaveType) ? (o.leaveType as AiLeaveType) : "기타";

  let title = str(o.title).slice(0, 100);
  if (category === "ATTENDANCE" && leaveType !== "기타") title = leaveType!;
  if (!title) title = category === "ATTENDANCE" ? "기타" : ctx.text.trim().slice(0, 100);

  const timeRaw = str(o.time);
  const time = /^([01]\d|2[0-3]):[0-5]\d$/.test(timeRaw) ? timeRaw : null;

  // People: keep only roster names; anything else is reported back as "not found".
  const people: string[] = [];
  const unknownPeople = strList(o.unknownPeople);
  for (const p of strList(o.people)) {
    const hit = matchRoster(p, ctx.roster);
    if (hit) {
      if (!people.includes(hit)) people.push(hit);
    } else if (!unknownPeople.includes(p)) unknownPeople.push(p);
  }

  const status = o.status === "unclear" ? "unclear" : "ok";
  return {
    status,
    category,
    leaveType,
    title,
    startDate: start,
    endDate: end,
    time,
    people,
    unknownPeople: unknownPeople.slice(0, 5),
    detail: category === "ATTENDANCE" ? str(o.detail).slice(0, 40) : "",
    note: status === "unclear" ? str(o.note).slice(0, 40) || "일정으로 읽지 못했어요" : "",
  };
}

export async function parseQuickAddWithAi(ctx: AiContext): Promise<AiDraft> {
  return checkDraft(await askModel(ctx), ctx);
}
