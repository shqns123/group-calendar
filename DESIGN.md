---
name: 그룹 캘린더
description: 그룹 일정과 특근을 관리하는 웹앱과 네이티브 앱(iOS·Android)의 공용 디자인 시스템
colors:
  canvas: "#F5F6F8"
  surface: "#FFFFFF"
  surface-muted: "#F0F2F5"
  text-primary: "#191F28"
  text-secondary: "#5F6B79"
  text-tertiary: "#8B95A1"
  divider: "#E8EBEF"
  action: "#4F46E5"
  action-tint: "#F0EFFF"
  danger: "#C92A2A"
  sunday-red: "#DC2626"
  saturday-blue: "#2563EB"
  overtime-amber: "#F59E0B"
  overtime-amber-deep: "#D97706"
  attendance-blue: "#2563EB"
  memo-wash: "#FFF8E6"
  memo-ink: "#8A4B08"
  roster-wash: "#EAF8F1"
  roster-ink: "#0B6B48"
  equipment-wash: "#E8F7FA"
  equipment-ink: "#0E6475"
  night-canvas: "#101318"
  night-surface: "#1B2028"
  night-surface-muted: "#252B35"
  night-text-primary: "#F4F6F8"
  night-text-secondary: "#B2BBC7"
  night-text-tertiary: "#98A3B1"
  night-divider: "#343C48"
  night-action: "#A5A0FF"
  night-action-tint: "#302D4D"
  night-danger: "#FF8585"
  event-blue: "#3B82F6"
  event-indigo: "#6366F1"
  event-violet: "#8B5CF6"
  event-pink: "#EC4899"
  event-red: "#EF4444"
  event-orange: "#F97316"
  event-amber: "#F59E0B"
  event-green: "#10B981"
  event-teal: "#14B8A6"
  event-cyan: "#06B6D4"
typography:
  display:
    fontFamily: "-apple-system, 'Apple SD Gothic Neo', Roboto, 'Noto Sans KR', sans-serif"
    fontSize: "30px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  title:
    fontFamily: "-apple-system, 'Apple SD Gothic Neo', Roboto, 'Noto Sans KR', sans-serif"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "-apple-system, 'Apple SD Gothic Neo', Roboto, 'Noto Sans KR', sans-serif"
    fontSize: "17px"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "-apple-system, 'Apple SD Gothic Neo', Roboto, 'Noto Sans KR', sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
  support:
    fontFamily: "-apple-system, 'Apple SD Gothic Neo', Roboto, 'Noto Sans KR', sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "-apple-system, 'Apple SD Gothic Neo', Roboto, 'Noto Sans KR', sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.4
  caption:
    fontFamily: "-apple-system, 'Apple SD Gothic Neo', Roboto, 'Noto Sans KR', sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.35
  event-bar:
    fontFamily: "-apple-system, 'Apple SD Gothic Neo', Roboto, 'Noto Sans KR', sans-serif"
    fontSize: "10px"
    fontWeight: 600
    lineHeight: 1.25
rounded:
  bar: "4px"
  chip: "6px"
  control: "14px"
  card: "20px"
  sheet: "28px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  xxl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.action}"
    textColor: "{colors.surface}"
    typography: "{typography.headline}"
    rounded: "{rounded.control}"
    height: "56px"
  button-secondary:
    backgroundColor: "{colors.surface-muted}"
    textColor: "{colors.text-primary}"
    typography: "{typography.headline}"
    rounded: "{rounded.control}"
    height: "52px"
  surface-section:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.card}"
    padding: "16px 20px"
  chip-selectable:
    backgroundColor: "{colors.surface-muted}"
    textColor: "{colors.text-primary}"
    typography: "{typography.support}"
    rounded: "{rounded.pill}"
    height: "44px"
  chip-selectable-on:
    backgroundColor: "{colors.action-tint}"
    textColor: "{colors.action}"
  input:
    backgroundColor: "{colors.surface-muted}"
    textColor: "{colors.text-primary}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    height: "52px"
  calendar-event-bar:
    typography: "{typography.event-bar}"
    rounded: "{rounded.bar}"
