# 🚀 AstraFlow - Data Integration Platform

> **A modern, full-stack data integration platform for seamless data workflows**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.3-61dafb.svg)](https://reactjs.org/)
[![Python](https://img.shields.io/badge/Python-3.x-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-Latest-009688.svg)](https://fastapi.tiangolo.com/)

---

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [Installation](#installation)
- [Usage](#usage)
- [Development](#development)
- [Testing](#testing)
- [Deployment](#deployment)
- [Documentation](#documentation)
- [Contributing](#contributing)

---

## 🎯 Overview

**AstraFlow** is a comprehensive data integration platform that enables seamless data workflows across multiple data sources including **Snowflake**, **Microsoft SQL Server**, and **PostgreSQL (Supabase)**.

### Tech Stack

**Frontend:**
- ⚛️ React 18 with TypeScript
- 🎨 TailwindCSS + shadcn/ui components
- ⚡ Vite for fast builds
- 🔄 TanStack Query for state management
- 🎭 React Router for navigation

**Backend:**
- 🐍 Python with FastAPI
- 🗄️ Multi-database support (Snowflake, MSSQL, PostgreSQL)
- 🔐 Secure authentication & authorization
- 📊 Real-time data processing

**Infrastructure:**
- 🐳 Docker & Docker Compose
- 🌐 Nginx reverse proxy
- 📦 Supabase for backend services

---

## ✨ Features

✅ **Multi-Database Connectivity** - Connect to Snowflake, MSSQL, PostgreSQL  
✅ **Real-time Data Flow** - Visual data pipeline builder  
✅ **Secure Authentication** - JWT-based auth with Supabase  
✅ **Modern UI** - Beautiful, responsive interface with shadcn/ui  
✅ **Performance Monitoring** - Built-in performance tracking  
✅ **Docker Support** - Easy deployment with Docker  
✅ **Comprehensive Testing** - Full test coverage for backend & frontend  
✅ **Security Scanning** - Automated security checks  

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ or Bun
- Python 3.9+
- Docker (optional)
- Git

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/Final_AstraFlow.git
cd Final_AstraFlow
```

### 2. Environment Setup

```bash
# Copy environment template
copy .env.example .env

# Edit .env with your configuration
notepad .env
```

### 3. Start the Application

**Windows:**
```bash
start_astraflow.bat
```

**Unix/Linux/Mac:**
```bash
chmod +x start_astraflow.sh
./start_astraflow.sh
```

**Or start services individually:**
```bash
# Backend only
start_backend.bat

# Frontend only
start_frontend.bat
```

### 4. Access the Application

- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:8000
- **API Docs:** http://localhost:8000/docs

---

## 📁 Project Structure

```
Final_AstraFlow/
├── 📂 backend/              # Python FastAPI backend
│   ├── api/                # API routes
│   ├── core/               # Core logic
│   ├── services/           # External integrations
│   └── tests/              # Backend tests
│
├── 📂 src/                  # React frontend
│   ├── components/         # UI components
│   ├── pages/              # Page components
│   ├── hooks/              # Custom hooks
│   ├── integrations/       # API integrations
│   └── lib/                # Utilities
│
├── 📂 docs/                 # Documentation
├── 📂 scripts/              # Utility scripts
│   ├── testing/           # Test scripts
│   ├── database/          # DB utilities
│   └── utilities/         # General utilities
│
├── 📂 tools/                # Development tools
│   ├── linters/           # Code linters
│   └── scanners/          # Security scanners
│
├── 📂 logs/                 # Log files (gitignored)
├── 📂 deploy/               # Deployment configs
└── 📂 public/               # Static assets
```

📖 **See [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md) for detailed structure**

---

## 💻 Installation

### Frontend Setup

```bash
# Using npm
npm install
npm run dev

# Using bun (faster)
bun install
bun run dev
```

### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# Unix:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run backend
python main.py
```

### Database Setup

```bash
# Setup database
python scripts/database/setup_database.py

# Apply migrations
python scripts/database/apply_migrations.py

# Check database health
python scripts/database/check_db.py
```

---

## 🎮 Usage

### Starting Development

1. **Start Backend:**
   ```bash
   cd backend
   python main.py
   ```

2. **Start Frontend:**
   ```bash
   npm run dev
   ```

3. **Access Application:**
   - Frontend: http://localhost:5173
   - API: http://localhost:8000
   - API Docs: http://localhost:8000/docs

### Building for Production

```bash
# Build frontend
npm run build

# Preview production build
npm run preview
```

### Using Docker

```bash
# Start all services
docker-compose up

# Start in background
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

---

## 🛠️ Development

### Code Linting

```bash
# Frontend linting
npm run lint

# Custom TypeScript linting
node tools/linters/custom_ts_linter.cjs

# Security scanning
node tools/scanners/security_scanner.cjs
```

### Running Tests

```bash
# Frontend tests
npm run test

# Watch mode
npm run test:watch

# Backend tests
cd backend
pytest

# Specific test
pytest tests/test_api.py
```

### Performance Testing

```bash
# Run performance tests
python scripts/testing/analyze_load_test.py

# Check performance logs
type logs\performance\perf_output.txt
```

---

## 🧪 Testing

### Test Structure

- **Frontend Tests:** `src/test/`
- **Backend Tests:** `backend/tests/`
- **Integration Tests:** `scripts/testing/`

### Running Tests

```bash
# All frontend tests
npm run test

# All backend tests
cd backend && pytest

# Specific test suites
python scripts/testing/audit_test.py
python scripts/testing/test_supabase_connection.py
```

### Test Coverage

View test results in:
- `logs/tests/` - Test outputs
- `logs/performance/` - Performance results
- `logs/security/` - Security scan results

---

## 🚢 Deployment

### Docker Deployment

```bash
# Build and start
docker-compose up --build

# Production mode
docker-compose -f docker-compose.prod.yml up
```

### Manual Deployment

1. Build frontend:
   ```bash
   npm run build
   ```

2. Configure Nginx (see `nginx.conf`)

3. Start backend:
   ```bash
   cd backend
   gunicorn main:app
   ```

### Environment Variables

Required environment variables (see `.env.example`):

```env
# Supabase
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key

# Database
SNOWFLAKE_ACCOUNT=your_account
SNOWFLAKE_USER=your_user
SNOWFLAKE_PASSWORD=your_password

# MSSQL
MSSQL_SERVER=your_server
MSSQL_DATABASE=your_database
```

---

## 📚 Documentation

Comprehensive documentation is available in the `/docs` folder:

- **[🚀 START HERE.txt](./🚀%20START%20HERE.txt)** - Quickest way to get started
- **[BEGINNERS_GUIDE.md](./docs/BEGINNERS_GUIDE.md)** - New to the project?
- **[SETUP_GUIDE.md](./docs/SETUP_GUIDE.md)** - Detailed setup instructions
- **[CONNECTION_GUIDE.md](./docs/CONNECTION_GUIDE.md)** - Database connections
- **[QUICKSTART.md](./docs/QUICKSTART.md)** - Quick reference
- **[EMERGENCY_FIX.md](./docs/EMERGENCY_FIX.md)** - Troubleshooting
- **[PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md)** - Complete structure guide
- **[RESTRUCTURING_GUIDE.md](./RESTRUCTURING_GUIDE.md)** - Organization guide

---

## 🤝 Contributing

We welcome contributions! Here's how:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Run tests: `npm run test && cd backend && pytest`
5. Run linter: `npm run lint`
6. Commit changes: `git commit -m 'Add amazing feature'`
7. Push to branch: `git push origin feature/amazing-feature`
8. Open a Pull Request

### Development Workflow

1. Write code
2. Add tests
3. Run linters
4. Run tests
5. Build successfully
6. Submit PR

---

## 📊 Scripts Reference

### Frontend Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |
| `npm run test` | Run tests |

### Utility Scripts

| Script | Purpose |
|--------|---------|
| `scripts/database/setup_database.py` | Setup database |
| `scripts/database/check_db.py` | Check DB health |
| `scripts/testing/audit_test.py` | Run audit tests |
| `tools/linters/custom_ts_linter.cjs` | Custom linting |
| `tools/scanners/security_scanner.cjs` | Security scan |

---

## 🐛 Troubleshooting

**Application won't start?**
- Check `docs/EMERGENCY_FIX.md`
- Verify environment variables in `.env`
- Check logs in `/logs` folder

**Database connection issues?**
- See `docs/CONNECTION_GUIDE.md`
- Run `python scripts/database/check_db.py`

**Build errors?**
- Clear cache: `rm -rf node_modules dist && npm install`
- Check Node.js version: `node --version` (need 18+)

---

## 📝 License

This project is proprietary software. All rights reserved.

---

## 📞 Support

- 📖 Read the docs in `/docs`
- 🐛 Report issues on GitHub
- 💬 Contact the development team

---

## 🙏 Acknowledgments

Built with:
- [React](https://reactjs.org/)
- [FastAPI](https://fastapi.tiangolo.com/)
- [Vite](https://vitejs.dev/)
- [TailwindCSS](https://tailwindcss.com/)
- [shadcn/ui](https://ui.shadcn.com/)
- [Supabase](https://supabase.com/)
- [Snowflake](https://www.snowflake.com/)

---

<div align="center">

**Made with ❤️ by the AstraFlow Team**

⭐ Star us on GitHub if this project helped you!

</div>
