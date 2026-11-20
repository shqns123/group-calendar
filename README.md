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
- GitLab Private 프로젝트로 그룹별 근태·출장 JSON 자동 동기화

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

컨테이너는 그룹별 `/app/data/exports/<그룹명> calendar.json`을 만들고 GitLab 파일을 생성 또는 갱신합니다. JSON에는 `ATTENDANCE`(근태)와 `BUSINESS_TRIP`(출장) 일정이 같은 기존 스키마로 포함됩니다. 그룹명은 파일명으로 사용되므로 서로 다르게 관리하세요. 각 그룹 설정 상단의 **지금 업로드** 버튼으로 해당 그룹만 즉시 동기화할 수 있으며, 그룹 관리자와 운영자만 실행할 수 있습니다.

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

### 초대 기반 회원가입

- 신규 가입은 **가입 정보 입력 → 초대 QR 스캔 → 운영자 승인** 순서입니다. Google 인증만으로는 계정이나 가입 승인 요청을 만들지 않습니다. 기존 승인 계정의 로그인은 유지합니다.
- 초대 QR은 생성 시점부터 정확히 60초 동안 1회 사용할 수 있습니다. 만료 또는 사용 후에는 `새 QR 만들기`를 눌러야 합니다. 초대 창 닫힘, 화면 이동, 탭 숨김, 앱 백그라운드 전환 시 서버에 폐기를 요청합니다.
- 창이 갑자기 종료되거나 네트워크가 끊겨 폐기 요청이 전송되지 못한 경우에도, 2초 간격으로 갱신하는 연결 기한이 마지막 확인으로부터 최대 10초 후 만료됩니다. 연결 갱신으로 QR의 60초 유효기간이 늘어나거나 폐기된 QR이 되살아나지는 않습니다.
- QR 확인 전에는 가입 계정과 승인 알림을 생성하지 않습니다. 확인된 요청만 운영자의 승인 목록과 웹·앱 푸시로 전달됩니다. 과거에 생성된 미확인 대기 계정은 QR 확인을 거쳐 다시 요청해야 합니다.
- 가입 제한은 **기기당 24시간에 1건 / IP당 1시간에 10건**, 검증 시도는 **기기당 10분에 5회 / IP당 10분에 20회**입니다. SQLite의 `SignupQuota`에 기록하므로 서버 재시작이나 계정 거절·삭제 후에도 제한이 유지됩니다.
- 웹 기기는 서명된 HttpOnly 쿠키, 앱 기기는 SecureStore의 설치 식별자로 구분합니다. 쿠키 삭제·다른 브라우저·앱 재설치를 넘어 물리 기기를 보증하는 방식은 아니므로 IP 제한과 QR 검증을 함께 적용합니다. 식별자와 IP는 `AUTH_SECRET`으로 HMAC 처리하여 저장합니다.
- `SIGNUP_IP_HEADER`는 신뢰하는 프록시가 실제 클라이언트 IP로 **덮어쓰는** 헤더 이름입니다. 기본값은 `x-forwarded-for`의 첫 IP이고 `x-real-ip`를 보조로 사용합니다. 프록시에서 전달받은 헤더를 그대로 통과시키거나 앱 포트를 직접 공개하면 IP를 위조할 수 있으므로, 프록시가 헤더를 재설정하고 외부에서는 프록시로만 접근하도록 배포합니다. IP가 없으면 공통 `unknown` 버킷으로 제한합니다.
- 적용 전 `npx prisma generate`와 `npx prisma db push`로 스키마를 갱신하세요. Docker 배포는 기존 시작 명령에서 `db push`를 실행합니다. 운영 데이터 삭제나 초기화는 필요하지 않습니다. 설치된 앱에는 변경된 가입 화면을 포함한 새 빌드가 필요합니다.

검증: `npx --package tsx@4.21.0 tsx --test tests/*.test.ts`

- 로컬 개발과 Docker 배포는 `DATABASE_URL`, `NEXTAUTH_URL` 값이 다릅니다.
- `AUTH_SECRET`이 없으면 로그인 흐름이 실패할 수 있습니다.
- Prisma 스키마가 변경되면 마이그레이션 적용 또는 `prisma db push`가 필요합니다.
