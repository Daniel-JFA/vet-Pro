// ─────────────────────────────────────────────
// Core domain models for VetPro SaaS
// ─────────────────────────────────────────────

export interface Clinic {
  id: string;
  name: string;
  logoUrl?: string;
  nit?: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  plan: 'starter' | 'clinic' | 'pro' | 'enterprise';
  aiMinutesUsed: number;
  aiMinutesLimit: number;
  createdAt: Date;
}

export interface User {
  id: string;
  clinicId: string;
  branchId?: string | null;
  firstName: string;
  lastName: string;
  email: string;
  role: 'admin' | 'vet' | 'assistant' | 'receptionist' | 'walker';
  avatarUrl?: string;
  active: boolean;
}

// ── WALKERS (PASEADORES) ───────────────────────

export type WalkStatus = 'requested' | 'assigned' | 'confirmed' | 'on_the_way' | 'walking' | 'completed' | 'cancelled';

export interface Walker {
  id: string;
  clinicId: string;
  userId: string;
  user?: User;
  bio?: string;
  photoUrl?: string;
  rating: number;
  totalWalks: number;
  pricePerHour: number;
  maxDogs: number;
  coverageZones: string[];
  active: boolean;
  createdAt: Date;
}

export interface WalkBooking {
  id: string;
  clinicId: string;
  tutorId: string;
  tutor?: Tutor;
  walkerId?: string;
  walker?: Walker;
  patientIds: string[];
  scheduledAt: Date;
  durationMins: number;
  address: string;
  latitude?: number;
  longitude?: number;
  status: WalkStatus;
  price: number;
  notes?: string;
  startedAt?: Date;
  completedAt?: Date;
  distanceKm?: number;
  photos: string[];
  walkerNotes?: string;
  rating?: number;
  review?: string;
  cancelledAt?: Date;
  cancelReason?: string;
  createdAt: Date;
}

export interface Tutor {
  id: string;
  clinicId: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone: string;
  documentId?: string;
  address?: string;
  notes?: string;
  createdAt: Date;
}

export type Species = 'dog' | 'cat' | 'rabbit' | 'bird' | 'reptile' | 'horse' | 'cow' | 'pig' | 'other';

export type PatientStatus = 'active' | 'inactive' | 'deceased';

export interface Patient {
  id: string;
  clinicId: string;
  tutorId: string;
  tutor?: Tutor;
  name: string;
  species: Species;
  breed?: string;
  birthDate?: Date;
  sex: 'male' | 'female';
  sterilized: boolean;
  weight?: number;
  chipId?: string;
  photoUrl?: string;
  allergies?: string;
  notes?: string;
  status: PatientStatus;
  createdAt: Date;
}

export type AppointmentStatus = 'scheduled' | 'waiting' | 'in-progress' | 'done' | 'cancelled' | 'no-show';

export interface Appointment {
  id: string;
  clinicId: string;
  patientId: string;
  patient?: Patient;
  vetId: string;
  vet?: User;
  serviceType: string;
  scheduledAt: Date;
  durationMinutes: number;
  status: AppointmentStatus;
  reason?: string;
  notes?: string;
  amountCharged?: number;
  createdAt: Date;
}

export interface MedicalRecord {
  id: string;
  clinicId: string;
  patientId: string;
  patient?: Patient;
  appointmentId?: string;
  vetId: string;
  type: 'consultation' | 'surgery' | 'vaccine' | 'deworming' | 'lab' | 'imaging' | 'other';
  title: string;
  anamnesis?: string;
  physicalExam?: string;
  diagnosis?: string;
  treatment?: string;
  observations?: string;
  aiGenerated: boolean;
  aiTranscriptionMinutes?: number;
  attachments?: Attachment[];
  createdAt: Date;
}

export interface Attachment {
  id: string;
  recordId: string;
  name: string;
  type: 'image' | 'pdf' | 'lab' | 'imaging' | 'other';
  url: string;
  size: number;
  uploadedAt: Date;
}

export interface Vaccine {
  id: string;
  patientId: string;
  name: string;
  brand?: string;
  batch?: string;
  appliedAt: Date;
  nextDueAt?: Date;
  vetId: string;
  notes?: string;
}

