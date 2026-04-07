# AstraFlow - Project Structure

## 📁 Directory Organization

```
Final_AstraFlow/
│
├── 📂 backend/                    # Backend API (Python/FastAPI)
│   ├── api/                      # API endpoints and routes
│   ├── core/                     # Core business logic
│   ├── services/                 # External service integrations
│   ├── tests/                    # Backend tests
│   ├── main.py                   # Application entry point
│   └── requirements.txt          # Python dependencies
│
├── 📂 src/                        # Frontend Application (React + TypeScript)
│   ├── components/               # Reusable React components
│   ├── hooks/                    # Custom React hooks
│   ├── integrations/             # Third-party integrations
│   ├── lib/                      # Utility libraries
│   ├── pages/                    # Page components
│   ├── test/                     # Frontend tests
│   ├── types/                    # TypeScript type definitions
│   ├── App.tsx                   # Main App component
│   └── main.tsx                  # Application entry point
│
├── 📂 public/                     # Static Assets
│   └── (images, fonts, favicon, etc.)
│
├── 📂 docs/                       # Documentation
│   ├── BEGINNERS_GUIDE.md        # Guide for beginners
│   ├── CONNECTION_GUIDE.md       # Database connection guide
│   ├── EMERGENCY_FIX.md          # Emergency troubleshooting
│   ├── HOW_TO_SEND_ERRORS.md     # Error reporting guide
│   ├── HOW_TO_START.md           # Getting started
│   ├── QUICKSTART.md             # Quick start guide
│   ├── SETUP_GUIDE.md            # Setup instructions
│   ├── START_NOW.md              # Immediate start guide
│   └── STABILIZATION_PROGRESS.md # Project progress
│
├── 📂 scripts/                    # Utility Scripts
│   ├── testing/                  # Testing scripts
│   │   ├── audit_test.py
│   │   ├── deep_audit.py
│   │   ├── test_ipv6.py
│   │   ├── test_mssql_instantiation.py
│   │   ├── test_snowflake_fallback.py
│   │   ├── test_supabase_connection.py
│   │   └── analyze_load_test.py
│   │
│   ├── database/                 # Database utilities
│   │   ├── check_db.py
│   │   ├── check_keys.py
│   │   ├── check_mssql_data.py
│   │   ├── check_pooling.py
│   │   ├── check_registry_schemas.py
│   │   ├── debug_snowflake.py
│   │   ├── setup_database.py
│   │   └── apply_migrations.py
│   │
│   └── utilities/                # General utilities
│       ├── fix_use_effects.cjs
│       └── update_readme.py
│
├── 📂 tools/                      # Development Tools
│   ├── linters/                  # Code linters
│   │   ├── custom_ts_linter.cjs
│   │   └── custom_ts_linter_deep.cjs
│   │
│   └── scanners/                 # Security & code scanners
│       └── security_scanner.cjs
│
├── 📂 logs/                       # Log Files
│   ├── tests/                    # Test output logs
│   ├── performance/              # Performance test results
│   ├── security/                 # Security scan reports
│   └── linting/                  # Lint reports
│
├── 📂 monitoring/                 # Monitoring & Observability
│   └── (monitoring configurations)
│
├── 📂 deploy/                     # Deployment Configurations
│   └── (deployment scripts and configs)
│
├── 📂 supabase/                   # Supabase Configuration
│   └── (migrations, functions, etc.)
│
├── 📂 tmp/                        # Temporary Files
│   └── (temp files - gitignored)
│
├── 📂 Requriment-Docs(PRD,TRD)/  # Requirement Documents
│   └── (PRD, TRD, specifications)
│
├── 📂 Project_Upgrade_plan/       # Project Planning
│   └── (upgrade plans and roadmaps)
│
├── 📄 Root Configuration Files
│   ├── package.json              # Node.js dependencies & scripts
│   ├── package-lock.json         # Locked dependency versions
│   ├── bun.lockb                 # Bun package manager lock
│   ├── tsconfig.json             # TypeScript configuration
│   ├── tsconfig.app.json         # App-specific TS config
│   ├── tsconfig.node.json        # Node-specific TS config
│   ├── vite.config.ts            # Vite build configuration
│   ├── vitest.config.ts          # Vitest test configuration
│   ├── tailwind.config.ts        # Tailwind CSS configuration
│   ├── postcss.config.js         # PostCSS configuration
│   ├── eslint.config.js          # ESLint configuration
│   ├── components.json           # shadcn/ui configuration
│   ├── docker-compose.yml        # Docker services
│   ├── Dockerfile.frontend       # Frontend Docker image
│   ├── nginx.conf                # Nginx configuration
│   └── .env.example              # Environment variables template
│
├── 📄 Startup Scripts
│   ├── start_astraflow.bat       # Complete application start
│   ├── start_astraflow.sh        # Unix start script
│   ├── start_backend.bat         # Backend only
│   ├── start_frontend.bat        # Frontend only
│   ├── START_BOTH.bat            # Start both services
│   ├── quick_start.bat           # Quick startup
│   └── push_to_github.bat        # Git helper
│
├── 📄 Important Files
│   ├── README.md                 # Main project documentation
│   ├── README_new.md             # Updated README
│   ├── index.html                # HTML entry point
│   ├── .gitignore                # Git ignore rules
│   ├── .dockerignore             # Docker ignore rules
│   ├── .env                      # Environment variables (gitignored)
│   ├── .env.local                # Local overrides (gitignored)
│   ├── application_start_steps.txt
│   └── 🚀 START HERE.txt         # Quick start pointer
│
└── 📄 Utility Scripts (Root)
    ├── reorganize_project.bat    # This restructuring script
    └── PROJECT_STRUCTURE.md      # This documentation

```

