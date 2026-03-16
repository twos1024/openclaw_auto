@echo off
setlocal

if not "%CLAWDESK_VSDEVCMD%"=="" (
  call "%CLAWDESK_VSDEVCMD%" -no_logo -arch=x64 -host_arch=x64
  if errorlevel 1 exit /b %errorlevel%
)

%*
exit /b %errorlevel%
