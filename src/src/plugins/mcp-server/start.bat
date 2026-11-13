@echo off
setlocal
pushd "%~dp0"
if errorlevel 1 exit /b 1
where node >nul 2>&1
if errorlevel 1 (
    echo Elainatheme MCP requires Node.js 20 or newer. Install Node.js and reopen this script.
    popd
    exit /b 1
)
where npm >nul 2>&1
if errorlevel 1 (
    echo npm was not found. Install Node.js with npm and reopen this script.
    popd
    exit /b 1
)
node launcher.mjs
set "mcp_exit=%errorlevel%"
popd
exit /b %mcp_exit%
