param(
  [string]$OutputPath = "C:\calendar-sync\calendar.json",
  [string]$GitLabApiUrl = $(if ($env:GITLAB_API_URL) { $env:GITLAB_API_URL } else { "https://gitlab.com/api/v4" }),
  [string]$ProjectId = $env:GITLAB_PROJECT_ID,
  [string]$Branch = $(if ($env:GITLAB_BRANCH) { $env:GITLAB_BRANCH } else { "main" }),
  [string]$FileName = $env:GITLAB_CALENDAR_FILE_NAME,
  [string]$AccessToken = $env:GITLAB_READ_TOKEN
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($ProjectId)) {
  throw "GITLAB_PROJECT_ID 환경 변수를 설정하세요."
}
if ([string]::IsNullOrWhiteSpace($AccessToken)) {
  throw "GITLAB_READ_TOKEN 환경 변수를 설정하세요."
}
if ([string]::IsNullOrWhiteSpace($FileName)) {
  throw "GITLAB_CALENDAR_FILE_NAME 환경 변수 또는 -FileName 값을 설정하세요."
}

$apiBase = $GitLabApiUrl.TrimEnd("/")
$encodedProjectId = [uri]::EscapeDataString($ProjectId)
$encodedBranch = [uri]::EscapeDataString($Branch)
$encodedFileName = [uri]::EscapeDataString($FileName)
$uri = "$apiBase/projects/$encodedProjectId/repository/files/$encodedFileName/raw?ref=$encodedBranch"
$outputDirectory = Split-Path -Parent $OutputPath
$temporaryPath = "$OutputPath.download"

New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
Invoke-WebRequest -Headers @{ "PRIVATE-TOKEN" = $AccessToken } -Uri $uri -OutFile $temporaryPath
Get-Content -LiteralPath $temporaryPath -Raw | ConvertFrom-Json | Out-Null
Move-Item -LiteralPath $temporaryPath -Destination $OutputPath -Force

Write-Output "$FileName 다운로드 완료: $OutputPath"