---

# Design System: 그룹 캘린더

> 2026-11-11 개정: `DESIGN-REDESIGN.md`(리디자인 기준)를 반영했어요. **네이티브 앱은 이 문서대로 적용됨.** 웹(`app/globals.css`, 컴포넌트)은 아직 이전 값이며, 웹 리디자인 때 같은 의미의 토큰으로 맞춘다.

## Overview

**Creative North Star: "조용한 업무 캘린더"**

여러 사람이 일정, 특근, 인원, 장비를 함께 보는 업무 도구다. 사용자가 첫 화면에서 알아야 할 것은 **어느 그룹의 어느 날짜를 보고 있는지**, **그날 무슨 일이 있는지**, **지금 할 수 있는 행동이 무엇인지**다. 밝은 회색 바탕 위의 흰 표면, 또렷한 글자, 넉넉한 간격으로 탐색 부담을 낮춘다. 색은 선택·행동·일정 상태에만 쓴다.

금융 앱(토스)의 정돈된 원리, 즉 연한 회색 바탕 위 흰 묶음, 큰 핵심 값과 작은 설명, 한 묶음에 하나의 주행동, 그림자 없는 둥근 표면을 참고한다. 그 앱의 화면 구성, 문구, 아이콘, 브랜드 색은 가져오지 않는다. 정체성은 기존 인디고 행동색으로 유지한다.

**Key Characteristics:**
- 회색 캔버스(`canvas`) 위 흰 표면(`surface`), 테두리와 그림자 없이 간격과 바탕 차이로 묶는다
- 핵심 값(날짜, 제목)은 크고 굵게, 메타 정보는 두 번째 줄에 작게
- 화면마다 시각적으로 가장 강한 버튼은 하나, 나머지는 조용한 회색 버튼이나 텍스트 버튼
- 월간 캘린더는 정보 밀도를 유지하고, 여백은 캘린더 바깥과 날짜 상세에 쓴다

## Colors

중성 회색 계열 위에서 인디고 하나가 행동을 이끌고, 정보색은 좁은 면적에만 쓴다.

### Primary
- **인디고 행동** (action): 주요 버튼, 선택된 칩·날짜의 글자, 포커스, 오늘 날짜 원. 흰 글자 대비 6.29:1. 다크 모드 값은 night-action이고, 그 위 글자는 night-canvas를 쓴다(8.0:1).
- **인디고 틴트** (action-tint): 선택된 칩, 선택된 날짜 칸의 옅은 면.

### Neutral
- **캔버스 / 표면 / 보조 표면** (canvas, surface, surface-muted): 앱 배경, 흰 묶음, 입력창·보조 버튼·미선택 칩.
- **본문 / 보조 / 3차 글자** (text-primary, text-secondary, text-tertiary): 3차 글자는 흰 바탕 대비 3.0:1이라 **비활성 표시에만** 쓰고, 작은 필수 문구에는 쓰지 않는다.
- **구분선** (divider): 목록 내부에서만 쓴다. 묶음 바깥 테두리로 쓰지 않는다.

리디자인 문서의 보조 글자 `#6B7684`는 회색 바탕 위 대비가 4.27:1이라, 같은 계열에서 한 단계 진한 `#5F6B79`(보조 표면 위 4.84:1)로 조정했다.

### 정보색
- **특근** = 앰버(overtime-amber, 비텍스트 요소는 overtime-amber-deep)
- **근태** = 블루(attendance-blue)
- **메모** = 웜 뉴트럴(memo-wash, memo-ink)
- **인원** = 그린(roster-wash, roster-ink)
- **장비** = 시안(equipment-wash, equipment-ink)
- **일정 색 10종** (event-*): 웹 EventModal과 같은 사용자 지정 팔레트. 캘린더 일정 막대는 **웹 캘린더와 같은 스타일**로 그린다: 이 색의 0x28 알파 면 위에 같은 일정 색 글자(아래 Calendar Day Cell의 예외 참고). 그 밖의 정보 칩은 옅은 면과 진한 글자를 쓴다.
- **일요일·공휴일 / 토요일** (sunday-red, saturday-blue): 날짜 숫자와 요일 머리에만 쓴다.

