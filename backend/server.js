const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');

// Load environment variables from backend/.env in local dev
dotenv.config({ path: path.join(__dirname, '.env') });

const { checkDatabaseHealth } = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const campusRoutes = require('./routes/campusRoutes');
const teacherRoutes = require('./routes/teacherRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();
const PORT = process.env.PORT || 5000;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// Support single or comma-separated allowed frontend origins (trimming trailing slashes)
const allowedOrigins = (
  process.env.FRONTEND_URL || (IS_PRODUCTION ? '' : 'http://localhost:5173')
)
  .split(',')
  .map((url) => url.trim().replace(/\/+$/, ''))
  .filter(Boolean);

if (IS_PRODUCTION && allowedOrigins.length === 0) {
  console.warn(
    'CORS warning: FRONTEND_URL is not set in production. Browser requests from external origins will be rejected.'
  );
}

// Security middleware
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);
app.use(
  cors({
    origin(origin, callback) {
      // Allow non-browser requests (health checks, server probes) and configured origins
      if (!origin) return callback(null, true);
      const normalized = origin.replace(/\/+$/, '');
      if (allowedOrigins.includes(normalized)) {
        return callback(null, true);
      }
      return callback(new Error('Origin not allowed by CORS policy.'));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(express.json({ limit: '1mb' }));

// Rate limiting (protects the laptop Express backend behind a public HTTPS tunnel)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.API_RATE_LIMIT_MAX) || 300,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/health',
  message: {
    message: 'Too many requests. Please wait a few minutes and try again.',
  },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.AUTH_RATE_LIMIT_MAX) || 25,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message:
      'Too many authentication attempts. Please wait 15 minutes and try again.',
  },
});

app.use('/api', apiLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// Basic root route
app.get('/', (req, res) => {
  res.json({
    project: 'AI-Powered Smart Campus Assistant API',
    status: 'running',
    healthEndpoint: '/api/health',
    dbHealthEndpoint: '/api/db-health',
    authEndpoints: '/api/auth',
    teacherEndpoints: '/api/teacher',
    adminEndpoints: '/api/admin',
    campusEndpoints: [
      '/api/public/highlights',
      '/api/dashboard',
      '/api/student/exams',
      '/api/student/results',
      '/api/notices',
      '/api/events',
      '/api/timetable',
      '/api/faculty',
      '/api/facilities',
    ],
  });
});

// Authentication routes (Student, Teacher, Admin)
app.use('/api/auth', authRoutes);

// Role-protected Teacher routes
app.use('/api/teacher', teacherRoutes);

// Role-protected Admin routes
app.use('/api/admin', adminRoutes);

// Read-only Campus & Student Portal routes
app.use('/api', campusRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'AI-Powered Smart Campus Assistant backend is running.',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
  });
});

// PostgreSQL database health check endpoint
app.get('/api/db-health', async (req, res) => {
  try {
    const isConnected = await checkDatabaseHealth();

    if (!isConnected) {
      return res.status(503).json({
        status: 'error',
        database: 'disconnected',
        message: 'Database health check did not return the expected result.',
        timestamp: new Date().toISOString(),
      });
    }

    return res.status(200).json({
      status: 'ok',
      database: 'connected',
      message: 'PostgreSQL database connection is healthy.',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    // Log only the safe error code without exposing credentials or connection strings
    const errorCode = error && error.code ? error.code : 'DB_CONNECTION_ERROR';
    console.error(`Database health check failed (${errorCode})`);

    let safeMessage = IS_PRODUCTION
      ? 'Database service is currently unavailable. Please try again later.'
      : 'Unable to connect to PostgreSQL. Please verify your database service and backend/.env.';

    if (!IS_PRODUCTION) {
      if (errorCode === '28P01') {
        safeMessage =
          'Database authentication failed. Please verify PG_USER and PG_PASSWORD in backend/.env.';
      } else if (errorCode === 'ECONNREFUSED') {
        safeMessage =
          'Could not reach the PostgreSQL server. Make sure PostgreSQL is running.';
      } else if (errorCode === '3D000') {
        safeMessage =
          'Target database was not found. Please verify PG_DATABASE in backend/.env.';
      }
    }

    return res.status(503).json({
      status: 'error',
      database: 'disconnected',
      message: safeMessage,
      timestamp: new Date().toISOString(),
    });
  }
});

// 404 fallback for unknown API routes
app.use((req, res) => {
  res.status(404).json({
    message: 'Requested endpoint was not found.',
  });
});

// Global production-safe error handler (never leaks stack traces or secrets)
app.use((err, req, res, next) => {
  if (err && err.message === 'Origin not allowed by CORS policy.') {
    return res.status(403).json({
      message: 'CORS policy: request origin is not permitted.',
    });
  }
  console.error(
    `Unhandled server error (${err && err.code ? err.code : 'INTERNAL_ERROR'})`
  );
  return res.status(500).json({
    message: 'An unexpected server error occurred. Please try again later.',
  });
});

// Start Express server
app.listen(PORT, () => {
  console.log(`Backend server listening on port ${PORT} (${process.env.NODE_ENV || 'development'})`);
});
