"use no memo"; // widget trees are plain function calls — keep the React Compiler out
// Home-screen widget layouts (Android): the 일정 요약 tab on the home screen. One component, three
// sizes picked from the widget's real height, so a 4x1 dragged taller turns into the 4x2 / 4x3
// layout and back:
//   4x1  — the first three sections (오늘 · 내일 · 이번 주 …) side by side: count + first event.
//   4x2  — header + those columns with as many events as fit.
//   4x3  — header + the whole summary list by section (scrolls), with date, people and range.
import type { ReactElement } from "react";
import { FlexWidget, ListWidget, TextWidget, type HexColor } from "react-native-android-widget";
import { dark, light, type ColorTokens } from "@/theme/tokens";
import type { WidgetData, WidgetEvent, WidgetSection } from "./data";

export const SCHEME = "groupcalendar://";
const hex = (s: string) => s as HexColor;

type Size = "small" | "medium" | "large";
export function sizeFor(height: number): Size {
  return height < 100 ? "small" : height < 170 ? "medium" : "large";
}

type Pal = { bg: HexColor; text: HexColor; text2: HexColor; line: HexColor; accent: HexColor };
const pal = (c: ColorTokens): Pal => ({ bg: hex(c.card), text: hex(c.text), text2: hex(c.text2), line: hex(c.outline), accent: hex(c.primaryText) });

const openDay = (key: string) => ({ clickAction: "OPEN_URI", clickActionData: { uri: `${SCHEME}day/${key}` } });
const openSummary = { clickAction: "OPEN_URI", clickActionData: { uri: `${SCHEME}summary` } };

function Header({ p, sub }: { p: Pal; sub: string }) {
  return (
    <FlexWidget style={{ width: "match_parent", flexDirection: "row", alignItems: "center", paddingBottom: 8 }}>
      <FlexWidget {...openSummary} accessibilityLabel="일정 요약 열기" style={{ flex: 1, flexDirection: "row", alignItems: "center" }}>
        <TextWidget text="일정 요약" style={{ fontSize: 14, fontWeight: "700", color: p.text }} />
        <TextWidget text={sub ? `  ${sub}` : ""} maxLines={1} truncate="END" style={{ fontSize: 11, color: p.text2 }} />
      </FlexWidget>
      <TextWidget text="↻" clickAction="REFRESH" accessibilityLabel="새로고침" style={{ fontSize: 16, color: p.text2, paddingHorizontal: 8, paddingVertical: 2 }} />
    </FlexWidget>
  );
}

function Bar({ color, height }: { color: string; height: number }) {
  return <FlexWidget style={{ width: 3, height, borderRadius: 2, backgroundColor: hex(color), marginRight: 6 }} />;
}

/** One section as a column (4x1 and 4x2). `rows` = how many event lines fit. */
function SectionColumn({ p, s, rows, first }: { p: Pal; s: WidgetSection; rows: number; first: boolean }) {
  const shown = s.events.length > rows ? s.events.slice(0, Math.max(rows - 1, 0)) : s.events;
  const more = s.events.length - shown.length;
  // Beyond 오늘/내일 the day matters, so each line starts with it.
  const dated = s.key !== "today" && s.key !== "tomorrow";
  return (
    <FlexWidget
      {...(s.events[0] ? openDay(s.events[0].dayKey) : openSummary)}
      accessibilityLabel={`${s.label}, 일정 ${s.events.length}개`}
      style={{ flex: 1, height: "match_parent", flexDirection: "column", paddingLeft: first ? 0 : 10, borderLeftWidth: first ? 0 : 1, borderLeftColor: p.line }}
    >
      <FlexWidget style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
        <TextWidget text={s.label} maxLines={1} style={{ fontSize: 11, fontWeight: "700", color: s.key === "today" ? p.accent : p.text2 }} />
        <TextWidget text={` ${s.events.length}`} style={{ fontSize: 11, color: p.text2 }} />
      </FlexWidget>
      {shown.map((e) => (
        <FlexWidget key={e.id} {...openDay(e.dayKey)} style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
          <Bar color={e.color} height={14} />
          {dated ? <TextWidget text={`${e.day} `} style={{ fontSize: 11, fontWeight: "600", color: p.text2 }} /> : null}
          <TextWidget text={e.title} maxLines={1} truncate="END" style={{ fontSize: 12, fontWeight: "600", color: p.text }} />
        </FlexWidget>
      ))}
      {more > 0 ? <TextWidget text={`+${more}개 더`} style={{ fontSize: 11, color: p.text2 }} /> : null}
    </FlexWidget>
  );
}

