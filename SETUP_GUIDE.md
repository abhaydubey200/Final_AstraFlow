# 🚀 AstraFlow - Setup & Configuration Guide

## 📋 Quick Start Checklist

- [ ] Install Python 3.8+
- [ ] Install Node.js 18+
- [ ] Configure environment variables
- [ ] Generate encryption key
- [ ] Install dependencies
- [ ] Start application

---

## 🔧 Step 1: Prerequisites

### Install Required Software

**Python 3.8 or higher**
```bash
# Check Python version
python --version

# If not installed, download from:
# https://www.python.org/downloads/
```

**Node.js 18 or higher**
```bash
# Check Node.js version
node --version

# If not installed, download from:
# https://nodejs.org/
```

**OpenSSL (for generating encryption keys)**
```bash
# Usually pre-installed on Mac/Linux
# For Windows, use Git Bash or WSL

# Check if available
openssl version
```

---

## 🔐 Step 2: Configure Environment Variables

### Create Your .env File

1. **Copy the template:**
   ```bash
   # Windows
   copy .env.local .env

   # Mac/Linux
   cp .env.local .env
   ```

2. **Get Supabase Credentials:**
   - Go to: https://supabase.com/dashboard
   - Select your project (or create one)
   - Go to Settings → API
   - Copy the following:
     * Project URL → `SUPABASE_URL`
     * Project API keys → anon public (for `VITE_SUPABASE_ANON_KEY`)
     * Project API keys → service_role (for `SUPABASE_SERVICE_ROLE_KEY`)
   - Go to Settings → Database → Connection string
     * Copy JWT Secret → `SUPABASE_JWT_SECRET`

3. **Generate Encryption Key:**
   ```bash
   # Generate a secure 256-bit key
   openssl rand -hex 32
   ```
   Copy the output to `ASTRAFLOW_MASTER_KEY` in your .env file

4. **Update .env file:**
   ```bash
   # Open .env in your text editor
   notepad .env          # Windows
   nano .env             # Linux
   open -a TextEdit .env # Mac
   ```

   Replace these placeholders with your actual values:
   ```env
   # Supabase (from dashboard)
   SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...your_actual_service_role_key
   SUPABASE_JWT_SECRET=your_actual_jwt_secret

   # Frontend Supabase
   VITE_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGc...your_actual_anon_key

   # Security (generated with openssl)
   ASTRAFLOW_MASTER_KEY=your_64_character_hex_string_here
   ```

---

## 📦 Step 3: Install Dependencies

### Automatic Installation (Recommended)

The startup script will automatically install all dependencies.

**Just run:**
```bash
# Windows
start_astraflow.bat

# Mac/Linux
chmod +x start_astraflow.sh
./start_astraflow.sh
```

### Manual Installation (Alternative)

**Backend Dependencies:**
```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate it
# Windows:
venv\Scripts\activate.bat
# Mac/Linux:
source venv/bin/activate

# Install packages
pip install -r requirements.txt

cd ..
```

**Frontend Dependencies:**
```bash
npm install
```

---

## 🚀 Step 4: Start the Application

### Option A: Automatic Startup (Easiest)

**Windows:**
```bash
start_astraflow.bat
```

**Mac/Linux:**
```bash
chmod +x start_astraflow.sh
./start_astraflow.sh
```

This will:
- ✅ Check environment configuration
- ✅ Install missing dependencies
- ✅ Start backend API on port 8000
- ✅ Start frontend UI on port 8080
- ✅ Open both in separate windows

### Option B: Manual Startup

**Terminal 1 - Backend:**
```bash
cd backend
# Windows:
venv\Scripts\activate.bat
# Mac/Linux:
source venv/bin/activate

python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

**Terminal 2 - Frontend:**
```bash
npm run dev
```

---

## 🌐 Access the Application

Once started, access AstraFlow at:

- **Frontend UI:** http://localhost:8080
- **Backend API:** http://localhost:8000
- **API Documentation:** http://localhost:8000/docs
- **Interactive API:** http://localhost:8000/redoc

---

## ✅ Verify Installation

### Test Backend Connection

1. Open your browser to: http://localhost:8000/docs
2. You should see the Swagger API documentation
3. Try the `/health` endpoint - should return `{"status": "healthy"}`

### Test Frontend Connection

1. Open your browser to: http://localhost:8080
2. You should see the AstraFlow dashboard
3. Check browser console (F12) - should be no errors
4. Try creating a connection or pipeline

### Test Database Connection

Check the backend terminal/console:
- Should see: `"STARTUP: Supabase API Connectivity PASSED"`
- Should NOT see database connection errors

---

## 🐛 Troubleshooting

### Issue: "ASTRAFLOW_MASTER_KEY not set"

**Solution:**
```bash
# Generate a key
openssl rand -hex 32

