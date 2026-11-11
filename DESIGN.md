---
name: 그룹 캘린더
description: 그룹 일정과 특근을 관리하는 웹앱과 네이티브 앱(iOS·Android)의 공용 디자인 시스템
colors:
  navy-ink: "#0F172A"
  slate-ink: "#475569"
  slate-muted: "#64748B"
  mist-bg: "#F1F5F9"
  paper-surface: "#FFFFFF"
  paper-raised: "#F8FAFC"
  hairline: "#E2E8F0"
  indigo-signal: "#6366F1"
  indigo-action: "#4F46E5"
  indigo-wash: "#EEF2FF"
  indigo-deep: "#3730A3"
  sunday-red: "#DC2626"
  saturday-blue: "#2563EB"
  overtime-amber: "#F59E0B"
  overtime-amber-deep: "#D97706"
  memo-wash: "#FFFBEB"
  memo-ink: "#92400E"
  roster-wash: "#ECFDF5"
  roster-ink: "#065F46"
  equipment-wash: "#ECFEFF"
  equipment-ink: "#155E75"
  night-bg: "#020617"
  night-surface: "#0F172A"
  night-card: "#1E293B"
  night-hairline: "#334155"
  night-ink: "#F1F5F9"
  night-ink-2: "#CBD5E1"
  night-muted: "#94A3B8"
  night-indigo-action: "#818CF8"
  night-indigo-text: "#A5B4FC"
  night-indigo-wash: "#312E81"
  night-sunday: "#F87171"
  night-saturday: "#60A5FA"
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
  title1:
    fontFamily: "-apple-system, 'Apple SD Gothic Neo', Roboto, 'Noto Sans KR', sans-serif"
    fontSize: "28px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  title2:
    fontFamily: "-apple-system, 'Apple SD Gothic Neo', Roboto, 'Noto Sans KR', sans-serif"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "-apple-system, 'Apple SD Gothic Neo', Roboto, 'Noto Sans KR', sans-serif"
    fontSize: "17px"
    fontWeight: 600
    lineHeight: 1.35
  body:
    fontFamily: "-apple-system, 'Apple SD Gothic Neo', Roboto, 'Noto Sans KR', sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.45
  subhead:
    fontFamily: "-apple-system, 'Apple SD Gothic Neo', Roboto, 'Noto Sans KR', sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.45
  footnote:
    fontFamily: "-apple-system, 'Apple SD Gothic Neo', Roboto, 'Noto Sans KR', sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.4
  caption:
    fontFamily: "-apple-system, 'Apple SD Gothic Neo', Roboto, 'Noto Sans KR', sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1.3
rounded:
  chip: "5px"
  control: "12px"
  card: "16px"
  sheet: "28px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.indigo-action}"
    textColor: "{colors.paper-surface}"
    typography: "{typography.headline}"
    rounded: "{rounded.card}"
    height: "52px"
  button-icon:
    backgroundColor: "{colors.mist-bg}"
    textColor: "{colors.navy-ink}"
    rounded: "{rounded.control}"
    size: "44px"
  fab:
    backgroundColor: "{colors.indigo-action}"
    textColor: "{colors.paper-surface}"
    rounded: "{rounded.pill}"
    size: "40px"
  chip-selectable:
    backgroundColor: "{colors.paper-surface}"
    textColor: "{colors.navy-ink}"
    typography: "{typography.subhead}"
    rounded: "{rounded.pill}"
    height: "44px"
  chip-selectable-on:
    backgroundColor: "{colors.indigo-wash}"
    textColor: "{colors.indigo-deep}"
  card:
    backgroundColor: "{colors.paper-surface}"
    rounded: "{rounded.card}"
    padding: "12px 14px"
  calendar-event-chip:
    textColor: "{colors.navy-ink}"
    typography: "{typography.caption}"
    rounded: "{rounded.chip}"
    padding: "1px 4px"
  tab-bar:
    backgroundColor: "{colors.paper-surface}"
    textColor: "{colors.slate-muted}"
    typography: "{typography.caption}"
    height: "49px"
---

# Design System: 그룹 캘린더

## Overview

**Creative North Star: "네이비 관제실"**

현장 일정과 특근, 인원과 장비를 한 화면에서 내려다보는 관제실이 이 시스템의 기준이다. 정체성은 웹 사이드바의 딥 네이비(navy-ink)와 인디고 신호색에서 온다. 그 위의 컴포넌트는 부드럽고 친근하다: 둥근 모서리, 옅은 배경 워시, 굵기로 만든 위계. 관제실은 어두운 방이므로 다크 모드는 부가 기능이 아니라 이 정체성이 가장 선명하게 드러나는 화면이다.

색은 정보에만 쓴다. 일정 종류, 특근 가능 여부, 인원과 장비 잔여처럼 사용자가 판단해야 하는 값만 색을 가지고, 화면 틀은 슬레이트 중성색으로 조용히 둔다. 밀도는 업무 도구 수준으로 높되, 모든 조작은 장갑 낀 손으로도 누를 수 있는 크기를 지킨다.

