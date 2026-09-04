# Build a production-like release APK locally (Windows).
# Uses the same API URL as the EAS "preview" profile in eas.json.

$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $ProjectRoot

$env:CI = "1"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:GRADLE_USER_HOME = "C:\gradle"
$env:EXPO_PUBLIC_API_BASE_URL = "https://api-safariscon.eserveconn.com/api"
$env:EXPO_PUBLIC_API_TIMEOUT_MS = "20000"
$env:EXPO_PUBLIC_AUTH_TIMEOUT_MS = "45000"

New-Item -ItemType Directory -Force -Path $env:GRADLE_USER_HOME | Out-Null

Write-Host "Generating native Android project..."
npx expo prebuild --platform android --clean

Write-Host "Building release APK (arm64-v8a)..."
Set-Location "$ProjectRoot\android"
.\gradlew.bat assembleRelease -PreactNativeArchitectures=arm64-v8a --no-daemon

$apk = "$ProjectRoot\android\app\build\outputs\apk\release\app-release.apk"
if (Test-Path $apk) {
  Write-Host ""
  Write-Host "APK ready:" -ForegroundColor Green
  Write-Host $apk
} else {
  Write-Host "Build finished but APK not found at expected path." -ForegroundColor Red
  exit 1
}
