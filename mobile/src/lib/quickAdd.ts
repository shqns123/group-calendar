// Quick add (Samsung Calendar style): one line of text → an event. Picks out
// dates ("11/20", "20일", "20~22일", "내일", "2박3일"), a time ("오전 9시", "14:30"),
// people from the group roster, and 근태 words (월휴/무휴/유휴); the rest is the title.
import { addDays, makeKey, parseKey, todayKey, type DateKey } from "./date";

export const LEAVE_WORDS = ["월휴", "무휴", "유휴"] as const;

export type QuickDraft = {
  category: "BUSINESS_TRIP" | "ATTENDANCE";
  title: string;
  start: DateKey;
  end: DateKey;
  /** "09:00" when a time was written; events are all-day, so it goes into the description. */
  time: string | null;
  people: string[];
};

const pad = (n: number) => String(n).padStart(2, "0");

/** Valid calendar day? (rejects 2/30 etc.) */
function safeKey(y: number, m: number, d: number): DateKey | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const k = makeKey(y, m, d);
  return parseKey(k).month === m && parseKey(k).day === d ? k : null;
}

export function parseQuickAdd(input: string, base: DateKey, roster: string[], today: DateKey = todayKey()): QuickDraft {
  let text = ` ${input.trim()} `;
  const cut = (re: RegExp) => {
    text = text.replace(re, " ");
  };
  const { year: by, month: bm } = parseKey(base);
  let start: DateKey | null = null;
  let end: DateKey | null = null;

  // Relative days.
  const rel: [RegExp, number][] = [
    [/\s(오늘)(?=\s|$|부터|까지|에)/, 0],
    [/\s(내일)(?=\s|$|부터|까지|에)/, 1],
    [/\s(모레)(?=\s|$|부터|까지|에)/, 2],
  ];
  for (const [re, n] of rel) {
    if (re.test(text)) {
      const k = addDays(today, n);
      if (!start) start = k;
      else end = k;
      cut(re);
    }
  }

  // "11/20~11/22", "11.20-22", "11월 20일 ~ 22일", "20~22일", "20일부터 22일까지"
  const md = String.raw`(?:(\d{1,2})\s*[/.월]\s*)?(\d{1,2})\s*일?`;
  const range = new RegExp(String.raw`\s${md}\s*(?:~|-|–|부터)\s*${md}\s*(?:까지)?`);
  const m = range.exec(text);
  if (m) {
    const m1 = m[1] ? Number(m[1]) : bm;
    const d1 = Number(m[2]);
    const m2 = m[3] ? Number(m[3]) : m1;
    const d2 = Number(m[4]);
    const s = safeKey(by, m1, d1);
    let e = safeKey(by, m2, d2);
    if (s && e && e < s) e = safeKey(by + 1, m2, d2); // wraps into next year (12/30~1/2)
    if (s && e) {
      start = s;
      end = e;
      cut(range);
    }
  }
  if (!start) {
    // Single date: "11/20", "11.20", "11월 20일", "20일"
    const single = /\s(?:(\d{1,2})\s*[/.월]\s*(\d{1,2})\s*일?|(\d{1,2})\s*일)(?=\s|$|에|부터|까지)/;
    const s = single.exec(text);
    if (s) {
      const k = s[1] ? safeKey(by, Number(s[1]), Number(s[2])) : safeKey(by, bm, Number(s[3]));
      if (k) {
        start = k;
        cut(single);
      }
    }
  }

  // Length: "2박3일" or "3일간" → end from start.
  const stay = /\s(\d{1,2})\s*박\s*(\d{1,2})\s*일/.exec(text) ?? /\s(\d{1,2})\s*일간/.exec(text);
  if (stay) {
    const days = stay[2] ? Number(stay[2]) : Number(stay[1]);
    if (days >= 1 && days <= 60) {
      end = addDays(start ?? base, days - 1);
      cut(/\s(\d{1,2})\s*박\s*(\d{1,2})\s*일|\s(\d{1,2})\s*일간/);
    }
  }

  // Time: "오전 9시", "오후 2시 30분", "9시 반", "14:30"
  let time: string | null = null;
  const t = /\s(오전|오후)?\s*(\d{1,2})\s*(?::\s*(\d{2})|시\s*(?:(\d{1,2})\s*분|(반))?)/.exec(text);
  if (t) {
    let h = Number(t[2]);
    const min = t[3] ? Number(t[3]) : t[4] ? Number(t[4]) : t[5] ? 30 : 0;
    if (t[1] === "오후" && h < 12) h += 12;
    if (t[1] === "오전" && h === 12) h = 0;
    if (h <= 23 && min <= 59) {
      time = `${pad(h)}:${pad(min)}`;
      text = text.replace(t[0], " ");
    }
  }

  // People from the roster (longest names first so "김민수" wins over "김민").
  const found: { name: string; at: number }[] = [];
  for (const name of [...roster].sort((a, b) => b.length - a.length)) {
    if (!name) continue;
    const esc = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const at = text.search(new RegExp(esc));
    if (at < 0) continue;
    found.push({ name, at });
    // Blank it out with spaces so earlier positions stay valid for ordering.
    text = text.replace(new RegExp(`${esc}(님)?(이랑|랑|와|과|하고|,)?`, "g"), (hit) => " ".repeat(hit.length));
  }
  const people = found.sort((a, b) => a.at - b.at).map((f) => f.name);

  // 근태: a leave word makes it an attendance entry titled with that word.
  const leave = LEAVE_WORDS.find((w) => text.includes(w));
  if (leave) text = text.replace(leave, " ");

  const title = text
    .replace(/\s(에|에서|부터|까지)(?=\s)/g, " ")
    .replace(/[,·]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const s = start ?? base;
  return {
    category: leave ? "ATTENDANCE" : "BUSINESS_TRIP",
    title: leave ?? title,
    start: s,
    end: end && end >= s ? end : s,
    time,
    people,
  };
}