### Named Rules
**The Quiet Surface Rule.** 묶음은 흰 표면과 여백으로만 구분한다. 바깥 테두리와 그림자는 쓰지 않는다. 떠 있는 요소(일정 추가 버튼, 시트)만 예외다.

**The One Strong Button Rule.** 한 화면에서 인디고로 채운 버튼은 하나뿐이다.

**The Web Dots Rule.** 날짜 칸의 근태·특근은 웹과 똑같이 오른쪽 아래 점으로 표시한다: 근태는 파란 점, 특근 가능은 빨간 점(둘 다 있으면 파랑이 왼쪽). 점만으로 의미가 전달되지 않으므로 날짜 칸의 접근성 이름에 "근태 있음, 특근 가능 표시"를 넣고, 날짜 상세에서 글자로 보여준다. 휴일은 빨간 날짜 숫자로만 표시한다.

**The Night Room Rule.** 모든 토큰은 라이트와 다크 값을 한 쌍으로 가진다.

## Typography

**Body Font (앱):** iOS는 SF Pro와 Apple SD Gothic Neo, Android는 Roboto와 Noto Sans KR (시스템 폰트, 번들 없음).
**Body Font (웹):** 현재 시스템 폰트 체계를 유지한다.

**Character:** 한 가족에 굵기로 위계를 세운다. 숫자·날짜는 크기와 굵기로 강조한다.

### Hierarchy
- **Display** (700, 30px, 1.2): 월 제목.
- **Title** (700, 22px, 1.3): 화면 제목, 날짜 상세의 날짜.
- **Headline** (600, 17px, 1.4): 일정명, 묶음 제목, 주요 버튼.
- **Body** (400, 16px, 1.5): 본문, 입력.
- **Support** (400–600, 15px, 1.45): 시간·설명·상태, 칩.
- **Label** (600, 13px, 1.4): 묶음 머리, 필드 라벨, 메타.
- **Caption** (600, 12px, 1.35): 캘린더 셀, 탭 라벨. **12px이 하한**이다. 단, 캘린더 일정 막대는 웹과 맞추기 위해 Event Bar(600, 10px, 1.25)를 쓰는 유일한 예외다.

### Named Rules
**The No Shrink Rule.** 작은 칸에 맞추려고 글자를 줄이지 않는다. 칸이 모자라면 표시 개수를 줄이고 "+N"으로 넘긴다. 글자 크기 설정을 키우면 캘린더 칸의 막대 줄 수가 자동으로 줄어든다.

## Layout

화면 좌우 기본 여백은 16–20px, 묶음 사이는 24–32px이다. 간격은 4, 8, 12, 16, 24, 32만 쓴다. 상단 헤더, 본문, 하단 탭 세 층 구조이며, 본문은 항상 스크롤된다. 안전 영역은 기기 값을 따른다.

월간 캘린더는 카드로 감싸지 않은 흰 그리드다. 상단에는 그룹 전환(조용한 텍스트 버튼), 크게 쓴 연월과 그 옆의 이전·다음 달, 오른쪽의 "오늘"이 놓인다. 날짜 상세와 관리 화면은 회색 캔버스 위에 흰 묶음을 쌓는다.

## Elevation & Depth

평면이 기본이다. 깊이는 캔버스와 표면의 밝기 차이로 표현한다.

### Shadow Vocabulary
- **Floating** (`box-shadow: 0 6px 16px rgba(25,31,40,0.18)`): 일정 추가 버튼.
- **Sheet** (`box-shadow: 0 -8px 32px rgba(25,31,40,0.16)`): 바텀시트.

## Shapes

캘린더 일정 막대는 4px(웹과 동일), 상태 표시는 6px, 입력창과 버튼은 14px, 흰 묶음은 20px, 바텀시트는 28px 모서리를 쓴다. 칩, 배지, 일정 추가 버튼은 완전한 원형 끝(999px)이다. 같은 역할에는 같은 모서리를 쓴다.

## Components

