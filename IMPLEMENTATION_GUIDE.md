# SkillSync Implementation & Deployment Guide

> **Current implementation reference:** This guide is an earlier delivery draft; some environment names, routes, dependencies, and deployment options below are not present in the current code. Use [docs/technical/installation.md](docs/technical/installation.md), [docs/technical/api.md](docs/technical/api.md), and [docs/technical/developer-manual.md](docs/technical/developer-manual.md) for verified instructions.

## Project Overview

SkillSync is a comprehensive campus internship and skills matching platform built with:
- **Backend**: Node.js + Express + Prisma + SQLite/PostgreSQL
- **Frontend**: React + TypeScript + Bootstrap 5
- **Database**: Fully normalized 3NF relational database
- **Reporting**: PDF export with comprehensive analytics

## Prerequisites

### Required Software
```
Node.js: v18.0.0 or higher
npm: v9.0.0 or higher
Git: Latest version
SQLite3: (included with Node.js)
PostgreSQL: 14+ (for production)
```

### Development Environment
```
VSCode (recommended)
Postman or Insomnia (API testing)
DBeaver (database visualization)
Chrome DevTools (frontend debugging)
```

## Installation & Setup

### 1. Clone Repository & Install Dependencies

```bash
# Clone repository
git clone <repository-url>
cd SkillSync

# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

### 2. Environment Configuration

**Server .env**
```env
# Database
DATABASE_URL="file:./dev.db"  # Development
# DATABASE_URL="postgresql://user:password@localhost:5432/skillsync"  # Production

# Authentication
JWT_SECRET="your-super-secret-jwt-key-change-this-in-production"
JWT_EXPIRE="7d"

# File Upload
UPLOAD_PATH="./uploads"
MAX_FILE_SIZE=10485760  # 10MB

# API Configuration
PORT=5000
NODE_ENV="development"
CLIENT_URL="http://localhost:5173"

# Email (Optional - for password reset)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"
```

**Client .env**
```env
VITE_API_URL="http://localhost:5000/api"
VITE_APP_NAME="SkillSync"
```

### 3. Database Setup & Migrations

```bash
# Navigate to server directory
cd server

# Install Prisma CLI
npm install -g prisma

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev --name init

# Seed database with sample data (optional)
npm run seed

# View database in Prisma Studio
npx prisma studio
```

### 4. Start Development Servers

**Terminal 1 - Backend Server**
```bash
cd server
npm run dev
# Server runs on http://localhost:5000
# API available at http://localhost:5000/api
```

**Terminal 2 - Frontend Server**
```bash
cd client
npm run dev
# Frontend runs on http://localhost:5173
# Access at http://localhost:5173
```

### 5. Verify Installation

```bash
# Test API health
curl http://localhost:5000/api/health

