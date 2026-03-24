@echo off
rmdir /s /q frontend
call npx.cmd create-next-app@latest frontend --typescript --tailwind --eslint --app --src-dir --use-npm --yes
echo Scaffolding complete.
