# One-click repair for an already-installed DCW biometric bridge.
# Run by FIX-ATTENDANCE.bat on the office PC. Holds no secrets, so it can be
# sent over WhatsApp/email.
#
#  1. Points the agent at the live CRM (the old Railway address is gone).
#  2. Restarts it with a long catch-up window once, so every punch the
#     machine stored while nothing reached the CRM comes in.
#  3. Restarts it again with the normal window.
#  4. Stops this PC from sleeping, which would stop attendance.
$ErrorActionPreference = 'Stop'
$CrmUrl     = 'https://distancecourseswala.com/crm'
$CatchUpHrs = 1500   # about 2 months
$InstallDir = Join-Path $env:LOCALAPPDATA 'DCWBiometric'
$EnvFile    = Join-Path $InstallDir '.env'
$LogFile    = Join-Path $InstallDir 'logs\agent.log'
$Launcher   = Join-Path ([Environment]::GetFolderPath('Startup')) 'DCW Biometric Bridge.vbs'

function Say($t, $c = 'White') { Write-Host $t -ForegroundColor $c }

if (-not (Test-Path $EnvFile) -or -not (Test-Path $Launcher)) {
  Say 'The biometric software is not installed for this Windows user.' Red
  Say 'Run FIX-ATTENDANCE on the PC (and user) where it was installed, or run INSTALL.bat from the original package.' Red
  exit 1
}

function Set-EnvVar($name, $value) {
  $lines = @(Get-Content $EnvFile) | Where-Object { $_ -notmatch "^$name=" }
  if ($null -ne $value) { $lines += "$name=$value" }
  Set-Content -Path $EnvFile -Value $lines -Encoding ASCII
}

function Stop-Agent {
  Get-CimInstance Win32_Process |
    Where-Object { $_.CommandLine -match 'dahua-bridge\.mjs|run-agent\.cmd' } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
  Start-Sleep -Seconds 2
}

function Start-Agent {
  Start-Process wscript.exe -ArgumentList "`"$Launcher`""
}

# Waits for the agent's first catch-up poll after a start; returns the new log text.
function Wait-Poll($seconds) {
  $from = if (Test-Path $LogFile) { (Get-Item $LogFile).Length } else { 0 }
  $deadline = (Get-Date).AddSeconds($seconds)
  do {
    Start-Sleep -Seconds 5
    $text = ''
    if (Test-Path $LogFile) {
      $fs = [IO.File]::Open($LogFile, 'Open', 'Read', 'ReadWrite')
      try { $fs.Seek($from, 'Begin') | Out-Null; $text = (New-Object IO.StreamReader($fs)).ReadToEnd() } finally { $fs.Close() }
    }
    if ($text -match 'poll \(.*(sent|no records)|initial poll failed') { return $text }
  } while ((Get-Date) -lt $deadline)
  return $text
}

Say ''
Say '=== DCW attendance fix ===' Cyan
Say "[1/4] Pointing the software at $CrmUrl" Green
Set-EnvVar 'CRM_BASE_URL' $CrmUrl
# Newer agent code ships alongside this script; the .env (passwords) is left alone.
Stop-Agent
foreach ($f in 'dahua-bridge.mjs', 'device.mjs', 'check-device.mjs', 'set-ntp.mjs') {
  $src = Join-Path $PSScriptRoot $f
  if (Test-Path $src) { Copy-Item $src (Join-Path $InstallDir $f) -Force }
}

Say '[2/4] Fetching all punches the machine stored (can take a few minutes)...' Green
Set-EnvVar 'BIOMETRIC_POLL_LOOKBACK_HOURS' $CatchUpHrs
Stop-Agent; Start-Agent
$log = Wait-Poll 600

Say '[3/4] Back to normal settings' Green
Set-EnvVar 'BIOMETRIC_POLL_LOOKBACK_HOURS' $null
Stop-Agent; Start-Agent

Say '[4/4] Turning off sleep on this PC (attendance stops while it sleeps)' Green
powercfg /change standby-timeout-ac 0 | Out-Null
powercfg /change hibernate-timeout-ac 0 | Out-Null

Say ''
Say '------------------------------------------------------------'
($log -split "`n" | Where-Object { $_.Trim() } | Select-Object -Last 15) | Out-Host
Say '------------------------------------------------------------'
Say ''
if ($log -match 'HTTP 40[13]|Bad signature') {
  Say 'PROBLEM: the CRM refused the data (secret key mismatch). Send a photo of this window.' Red
} elseif ($log -match 'initial poll failed|device serial not readable') {
  Say 'PROBLEM: this PC cannot read the biometric machine. Check the machine is on and its cable is connected, then run this again. Send a photo of this window.' Red
} elseif ($log -match 'poll \(.*(sent|no records)') {
  Say 'DONE. Attendance is connected again. Keep this PC switched on and logged in.' Green
} else {
  Say 'Not sure it worked - send a photo of this window.' Yellow
}
Say ''