export interface Prescription {
  id: string;
  recordId: string;
  patientId: string;
  vetId: string;
  items: PrescriptionItem[];
  instructions?: string;
  signedAt?: Date;
  sentToTutor: boolean;
}

export interface PrescriptionItem {
  drugName: string;
  presentation: string;
  dose: string;
  frequency: string;
  durationDays: number;
  quantity: number;
}

// ── INVENTORY ──────────────────────────────────

export type ProductCategory =
  | 'medication'
  | 'vaccine'
  | 'surgical-supply'
  | 'consumable'
  | 'food'
  | 'accessory'
  | 'lab-reagent'
  | 'other';

export interface Product {
  id: string;
  clinicId: string;
  sku: string;
  name: string;
  category: ProductCategory;
  brand?: string;
  unit: string;
  description?: string;
  barcode?: string;
  requiresPrescription: boolean;
  controlled: boolean; // narcóticos / control especial
  minStock: number;
  currentStock: number;
  costPrice: number;
  salePrice: number;
  taxRate: number; // e.g. 0.19 for 19% IVA
  expiresAt?: Date;
  supplierId?: string;
  active: boolean;
  createdAt: Date;
}

export type MovementType = 'in' | 'out' | 'adjustment' | 'return' | 'loss';

export interface InventoryMovement {
  id: string;
  clinicId: string;
  productId: string;
  product?: Product;
  type: MovementType;
  quantity: number;
  quantityBefore: number;
  quantityAfter: number;
  unitCost?: number;
  reason?: string;
  referenceId?: string; // appointmentId, invoiceId, purchaseOrderId
  referenceType?: 'appointment' | 'invoice' | 'purchase' | 'adjustment';
  performedBy: string;
  performedAt: Date;
  batchNumber?: string;
  expiryDate?: Date;
}

export interface Supplier {
  id: string;
  clinicId: string;
  name: string;
  nit?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
  active: boolean;
}

export interface PurchaseOrder {
  id: string;
  clinicId: string;
  supplierId: string;
  supplier?: Supplier;
  status: 'draft' | 'sent' | 'partial' | 'received' | 'cancelled';
  items: PurchaseOrderItem[];
  total: number;
  orderedAt: Date;
  expectedAt?: Date;
  receivedAt?: Date;
  notes?: string;
}

export interface PurchaseOrderItem {
  productId: string;
  product?: Product;
  quantityOrdered: number;
  quantityReceived: number;
  unitCost: number;
  total: number;
}

// ── BILLING ────────────────────────────────────

export type InvoiceStatus = 'draft' | 'issued' | 'paid' | 'partial' | 'void';

export interface Invoice {
  id: string;
  clinicId: string;
  invoiceNumber: string;
  tutorId: string;
  tutor?: Tutor;
  appointmentId?: string;
  status: InvoiceStatus;
  items: InvoiceItem[];
  subtotal: number;
  taxTotal: number;
  total: number;
  amountPaid: number;
  balance: number;
  issuedAt: Date;
  dueAt?: Date;
  paidAt?: Date;
  notes?: string;
  electronicId?: string; // DIAN CUFE
}

export interface InvoiceItem {
  description: string;
  productId?: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  discount: number;
  total: number;
}

// ── NOTIFICATIONS ──────────────────────────────

export interface NotificationTemplate {
  id: string;
  clinicId: string;
  name: string;
  trigger: 'appointment-reminder-24h' | 'appointment-reminder-2h' | 'vaccine-due' | 'birthday' | 'lab-ready' | 'custom';
  channel: 'whatsapp' | 'email' | 'push';
  subject?: string;
  body: string;
  active: boolean;
}

export interface NotificationLog {
  id: string;
  clinicId: string;
  templateId?: string;
  recipientPhone?: string;
  recipientEmail?: string;
  channel: string;
  status: 'sent' | 'delivered' | 'failed' | 'pending';
  patientId?: string;
  appointmentId?: string;
  sentAt: Date;
  error?: string;
}

// ── PAGINATION ─────────────────────────────────

export interface PagedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface QueryParams {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  [key: string]: any;
}
