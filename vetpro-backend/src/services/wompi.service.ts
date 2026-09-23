import crypto from 'crypto';
import { prisma } from '../config/database.js';
import { MarketplacePaymentStatus } from '@prisma/client';

export interface WompiConfig {
  publicKey: string;
  privateKey: string;
  integritySecret: string;
  eventsSecret: string;
  apiUrl: string;
  redirectUrl: string;
}

export const wompiConfig: WompiConfig = {
  publicKey: process.env.WOMPI_PUBLIC_KEY || 'pub_test_vetpro_gateway_dev_key',
  privateKey: process.env.WOMPI_PRIVATE_KEY || 'prv_test_vetpro_gateway_dev_key',
  integritySecret: process.env.WOMPI_INTEGRITY_SECRET || 'test_integrity_vetpro_colombia_2026',
  eventsSecret: process.env.WOMPI_EVENTS_SECRET || 'test_events_vetpro_colombia_2026',
  apiUrl: process.env.WOMPI_API_URL || 'https://sandbox.wompi.co/v1',
  redirectUrl: process.env.WOMPI_REDIRECT_URL || 'http://localhost:4200/marketplace/payment-result'
};

export class WompiService {
  /**
   * Genera la firma de integridad requerida por el widget y API de Wompi Colombia:
   * SHA256(reference + amountInCents + currency + integritySecret)
   */
  static generateIntegritySignature(
    reference: string,
    amountInCents: number,
    currency: string = 'COP'
  ): string {
    const rawString = `${reference}${amountInCents}${currency}${wompiConfig.integritySecret}`;
    return crypto.createHash('sha256').update(rawString).digest('hex');
  }

  /**
   * Valida la firma del evento Webhook enviado por Wompi Colombia
   */
  static verifyWebhookSignature(payload: any): boolean {
    if (!payload?.signature?.checksum || !payload?.signature?.properties) {
      return false;
    }

    try {
      const properties: string[] = payload.signature.properties;
      let rawString = '';

      for (const prop of properties) {
        const parts = prop.split('.');
        let val: any = payload.data;
        for (const part of parts) {
          val = val ? val[part] : undefined;
        }
        rawString += val !== undefined ? String(val) : '';
      }

      rawString += `${payload.timestamp}${wompiConfig.eventsSecret}`;
      const calculatedChecksum = crypto.createHash('sha256').update(rawString).digest('hex');

      return calculatedChecksum.toLowerCase() === payload.signature.checksum.toLowerCase();
    } catch {
      return false;
    }
  }

