# Install the Dahua bridge agent on a Windows office PC.
#
# Run via INSTALL.bat (double-click). No admin rights are needed for the agent
# itself: it lives in %LOCALAPPDATA% and starts from the user's Startup folder,
# so it comes back after every reboot/login. Only installing Node.js, when it
# is missing, asks for admin once.
#
# Re-running this is an upgrade: it stops the old agent and copies fresh files.

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$Src        = Split-Path -Parent $MyInvocation.MyCommand.Path
$InstallDir = Join-Path $env:LOCALAPPDATA 'DCWBiometric'
$LogDir     = Join-Path $InstallDir 'logs'
$Startup    = [Environment]::GetFolderPath('Startup')
$Launcher   = Join-Path $Startup 'DCW Biometric Bridge.vbs'

function Say($msg, $color = 'Gray') { Write-Host $msg -ForegroundColor $color }
function Fail($msg) {
  Say ''
  Say "ERROR: $msg" Red
  Say ''
  Read-Host 'Press Enter to close'
  exit 1
}

Say ''
Say '=== DCW Biometric Bridge - Windows setup ===' Cyan
Say ''

# --- 1. Files we need ---------------------------------------------------------
foreach ($f in 'dahua-bridge.mjs', 'device.mjs', 'check-device.mjs', '.env') {
  if (-not (Test-Path (Join-Path $Src $f))) {
    Fail "$f is missing from this folder. Unzip the whole package, then run INSTALL.bat again."
  }
}

# --- 2. Node.js ---------------------------------------------------------------
function Find-Node {
  $cmd = Get-Command node.exe -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  foreach ($p in "$env:ProgramFiles\nodejs\node.exe", "${env:ProgramFiles(x86)}\nodejs\node.exe", "$env:LOCALAPPDATA\Programs\nodejs\node.exe") {
    if ($p -and (Test-Path $p)) { return $p }
  }
  return $null
}

function Node-Major($node) {
  try { return [int]((& $node -v).TrimStart('v').Split('.')[0]) } catch { return 0 }
}

$Node = Find-Node
if (-not $Node -or (Node-Major $Node) -lt 18) {
  Say '[1/4] Node.js not found - installing it (Windows may ask for permission, click Yes)...' Yellow
  $installed = $false

  if (Get-Command winget.exe -ErrorAction SilentlyContinue) {
    & winget.exe install -e --id OpenJS.NodeJS.LTS --silent --accept-source-agreements --accept-package-agreements | Out-Host
    $installed = [bool](Find-Node)
  }

  if (-not $installed) {
    # No winget (older Windows 10): fetch the current LTS installer from nodejs.org.
    $arch = if ([Environment]::Is64BitOperatingSystem) { 'x64' } else { 'x86' }
    $sums = (Invoke-WebRequest -UseBasicParsing 'https://nodejs.org/dist/latest-v22.x/SHASUMS256.txt').Content
    $msi  = ([regex]::Match($sums, "node-v[\d.]+-$arch\.msi")).Value
    if (-not $msi) { Fail 'Could not find the Node.js installer online. Install Node.js LTS from https://nodejs.org and run INSTALL.bat again.' }
    $msiPath = Join-Path $env:TEMP $msi
    Invoke-WebRequest -UseBasicParsing "https://nodejs.org/dist/latest-v22.x/$msi" -OutFile $msiPath
    Start-Process msiexec.exe -ArgumentList "/i `"$msiPath`" /qb" -Wait -Verb RunAs
  }

  $Node = Find-Node
  if (-not $Node) { Fail 'Node.js install did not finish. Install Node.js LTS from https://nodejs.org and run INSTALL.bat again.' }
}
Say "[1/4] Node.js OK: $Node ($(& $Node -v))" Green

# --- 3. Stop an older copy, then copy files -----------------------------------
Get-CimInstance Win32_Process -Filter "Name='node.exe' OR Name='cmd.exe'" |
  Where-Object { $_.CommandLine -match 'dahua-bridge\.mjs|run-agent\.cmd' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

New-Item -ItemType Directory -Force -Path $InstallDir, $LogDir | Out-Null
foreach ($f in 'dahua-bridge.mjs', 'device.mjs', 'check-device.mjs', '.env') {
  Copy-Item (Join-Path $Src $f) (Join-Path $InstallDir $f) -Force
}
if (Test-Path (Join-Path $Src 'set-ntp.mjs')) { Copy-Item (Join-Path $Src 'set-ntp.mjs') $InstallDir -Force }

# The runner: restart node if it ever exits, keep the log under ~5 MB.
$runner = @"
@echo off
cd /d "%~dp0"
:loop
for %%A in ("logs\agent.log") do if %%~zA GTR 5000000 move /y "logs\agent.log" "logs\agent.old.log" >nul
"$Node" dahua-bridge.mjs >> "logs\agent.log" 2>&1
timeout /t 30 /nobreak >nul
goto loop
"@
Set-Content -Path (Join-Path $InstallDir 'run-agent.cmd') -Value $runner -Encoding ASCII
Say "[2/4] Files copied to $InstallDir" Green

# --- 4. Start on every login, hidden, never twice -----------------------------
$runCmd = Join-Path $InstallDir 'run-agent.cmd'
$vbs = @"
' Starts the DCW biometric bridge hidden. Does nothing if it is already running.
Set wmi = GetObject("winmgmts:\\.\root\cimv2")
Set procs = wmi.ExecQuery("SELECT ProcessId FROM Win32_Process WHERE CommandLine LIKE '%dahua-bridge.mjs%' OR CommandLine LIKE '%run-agent.cmd%'")
If procs.Count = 0 Then
  CreateObject("WScript.Shell").Run Chr(34) & "$runCmd" & Chr(34), 0, False
End If
"@
Set-Content -Path $Launcher -Value $vbs -Encoding ASCII
Say '[3/4] Auto-start on login enabled' Green

Start-Process wscript.exe -ArgumentList "`"$Launcher`""
Start-Sleep -Seconds 12

# --- Report -------------------------------------------------------------------
$envText = Get-Content (Join-Path $InstallDir '.env') -Raw
$devHost = ([regex]::Match($envText, '(?m)^DAHUA_HOST=(.+)$')).Groups[1].Value.Trim()
if (-not $devHost) { $devHost = '192.168.1.108' }
$ip = $devHost.Split(':')[0]
$reachable = Test-NetConnection -ComputerName $ip -Port 80 -InformationLevel Quiet -WarningAction SilentlyContinue

Say '[4/4] Agent started. Recent log:' Green
Say '------------------------------------------------------------'
if (Test-Path (Join-Path $LogDir 'agent.log')) { Get-Content (Join-Path $LogDir 'agent.log') -Tail 12 | Out-Host }
Say '------------------------------------------------------------'
Say ''
if ($reachable) {
  Say "DONE. Biometric machine ($ip) is reachable from this PC." Green
  Say 'Attendance will now reach the CRM automatically. Nothing to run again.' Green
} else {
  Say "WARNING: this PC cannot reach the biometric machine at $ip." Yellow
  Say 'Check that this PC is on the office network and the machine is switched on.' Yellow
  Say 'The agent is installed and will connect by itself once the machine is reachable.' Yellow
}
Say ''
Say 'Check status any time: double-click STATUS.bat'
Say ''
Read-Host 'Press Enter to close'