## 🚀 Quick Start

1. **First Time Setup:**
   ```bash
   # Read this file first
   🚀 START HERE.txt
   
   # Then follow the setup guide
   docs/SETUP_GUIDE.md
   ```

2. **Start the Application:**
   ```bash
   # Windows
   start_astraflow.bat
   
   # Unix/Linux/Mac
   ./start_astraflow.sh
   ```

3. **Start Individual Services:**
   ```bash
   # Backend only
   start_backend.bat
   
   # Frontend only
   start_frontend.bat
   ```

## 📦 Key Directories

### Backend (`/backend`)
- **Purpose:** Python FastAPI backend server
- **Entry:** `main.py`
- **Dependencies:** `requirements.txt`
- **Key Folders:**
  - `api/` - REST API endpoints
  - `core/` - Business logic
  - `services/` - External integrations (Snowflake, MSSQL, etc.)

### Frontend (`/src`)
- **Purpose:** React + TypeScript frontend application
- **Entry:** `main.tsx`
- **Dependencies:** `package.json`
- **Key Folders:**
  - `components/` - Reusable UI components
  - `pages/` - Route pages
  - `integrations/` - API integrations

### Scripts (`/scripts`)
- **Purpose:** Development and maintenance scripts
- **Subfolders:**
  - `testing/` - Test runners and validators
  - `database/` - DB utilities and migrations
  - `utilities/` - General helper scripts

### Tools (`/tools`)
- **Purpose:** Development tooling
- **Subfolders:**
  - `linters/` - Custom code linters
  - `scanners/` - Security and code scanners

### Logs (`/logs`)
- **Purpose:** Output from various operations
- **Subfolders:**
  - `tests/` - Test execution logs
  - `performance/` - Performance test results
  - `security/` - Security scan reports
  - `linting/` - Lint check outputs

## 🔧 Configuration Files

| File | Purpose |
|------|---------|
| `package.json` | Node.js dependencies and scripts |
| `tsconfig.json` | TypeScript compiler configuration |
| `vite.config.ts` | Vite bundler configuration |
| `tailwind.config.ts` | Tailwind CSS styling |
| `eslint.config.js` | Code linting rules |
| `docker-compose.yml` | Multi-container Docker setup |
| `.env.example` | Environment variable template |

## 🧪 Running Tests

```bash
# Frontend tests
npm run test

# Backend tests
cd backend
pytest

# Specific test scripts
python scripts/testing/audit_test.py
```

## 🔍 Database Management

```bash
# Check database health
python scripts/database/check_db.py

# Setup database
python scripts/database/setup_database.py

# Apply migrations
python scripts/database/apply_migrations.py
```

## 📝 Documentation

All documentation is organized in the `/docs` folder:
- **BEGINNERS_GUIDE.md** - New to the project? Start here
- **SETUP_GUIDE.md** - Complete setup instructions
- **CONNECTION_GUIDE.md** - Database connection help
- **QUICKSTART.md** - Get running in minutes

## 🐳 Docker

```bash
# Start all services with Docker
docker-compose up

# Build frontend image
docker build -f Dockerfile.frontend -t astraflow-frontend .
```

## 📊 Project Stack

- **Frontend:** React 18, TypeScript, Vite, TailwindCSS, shadcn/ui
- **Backend:** Python, FastAPI
- **Databases:** Supabase (PostgreSQL), Snowflake, MSSQL
- **State Management:** TanStack Query
- **Testing:** Vitest, Pytest
- **Deployment:** Docker, Nginx

## 🔐 Environment Variables

Copy `.env.example` to `.env` and fill in your values:
```bash
cp .env.example .env
```

See `CONNECTION_GUIDE.md` for detailed environment setup.

## 📈 Development Workflow

1. Create feature branch
2. Make changes
3. Run linters: `npm run lint`
4. Run tests: `npm run test`
5. Build: `npm run build`
6. Submit PR

## 🆘 Troubleshooting

- **Can't start?** → Read `docs/EMERGENCY_FIX.md`
- **Connection issues?** → Check `docs/CONNECTION_GUIDE.md`
- **Errors?** → See `docs/HOW_TO_SEND_ERRORS.md`

## 📞 Support

Refer to project documentation in `/docs` for detailed guides and troubleshooting.

---

**Last Updated:** 2026-04-07
**Project:** AstraFlow - Data Integration Platform
