!define SIPLINX_INSTALL_EVENT_URL "https://siplinx-ai.vercel.app/api/install-event"

Var SiplinxInstallId

!macro SIPLINX_ENSURE_INSTALL_ID
  StrCmp $SiplinxInstallId "" 0 +4
    System::Call 'kernel32::GetTickCount() i .r0'
    System::Call 'kernel32::GetCurrentProcessId() i .r1'
    StrCpy $SiplinxInstallId "$0-$1"
!macroend

!macro SIPLINX_PING_INSTALL_EVENT EVENT_NAME
  !insertmacro SIPLINX_ENSURE_INSTALL_ID
  Exec `"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -Command "try { [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 -Uri '${SIPLINX_INSTALL_EVENT_URL}?event=${EVENT_NAME}&platform=win&installer=nsis&install_id=$SiplinxInstallId' | Out-Null } catch {}"`
!macroend

!macro NSIS_HOOK_PREINSTALL
  !insertmacro SIPLINX_PING_INSTALL_EVENT "app_install_started"
!macroend

!macro NSIS_HOOK_POSTINSTALL
  !insertmacro SIPLINX_PING_INSTALL_EVENT "app_install_completed"
!macroend
