# 그룹 캘린더 앱 (iOS · Android)

웹앱과 **같은 서버, 같은 계정, 같은 데이터**를 쓰는 네이티브 앱입니다. 화면은 React Native로 따로 그리며, 웹을 띄우는 WebView가 아닙니다.

- 기술: Expo SDK 58, Expo Router, TypeScript
- 디자인: 저장소 루트의 `DESIGN.md`(네이비 관제실)를 따릅니다. 토큰은 `src/theme/tokens.ts`에 있습니다.
- 화면: 캘린더 · 날짜 상세(바텀시트) · 일정 추가/수정 · 일정 요약 · 알림 · 설정 · 로그인

## 서버 연결 방식

1. 앱은 `/api/auth/app-native-signin`(Google 또는 이름+사번)으로 로그인해 세션 토큰을 받습니다.
2. 이후 모든 요청에 `Authorization: Bearer <토큰>`을 붙입니다.
3. 서버 `proxy.ts`가 이 토큰을 기존 로그인 쿠키로 바꿔 넘기기 때문에 웹의 API(`/api/events`, `/api/groups` 등)를 수정 없이 그대로 씁니다.
4. 앱용으로 추가한 API는 `/api/auth/me`(내 정보) 하나입니다.

웹에서 일정을 바꾸면 앱이 화면에 다시 들어올 때, 앱이 다시 열릴 때, 당겨서 새로고침할 때 바로 반영됩니다.

## 처음 실행하기

```bash
cd mobile
npm install
cp .env.example .env.local   # 서버 주소 등을 채우기
npx expo start
```

- **휴대폰에서 보기:** Expo Go 앱으로 터미널의 QR을 찍습니다. 휴대폰과 PC가 같은 Wi-Fi에 있어야 하고, `EXPO_PUBLIC_API_URL`이 휴대폰에서 접속 가능한 주소(PC의 LAN IP, 또는 test/main 서버 주소)여야 합니다.
- **서버 없이 화면만 보기:** `EXPO_PUBLIC_API_URL`을 비우거나 `EXPO_PUBLIC_DEMO=1`이면 예시 데이터로 동작합니다. `npm run web`으로 브라우저에서도 볼 수 있습니다(웹은 미리보기용).

## Google 로그인

Google 로그인은 Expo Go에서는 동작하지 않고, 개발 빌드나 정식 빌드가 필요합니다.

1. Google Cloud Console에서 iOS·Android OAuth 클라이언트를 만듭니다.
2. `.env.local`에 다음 값을 넣습니다.
   - `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`: 서버 `.env`의 `GOOGLE_CLIENT_ID`와 같은 값(서버가 ID 토큰의 aud를 이 값으로 검사합니다)
   - `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`
   - `GOOGLE_IOS_URL_SCHEME`
3. `npx expo run:ios` 또는 `npx expo run:android`로 개발 빌드를 만듭니다. EAS를 쓰려면 `npx eas-cli@latest build --profile development`를 실행합니다.

Google 값을 넣지 않으면 로그인 화면에는 이름+사번 로그인만 보입니다.

## test / main 앱 나누기

서버가 두 개(test, main)이므로 앱도 두 벌로 빌드할 수 있습니다.

| APP_VARIANT | 앱 이름 | 번들 ID |
|---|---|---|
| `development` (기본) | 그룹 캘린더 (개발) | `kr.groupcalendar.app.development` |
| `test` | 그룹 캘린더 (테스트) | `kr.groupcalendar.app.test` |
| `production` | 그룹 캘린더 | `kr.groupcalendar.app` |

번들 ID(`kr.groupcalendar.app`)는 임시값입니다. 스토어에 올리기 전에 `app.config.ts`에서 실제 값으로 바꿔 주세요.

## 검사

```bash
npm run typecheck
npx eslint src
```

## 아직 남은 일

- 푸시 알림: 서버에 FCM(`MobileDeviceToken`)은 있지만, 앱 쪽 토큰 등록(expo-notifications)은 아직 없습니다. 서버는 `platform: "ANDROID"`로 고정돼 있어 iOS 대응도 필요합니다.
- 실시간 갱신: 웹의 SSE(`/api/events/stream`) 대신 화면 포커스·앱 복귀·당겨서 새로고침으로 갱신합니다.
- 그룹 메모와 개인 메모 편집, QR 초대 가입, 관리자 기능은 웹에서 이용합니다.
- 태블릿 전용 레이아웃(분할 화면)은 아직 없습니다.
