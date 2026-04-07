# 🎓 BEGINNER'S GUIDE - How to Start AstraFlow

## 📺 STEP-BY-STEP VIDEO GUIDE (Follow Along!)

Don't worry! I'll guide you through EVERY step with pictures. This is EASY! 🚀

---

## 🔴 PART 1: Open Command Prompt (30 seconds)

### Method 1: Using Search (EASIEST)
1. Click the **Windows Start button** (bottom-left corner)
2. Type: `cmd`
3. You'll see **"Command Prompt"** appear
4. Click on it!

### Method 2: Using Run Dialog
1. Press `Windows Key + R` on your keyboard
2. A small window appears
3. Type: `cmd`
4. Press Enter

**You should now see a BLACK WINDOW with white text!** ✅

---

## 🟢 PART 2: Start the Backend (2 minutes)

### Step 1: Go to Backend Folder

In the black window, type this EXACTLY and press Enter:
```
cd C:\Users\Abhay Dubey\Final_AstraFlow\backend
```

**What you'll see:**
```
C:\Users\Abhay Dubey>cd C:\Users\Abhay Dubey\Final_AstraFlow\backend
C:\Users\Abhay Dubey\Final_AstraFlow\backend>
```

The path at the beginning should change to show `backend>` ✅

---

### Step 2: Check Python Works

Type this and press Enter:
```
python --version
```

**You should see something like:**
```
Python 3.11.0
```
or
```
Python 3.10.5
```

**If you see "command not found" or error:**
- Python is not installed
- Download from: https://www.python.org/downloads/
- Install it, then come back!

---

### Step 3: Install Required Packages (First Time Only)

Type this and press Enter:
```
pip install -r requirements.txt
```

**This will show LOTS of text scrolling!** That's normal! ✅

Wait until you see:
```
Successfully installed ...
```

**This step might take 2-5 minutes!** Be patient! ☕

---

### Step 4: Start the Backend Server

Now type this MAGIC command and press Enter:
```
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

**🎉 IF IT WORKS, you'll see:**
```
INFO:     Will watch for changes in these directories: [...]
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
INFO:     Started reloader process [12345] using WatchFiles
INFO:     Started server process [67890]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
```

**✅ SUCCESS!** Your backend is running! Leave this window OPEN!

---

**❌ IF YOU SEE ERRORS:**

Take a picture with your phone of the error text, or:

1. Right-click anywhere in the window
2. Select "Mark"
3. Drag to select ALL text
4. Press Enter (this copies it)
5. Paste it in a message to me!

---

## 🔵 PART 3: Start the Frontend (2 minutes)

**IMPORTANT:** Open a NEW Command Prompt window (keep the backend one running!)

### Step 1: Open Another Command Prompt
- Follow Part 1 again to open a NEW cmd window
- Or just click the Start button, type `cmd` again

### Step 2: Go to Main Folder

Type this and press Enter:
```
cd C:\Users\Abhay Dubey\Final_AstraFlow
```

### Step 3: Install Node Packages (First Time Only)

Type this and press Enter:
```
npm install
```

**This might take 3-10 minutes!** You'll see lots of packages downloading. ⏳

### Step 4: Start Frontend

Type this and press Enter:
```
npm run dev
```

**🎉 IF IT WORKS, you'll see:**
```
VITE v5.4.19  ready in 1234 ms

  ➜  Local:   http://localhost:8080/
  ➜  Network: use --host to expose
  ➜  press h + enter to show help
```

**✅ SUCCESS!** Your frontend is running!

---

## 🌐 PART 4: Open in Browser

1. Open **Google Chrome** (or any browser)
2. In the address bar, type: `http://localhost:8080`
3. Press Enter

**You should see the AstraFlow Dashboard!** 🎉

---

## 📸 WHAT YOU SHOULD HAVE NOW:

✅ **TWO** Command Prompt windows open:
- Window 1: Backend (showing "Uvicorn running")
- Window 2: Frontend (showing "Local: http://localhost:8080")

✅ **ONE** Browser window:
- Showing AstraFlow dashboard at http://localhost:8080

**KEEP BOTH COMMAND PROMPT WINDOWS OPEN!**
If you close them, the application stops!

---

## 🆘 COMMON PROBLEMS & FIXES

### Problem 1: "python is not recognized"
**Fix:** Install Python from https://www.python.org/downloads/
- Download Python 3.11
- During installation, CHECK the box "Add Python to PATH"
- Restart Command Prompt

### Problem 2: "npm is not recognized"
**Fix:** Install Node.js from https://nodejs.org/
- Download the LTS version
- Install it
- Restart Command Prompt

### Problem 3: "Port 8000 is already in use"
**Fix:** Something else is using that port
```
# Find what's using it:
netstat -ano | findstr :8000

# Kill it (replace XXXX with the number you see):
taskkill /PID XXXX /F

# Then try starting backend again
```

### Problem 4: Backend shows errors with module names
**Fix:** Reinstall packages:
```
cd C:\Users\Abhay Dubey\Final_AstraFlow\backend
pip install -r requirements.txt --force-reinstall
```

### Problem 5: White screen in browser
**Fix:** 
1. Press F12 in browser
2. Click "Console" tab
3. Take screenshot of errors
4. Send to me!

---

## 🎯 QUICK REFERENCE CARD

**To START the application:**
1. Open CMD #1 → `cd C:\Users\Abhay Dubey\Final_AstraFlow\backend`
2. Type: `python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload`
3. Open CMD #2 → `cd C:\Users\Abhay Dubey\Final_AstraFlow`
4. Type: `npm run dev`
5. Open browser → `http://localhost:8080`

**To STOP the application:**
1. In CMD windows, press `Ctrl + C`
2. Close the windows

---

## 💡 TIPS

- **ALWAYS keep the two CMD windows open** while using the app
- **If something crashes**, look at that CMD window for error messages
- **To restart**, close both CMD windows and start fresh
- **Bookmark** `http://localhost:8080` in your browser!

---

## 📞 GET HELP

If you're stuck:
1. Take a **screenshot** of the error
2. Or **copy the text** from the CMD window (right-click → Mark → drag → Enter)
3. Send it to me!
4. I'll tell you exactly how to fix it!

---

**YOU GOT THIS! 🚀**

Start with Part 1, then Part 2, then Part 3, then Part 4!
