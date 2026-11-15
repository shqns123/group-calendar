# Local release APK (no EAS build quota used).
#
#   cd mobile
#   powershell -ExecutionPolicy Bypass -File scripts\build-android-local.ps1
#   (versionCode is picked automatically; -VersionCode N overrides it)
#   -Arch arm64 = fastest (64-bit phones only); -Arch all = emulators too (default: phone)
#
# Needs: Android Studio (its bundled Java + Android SDK), and credentials.json +
# credentials\android\keystore.jks downloaded with `npx.cmd eas-cli@latest credentials -p android`
# (production -> Download credentials). Both are git-ignored.
#
# The versionCode must be higher than the app already on the phone, or Android refuses the update.
# After a local build, the next EAS cloud build must use a higher number too (EAS keeps its own
# counter: `npx.cmd eas-cli@latest build:version:set -p android`).

param(
  # Optional: by default the next number after the newest APK in dist\ (never below 23, the first
  # local build; EAS had reached 22).
  [int]$VersionCode = 0,
  # Regenerate android/ from scratch (after adding/removing native packages or plugins).
  [switch]$Clean,
  # Detailed Gradle log (shows every download URL); for diagnosing stalls.
  [switch]$Info,
  # CPU types to compile the native (C++) code for — most of the build time goes here, once per type.
  #   phone (default) = arm64-v8a + armeabi-v7a: every real phone, old 32-bit ones included (about half the time)
  #   arm64           = arm64-v8a only: fastest and smallest; very old 32-bit phones can't install it
  #   all             = also x86 / x86_64 (emulators)
  [ValidateSet("phone", "arm64", "all")]
  [string]$Arch = "phone"
)

$ErrorActionPreference = "Stop"
$realMobile = Split-Path -Parent $PSScriptRoot

$mobile = $realMobile
Set-Location $mobile

if ($VersionCode -le 0) {
  $last = 22
  Get-ChildItem "dist" -Filter "group-calendar-v*.apk" -ErrorAction SilentlyContinue | ForEach-Object {
    if ($_.BaseName -match "v(\d+)$" -and [int]$Matches[1] -gt $last) { $last = [int]$Matches[1] }
  }
  $VersionCode = $last + 1
}

# --- Toolchain (Android Studio's own Java, the SDK it installed).
$studioJava = "C:\Program Files\Android\Android Studio\jbr"
if (-not $env:JAVA_HOME) { $env:JAVA_HOME = $studioJava }
if (-not $env:ANDROID_HOME) { $env:ANDROID_HOME = Join-Path $env:LOCALAPPDATA "Android\Sdk" }
if (-not (Test-Path (Join-Path $env:JAVA_HOME "bin\java.exe"))) { throw "Java not found at $env:JAVA_HOME (install Android Studio)." }
if (-not (Test-Path $env:ANDROID_HOME)) { throw "Android SDK not found at $env:ANDROID_HOME (finish Android Studio's setup wizard)." }
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"

# --- Signing: the same keystore EAS uses, so the APK installs as an update.
if (-not (Test-Path "credentials.json")) { throw "credentials.json missing: run npx.cmd eas-cli@latest credentials -p android (production -> Download credentials)." }
$cred = (Get-Content "credentials.json" -Raw | ConvertFrom-Json).android.keystore
$env:RELEASE_STORE_FILE = (Resolve-Path $cred.keystorePath).Path
$env:RELEASE_STORE_PASSWORD = $cred.keystorePassword
$env:RELEASE_KEY_ALIAS = $cred.keyAlias
$env:RELEASE_KEY_PASSWORD = $cred.keyPassword
$env:LOCAL_RELEASE_SIGNING = "1"

# --- Same settings as the EAS "production" profile (eas.json).
$eas = (Get-Content "eas.json" -Raw | ConvertFrom-Json).build.production.env
foreach ($p in $eas.PSObject.Properties) { Set-Item -Path "env:$($p.Name)" -Value $p.Value }
$env:ANDROID_VERSION_CODE = "$VersionCode"
$env:NODE_ENV = "production"

