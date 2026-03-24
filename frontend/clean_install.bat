@echo off
echo === Cleaning up old install ===
if exist node_modules rmdir /s /q node_modules
if exist package-lock.json del package-lock.json
echo === Running fresh npm install ===
call npm install
echo === Verifying @supabase/ssr ===
if exist node_modules\@supabase\ssr (
    echo SUCCESS: @supabase/ssr is installed!
) else (
    echo FAILED: @supabase/ssr NOT found. Installing directly...
    call npm install @supabase/ssr
)
echo === Verifying @radix-ui/react-slot ===
if exist node_modules\@radix-ui\react-slot (
    echo SUCCESS: @radix-ui/react-slot is installed!
) else (
    echo FAILED: @radix-ui/react-slot NOT found. Installing directly...
    call npm install @radix-ui/react-slot
)
echo === All done! Run: npm run dev ===
pause
