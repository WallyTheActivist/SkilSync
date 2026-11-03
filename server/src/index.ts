import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { validateJsonBody, verifyRequestOrigin } from './middleware/security';
import { createApiRateLimiter, createAuthRateLimiter, getAuthRateLimitSettings } from './config/authRateLimit';

import authRoutes from './routes/auth';
import studentRoutes from './routes/student';
import skillRoutes from './routes/skills';
import internshipRoutes from './routes/internships';
import applicationRoutes from './routes/applications';
import employerRoutes from './routes/employer';
import adminRoutes from './routes/admin';
import reportRoutes from './routes/reports';
import { errorHandler, notFound } from './middleware/errorHandler';

const app = express();
const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
const authRateLimitSettings = getAuthRateLimitSettings();

// ─── Security Middleware ──────────────────────────────────────────────────────
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        frameAncestors: ["'none'"],
        formAction: ["'self'"],
      },
    },
  })
);

const allowedOrigins = CLIENT_URL.split(',').map((origin) => origin.trim()).filter(Boolean);
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use('/api', createApiRateLimiter(authRateLimitSettings));
app.use('/api', verifyRequestOrigin);

// ─── Body Parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use('/api', validateJsonBody);

// ─── Logging ─────────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// ─── Static Files (Avatars) ───────────────────────────────────────────────────
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/auth', createAuthRateLimiter(authRateLimitSettings), authRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/skills', skillRoutes);
app.use('/api/internships', internshipRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/employer', employerRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/reports', reportRoutes);

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    message: 'SkillSync API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// ─── 404 & Error Handlers ────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ─── Start Server ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════╗
║         SkillSync API Server v1.0.0          ║
╠══════════════════════════════════════════════╣
║  Status  : Running                           ║
║  Port    : ${PORT}                               ║
║  Mode    : ${(process.env.NODE_ENV || 'development').padEnd(12)}                ║
║  Auth RL : ${authRateLimitSettings.enabled ? 'enabled (20/15 min)' : 'disabled (development)'}          ║
║  URL     : http://localhost:${PORT}/api         ║
╚══════════════════════════════════════════════╝
  `);
});

export default app;
