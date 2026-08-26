# Group Calendar

그룹 단위 일정, 근태, 장비 현황, 업무 메모, 승인 요청, 알림을 관리하는 Next.js 기반 캘린더입니다.

## 주요 기능

- Google 로그인, Guest 로그인, 그룹 가입 요청
- 그룹 생성, 초대 코드 공유, QR 초대
- 월간 캘린더와 오늘 일정 보기
- 출장/근태 일정 등록, 수정, 삭제
- 장비 선택 및 장비 잔여량 확인
- `장비 반출` 일정 등록
  - 검교정, 외부 대여처럼 인원 없이 장비만 나가는 경우 사용합니다.
  - 장비 현황에는 반영되지만 인원 현황과 월간 일정 표시줄에는 반영되지 않습니다.
  - 날짜 상세, 오늘 보기, 일정 요약에서는 선택한 장비 목록으로 표시됩니다.
- 그룹별 업무 내용 메모
  - 업무 내용이 있는 날짜는 월간 캘린더 날짜칸 왼쪽 상단에 표시됩니다.
- 특근 가능/불가능 상태 표시
- 알림 패널
  - 전체, 근태, 출장, 읽지않음, 승인대기 탭으로 분류됩니다.
- 인원/장비 현황 확인
- 회사 휴일 및 대체 근무일 설정
- 데스크톱/모바일 푸시 알림
- 운영자용 사용자 승인, 알림 설정 관리
- GitLab Private 프로젝트로 그룹별 근태 JSON 자동 동기화

## 기술 스택

- Next.js 16
- React 19
- NextAuth v5 beta
- Prisma + SQLite
- FullCalendar
- Firebase Admin
- Web Push

## 디렉터리 구조

- `app/`: App Router 페이지와 API 라우트
- `components/`: 캘린더, 모달, 대시보드 UI
- `lib/`: 인증, 날짜 처리, 휴일, 알림 등 공용 로직
- `prisma/`: Prisma 스키마와 마이그레이션
- `tests/`: `node:test` 기반 테스트

## 사전 요구사항

- Node.js 20 이상
- npm

## 환경 변수

로컬 개발은 `.env.local`, Docker/배포는 `.env` 기준으로 맞추는 것을 권장합니다.

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
GITLAB_PROJECT_ID=12345678
GITLAB_ACCESS_TOKEN=replace-with-project-access-token
GITLAB_BRANCH=main
# 기본값: 30분마다. node-cron 5필드 형식이며 Asia/Seoul 기준입니다.
GITLAB_SYNC_CRON=*/30 * * * *
```

## GitLab 캘린더 동기화

1. GitLab에서 빈 **Private** 프로젝트를 만들고 프로젝트 숫자 ID를 확인합니다.
2. `Settings → Access Tokens`에서 업로드용 Project Access Token을 발급합니다.
   - Scope: `api`
   - Role: `Maintainer` 권장
3. 보호된 `main` 브랜치를 사용할 경우 `Settings → Repository → Branch rules`에서 토큰 역할이 `Allowed to push and merge`에 포함되어야 합니다. 그렇지 않으면 `403 Forbidden - You are not allowed to push into this branch`가 발생합니다.
4. 토큰은 `.env`에만 두고 Git에 커밋하지 않습니다.

컨테이너는 그룹별 `/app/data/exports/<그룹명> calendar.json`을 만들고 GitLab 파일을 생성 또는 갱신합니다. 그룹명은 파일명으로 사용되므로 서로 다르게 관리하세요. 각 그룹 설정 상단의 **지금 업로드** 버튼으로 해당 그룹만 즉시 동기화할 수 있으며, 그룹 관리자와 운영자만 실행할 수 있습니다.

`GITLAB_SYNC_CRON=*/30 * * * *`는 Asia/Seoul 기준 30분마다 모든 그룹 파일을 동기화합니다. 전용 브랜치를 사용하려면 GitLab에서 브랜치를 먼저 만든 후 `GITLAB_BRANCH=calendar-sync`처럼 설정하고, 회사 PC에도 같은 브랜치를 설정하세요.

회사 PC는 Git 설치 없이 아래 스크립트로 원본 JSON을 받을 수 있습니다. 읽기 전용 Project Access Token에는 `read_api` 또는 `read_repository` scope만 부여하세요. 다운로드가 완료된 뒤 기존 회사 캘린더 반영 프로그램을 호출하도록 작업 스케줄러에 이 스크립트를 등록하면 됩니다.

```powershell
$env:GITLAB_PROJECT_ID = "12345678"
$env:GITLAB_READ_TOKEN = "read-only-project-access-token"
$env:GITLAB_CALENDAR_FILE_NAME = "개발팀 calendar.json"
.\scripts\download-calendar-from-gitlab.ps1 -OutputPath "C:\calendar-sync\calendar.json"
```

여러 그룹을 받으려면 그룹마다 `GITLAB_CALENDAR_FILE_NAME`과 출력 경로를 바꿔 스크립트를 실행하세요.

## 로컬 실행

```bash
npm install
npx prisma generate
npx prisma db push
npm run dev
```

브라우저에서 `http://localhost:3000`으로 접속합니다.

## 프로덕션 빌드

```bash
npm run build
npm run start
```

## Docker 실행

Docker 환경에서는 SQLite DB 경로를 컨테이너 내부 경로로 지정합니다.

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
GITLAB_PROJECT_ID=12345678
GITLAB_ACCESS_TOKEN=replace-with-project-access-token
GITLAB_BRANCH=main
GITLAB_SYNC_CRON=*/30 * * * *
```

```bash
docker compose up --build -d
```

## 검증

```bash
npm run lint
npx tsc --noEmit
node --test tests/notifications.test.ts
npm run build
```

## 휴일 처리 방식

기본 공휴일은 `lib/koreanHolidays.ts`에서 관리합니다.

우선순위는 다음과 같습니다.

1. 회사 `workday` 설정이 있으면 평일 처리
2. 회사 `holiday` 설정이 있으면 회사 휴일 처리
3. 그 외에는 기본 공휴일 처리

## 운영 메모

- 로컬 개발과 Docker 배포는 `DATABASE_URL`, `NEXTAUTH_URL` 값이 다릅니다.
- `AUTH_SECRET`이 없으면 로그인 흐름이 실패할 수 있습니다.
- Prisma 스키마가 변경되면 마이그레이션 적용 또는 `prisma db push`가 필요합니다.