  /**
   * Crea una sesión de Checkout de Wompi para una cita médica del marketplace
   */
  static async createAppointmentCheckout(appointmentId: string) {
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        clinic: { select: { id: true, name: true, phone: true } },
        patient: {
          select: {
            id: true,
            name: true,
            species: true,
            tutor: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } }
          }
        },
        vet: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            vetProfile: { select: { id: true, consultationPrice: true, homeVisitPrice: true } }
          }
        }
      }
    });

    if (!appointment) {
      throw new Error('Cita médica no encontrada');
    }

    const amount = appointment.amountCharged || 50000;
    const amountInCents = Math.round(amount * 100);
    const platformFee = Math.round(amount * 0.15); // 15% Comisión VetPro
    const vetAmount = amount - platformFee;        // 85% para el veterinario

    const shortId = appointment.id.slice(0, 8).toUpperCase();
    const timestampStr = Date.now().toString(36).toUpperCase();
    const reference = `VP-APT-${shortId}-${timestampStr}`;

    const signatureIntegrity = this.generateIntegritySignature(reference, amountInCents, 'COP');

    // Registrar o actualizar registro de pago
    const payment = await prisma.marketplacePayment.create({
      data: {
        clinicId: appointment.clinicId,
        appointmentId: appointment.id,
        vetProfileId: appointment.vet?.vetProfile?.id || null,
        tutorId: appointment.patient?.tutor?.id || null,
        amount,
        platformFee,
        vetAmount,
        currency: 'COP',
        paymentType: 'appointment_booking',
        status: MarketplacePaymentStatus.pending,
        wompiReference: reference
      }
    });

    // Actualizar referencia en la cita
    await prisma.appointment.update({
      where: { id: appointment.id },
      data: {
        paymentReference: reference,
        paymentStatus: 'pending'
      }
    });

    const tutorEmail = appointment.patient?.tutor?.email || undefined;
    const tutorFullName = appointment.patient?.tutor
      ? `${appointment.patient.tutor.firstName} ${appointment.patient.tutor.lastName}`.trim()
      : undefined;
    const tutorPhone = appointment.patient?.tutor?.phone || undefined;

    return {
      paymentId: payment.id,
      publicKey: wompiConfig.publicKey,
      currency: 'COP',
      amountInCents,
      amount,
      platformFee,
      vetAmount,
      reference,
      signatureIntegrity,
      redirectUrl: `${wompiConfig.redirectUrl}?ref=${reference}`,
      customerData: {
        email: tutorEmail,
        fullName: tutorFullName,
        phoneNumber: tutorPhone
      },
      appointment: {
        id: appointment.id,
        reservationCode: shortId,
        scheduledAt: appointment.scheduledAt,
        serviceType: appointment.serviceType,
        modality: appointment.modality,
        patientName: appointment.patient?.name || 'Mascota',
        vetName: appointment.vet ? `${appointment.vet.firstName} ${appointment.vet.lastName}` : 'Especialista',
        clinicName: appointment.clinic.name
      }
    };
  }

  /**
   * Crea una sesión de Checkout para la membresía "Pro Vet" ($49.000 COP / mes)
   */
  static async createSubscriptionCheckout(userId: string) {
    const profile = await prisma.vetProfile.findUnique({
      where: { userId },
      include: {
        clinic: { select: { id: true, name: true } },
        user: { select: { firstName: true, lastName: true, email: true, phone: true } }
      }
    });

    if (!profile) {
      throw new Error('Perfil de veterinario no encontrado');
    }

    const amount = 49000; // $49.000 COP mensual
    const amountInCents = amount * 100;
    const platformFee = amount; // 100% suscripción SaaS
    const vetAmount = 0;

    const shortId = profile.id.slice(0, 8).toUpperCase();
    const timestampStr = Date.now().toString(36).toUpperCase();
    const reference = `VP-SUB-${shortId}-${timestampStr}`;

    const signatureIntegrity = this.generateIntegritySignature(reference, amountInCents, 'COP');

    const payment = await prisma.marketplacePayment.create({
      data: {
        clinicId: profile.clinicId,
        vetProfileId: profile.id,
        amount,
        platformFee,
        vetAmount,
        currency: 'COP',
        paymentType: 'subscription_pro_vet',
        status: MarketplacePaymentStatus.pending,
        wompiReference: reference
      }
    });

    return {
      paymentId: payment.id,
      publicKey: wompiConfig.publicKey,
      currency: 'COP',
      amountInCents,
      amount,
      reference,
      signatureIntegrity,
      redirectUrl: `${wompiConfig.redirectUrl}?ref=${reference}&type=sub`,
      customerData: {
        email: profile.user.email,
        fullName: `${profile.user.firstName} ${profile.user.lastName}`.trim(),
        phoneNumber: profile.user.phone || undefined
      },
      plan: {
        name: 'Membresía Pro Vet ⭐',
        period: 'Mensual',
        price: 49000,
        benefits: [
          'Insignia de Veterinario Verificado Pro ⭐',
          'Primer lugar en búsquedas por ciudad y especialidad',
          'Acceso preferencial para consultas a domicilio',
          'Soporte prioritario y analítica de perfil'
        ]
      }
    };
  }

  /**
   * Procesa la transacción reportada por Wompi (Webhook o Mock)
   */
  static async processTransaction(transaction: {
    id: string;
    reference: string;
    status: string; // 'APPROVED' | 'DECLINED' | 'VOIDED' | 'ERROR' | 'PENDING'
    amount_in_cents?: number;
    payment_method_type?: string;
    payment_method?: any;
    finalized_at?: string;
  }) {
    const payment = await prisma.marketplacePayment.findUnique({
      where: { wompiReference: transaction.reference },
      include: {
        appointment: true,
        vetProfile: true
      }
    });

    if (!payment) {
      throw new Error(`Pago no encontrado con referencia: ${transaction.reference}`);
    }

    let newStatus: MarketplacePaymentStatus = MarketplacePaymentStatus.pending;
    const statusUpper = (transaction.status || '').toUpperCase();

    if (statusUpper === 'APPROVED') {
      newStatus = MarketplacePaymentStatus.approved;
    } else if (statusUpper === 'DECLINED') {
      newStatus = MarketplacePaymentStatus.declined;
    } else if (statusUpper === 'VOIDED') {
      newStatus = MarketplacePaymentStatus.voided;
    } else if (statusUpper === 'ERROR') {
      newStatus = MarketplacePaymentStatus.error;
    }

    const paymentMethodType =
      transaction.payment_method_type ||
      transaction.payment_method?.type ||
      payment.paymentMethod ||
      'WOMPI';

    const paidAt = newStatus === MarketplacePaymentStatus.approved ? new Date() : null;

    // Actualizar el registro del pago
    const updatedPayment = await prisma.marketplacePayment.update({
      where: { id: payment.id },
      data: {
        status: newStatus,
        wompiTransactionId: transaction.id || payment.wompiTransactionId,
        paymentMethod: paymentMethodType,
        gatewayResponse: transaction as any,
        paidAt: paidAt || payment.paidAt
      }
    });

    // Si fue aprobado:
    if (newStatus === MarketplacePaymentStatus.approved) {
      // 1. Cita médica
      if (payment.appointmentId) {
        await prisma.appointment.update({
          where: { id: payment.appointmentId },
          data: {
            paymentStatus: 'paid',
            paymentMethod: paymentMethodType,
            paymentReference: transaction.reference
          }
        });
      }

      // 2. Suscripción Pro Vet
      if (payment.paymentType === 'subscription_pro_vet' && payment.vetProfileId) {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30); // 30 días de membresía

        await prisma.vetProfile.update({
          where: { id: payment.vetProfileId },
          data: {
            isFeatured: true,
            subscriptionStatus: 'active',
            subscriptionExpiresAt: expiresAt
          }
        });
      }
    } else if (newStatus === MarketplacePaymentStatus.declined || newStatus === MarketplacePaymentStatus.error) {
      if (payment.appointmentId) {
        await prisma.appointment.update({
          where: { id: payment.appointmentId },
          data: {
            paymentStatus: 'declined'
          }
        });
      }
    }

    return {
      payment: updatedPayment,
      status: newStatus,
      isApproved: newStatus === MarketplacePaymentStatus.approved
    };
  }

  /**
   * Simulación directa de pago para testing / sandbox / desarrollo
   */
  static async mockSimulatePayment(
    reference: string,
    status: 'APPROVED' | 'DECLINED' = 'APPROVED',
    paymentMethodType: string = 'CARD'
  ) {
    const fakeTransactionId = `WOMPI-TX-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    return this.processTransaction({
      id: fakeTransactionId,
      reference,
      status,
      payment_method_type: paymentMethodType,
      payment_method: {
        type: paymentMethodType,
        extra: {
          brand: 'VISA',
          last_four: '4242'
        }
      },
      finalized_at: new Date().toISOString()
    });
  }

  /**
   * Obtiene la información completa del Comprobante Digital (Voucher) de una cita
   */
  static async getAppointmentVoucher(appointmentId: string) {
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        clinic: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            address: true,
            city: true,
            nit: true
          }
        },
        patient: {
          select: {
            id: true,
            name: true,
            species: true,
            breed: true,
            tutor: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                phone: true,
                email: true,
                documentId: true,
                address: true
              }
            }
          }
        },
        vet: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            vetProfile: {
              select: {
                id: true,
                professionalCard: true,
                specialties: true,
                isFeatured: true,
                whatsappNumber: true
              }
            }
          }
        },
        marketplacePayments: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });

    if (!appointment) {
      throw new Error('Cita médica no encontrada');
    }

    const latestPayment = appointment.marketplacePayments?.[0] || null;
    const reservationCode = appointment.id.slice(0, 8).toUpperCase();
    const amount = appointment.amountCharged || 0;
    const platformFee = Math.round(amount * 0.15);
    const netVetAmount = amount - platformFee;

    // Generar hash de verificación para el QR / Voucher
    const rawVoucherData = `${reservationCode}:${appointment.id}:${appointment.scheduledAt.toISOString()}:${appointment.paymentStatus || 'unpaid'}`;
    const voucherHash = crypto.createHash('sha256').update(rawVoucherData).digest('hex').slice(0, 16);

    const tutorFullName = appointment.patient?.tutor
      ? `${appointment.patient.tutor.firstName} ${appointment.patient.tutor.lastName}`.trim()
      : 'Tutor';

    const vetFullName = appointment.vet
      ? `Dr(a). ${appointment.vet.firstName} ${appointment.vet.lastName}`.trim()
      : 'Veterinario Asignado';

    return {
      voucherId: `VOUCHER-${reservationCode}`,
      reservationCode,
      appointmentId: appointment.id,
      scheduledAt: appointment.scheduledAt,
      status: appointment.status,
      modality: appointment.modality,
      serviceType: appointment.serviceType,
      reason: appointment.reason,
      notes: appointment.notes,
      address: appointment.address || appointment.clinic.address,
      city: appointment.city || appointment.clinic.city,
      pricing: {
        totalAmount: amount,
        platformFee,
        netVetAmount,
        currency: 'COP',
        paymentStatus: appointment.paymentStatus || 'unpaid',
        paymentMethod: appointment.paymentMethod || latestPayment?.paymentMethod || 'Pendiente',
        paymentReference: appointment.paymentReference || latestPayment?.wompiReference || null,
        paidAt: latestPayment?.paidAt || null
      },
      patient: {
        id: appointment.patient?.id || null,
        name: appointment.patient?.name || 'Mascota',
        species: appointment.patient?.species || 'dog',
        breed: appointment.patient?.breed || 'Mestizo'
      },
      tutor: {
        name: tutorFullName,
        phone: appointment.patient?.tutor?.phone || '',
        email: appointment.patient?.tutor?.email || null,
        documentId: appointment.patient?.tutor?.documentId || null,
        address: appointment.patient?.tutor?.address || null
      },
      vet: {
        name: vetFullName,
        phone: appointment.vet?.vetProfile?.whatsappNumber || appointment.vet?.phone || appointment.clinic.phone,
        professionalCard: appointment.vet?.vetProfile?.professionalCard || 'En trámite',
        specialties: appointment.vet?.vetProfile?.specialties || ['Medicina General'],
        isFeatured: appointment.vet?.vetProfile?.isFeatured || false
      },
      clinic: {
        name: appointment.clinic.name,
        nit: appointment.clinic.nit || 'NIT en trámite',
        phone: appointment.clinic.phone,
        email: appointment.clinic.email,
        address: appointment.clinic.address,
        city: appointment.clinic.city
      },
      security: {
        voucherHash,
        issuedAt: new Date().toISOString(),
        verificationUrl: `http://localhost:4200/marketplace/voucher/${appointment.id}?token=${voucherHash}`
      }
    };
  }
}
