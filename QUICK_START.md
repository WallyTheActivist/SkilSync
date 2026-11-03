# SkillSync Quick Start Guide

> **Current setup instructions:** This earlier quick-start draft contains outdated setup/API details. Follow [docs/technical/installation.md](docs/technical/installation.md) for the current SQLite environment, migrations, and Vite proxy setup.

## 🚀 Get Started in 5 Minutes

### Prerequisites
- Node.js 18+
- npm 9+
- Git

### Step 1: Clone & Install (1 min)
```bash
# Clone repository
git clone <repo-url>
cd SkillSync

# Install all dependencies
cd server && npm install
cd ../client && npm install
```

### Step 2: Configure Environment (1 min)
```bash
# Server configuration
cd server
echo 'DATABASE_URL="file:./dev.db"' > .env
echo 'JWT_SECRET="dev-secret-key"' >> .env
echo 'NODE_ENV="development"' >> .env
echo 'PORT=5000' >> .env
echo 'CLIENT_URL="http://localhost:5173"' >> .env

# Client configuration
cd ../client
echo 'VITE_API_URL="http://localhost:5000/api"' > .env
```

### Step 3: Setup Database (2 min)
```bash
cd server

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev --name init

# Optional: Seed sample data
npm run seed
```

### Step 4: Start Servers (1 min)
```bash
# Terminal 1 - Backend
cd server && npm run dev

# Terminal 2 - Frontend
cd client && npm run dev
```

For local presentation/demo use, set `NODE_ENV="development"` in `server/.env` (as above).
This disables only the authentication-specific request limiter; login, registration validation,
password hashing, authorization, and the general API rate limit remain in place. When `NODE_ENV`
is unset, `test`, or `production`, the authentication limiter uses the production-safe limit of
20 requests per IP per 15 minutes.

### Step 5: Access Application
- Frontend: http://localhost:5173
- Backend API: http://localhost:5000/api
- API Health: http://localhost:5000/api/health
- Reports: http://localhost:5173/admin/reports

---

## 📊 View Reports

### Access Reports Dashboard
1. Go to: http://localhost:5173/admin/reports
2. View four report types:
   - Student Readiness
   - Internship Match
   - Application Statistics
   - Skills Demand

### Export to PDF
Click "Export PDF" button on any report tab

---

## 🛢️ Database Management

### View Database (Prisma Studio)
```bash
cd server
npx prisma studio
# Opens http://localhost:5555
```

### Reset Database
```bash
cd server
npx prisma migrate reset
npx prisma db seed  # Reseed data
```

### Backup Database
```bash
# SQLite (development)
cp server/prisma/dev.db server/prisma/dev.db.backup
```

---

## 🎨 UI/UX Styling

### Color Palette
- Primary Blue: #2563EB
- Secondary Navy: #0F172A
- Accent Green: #10B981
- View full palette in [UI_UX_DESIGN.md](UI_UX_DESIGN.md)

### Bootstrap 5 Classes
```html
<!-- Primary button -->
<button class="btn btn-primary">Click me</button>

<!-- Primary card -->
<div class="card">
  <div class="card-header">Header</div>
  <div class="card-body">Content</div>
</div>

<!-- Stat card -->
<div class="stat-card">
  <div class="stat-value">1,234</div>
  <div class="stat-label">Students</div>
</div>
```

---

## 📚 API Examples

### Get Report Data
```bash
# Student Readiness
curl http://localhost:5000/api/reports/student-readiness \
  -H "Authorization: Bearer YOUR_TOKEN"

# Internship Match
curl http://localhost:5000/api/reports/internship-match \
  -H "Authorization: Bearer YOUR_TOKEN"

# Application Statistics
curl http://localhost:5000/api/reports/application-statistics \
  -H "Authorization: Bearer YOUR_TOKEN"

# Skills Demand
curl http://localhost:5000/api/reports/skills-demand \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Export to PDF
```bash
# Add ?export=pdf to any report endpoint
curl http://localhost:5000/api/reports/student-readiness?export=pdf \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -o report.pdf
```

---

## 🐛 Common Issues

### Port 5000 already in use
```bash
# Kill process
lsof -ti :5000 | xargs kill -9
```

### Database connection error
```bash
# Regenerate database
cd server
npx prisma migrate reset
npx prisma db seed
```

### Bootstrap CSS not loading
```bash
# Verify import in client/src/main.tsx
import 'bootstrap/dist/css/bootstrap.min.css';
import './styles/theme.css';
```

### Reports showing no data
```bash
# Check:
1. Database has sample data: npx prisma studio
2. JWT token is valid
3. User has admin role
4. Date range filters are correct
```

---

## 📖 Documentation

### Full Documentation Files
- **[DATABASE_DESIGN.md](DATABASE_DESIGN.md)** - Database schema (500+ lines)
- **[UI_UX_DESIGN.md](UI_UX_DESIGN.md)** - Design system (400+ lines)
- **[REPORTING_SYSTEM.md](REPORTING_SYSTEM.md)** - Reports guide (600+ lines)
- **[IMPLEMENTATION_GUIDE.md](IMPLEMENTATION_GUIDE.md)** - Full setup guide (800+ lines)

### Project Structure
```
SkillSync/
├── server/              Backend (Node.js + Express)
│   ├── src/
│   │   ├── controllers/ Request handlers
│   │   ├── services/    Business logic
│   │   ├── routes/      API endpoints
│   │   └── prisma/      Database schema
│   └── package.json
│
├── client/              Frontend (React + Bootstrap 5)
│   ├── src/
│   │   ├── components/  UI components
│   │   ├── pages/       Page components
│   │   ├── services/    API integration
│   │   └── styles/      CSS & theming
│   └── package.json
│
└── Documentation files (4 files, 2000+ lines)
```

---

## 🔄 Development Workflow

### Making Changes

**Backend Change**
```bash
cd server

