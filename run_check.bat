@echo off
cd /d "C:\Users\USER\Desktop\Toolsy"
echo === LINT CHECK ===
npx next lint --no-cache 2>&1
echo === EXIT CODE: %ERRORLEVEL% ===
echo.
echo === BUILD CHECK ===
npx next build 2>&1
echo === EXIT CODE: %ERRORLEVEL% ===
echo.
echo === DONE ===