# --- React Native's core AAR (~170MB) from repo.reactnative.dev stalls mid-download on this
# network and Gradle can't resume, so fetch it here with a resumable download into ~/.m2
# (the signing plugin makes local builds read react-android from there first).
$rnVersion = (Get-Content "node_modules\react-native\package.json" -Raw | ConvertFrom-Json).version
$m2 = Join-Path $env:USERPROFILE ".m2\repository\com\facebook\react\react-android\$rnVersion"
$aarName = "react-android-$rnVersion-release.aar"
$aar = Join-Path $m2 $aarName
$central = "https://repo.maven.apache.org/maven2/com/facebook/react/react-android/$rnVersion"
New-Item -ItemType Directory -Force $m2 | Out-Null
foreach ($f in @("react-android-$rnVersion.pom", "react-android-$rnVersion.module", "$aarName.sha1")) {
  if (-not (Test-Path (Join-Path $m2 $f))) { curl.exe -sSfL --retry 5 -o (Join-Path $m2 $f) "$central/$f"; if ($LASTEXITCODE -ne 0) { throw "Could not fetch $f" } }
}
$want = (Get-Content (Join-Path $m2 "$aarName.sha1") -Raw).Trim().Substring(0, 40)
$have = if (Test-Path $aar) { (Get-FileHash $aar -Algorithm SHA1).Hash.ToLower() } else { "" }
if ($have -ne $want) {
  Write-Host "Fetching $aarName (resumable)..."
  for ($i = 1; $i -le 60; $i++) {
    curl.exe -sSL -C - --speed-time 20 --speed-limit 2000 --connect-timeout 20 -o $aar "$central/$aarName"
    if ($LASTEXITCODE -eq 0) { break }
    Start-Sleep -Seconds 2
  }
  $have = (Get-FileHash $aar -Algorithm SHA1).Hash.ToLower()
  if ($have -ne $want) { Remove-Item $aar -Force; throw "$aarName checksum mismatch; run the script again" }
}

Write-Host "Generating android/ (production, versionCode $VersionCode)..."
# Update android/ in place (a running Metro or editor can lock the folder, so deleting it fails);
# -Clean regenerates it from scratch.
if ($Clean -or -not (Test-Path "android")) {
  npx.cmd expo prebuild --platform android --clean --no-install
} else {
  npx.cmd expo prebuild --platform android --no-install
}
if ($LASTEXITCODE -ne 0) { throw "expo prebuild failed" }
# prebuild rewrites the android/ios npm scripts to native runs; put the project's own back.
$pkg = Get-Content "package.json" -Raw
$pkg = $pkg.Replace('"android": "expo run:android"', '"android": "expo start --android"').Replace('"ios": "expo run:ios"', '"ios": "expo start --ios"')
[System.IO.File]::WriteAllText((Join-Path $mobile "package.json"), $pkg)

# C++ build folders go to a short path (C:\gcx\<library>, set up by plugins/withLocalReleaseSigning.js):
# from this repo's real path, CMake's object paths pass Windows' 260-character limit. Old .cxx
# folders inside node_modules (from before) are stale; clear them once.
$cxxRoot = if ($env:GC_CXX_ROOT) { $env:GC_CXX_ROOT } else { "C:\gcx" }
$env:GC_CXX_ROOT = $cxxRoot
New-Item -ItemType Directory -Force $cxxRoot | Out-Null
$rootMark = Join-Path $cxxRoot ".source"
if (-not (Test-Path $rootMark) -or (Get-Content $rootMark -Raw).Trim() -ne $mobile) {
  Get-ChildItem "node_modules" -Directory -Recurse -Depth 3 -Filter ".cxx" -Force -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
  Get-ChildItem $cxxRoot -Directory -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
  Set-Content $rootMark $mobile
}

Write-Host "Building release APK (first run downloads Gradle and dependencies)..."
Push-Location android
# Network timeouts: without them a stalled dependency download can hang the build indefinitely.
$gradleArgs = @("assembleRelease", "--console=plain", "-Dorg.gradle.internal.http.socketTimeout=120000", "-Dorg.gradle.internal.http.connectionTimeout=60000")
if ($Info) { $gradleArgs += "--info" }
$archs = @{ phone = "arm64-v8a,armeabi-v7a"; arm64 = "arm64-v8a"; all = "armeabi-v7a,arm64-v8a,x86,x86_64" }[$Arch]
$gradleArgs += "-PreactNativeArchitectures=$archs"
Write-Host "CPU types: $archs"
& .\gradlew.bat @gradleArgs
$code = $LASTEXITCODE
Pop-Location
if ($code -ne 0) { throw "Gradle build failed" }

$apk = "android\app\build\outputs\apk\release\app-release.apk"
New-Item -ItemType Directory -Force "dist" | Out-Null
$out = "dist\group-calendar-v$VersionCode.apk"
Copy-Item $apk $out -Force
Write-Host "APK: $(Join-Path $realMobile $out)"
