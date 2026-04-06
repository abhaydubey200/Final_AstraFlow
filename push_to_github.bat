@echo off
echo Updating README.md...
echo # AstraFlow > README.md

echo Adding all files to git...
git add .

echo Committing changes...
git commit -m "first commit"

echo Setting branch to main...
git branch -M main

echo Adding remote origin...
git remote add origin https://github.com/dubeyabhay2003/AstraFlow.git

echo Pushing to GitHub...
git push -u origin main

echo Done!
pause