**Key Characteristics:**
- 네이비 잉크와 인디고 신호색, 나머지는 슬레이트 중성색
- 정보 색은 옅은 워시 배경과 진한 같은 계열 글자로 쓴다
- 둥근 카드(16px)와 알약형(pill) 칩
- 네이티브 앱은 플랫폼 시스템 폰트, 플랫폼 기본 컨트롤, 다크 모드를 기본으로 지원

## Colors

중성 슬레이트 바탕 위에서 인디고 하나가 행동을 이끌고, 일정과 상태 색 열 가지가 정보를 운반한다.

### Primary
- **인디고 액션** (indigo-action): 주요 버튼, FAB, 오늘 날짜 원, 선택 상태 글자. 흰 글씨와의 대비 6.29:1. 다크 모드에서는 night-indigo-action으로 바꾸고 글자는 navy-ink를 쓴다.
- **인디고 신호** (indigo-signal): 웹에서 물려받은 브랜드 원색. 그룹 표시 점처럼 큰 면이나 장식적 신호에만 쓴다. 흰 배경 위 작은 글자에는 대비가 4.47:1로 부족하므로 쓰지 않는다.
- **인디고 워시 / 딥** (indigo-wash, indigo-deep): 선택된 칩, 선택된 날짜 칸, 그룹 전환 알약.

### Neutral
- **네이비 잉크** (navy-ink): 본문 글자. 다크 모드의 표면색이기도 하다.
- **슬레이트 잉크** (slate-ink): 보조 글자. **슬레이트 뮤트** (slate-muted): 비활성 탭, 메타 정보, 이전/다음 달 날짜.
- **미스트 배경 / 종이 표면 / 헤어라인** (mist-bg, paper-surface, hairline): 화면 바탕, 카드, 1px 구분선.

### 정보 색
- **특근 앰버** (overtime-amber): 특근 가능. 스위치 트랙처럼 흰 배경 위 비텍스트 요소에는 overtime-amber-deep(3:1 이상)을 쓴다. 특근 불가는 event-red 계열.
- **메모 / 인원 / 장비 워시** (memo-*, roster-*, equipment-*): 그룹 메모, 남은 인원, 장비 잔여 칩. 항상 같은 계열의 진한 글자와 짝을 이룬다.
- **일정 색 10종** (event-*): 웹 EventModal과 똑같은 팔레트. 캘린더 칩은 이 색의 18% 워시(다크 30%) 위에 잉크 글자를 쓴다(대비 14:1 이상).
- **일요일 / 토요일** (sunday-red, saturday-blue): 요일 머리와 날짜 숫자.

### Named Rules
**The Signal Only Rule.** 색은 판단이 필요한 정보에만 쓴다. 틀, 헤더, 탭바는 중성색이다.

**The Wash And Ink Rule.** 정보 칩은 옅은 워시 배경에 같은 계열의 진한 글자를 쓴다. 채도 높은 면 위에 흰 글씨를 올리지 않는다(주요 버튼과 배지는 예외).

**The Night Room Rule.** 모든 토큰은 라이트와 다크 값을 한 쌍으로 갖는다. 다크 값이 없는 색은 추가하지 않는다.

## Typography

**Body Font (앱):** iOS는 SF Pro와 Apple SD Gothic Neo, Android는 Roboto와 Noto Sans KR. 모두 시스템 폰트라 앱에 폰트를 번들하지 않는다.
**Body Font (웹):** Plus Jakarta Sans와 한글 시스템 폰트 폴백(기존 globals.css 유지).

**Character:** 한 가족, 굵기 위계. 크기 대신 600–700 굵기로 제목과 값을 세운다.

### Hierarchy
- **Title 1** (700, 28px, 1.2): 탭 최상위 화면 제목, 월 제목.
- **Title 2** (700, 22px, 1.25): 바텀시트 날짜.
- **Headline** (600, 17px, 1.35): 카드 제목, 내비게이션 제목, 섹션 제목, 주요 버튼.
- **Body** (400, 17px, 1.45): 입력값, 설명.
- **Subhead** (400–600, 15px, 1.45): 목록 보조 줄, 메모 본문, 선택 칩.
- **Footnote** (600, 13px, 1.4): 라벨, 정보 칩, 메타.
- **Caption** (600, 11px, 1.3): 캘린더 일정 칩, 탭 라벨, 배지. 11px이 하한이다.

### Named Rules
**The Scalable Type Rule.** 앱의 모든 글자는 Dynamic Type과 Android 글꼴 크기를 따른다. 높이를 고정한 글자 상자는 만들지 않는다. 글자가 커지면 캘린더 칸은 칩 수를 줄이고(4 → 2) "+N"으로 넘긴다.

## Layout

휴대폰 세로 화면을 기준으로 상단 헤더, 본문, 하단 탭바 세 층으로 나눈다. 본문은 항상 스크롤 영역이며 내용을 잘라 숨기지 않는다. 상단과 하단 여백은 고정 px가 아니라 기기의 안전 영역(safe area) 값에서 계산한다. 시안 기준 iOS는 47/34, Android는 32/24다.

