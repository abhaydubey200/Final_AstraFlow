# Quick script to update README
with open('README.md', 'w', encoding='utf-8') as f:
    f.write('''# 🚀 AstraFlow - Production ETL Orchestration Platform

![AstraFlow](https://img.shields.io/badge/AstraFlow-v2.5.0-teal?style=for-the-badge)
![Python](https://img.shields.io/badge/Python-3.8+-blue?style=for-the-badge&logo=python)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue?style=for-the-badge&logo=typescript)
![FastAPI](https://img.shields.io/badge/FastAPI-Latest-green?style=for-the-badge&logo=fastapi)
![React](https://img.shields.io/badge/React-18-cyan?style=for-the-badge&logo=react)

**Production-grade ETL pipeline orchestration platform**

---

## 🌟 Features

- 🔄 **Visual Pipeline Builder** - Drag-and-drop interface for building ETL pipelines
- 🔌 **Multi-Database Support** - PostgreSQL, MySQL, MSSQL, Snowflake, and more
- 🤖 **Self-Healing** - Autonomous error detection and recovery
- 📊 **Real-time Monitoring** - Live pipeline execution tracking
- 🔒 **Enterprise Security** - AES-256 encryption, JWT authentication
- ⚡ **High Performance** - Async Python, optimized queries

## 🚀 Quick Start

```bash
# 1. Configure environment
cp .env.local .env
# Edit .env with your Supabase credentials

# 2. Generate encryption key
openssl rand -hex 32

# 3. Start the application
start_astraflow.bat  # Windows
./start_astraflow.sh  # Mac/Linux

# 4. Access at http://localhost:8080
```

**See [SETUP_GUIDE.md](SETUP_GUIDE.md) for detailed instructions**

## 📚 Documentation

- [Setup Guide](SETUP_GUIDE.md) - Complete installation guide
- [API Docs](http://localhost:8000/docs) - Interactive API explorer

## 🏗️ Tech Stack

- **Backend:** Python, FastAPI, Supabase (PostgreSQL)
- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS
- **Security:** AES-256-GCM encryption, JWT auth
- **Performance:** Async/await, connection pooling, optimized queries

## 📊 Key Metrics

- 20+ comprehensive UI pages
- 10+ database connectors
- Auto-healing capabilities
- Real-time monitoring
- Full TypeScript + Pydantic validation

## 🔒 Security

✅ AES-256 encryption | ✅ Environment-based CORS | ✅ Input validation  
✅ JWT authentication | ✅ SQL injection protection | ✅ No hardcoded secrets

## 🆘 Support

- 📖 [Setup Guide](SETUP_GUIDE.md)
- 🐛 [GitHub Issues](https://github.com/dubeyabhay2003/AstraFlow/issues)

---

<div align="center">
**Made with ❤️ by the AstraFlow Team**

⭐ Star us on GitHub!
</div>
''')

print("README.md updated successfully!")