# Response should be:
# {"success": true, "message": "SkillSync API is running", "version": "1.0.0"}
```

## Project Structure

```
SkillSync/
├── server/                          # Backend Node.js/Express
│   ├── src/
│   │   ├── index.ts                # Main application entry
│   │   ├── config/
│   │   │   └── database.ts         # Database configuration
│   │   ├── controllers/             # Request handlers
│   │   │   ├── authController.ts
│   │   │   ├── studentController.ts
│   │   │   ├── employerController.ts
│   │   │   ├── internshipController.ts
│   │   │   ├── applicationController.ts
│   │   │   ├── skillController.ts
│   │   │   ├── adminController.ts
│   │   │   └── reportController.ts  # NEW: Report generation
│   │   ├── routes/                  # API route definitions
│   │   │   ├── auth.ts
│   │   │   ├── student.ts
│   │   │   ├── employer.ts
│   │   │   ├── internships.ts
│   │   │   ├── applications.ts
│   │   │   ├── skills.ts
│   │   │   ├── admin.ts
│   │   │   └── reports.ts          # NEW: Report routes
│   │   ├── middleware/
│   │   │   ├── auth.ts
│   │   │   ├── errorHandler.ts
│   │   │   └── upload.ts
│   │   ├── services/
│   │   │   ├── matchingService.ts
│   │   │   └── reportService.ts    # NEW: Report business logic
│   │   └── utils/
│   │       ├── jwt.ts
│   │       └── seed.ts
│   ├── prisma/
│   │   ├── schema.prisma           # Updated with Notifications, AuditLogs, Metrics
│   │   └── migrations/              # Database migrations
│   │       ├── 20260609231532_init/
│   │       ├── 20260710195215_add_password_reset_token/
│   │       └── 20260810120000_add_notifications_auditing_metrics/  # NEW
│   ├── uploads/
│   │   └── avatars/
│   ├── package.json
│   ├── tsconfig.json
│   └── .env
│
├── client/                          # React Frontend
│   ├── src/
│   │   ├── main.tsx                # Entry point (updated with Bootstrap)
│   │   ├── App.tsx
│   │   ├── index.css
│   │   ├── styles/
│   │   │   └── theme.css           # NEW: Bootstrap 5 theme & color scheme
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── AdminLayout.tsx      # Updated with Bootstrap
│   │   │   │   ├── AdminSidebar.tsx     # Updated with Bootstrap
│   │   │   │   ├── EmployerLayout.tsx
│   │   │   │   ├── Navbar.tsx
│   │   │   │   └── Layout.tsx
│   │   │   └── ui/
│   │   │       ├── Button.tsx
│   │   │       ├── Card.tsx
│   │   │       ├── Modal.tsx
│   │   │       ├── ModernButton.tsx     # NEW
│   │   │       ├── ModernCard.tsx       # NEW
│   │   │       └── StatCard.tsx         # NEW
│   │   ├── pages/
│   │   │   ├── admin/
│   │   │   │   ├── Dashboard.tsx
│   │   │   │   ├── Students.tsx
│   │   │   │   ├── Employers.tsx
│   │   │   │   ├── Internships.tsx
│   │   │   │   ├── Applications.tsx
│   │   │   │   ├── SkillsCatalogue.tsx
│   │   │   │   └── Reports.tsx          # NEW: Comprehensive reporting page
│   │   │   ├── student/
│   │   │   ├── employer/
│   │   │   └── auth/
│   │   ├── services/
│   │   │   ├── api.ts
│   │   │   └── reportsService.ts   # NEW: Frontend report API
│   │   ├── contexts/
│   │   │   └── AuthContext.tsx
│   │   └── utils/
│   │       └── helpers.ts
│   ├── public/
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── .env
│
├── DATABASE_DESIGN.md               # NEW: Database design documentation
├── UI_UX_DESIGN.md                  # NEW: UI/UX design system
├── REPORTING_SYSTEM.md              # NEW: Reporting system documentation
└── README.md
```

## Database Schema

### Key Tables (3NF Normalized)

1. **Users** - Authentication & authorization
2. **StudentProfile** - Student information
3. **EmployerProfile** - Company information
4. **Skill** - Skills catalog
5. **StudentSkill** - M:N relationship (Student ↔ Skill)
6. **Internship** - Job positions
7. **InternshipSkill** - M:N relationship (Internship ↔ Skill)
8. **Application** - Job applications
9. **Recommendation** - Personalized recommendations
10. **Notification** - User notifications
11. **AuditLog** - System audit trail
12. **StudentReadinessMetric** - Calculated readiness scores
13. **InternshipMatchMetric** - Calculated match scores

### Indexes Strategy
- All foreign keys indexed for JOIN performance
- Status columns indexed for filtering
- Readiness scores indexed for sorting/ranking
- Temporal columns indexed for range queries

## API Documentation

### Authentication Endpoints
```
POST /api/auth/register        - Student/Employer registration
POST /api/auth/login           - User login
POST /api/auth/logout          - User logout
POST /api/auth/forgot-password - Request password reset
POST /api/auth/reset-password  - Reset password with token
```

### Student Endpoints
```
GET    /api/student/profile           - Get student profile
PUT    /api/student/profile           - Update student profile
GET    /api/student/skills            - Get student skills
POST   /api/student/skills            - Add student skill
PUT    /api/student/skills/:id        - Update skill proficiency
DELETE /api/student/skills/:id        - Remove skill
GET    /api/student/applications      - Get student applications
GET    /api/student/matches           - Get skill-matched internships
GET    /api/student/recommendations   - Get personalized recommendations
```

### Employer Endpoints
```
GET    /api/employer/profile          - Get employer profile
PUT    /api/employer/profile          - Update employer profile
POST   /api/employer/internships      - Create internship posting
GET    /api/employer/internships      - List internships
PUT    /api/employer/internships/:id  - Update internship
DELETE /api/employer/internships/:id  - Remove internship
GET    /api/employer/applications     - Get applications for their positions
PATCH  /api/employer/applications/:id - Update application status
```

### Admin Endpoints
```
GET    /api/admin/dashboard           - Admin dashboard statistics
GET    /api/admin/students            - List all students
GET    /api/admin/employers           - List all employers
GET    /api/admin/internships         - List all internships
GET    /api/admin/applications        - List all applications
GET    /api/admin/skills              - List all skills
POST   /api/admin/skills              - Add new skill
```

### Report Endpoints (NEW)
```
GET    /api/reports/dashboard                    - All report summaries
GET    /api/reports/student-readiness            - Student readiness report
GET    /api/reports/student-readiness/:id        - Individual student readiness
GET    /api/reports/internship-match             - Match analysis
GET    /api/reports/application-statistics      - Application workflow stats
GET    /api/reports/skills-demand                - Skills market analysis
```

### PDF Export
```
All report endpoints support: ?export=pdf
Response: Binary PDF file with charts and data
```

## Bootstrap 5 Integration

### Color Scheme
- **Primary**: #2563EB (Blue)
- **Secondary**: #0F172A (Navy)
- **Accent**: #10B981 (Green)
- **Danger**: #EF4444 (Red)
- **Warning**: #F59E0B (Amber)
- **Success**: #10B981 (Green)

### Component Library Included
- Modern Buttons with loading states
- Stat Cards for dashboards
- Professional Cards with hover effects
- Responsive Forms
- Data Tables
- Charts (Recharts integration)
- Progress Bars
- Modals
- Navigation Bar
- Sidebar Navigation

### CSS Custom Properties
```css
--primary-color: #2563EB;
--secondary-color: #0F172A;
--accent-color: #10B981;
--shadow-sm, --shadow-md, --shadow-lg, --shadow-xl
```

## Reporting System

### Four Core Reports

1. **Student Readiness Report**
   - Readiness score (0-100)
   - Skills analysis
   - Recommendations
   - PDF export

2. **Internship Match Report**
   - Student-position match scores
   - Skill compatibility analysis
   - Experience alignment
   - PDF export

3. **Application Statistics Report**
   - Application workflow metrics
   - Status distribution
   - Top internships by applications
   - Acceptance rates
   - PDF export

4. **Skills Demand Report**
   - Market demand vs. supply
   - Skill gaps
   - Trend analysis
   - High-demand skills
   - PDF export

### Report Features
- Real-time data generation
- Comprehensive PDF export
- Interactive dashboards
- Filtering & customization
- Email distribution (future)
- Scheduled generation (future)

## Testing

### Manual Testing Checklist

**Database**
- [ ] Can connect to database
- [ ] Tables created successfully
- [ ] Sample data seeded
- [ ] Indexes created
- [ ] Relationships valid

**API**
- [ ] Health check endpoint works
- [ ] Authentication flow working
- [ ] CRUD operations working
- [ ] Report endpoints returning data
- [ ] PDF export generating files

**Frontend**
- [ ] Bootstrap CSS loading
- [ ] Color theme applied
- [ ] Components rendering
- [ ] Forms validating
- [ ] Reports page loading
- [ ] PDF export downloading

**Reports**
- [ ] Student readiness data correct
- [ ] Match scores calculating
- [ ] Application stats accurate
- [ ] Skills demand analysis correct
- [ ] PDF exports formatting properly

### Automated Testing (Optional)
```bash
# Install testing framework
npm install --save-dev jest @testing-library/react