# Add to .env file
ASTRAFLOW_MASTER_KEY=your_generated_key_here
```

### Issue: "Failed to fetch" in frontend

**Possible Causes:**
1. Backend not running
2. Wrong `VITE_BACKEND_URL` in .env
3. CORS misconfiguration

**Solution:**
```bash
# Check backend is running on port 8000
curl http://localhost:8000/health

# Verify VITE_BACKEND_URL in .env
VITE_BACKEND_URL=http://localhost:8000

# Restart frontend after .env changes
npm run dev
```

### Issue: "Supabase connection failed"

**Solution:**
1. Verify credentials in .env match Supabase dashboard
2. Check project is not paused in Supabase
3. Verify you're using `service_role` key (not anon key) for backend

### Issue: CORS errors in browser console

**Solution:**
```bash
# In .env, ensure frontend URL is in ALLOWED_ORIGINS
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000,http://localhost:8080
```

### Issue: Port already in use

**Solution:**
```bash
# Windows - Kill process on port 8000
netstat -ano | findstr :8000
taskkill /PID <process_id> /F

# Mac/Linux - Kill process on port 8000
lsof -ti:8000 | xargs kill -9

# Or change port in .env
BACKEND_PORT=8001
```

---

## 🔒 Security Checklist

Before deploying to production:

- [ ] `.env` is in `.gitignore` (never commit it!)
- [ ] Generated strong `ASTRAFLOW_MASTER_KEY` (64 hex chars)
- [ ] Using `service_role` key only in backend (never in frontend)
- [ ] Using `anon` key in frontend (safe for public)
- [ ] Set `ENVIRONMENT=production` in production
- [ ] Configured `ALLOWED_ORIGINS` for your production domain
- [ ] Rotated all keys from development
- [ ] Set up Supabase Row Level Security (RLS) policies

---

## 📁 Project Structure

```
AstraFlow/
├── backend/              # Python FastAPI backend
│   ├── api/              # API routers
│   ├── core/             # Core utilities
│   ├── services/         # Business logic
│   ├── main.py           # Entry point
│   └── requirements.txt  # Python dependencies
├── src/                  # React frontend
│   ├── components/       # UI components
│   ├── pages/            # Page components
│   ├── lib/              # Utilities (api-client)
│   └── main.tsx          # Entry point
├── .env                  # Your config (DO NOT COMMIT)
├── .env.example          # Template
├── .env.local            # Local dev defaults
└── start_astraflow.bat   # Startup script
```

---

## 🎯 Next Steps

After successful setup:

1. **Create your first connection:**
   - Navigate to Connections page
   - Add a database connection (PostgreSQL, MySQL, etc.)
   - Test the connection

2. **Build your first pipeline:**
   - Go to Pipelines page
   - Create a new pipeline
   - Add source and destination
   - Configure transformations

3. **Monitor execution:**
   - Check Monitoring page
   - View self-healing status
   - Check performance metrics

4. **Explore features:**
   - Cost tracking
   - Schema discovery
   - Data lineage
   - Alert configurations

---

## 📚 Additional Resources

- **API Documentation:** http://localhost:8000/docs (when running)
- **Supabase Dashboard:** https://supabase.com/dashboard
- **AstraFlow Architecture:** See `docs/` folder
- **Code Review Report:** See session files for detailed analysis

---

## 🆘 Need Help?

If you encounter issues:

1. Check this guide's troubleshooting section
2. Check backend console for error messages
3. Check browser console (F12) for frontend errors
4. Verify all environment variables are set correctly
5. Ensure Supabase project is active and accessible

---

## 🎉 You're All Set!

AstraFlow is now configured and running. Start building your ETL pipelines! 🚀