### Buttons
- **Primary:** action 배경, 흰 글자, Headline, 높이 56px, 모서리 14px. 화면당 하나.
- **Secondary:** surface-muted 배경, text-primary 글자, 높이 52px.
- **Text:** 배경 없이 action 글자. 취소, 지우기, 편집 같은 보조 동작.
- **Icon:** 보이는 크기 44px, surface-muted 원형 또는 투명. 접근성 라벨 필수.
- **일정 추가(FAB):** 보이는 원 40px, 터치 영역 48px. 권한이 있을 때만 보인다.

### Chips
- **Selectable:** 기본은 surface-muted 배경, 테두리 없음. 선택되면 action-tint 배경과 action 글자로만 강조한다(체크 아이콘 없음). 선택 상태는 스크린리더에 전달한다.
- **Status:** 정보색 옅은 면과 같은 계열의 진한 글자. 읽기 전용.
- **두 선택지(출장/근태 등):** 떨어진 두 칸의 Selectable 칩으로 나란히 둔다.

### Surface / Section / ListRow
- 흰 묶음, 모서리 20px, 테두리·그림자 없음. 묶음 제목은 바깥 위쪽에 Label로 둔다.
- 행은 높이 56px 이상, 행 사이에는 좌우 여백을 띄운 divider.

### Inputs / Fields
- surface-muted 채움, 테두리 없음, 모서리 14px, 높이 52px 이상. 라벨은 위쪽에 Label로 둔다.
- Placeholder는 text-secondary를 쓴다.

### EventRow
첫 줄에 색 점과 일정 제목(Headline), 오른쪽에 기간. 두 번째 줄에 인원·장비·설명 중 필요한 것만 Support로 둔다. 날짜 상세에서는 일정 여러 개를 흰 묶음 하나에 행으로 쌓는다.

### Calendar Day Cell (Signature)
- **날짜 숫자:** Label 크기. 오늘은 action 원, 일요일·공휴일은 빨강, 토요일은 파랑, 대체 근무일은 본문색.
- **일정 막대:** 출장 일정만 그린다. 여러 날 일정은 한 막대로 이어지고, 막대 수는 그룹 설정과 칸 높이에 맞춘다.
- **막대 스타일 (웹과 동일, 의도된 예외):** 배경은 일정 색 + `28` 알파, 글자는 일정 색 그대로, 10px/600, 모서리 4px. 웹 `CalendarView`의 eventContent와 `globals.css`의 `.fc-event`와 같다. 노랑·청록처럼 밝은 일정 색은 글자 대비가 AA보다 낮을 수 있으므로, 막대에서 잘린 제목은 날짜 상세에서 전체로 보여준다.
- **상태 표시 (웹과 동일):** 오른쪽 아래 6px 점. 근태 파랑, 특근 가능 빨강(본인 것, 그룹장·파트장·운영자는 전원 것). 휴일은 빨간 숫자.
- **접근성:** "11월 12일 목요일, 추석, 일정 2개, 근태 있음"처럼 전체 문장으로 이름을 단다.

## Do's and Don'ts

### Do:
- **Do** 모든 터치 영역을 44pt / 48dp 이상으로 한다.
- **Do** 새 색은 라이트·다크 한 쌍으로 정하고, 글자 4.5:1, 비텍스트 3:1을 확인한다.
- **Do** 권한이 없는 행동은 숨긴다(설정 메뉴, 일정 추가, 특근 스위치).
- **Do** 색 점처럼 색만으로 보이는 상태는 접근성 이름과 상세 화면에서 글자로도 전달한다.

### Don't:
- **Don't** 흰 묶음에 테두리나 그림자를 넣지 않는다.
- **Don't** 12px보다 작은 글자를 쓰지 않는다.
- **Don't** text-tertiary를 필수 문구에 쓰지 않는다.
- **Don't** 레퍼런스 앱의 화면 구성, 문구, 아이콘, 브랜드 색을 복제하지 않는다.
- **Don't** API, 권한 판단, 일정 계산, 데이터 형식은 디자인 작업에서 바꾸지 않는다.