간격은 4의 배수(4, 8, 12, 16, 24)를 쓴다. 카드 사이 8–14, 카드 안쪽 12×14, 화면 좌우 16이 기본이다. 월간 캘린더는 7열, 5–6행을 남은 높이에 균등 분배하고, 칸은 탭 한 번으로 날짜 바텀시트를 연다.

태블릿 레이아웃은 아직 정의하지 않았다. 다음 단계에서 캘린더와 날짜 상세를 나란히 놓는 분할 화면으로 설계한다.

## Elevation & Depth

평면과 헤어라인이 기본이다. 카드와 목록은 1px 헤어라인과 배경 단차(mist-bg 위의 paper-surface)로 구분하고, 그림자는 화면 위에 떠 있는 요소에만 쓴다.

### Shadow Vocabulary
- **Floating** (`box-shadow: 0 6px 16px rgba(15,23,42,0.25)`): FAB.
- **Sheet** (`box-shadow: 0 -8px 32px rgba(15,23,42,0.2)`): 바텀시트.

### Named Rules
**The Float Only Rule.** 그림자는 떠 있는 것(FAB, 시트)에만. 카드는 선으로 구분한다.

## Shapes

부드러운 둥근 모서리로 통일한다. 카드 16px, 아이콘 버튼과 세그먼트 12px, 캘린더 일정 칩 5px, 바텀시트 상단 28px. 선택 칩, 알약형 버튼, 배지, FAB는 완전한 원형 끝(999px)이다.

## Components

### Buttons
- **Shape:** 주요 버튼 16px 모서리, 높이 52px.
- **Primary:** indigo-action 배경에 흰 글자, Headline. 화면당 하나.
- **Icon:** 보이는 크기 44×44, 12px 모서리, mist-bg 배경. 아이콘 20–22px. 모든 아이콘 버튼은 접근성 라벨을 가진다.
- **FAB:** 보이는 원 40px, 터치 영역 48px. 캘린더 화면에만 하나.

### Chips
- **Style:** 선택형 칩은 높이 44px, pill, 헤어라인 테두리.
- **State:** 선택되면 indigo-wash 배경, indigo-deep 글자, 체크 아이콘이 붙는다(색만으로 구분하지 않는다). 사용 중인 장비는 점선 테두리와 "사용 중" 문구로 비활성 이유를 보여준다.

### Cards / Containers
- **Corner Style:** 16px
- **Background:** paper-surface(다크 night-card)
- **Shadow Strategy:** 없음. Elevation & Depth 참고.
- **Border:** 1px hairline
- **Internal Padding:** 12px 14px

### Inputs / Fields
- **Style:** 카드 안의 라벨(Footnote, slate-ink)과 값(Body). 테두리 없는 입력, 카드가 필드 경계 역할.
- **Placeholder:** 글자색 62% 불투명도(라이트·다크 모두 4.5:1 이상).
- **Required:** 라벨 옆 빨간 별표.

### Navigation
- **iOS:** 탭바 49pt + 하단 안전 영역, 아이콘 24, 라벨 Caption. 활성 탭은 인디고 글자와 굵은 아이콘.
- **Android:** Material NavigationBar 80dp, 활성 탭은 indigo-wash 알약(64×32) 표시와 잉크 글자, 라벨 12sp.
- **편집 화면:** iOS는 "취소 / 제목 / 저장" 내비게이션 바, Android는 닫기(X) 아이콘, 제목, "저장" 버튼이 있는 상단 앱바.

### Switch / Segmented
플랫폼 기본 컨트롤을 쓴다(React Native Switch, iOS 세그먼트 컨트롤, Material SegmentedButton). 브랜드는 트랙 색으로만 입힌다. 특근 스위치는 overtime-amber-deep, 일반 스위치는 indigo-action.

### Calendar Day Cell (Signature)
날짜 숫자(Footnote, 오늘은 인디고 원), 그 아래 일정 칩 최대 4개, 넘치면 "+N". 선택된 날은 indigo-wash 배경. 각 칸은 "11월 12일 목요일, 일정 4개, 선택됨"처럼 전체 문장으로 접근성 라벨을 가진다.

## Do's and Don'ts

### Do:
- **Do** 모든 조작 요소의 터치 영역을 44pt / 48dp 이상으로 한다. 보이는 크기가 작으면 터치 영역만 넓힌다.
- **Do** 새 색을 추가할 때 라이트와 다크 값을 함께 정하고, 글자는 4.5:1, 비텍스트 요소는 3:1 대비를 확인한다.
- **Do** 일정 색은 웹 EventModal의 10종 팔레트를 그대로 쓴다.
- **Do** 상태는 색과 함께 글자나 아이콘으로도 표시한다(특근 상태 문구, 선택 체크, "사용 중").

### Don't:
- **Don't** 11px보다 작은 글자를 쓰지 않는다.
- **Don't** 스위치, 세그먼트, 피커를 직접 그려 만들지 않는다. 플랫폼 컨트롤을 쓰고 색만 입힌다.
- **Don't** 카드에 그림자를 넣지 않는다. 그림자는 FAB와 시트 전용이다.
- **Don't** indigo-signal(#6366F1)을 흰 배경 위 작은 글자에 쓰지 않는다. 글자에는 indigo-action을 쓴다.