# Run tests
npm test
```

## Deployment

### Build Production

**Backend**
```bash
cd server
npm run build
# Generates dist/ folder with compiled JavaScript
```

**Frontend**
```bash
cd client
npm run build
# Generates dist/ folder with optimized React build
```

### Production Configuration

**Server .env (Production)**
```env
DATABASE_URL="postgresql://user:password@prod-db-host:5432/skillsync"
JWT_SECRET="<very-long-random-secret-key>"
NODE_ENV="production"
PORT=5000
CLIENT_URL="https://yourdomain.com"
```

### Deployment Platforms

**Option 1: Heroku**
```bash
# Install Heroku CLI
npm install -g heroku

# Login to Heroku
heroku login

# Create app
heroku create skillsync-app

# Deploy backend
git push heroku main

# Run migrations
heroku run npx prisma migrate deploy
```

**Option 2: Docker**
```dockerfile
# Server Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY server/ .
RUN npm install && npm run build
EXPOSE 5000
CMD ["npm", "start"]

# Client Dockerfile
FROM node:18-alpine AS build
WORKDIR /app
COPY client/ .
RUN npm install && npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
```

**Option 3: VPS (Ubuntu/Debian)**
```bash
# SSH into server
ssh user@your-server

# Clone repository
git clone <repo> /var/www/skillsync

