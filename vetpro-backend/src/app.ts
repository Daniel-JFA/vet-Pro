import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
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
import { errorHandler } from './middleware/error.js';

dotenv.config();

const app = express();

// Cabeceras de seguridad para endurecer la API (OWASP Best Practices)
app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; img-src 'self' data: https://images.unsplash.com https://cdnjs.cloudflare.com; connect-src 'self' http://localhost:3000;");
  next();
});

// Middlewares globales
app.use(cors());
app.use(express.json());

if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// Ruta de diagnóstico simple
app.get(['/health', '/api/health'], (req, res) => {
  res.json({ status: 'ok', service: 'VetPro API', timestamp: new Date() });
});

// Registrar Rutas de la API REST v1
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
app.use('/docs', DOCS_ROUTES);

// Manejador global de excepciones
app.use(errorHandler);

export default app;