/** A list row (4x3): date block, color bar, title + people / range — like a summary tab row. */
function EventRow({ p, e }: { p: Pal; e: WidgetEvent }) {
  return (
    <FlexWidget {...openDay(e.dayKey)} accessibilityLabel={`${e.day}일, ${e.title}${e.sub ? `, ${e.sub}` : ""}`} style={{ width: "match_parent", flexDirection: "row", alignItems: "center", paddingVertical: 5 }}>
      <FlexWidget style={{ width: 30, flexDirection: "column", alignItems: "center", marginRight: 6 }}>
        <TextWidget text={e.day} style={{ fontSize: 15, fontWeight: "700", color: p.text }} />
        <TextWidget text={e.dayNote} style={{ fontSize: 10, color: p.text2 }} />
      </FlexWidget>
      <Bar color={e.color} height={30} />
      <FlexWidget style={{ flex: 1, flexDirection: "column" }}>
        <TextWidget text={e.kind === "leave" ? `${e.title} · 근태` : e.title} maxLines={1} truncate="END" style={{ fontSize: 13, fontWeight: "600", color: p.text }} />
        {e.sub ? <TextWidget text={e.sub} maxLines={1} truncate="END" style={{ fontSize: 11, color: p.text2 }} /> : null}
      </FlexWidget>
    </FlexWidget>
  );
}

function Message({ p, text, sub }: { p: Pal; text: string; sub?: string }) {
  return (
    <FlexWidget clickAction="OPEN_APP" style={{ flex: 1, width: "match_parent", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
      <TextWidget text={text} style={{ fontSize: 13, fontWeight: "600", color: p.text }} />
      {sub ? <TextWidget text={sub} style={{ fontSize: 11, color: p.text2, marginTop: 2 }} /> : null}
    </FlexWidget>
  );
}

function Tree({ data, height, c }: { data: WidgetData | null; height: number; c: ColorTokens }) {
  const p = pal(c);
  const size = sizeFor(height);
  const shell = { height: "match_parent" as const, width: "match_parent" as const, backgroundColor: p.bg, borderRadius: 24, flexDirection: "column" as const };

  if (!data || data.state !== "ok" || data.sections.length === 0) {
    const msg = !data
      ? ["불러오는 중…"]
      : data.state === "ok"
        ? ["다가오는 일정이 없어요"]
        : data.state === "signedOut"
          ? ["로그인이 필요해요", "눌러서 앱 열기"]
          : data.state === "noGroup"
            ? ["속한 그룹이 없어요", "앱에서 그룹에 가입해 주세요"]
            : [data.message, "↻ 눌러서 다시 시도"];
    return (
      <FlexWidget style={{ ...shell, padding: 14 }}>
        {size !== "small" && (data?.state === "error" || data?.state === "ok") ? <Header p={p} sub={data.state === "ok" ? `${data.groupName} · ${data.updatedAt}` : ""} /> : null}
        <Message p={p} text={msg[0]} sub={msg[1]} />
      </FlexWidget>
    );
  }

  const columns = data.sections.slice(0, 3);
  if (size === "small") {
    return (
      <FlexWidget style={{ ...shell, flexDirection: "row", paddingHorizontal: 14, paddingVertical: 10 }}>
        {columns.map((s, i) => (
          <SectionColumn key={s.key} p={p} s={s} rows={1} first={i === 0} />
        ))}
      </FlexWidget>
    );
  }

  const sub = `${data.groupName} · ${data.total}건 · ${data.updatedAt}`;
  if (size === "medium") {
    // header ≈ 30dp, section label ≈ 20dp, each event line ≈ 22dp, padding 24dp.
    const rows = Math.max(1, Math.floor((height - 24 - 30 - 20) / 22));
    return (
      <FlexWidget style={{ ...shell, padding: 12, paddingHorizontal: 14 }}>
        <Header p={p} sub={sub} />
        <FlexWidget style={{ flex: 1, width: "match_parent", flexDirection: "row" }}>
          {columns.map((s, i) => (
            <SectionColumn key={s.key} p={p} s={s} rows={rows} first={i === 0} />
          ))}
        </FlexWidget>
      </FlexWidget>
    );
  }

  // Large: every section, every event (scrolls), like the summary tab.
  const items: ReactElement[] = [];
  for (const s of data.sections) {
    items.push(
      <FlexWidget key={`h-${s.key}`} {...openSummary} style={{ width: "match_parent", flexDirection: "row", alignItems: "center", paddingTop: items.length ? 10 : 0, paddingBottom: 2 }}>
        <TextWidget text={s.label} style={{ fontSize: 12, fontWeight: "700", color: s.key === "today" ? p.accent : p.text }} />
        <TextWidget text={`  ${s.events.length}건`} style={{ fontSize: 11, color: p.text2 }} />
      </FlexWidget>,
    );
    for (const e of s.events) items.push(<EventRow key={`${s.key}-${e.id}`} p={p} e={e} />);
  }
  return (
    <FlexWidget style={{ ...shell, padding: 14 }}>
      <Header p={p} sub={sub} />
      <ListWidget style={{ height: "match_parent", width: "match_parent" }}>{items}</ListWidget>
    </FlexWidget>
  );
}

/** Light and dark trees — Android picks one from the system theme. */
export function renderSchedule(data: WidgetData | null, height: number) {
  return { light: <Tree data={data} height={height} c={light} />, dark: <Tree data={data} height={height} c={dark} /> };
}
