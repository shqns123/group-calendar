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

## MCP 서버 (Hermes / Codex)

`group-calendar-mcp`는 별도 Docker 컨테이너로 실행되는 stdio MCP 서버입니다. MCP 서버는 SQLite에 직접 연결하지 않고, Docker 내부 네트워크에서 컨테이너 이름 `group-calendar`로 이 앱의 REST API만 호출합니다. 웹앱은 `MCP_API_TOKEN`이 유효할 때만 `MCP_SERVICE_USER_EMAIL` 계정으로 요청을 실행하며, 기존 그룹/운영자 권한도 그대로 적용합니다.

### MCP 권한 준비

1. [.env.example](.env.example)를 `.env`로 복사하고 기존 웹앱 환경 변수도 채웁니다.
2. `MCP_API_TOKEN`에는 충분히 긴 무작위 토큰을 설정합니다. PowerShell에서는 다음 명령으로 만들 수 있습니다.

   ```powershell
   -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 48 | ForEach-Object {[char]$_})
   ```

3. `MCP_SERVICE_USER_EMAIL`에는 이미 가입되어 있으며 필요한 권한을 가진 계정의 이메일을 설정합니다. 그룹 생성/삭제까지 사용하려면 운영자 계정이어야 합니다.
4. 웹앱을 빌드하고 실행합니다.

   ```bash
   docker compose up --build -d
   ```

MCP 서비스는 `profiles: ["mcp"]`로 표시되어 있어 일반 `up` 때 stdin 없이 실행되지 않습니다. MCP 클라이언트가 아래 명령으로 한 번의 stdio 세션을 만들 때마다 별도 컨테이너가 실행됩니다.

```bash
docker compose --profile mcp run --rm -i group-calendar-mcp
```

변경/삭제 요청은 MCP 서버가 입력 스키마를 우선 검증하고, 앱 REST API의 권한·유효성 검사를 다시 거칩니다. 삭제 도구에는 반드시 `confirm: true`가 필요합니다. 변경 및 삭제 결과는 JSON 형식으로 Docker 로그에 남습니다.

### 제공 도구

| 구분 | 도구 | 설명 |
| --- | --- | --- |
| 조회 | `calendar_read_groups` | 권한이 있는 그룹 목록 |
| 조회 | `calendar_read_group` | 그룹 및 구성원 상세 |
| 조회 | `calendar_read_events` | 개인/그룹 일정 조회 및 기간 필터 |
| 변경 | `calendar_write_create_group` | 그룹 생성 |
| 변경 | `calendar_write_update_group` | 그룹 설정 변경 |
| 삭제 | `calendar_delete_group` | 그룹 및 관련 데이터 영구 삭제 |
| 변경 | `calendar_write_create_event` | 개인/그룹 일정 생성 |
| 변경 | `calendar_write_update_event` | 일정 변경 |
| 삭제 | `calendar_delete_event` | 일정 영구 삭제 |

### Codex 설정

프로젝트를 신뢰한 뒤 `.codex/config.toml` 또는 사용자 설정 `~/.codex/config.toml`에 아래를 추가합니다. Windows에서는 `command`의 `docker`가 PATH에 있어야 합니다.

```toml
[mcp_servers.group-calendar]
command = "docker"
args = ["compose", "--project-directory", "C:\\Users\\Woojin\\Desktop\\group-calendar", "--profile", "mcp", "run", "--rm", "-i", "group-calendar-mcp"]
```

저장 후 Codex를 재시작하고 `/mcp` 또는 `codex mcp list`로 연결을 확인합니다. Codex는 프로젝트별 `.codex/config.toml`과 사용자 `~/.codex/config.toml`의 stdio MCP 설정을 지원합니다. 자세한 형식은 [공식 OpenAI MCP 문서](https://learn.chatgpt.com/ko-KR/docs/extend/mcp)를 참고하세요.

### Hermes 설정

`~/.hermes/config.yaml`의 `mcp_servers`에 다음을 추가한 뒤 Hermes를 재시작합니다.

```yaml
mcp_servers:
  group_calendar:
    command: docker
    args:
      - compose
      - --project-directory
      - C:\\Users\\Woojin\\Desktop\\group-calendar
      - --profile
      - mcp
      - run
      - --rm
      - -i
      - group-calendar-mcp
```

Hermes에서는 도구명이 `mcp_group_calendar_calendar_read_events`처럼 서버 이름이 접두사로 붙습니다. Hermes의 stdio MCP 설정 방식은 [Hermes MCP 문서](https://hermes-agent.nousresearch.com/docs/user-guide/features/mcp/)를 기준으로 했습니다.

### MCP 테스트

MCP 이미지 빌드와 서버 패키지 검증은 다음처럼 실행합니다.

```bash
cd mcp-server
npm ci
npm run build
cd ..
docker compose --profile mcp build group-calendar-mcp
```

실제 도구 호출은 Codex/Hermes에서 `calendar_read_groups`를 먼저 실행해 서비스 계정 및 토큰 설정을 확인한 뒤, 테스트 그룹에서 일정 생성/수정/삭제를 검증하세요. stdio 컨테이너는 `--rm`으로 세션 종료 후 제거되므로 변경/삭제 감사 JSON은 MCP 클라이언트가 실행한 Docker 프로세스의 stderr(또는 해당 프로세스의 수집 로그)에서 확인합니다.

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
