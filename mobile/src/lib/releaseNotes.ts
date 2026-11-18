import Constants from "expo-constants";

/**
 * What's new, per app version (app.config.ts `version`). The popup after sign-in shows only the
 * entry for the version that's running, so each update announces just its own changes. Add the
 * next version's entry when you bump the version; a version without an entry shows nothing.
 */
export type ReleaseSection = {
  icon: "sparkles" | "mic" | "info" | "calendar" | "bell" | "people";
  title: string;
  body?: string;
  examples?: string[];
  steps?: string[];
  note?: string;
  bullets?: string[];
};
export type ReleaseNote = {
  date: string;
  title: string;
  lead: string;
  sections: ReleaseSection[];
  /**
   * Phone web app only: last day (YYYY-MM-DD) it shows this note. The web keeps "다시 보지 않기" in
   * browser storage, so a cache clear would bring an old note back; past this day it stays away,
   * however often the web app is rebuilt. Missing = never on the web.
   */
  webUntil?: string;
};

export const RELEASE_NOTES: Record<string, ReleaseNote> = {
  "1.1.0": {
    date: "2026년 11월 업데이트",
    webUntil: "2026-11-21",
    title: "대충 적어도, 말로 해도\n일정이 들어가요",
    lead: "하단바 가운데 + 버튼으로 어느 화면에서든 빠른 추가 입력창을 열 수 있고, AI 읽기와 음성 입력이 생겼어요. 날짜를 계산하거나 형식을 맞추지 않아도 돼요.",
    sections: [
      {
        icon: "sparkles",
        title: "AI로 읽기",
        body: "입력창 왼쪽의 반짝이 버튼을 켜면, 편하게 적은 한 줄을 AI가 날짜·기간·인원·출장지로 나눠 줘요. 오타나 띄어쓰기가 틀려도 알아들어요.",
        examples: ["3일뒤 남양연구소 출장", "3일뒤 일주일간 광주출장", "이틀 뒤 광주 출장", "오후 3시 월차"],
        steps: [
          "하단바의 + 를 눌러 입력창을 열고, 왼쪽 반짝이 버튼을 켜요. 켜져 있는 동안 입력창 둘레가 은은하게 빛나요.",
          "할 일을 한 줄로 적고 ✓를 눌러요.",
          "「이대로 추가할까요?」 창에서 날짜와 인원을 확인하고 「추가」를 눌러요. 고칠 게 있으면 「수정」을 누르면 일정 편집 화면이 열려요.",
        ],
      },
      {
        icon: "mic",
        title: "말로 입력",
        body: "입력창 오른쪽의 마이크를 누르고 말하면 바로 글자로 적혀요. 말을 멈추면 자동으로 끝나고, AI가 읽어서 확인 창을 띄워 줘요.",
        note: "처음 한 번 마이크 권한을 물어봐요. 음성은 휴대폰의 음성 인식(Google·Apple)이 글자로 바꾸고, 그룹 캘린더 서버에는 글자만 전송돼요.",
      },
      {
        icon: "info",
        title: "알아두면 좋아요",
        bullets: [
          "AI도 가끔 잘못 읽어요. 추가하기 전에 확인 창의 날짜와 인원을 한 번 봐 주세요.",
          "AI가 답하지 않을 때(서버 점검, 사용량 초과 등)는 기존 방식으로 읽은 결과를 보여 드려요.",
          "AI가 읽을 수 있도록 적은 문장, 그룹 인원 이름, 최근 일정 제목이 AI 서비스로 전송돼요.",
          "반짝이 버튼을 끄면 지금까지처럼 바로 추가돼요.",
        ],
      },
      {
        icon: "people",
        title: "그룹 가입은 QR로",
        body: "초대 코드가 없어지고 QR 코드로만 그룹에 가입해요. QR 코드는 한 번만 쓸 수 있고 1분마다 바뀌어요.",
        bullets: [
          "초대하기: 설정 › 「QR로 그룹 초대」에서 QR 코드를 보여 주세요. 그룹 멤버라면 누구나 초대할 수 있어요.",
          "가입하기: 설정 › 「QR 스캔으로 그룹 가입」에서 카메라로 비추면 돼요.",
          "운영자·그룹장·파트장의 QR로 가입하면 승인 없이 바로 멤버가 되고, 다른 멤버의 QR은 승인이 필요해요.",
        ],
      },
    ],
  },
};

/** The running app's version (versionName), e.g. "1.1.0". */
export const APP_VERSION: string = Constants.expoConfig?.version ?? "0.0.0";

/** -1 / 0 / 1 for dotted numeric versions ("1.10.0" > "1.9.2"). */
export function compareVersions(a: string, b: string) {
  const pa = a.split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d > 0 ? 1 : -1;
  }
  return 0;
}
