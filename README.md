# Group Calendar

그룹 단위 일정 관리, 가입 승인, 알림, 회사 휴일 예외 처리를 한 번에 다루는 Next.js 기반 그룹 캘린더입니다.

## 주요 기능

- Google 로그인, Guest 로그인, Guest 가입 요청
- 운영자 승인 기반 사용자 온보딩
- 그룹 생성, 초대 코드 공유, QR 초대, 그룹 가입 요청
- 월간 캘린더와 오늘 요약 보기
- 일정 생성, 수정, 삭제
- 인원/장비 현황 확인
- 연장 가능/불가 표시
- 그룹별 업무 메모
- 웹 푸시 / 모바일 푸시 알림
- 회사 휴일 / 대체 근무일 설정
- 운영자용 사용자, 승인, 알림 스케줄 관리

## 기술 스택

- Next.js 16
- React 19
- NextAuth v5 beta
- Prisma + SQLite
- FullCalendar
- Firebase Admin
- Web Push

## 디렉터리 개요

- `app/`: App Router 페이지와 API 라우트
- `components/`: 캘린더, 모달, 대시보드 UI
- `lib/`: 인증, 시간 처리, 공휴일, 알림 등 공용 로직
- `prisma/`: Prisma 스키마와 마이그레이션
- `tests/`: `node:test` 기반 테스트

## 사전 요구사항

- Node.js 20 이상
- npm

## 환경변수

로컬 개발은 `.env.local`, 도커/배포는 `.env` 기준으로 맞추는 게 안전합니다.

### 로컬 개발 예시

```env
DATABASE_URL=file:./prisma/dev.db
NEXTAUTH_URL=http://localhost:3000
AUTH_SECRET=replace-with-random-secret
GOOGLE_CLIENT_ID=replace-with-google-client-id
GOOGLE_CLIENT_SECRET=replace-with-google-client-secret
AUTH_TRUST_HOST=true
OPERATOR_EMAIL=operator@example.com
VAPID_EMAIL=mailto:operator@example.com
NEXT_PUBLIC_VAPID_PUBLIC_KEY=replace-with-public-vapid-key
VAPID_PRIVATE_KEY=replace-with-private-vapid-key
FIREBASE_PROJECT_ID=replace-with-firebase-project-id
FIREBASE_SERVICE_ACCOUNT_BASE64=replace-with-base64-json
```

### 주요 변수 설명

- `DATABASE_URL`: 로컬은 `file:./prisma/dev.db`, 도커는 `/app/data/prod.db` 계열 사용
- `NEXTAUTH_URL`: 현재 실행 중인 앱 주소
- `AUTH_SECRET`: Auth.js 세션 서명 키
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`: Google OAuth 설정
- `OPERATOR_EMAIL`: 최초 운영자 이메일
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`: 웹 푸시용 키
- `FIREBASE_*`: 모바일 푸시용 Firebase 설정

## 로컬 설치 및 실행

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경변수 파일 준비

프로젝트 루트에 `.env.local`을 만들고 위 예시 값을 채웁니다.

### 3. Prisma 클라이언트 및 DB 준비

```bash
npx prisma generate
npx prisma db push
```

### 4. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 `http://localhost:3000`으로 접속합니다.

## 프로덕션 빌드 실행

```bash
npm run build
npm run start
```

## Docker 실행

`docker-compose.yml`은 `.env`를 읽고, 컨테이너 내부 DB 경로로 `/app/data/prod.db`를 사용합니다.

### 1. `.env` 준비

예:

```env
DATABASE_URL=file:/app/data/prod.db
NEXTAUTH_URL=https://your-domain.example.com
AUTH_SECRET=replace-with-random-secret
GOOGLE_CLIENT_ID=replace-with-google-client-id
GOOGLE_CLIENT_SECRET=replace-with-google-client-secret
AUTH_TRUST_HOST=true
OPERATOR_EMAIL=operator@example.com
VAPID_EMAIL=mailto:operator@example.com
NEXT_PUBLIC_VAPID_PUBLIC_KEY=replace-with-public-vapid-key
VAPID_PRIVATE_KEY=replace-with-private-vapid-key
FIREBASE_PROJECT_ID=replace-with-firebase-project-id
FIREBASE_SERVICE_ACCOUNT_BASE64=replace-with-base64-json
```

### 2. 실행

```bash
docker compose up --build -d
```

## 테스트 / 검증

린트:

```bash
npm run lint
```

예시 테스트:

```bash
node --test tests/korean-holidays.test.ts
```

## 공휴일 처리 방식

기본 공휴일은 `lib/koreanHolidays.ts`에서 관리합니다.

- 국가 공휴일 / 설날 / 추석 같은 기본 휴일
- 회사 휴일(`holiday`)
- 대체 근무일(`workday`)

최종 우선순위는 아래와 같습니다.

1. 회사 `workday` 설정이 있으면 평일 처리
2. 회사 `holiday` 설정이 있으면 회사 휴일 처리
3. 그 외에는 기본 공휴일 처리

즉, 법정 공휴일이어도 회사 기준으로 출근해야 하는 날을 계속 지원합니다.

## 운영 메모

- 로컬 개발과 도커 배포는 `DATABASE_URL`, `NEXTAUTH_URL`이 다릅니다.
- `AUTH_SECRET`가 없으면 로그인 라우트가 바로 실패합니다.
- SQLite 파일 경로가 환경에 맞지 않으면 Prisma가 DB를 열지 못합니다.
- 현재 작업 폴더에는 `.git` 디렉터리가 없어서 이 위치에서는 바로 `git commit` / `git push`를 할 수 없습니다.