# Edit files in src/
# Restart server with: npm run dev
# Changes auto-reload with ts-node-dev
```

**Frontend Change**
```bash
cd client

# Edit files in src/
# Vite auto-reloads changes
```

**Database Schema Change**
```bash
cd server

# Edit prisma/schema.prisma
# Create migration: npx prisma migrate dev --name description
# Restart server
```

### Adding a Report

```bash
# 1. Create service method in server/src/services/reportService.ts
# 2. Create controller in server/src/controllers/reportController.ts
# 3. Add route in server/src/routes/reports.ts
# 4. Create frontend component in client/src/pages/admin/Reports.tsx
# 5. Add service in client/src/services/reportsService.ts
```

---

## 📦 Build for Production

```bash
# Backend
cd server
npm run build
# Creates dist/ folder

# Frontend
cd client
npm run build
# Creates dist/ folder

# Start production server
node server/dist/index.js
```

---

## 🚀 Deploy

### Quick Deploy (Heroku)
```bash
# Install Heroku CLI
npm install -g heroku

# Create app
heroku create skillsync-app

# Deploy
git push heroku main

# Run migrations
heroku run npx prisma migrate deploy
```

### Docker Deploy
```bash
# Build images
docker-compose build

# Start services
docker-compose up
```

---

## 💡 Quick Tips

### View Logs
```bash
# Backend logs
cd server
npm run dev  # Shows detailed logs

# Frontend logs
cd client
npm run dev  # Shows Vite logs

# Check browser console (F12)
```

### Debug with Prisma Studio
```bash
cd server
npx prisma studio
# Opens interactive database explorer at localhost:5555
```

### Test API with Postman
```
Import collection from:
- Method: GET/POST/PUT/DELETE
- URL: http://localhost:5000/api/...
- Headers: Authorization: Bearer <token>
```

### View Database Indexes
```bash
cd server
npx prisma studio
# View in "indexes" tab
```

---

## 📞 Support

### Check Documentation
1. For database questions → [DATABASE_DESIGN.md](DATABASE_DESIGN.md)
2. For UI/styling → [UI_UX_DESIGN.md](UI_UX_DESIGN.md)
3. For reports → [REPORTING_SYSTEM.md](REPORTING_SYSTEM.md)
4. For deployment → [IMPLEMENTATION_GUIDE.md](IMPLEMENTATION_GUIDE.md)

### Check Logs
```bash
# Browser console
F12 or Cmd+Option+J

# Backend terminal
npm run dev output

# Database
npx prisma studio
```

---

## ✅ Verification Checklist

- [ ] Node 18+ installed: `node -v`
- [ ] npm 9+ installed: `npm -v`
- [ ] Repo cloned successfully
- [ ] Dependencies installed: `npm install`
- [ ] .env files configured
- [ ] Database migrations run: `npx prisma migrate dev`
- [ ] Backend starts: `npm run dev` (server)
- [ ] Frontend starts: `npm run dev` (client)
- [ ] Can access http://localhost:5173
- [ ] Can access http://localhost:5173/admin/reports
- [ ] Reports load and display data

---

## 🎉 You're Ready!

Your SkillSync development environment is now running with:
- ✅ Fully normalized 3NF database
- ✅ Bootstrap 5 professional UI/UX
- ✅ 4 comprehensive reports with PDF export
- ✅ Real-time dashboard
- ✅ Complete documentation

**Happy coding!** 🚀