# Install dependencies
cd /var/www/skillsync
npm install

# Setup environment
cp .env.example .env
# Edit .env with production values

# Run migrations
cd server
npx prisma migrate deploy

# Start services
npm install -g pm2
pm2 start "npm run dev" --name skillsync

# Setup Nginx reverse proxy
# Install and configure Nginx...
```

## Maintenance & Monitoring

### Database Maintenance
```bash
# Backup database (SQLite)
cp server/prisma/dev.db server/prisma/dev.db.backup

# Backup database (PostgreSQL)
pg_dump -U postgres skillsync > backup.sql

# Restore database
psql -U postgres skillsync < backup.sql
```

### Monitoring
- Monitor server logs: `pm2 logs`
- Monitor database: Prisma Studio (`npx prisma studio`)
- Monitor API performance: Add logging middleware
- Monitor client errors: Browser console + error tracking service

### Performance Optimization
1. Enable database query caching
2. Implement rate limiting (already configured)
3. Add CDN for static files
4. Optimize images and assets
5. Enable gzip compression

## Troubleshooting

### Common Issues

**Database Connection Error**
```
Error: ENOENT: no such file or directory, open 'dev.db'
Solution: Run npx prisma migrate dev
```

**Port Already in Use**
```
Error: listen EADDRINUSE :::5000
Solution: Kill process: lsof -ti :5000 | xargs kill -9
```

**Bootstrap CSS Not Loading**
```
Solution: Verify import in main.tsx:
import 'bootstrap/dist/css/bootstrap.min.css';
import './styles/theme.css';
```

**PDF Export Not Working**
```
Solution: Ensure pdfkit installed:
npm install pdfkit
```

**Report Data Missing**
```
Solution: Check:
1. Database has data
2. User has correct permissions
3. Date range filters are correct
4. Check browser console for errors
```

## Performance Benchmarks

### Expected Response Times
- API endpoints: 50-200ms
- Report generation: 2-8 seconds
- PDF export: 5-15 seconds
- Frontend load: < 3 seconds
- Database queries: < 100ms (with indexes)

### Scalability Limits (SQLite)
- ~10,000 users
- ~100,000 applications
- ~1,000 internships
- Consider PostgreSQL for larger scale

## Security Checklist

- [ ] Change JWT_SECRET in production
- [ ] Use HTTPS for all connections
- [ ] Enable CORS only for trusted domains
- [ ] Implement rate limiting (done)
- [ ] Validate all user inputs
- [ ] Sanitize database queries (Prisma does this)
- [ ] Use helmet.js for HTTP headers (done)
- [ ] Enable CSRF protection
- [ ] Hash passwords (bcryptjs, done)
- [ ] Audit log all sensitive operations (done)

## Conclusion

SkillSync is now ready for development and deployment with:
- ✅ Fully normalized 3NF database
- ✅ Comprehensive report generation system
- ✅ Bootstrap 5 modern UI/UX
- ✅ Complete API documentation
- ✅ Production-ready deployment guide

For support or questions, refer to the respective documentation files:
- `DATABASE_DESIGN.md` - Database schema details
- `UI_UX_DESIGN.md` - Design system documentation
- `REPORTING_SYSTEM.md` - Report features and usage
