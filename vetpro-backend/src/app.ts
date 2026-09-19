import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import cors from 'cors';
import { httpLogger } from './utils/logger.js';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { AUTH_ROUTES } from './routes/auth.routes.js';
import { PATIENT_ROUTES } from './routes/patient.routes.js';
import { TUTOR_ROUTES } from './routes/tutor.routes.js';
import { APPOINTMENT_ROUTES } from './routes/appointment.routes.js';
import { MEDICAL_RECORD_ROUTES } from './routes/medical-record.routes.js';
import { BILLING_ROUTES } from './routes/billing.routes.js';
import { INVENTORY_ROUTES } from './routes/inventory.routes.js';
import { CONSENT_ROUTES } from './routes/consent.routes.js';
import { REPORT_ROUTES } from './routes/report.routes.js';
import { PORTAL_ROUTES } from './routes/portal.routes.js';
import { BRANCH_ROUTES } from './routes/branch.routes.js';
import { DOCS_ROUTES } from './routes/docs.routes.js';
import { WALKER_ROUTES } from './routes/walker.routes.js';
import { HOSPITALIZATION_ROUTES } from './routes/hospitalization.routes.js';
import { DIAN_ROUTES } from './routes/dian.routes.js';
import { LAB_ROUTES } from './routes/lab.routes.js';
import { GROOMING_ROUTES } from './routes/grooming.routes.js';
import { CRM_ROUTES } from './routes/crm.routes.js';
import { PLATFORM_ROUTES } from './routes/platform.routes.js';
import { GEO_ROUTES } from './routes/geo.routes.js';
import { SERVICE_CATALOG_ROUTES } from './routes/service-catalog.routes.js';
import { errorHandler, requestId } from './middleware/error.js';
import { initSentry } from './utils/sentry.js';

dotenv.config();
initSentry();

const app = express();

app.use(requestId);

// ─────────────────────────────────────────────
// SEGURIDAD & CABECERAS HTTP (OWASP)
// ─────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://cdnjs.cloudflare.com', 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdnjs.cloudflare.com'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https://images.unsplash.com', 'https://cdnjs.cloudflare.com'],
        connectSrc: ["'self'", '*']
      }
    },
    crossOriginEmbedderPolicy: false
  })
);

// Configuración dinámica de CORS
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:4200', 'http://localhost:3000', 'https://vetpro.danielflorez.dev'];

app.use(
  cors({
    origin: (origin, callback) => {
      // Permitir peticiones sin origen (como apps móviles, Postman o curl) o si está en la lista permitida
      if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
        callback(null, true);
      } else {
        callback(new Error('Bloqueado por política CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-clinic-id', 'x-branch-id']
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Archivos subidos (fotos de mascotas, etc.) — montados en un volumen persistente.
// Se sirven bajo /api/uploads (no /uploads) porque Traefik solo enruta
// PathPrefix('/api') hacia este contenedor; todo lo demás va al frontend.
app.use('/api/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Logger estructurado con Pino (con ID de petición X-Request-Id)
app.use(httpLogger);

// ─────────────────────────────────────────────
// RATE LIMITING (Control de Abusos y Brute-Force)
// ─────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 1000, // Límite de 1000 peticiones por IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes desde esta IP, por favor intente nuevamente en 15 minutos.' }
});

const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 15, // Límite de 15 intentos por minuto
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos de autenticación. Por favor espere 1 minuto.' }
});

app.use('/api/', globalLimiter);
app.use('/api/v1/auth/login', authLimiter);
app.use('/api/v1/portal/auth/magic-link', authLimiter);
app.use('/api/v1/platform/auth/login', authLimiter);

// ─────────────────────────────────────────────
// RUTAS DE SALUD & DIAGNÓSTICO
// ─────────────────────────────────────────────
app.get(['/health', '/api/health'], (_req, res) => {
  res.json({
    status: 'ok',
    service: 'VetPro SaaS API',
    version: '2.0.0',
    timestamp: new Date()
  });
});

// ─────────────────────────────────────────────
// REGISTRO DE RUTAS API REST v1
// ─────────────────────────────────────────────
app.use('/api/v1/auth', AUTH_ROUTES);
app.use('/api/v1/patients', PATIENT_ROUTES);
app.use('/api/v1/tutors', TUTOR_ROUTES);
app.use('/api/v1/appointments', APPOINTMENT_ROUTES);
app.use('/api/v1/medical-records', MEDICAL_RECORD_ROUTES);
app.use('/api/v1/billing', BILLING_ROUTES);
app.use('/api/v1/inventory', INVENTORY_ROUTES);
app.use('/api/v1/consent-forms', CONSENT_ROUTES);
app.use('/api/v1/reports', REPORT_ROUTES);
app.use('/api/v1/portal', PORTAL_ROUTES);
app.use('/api/v1/branches', BRANCH_ROUTES);
app.use('/api/v1/walkers', WALKER_ROUTES);
app.use('/api/v1/hospitalizations', HOSPITALIZATION_ROUTES);
app.use('/api/v1/billing/dian', DIAN_ROUTES);
app.use('/api/v1/labs', LAB_ROUTES);
app.use('/api/v1/grooming', GROOMING_ROUTES);
app.use('/api/v1/crm', CRM_ROUTES);
app.use('/api/v1/platform', PLATFORM_ROUTES);
app.use('/api/v1/geo', GEO_ROUTES);
app.use('/api/v1/service-catalog', SERVICE_CATALOG_ROUTES);
app.use('/docs', DOCS_ROUTES);

// Manejador global de excepciones
app.use(errorHandler);

export default app;
