/**
 * Certificate Generation Routes
 * Phase 1 Remediation: Security, Authorization, Date Integrity, Daily Limit, Audit Logging
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { prisma } from '../db/prisma.js';
import { verifyToken } from '../middleware/auth.js';
import type { ActivityCategory } from '@prisma/client';
import {
  todayIST,
  getISTDayRange,
  resolveAndValidateEffectiveDates,
  checkStudentCertificateEligibility,
  verifyCoordinatorAuthorization,
  logCertificateAuditAction,
  formatCertificateNumber,
} from '../services/certificate.service.js';

const router = Router();

// ─── Public Routes (No Auth Required) ─────────────────────────────────────────

// GET /api/certificates/verify/:token — Public verification lookup
router.get('/verify/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    if (!token || token.trim().length < 5) {
      res.status(400).json({ error: 'Invalid verification token.' });
      return;
    }

    const cert = await prisma.issuedCertificate.findUnique({
      where: { verificationToken: token.trim() },
      select: {
        certificateNumber: true,
        studentName: true,
        studentRollNumber: true,
        studentDepartment: true,
        studentYear: true,
        studentSection: true,
        category: true,
        titleOrCompany: true,
        roleOrPosition: true,
        tenure: true,
        effectiveStartDate: true,
        effectiveEndDate: true,
        issuedByName: true,
        issuedByDesignation: true,
        issuedByDepartment: true,
        issuedAt: true,
        revokedAt: true,
      },
    });

    if (!cert) {
      res.status(404).json({ valid: false, error: 'No certificate found for this token.' });
      return;
    }

    if (cert.revokedAt) {
      res.json({
        valid: false,
        status: 'revoked',
        message: 'This certificate has been revoked by an institutional coordinator.',
        revokedAt: cert.revokedAt,
        certificateNumber: cert.certificateNumber,
      });
      return;
    }

    res.json({
      valid: true,
      status: 'active',
      certificate: {
        certificateNumber: cert.certificateNumber,
        studentName: cert.studentName,
        studentRollNumber: cert.studentRollNumber,
        studentDepartment: cert.studentDepartment,
        studentYear: cert.studentYear,
        studentSection: cert.studentSection,
        category: cert.category,
        titleOrCompany: cert.titleOrCompany,
        roleOrPosition: cert.roleOrPosition,
        tenure: cert.tenure,
        participationNote:
          cert.tenure === 'active'
            ? `Active participant as of ${cert.effectiveEndDate}. Participation may be ongoing beyond this date.`
            : null,
        effectiveStartDate: cert.effectiveStartDate,
        effectiveEndDate: cert.effectiveEndDate,
        issuedBy: {
          name: cert.issuedByName,
          designation: cert.issuedByDesignation,
          department: cert.issuedByDepartment,
        },
        issuedAt: cert.issuedAt,
      },
    });
  } catch (err) {
    console.error('GET /api/certificates/verify/:token error:', err);
    res.status(500).json({ error: 'Verification lookup failed.' });
  }
});

// ─── Authenticated Routes ───────────────────────────────────────────────────────

router.use(verifyToken);

// POST /api/certificates/request — Student submits certificate request
router.post('/request', async (req: Request, res: Response) => {
  try {
    const { activityId, studentRemarks } = req.body as {
      activityId?: string;
      studentRemarks?: string;
    };
    if (!activityId) {
      res.status(400).json({ error: 'activityId is required.' });
      return;
    }

    const studentUserId = req.user!.id; // canonical User.userId

    // 1. Authoritative record lookup with student profile integrity
    const activity = await prisma.studentActivity.findFirst({
      where: { id: activityId },
      include: {
        student: {
          select: {
            id: true,
            userId: true,
            name: true,
            rollNumber: true,
            department: true,
            year: true,
            section: true,
            isActive: true,
          },
        },
      },
    });

    // 2. Server-side eligibility and ownership enforcement
    const eligibility = checkStudentCertificateEligibility(activity, studentUserId);
    if (!eligibility.eligible) {
      res.status(eligibility.status).json({ error: eligibility.error });
      return;
    }

    // 3. Strict Date Integrity & Historical End-Date Policy
    const dateValidation = resolveAndValidateEffectiveDates(activity!);
    if (!dateValidation.valid) {
      res.status(400).json({ error: dateValidation.error });
      return;
    }
    const { tenure, capturedStartDate, capturedEndDate } = dateValidation.dates;

    // 4. Active Certificate Guard: Block request if an active certificate already exists
    const existingActiveCert = await prisma.issuedCertificate.findFirst({
      where: { activityId, revokedAt: null },
    });
    if (existingActiveCert) {
      res.status(409).json({
        error: `A valid certificate (${existingActiveCert.certificateNumber}) has already been issued for this activity. Reissuance is only permitted after revocation.`
      });
      return;
    }

    // 5. Daily Request Limit: At most 1 request per student, activity, and Asia/Kolkata calendar day
    // CRITICAL: Rejected and revoked requests also consume this calendar day's limit.
    const { startUTC, endUTC, dateIST } = getISTDayRange();
    const sameDayRequest = await prisma.certificateRequest.findFirst({
      where: {
        activityId,
        studentId: studentUserId,
        requestedAt: { gte: startUTC, lte: endUTC },
      },
    });

    if (sameDayRequest) {
      res.status(429).json({
        error: `Daily limit reached: You have already submitted a certificate request for this activity on ${dateIST} (Asia/Kolkata). Please wait until the next calendar day.`
      });
      return;
    }

    // 6. Block duplicate pending request from previous calendar days
    const pendingRequest = await prisma.certificateRequest.findFirst({
      where: {
        activityId,
        studentId: studentUserId,
        status: 'pending',
      },
    });

    if (pendingRequest) {
      res.status(409).json({
        error: 'A certificate request for this activity is already pending review from a previous day.'
      });
      return;
    }

    // 7. Create request record
    const certRequest = await prisma.certificateRequest.create({
      data: {
        activityId,
        studentId: studentUserId,
        requestedById: studentUserId,
        tenure,
        capturedStartDate,
        capturedEndDate,
        requestDate: dateIST,
        status: 'pending',
        studentRemarks: studentRemarks?.trim() || null,
      },
      include: {
        activity: true,
        student: {
          select: {
            id: true,
            userId: true,
            name: true,
            rollNumber: true,
            department: true,
            year: true,
            section: true,
          },
        },
      },
    });

    res.status(201).json({ success: true, certRequest });
  } catch (err: any) {
    if (err?.code === 'P2002' || err?.message?.includes('Unique constraint failed')) {
      res.status(429).json({
        error: `Daily limit reached: You have already submitted a certificate request for this activity today (Asia/Kolkata). Please wait until the next calendar day.`
      });
      return;
    }
    console.error('POST /api/certificates/request error:', err);
    res.status(500).json({ error: 'Failed to submit certificate request.' });
  }
});

// GET /api/certificates/my-requests — Student views their requests
router.get('/my-requests', async (req: Request, res: Response) => {
  try {
    const studentUserId = req.user!.id;
    const requests = await prisma.certificateRequest.findMany({
      where: { studentId: studentUserId },
      include: { activity: true, certificate: true },
      orderBy: { requestedAt: 'desc' },
    });
    res.json({ success: true, requests });
  } catch (err) {
    console.error('GET /api/certificates/my-requests error:', err);
    res.status(500).json({ error: 'Failed to fetch your certificate requests.' });
  }
});

// GET /api/certificates/coordinator — Coordinator views requests for their categories
router.get('/coordinator', async (req: Request, res: Response) => {
  try {
    const actor = req.user!;
    const statusFilter = (req.query.status as string) || 'pending';
    const whereClause: any = {};
    if (statusFilter !== 'all') {
      whereClause.status = statusFilter;
    }

    if (actor.role !== 'admin') {
      const assignments = await prisma.coordinatorAccess.findMany({
        where: {
          isActive: true,
          OR: [{ facultyId: actor.id }, { faculty: { userId: actor.id } }],
        },
        select: { category: true },
      });
      const categories = assignments.map((a) => a.category);
      if (categories.length === 0) {
        res.json({ success: true, requests: [] });
        return;
      }
      whereClause.activity = { category: { in: categories } };
    }

    const requests = await prisma.certificateRequest.findMany({
      where: whereClause,
      include: {
        activity: true,
        student: {
          select: {
            id: true,
            userId: true,
            name: true,
            rollNumber: true,
            department: true,
            year: true,
            section: true,
            avatarUrl: true,
          },
        },
        certificate: true,
      },
      orderBy: { requestedAt: 'desc' },
    });
    res.json({ success: true, requests });
  } catch (err) {
    console.error('GET /api/certificates/coordinator error:', err);
    res.status(500).json({ error: 'Failed to fetch certificate requests.' });
  }
});

// POST /api/certificates/:id/approve — Atomic and Idempotent approval
router.post('/:id/approve', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { coordinatorRemarks, coordinatorCode } = req.body as {
      coordinatorRemarks?: string;
      coordinatorCode?: string;
    };
    const actor = req.user!;

    const certReq = await prisma.certificateRequest.findUnique({
      where: { id },
      include: {
        activity: true,
        student: {
          select: {
            id: true,
            userId: true,
            name: true,
            rollNumber: true,
            department: true,
            year: true,
            section: true,
          },
        },
        certificate: true,
      },
    });

    if (!certReq) {
      res.status(404).json({ error: 'Certificate request not found.' });
      return;
    }

    // Idempotency check: If already approved and certificate exists, return it cleanly
    if (certReq.status === 'approved' && certReq.certificate) {
      res.json({
        success: true,
        certRequest: certReq,
        certificate: certReq.certificate,
        idempotent: true,
      });
      return;
    }

    if (certReq.status !== 'pending') {
      res.status(409).json({
        error: `Request is already '${certReq.status}' and cannot be approved.`
      });
      return;
    }

    // Strict Coordinator Authorization & Code Verification
    const authResult = await verifyCoordinatorAuthorization({
      actorUserId: actor.id,
      actorRole: actor.role,
      category: certReq.activity.category as ActivityCategory,
      coordinatorCode,
      assignedCoordinatorId: certReq.activity.coordinatorId ?? certReq.coordinatorId,
    });

    if (!authResult.authorized) {
      res.status(authResult.status).json({ error: authResult.error });
      return;
    }

    const coordinatorUser = await prisma.user.findFirst({
      where: { userId: actor.id },
      select: { name: true, designation: true, department: true },
    });

    // Atomic interactive transaction
    const result = await prisma.$transaction(async (tx) => {
      const locked = await tx.certificateRequest.findUnique({
        where: { id },
        include: {
          activity: true,
          student: {
            select: {
              id: true,
              userId: true,
              name: true,
              rollNumber: true,
              department: true,
              year: true,
              section: true,
            },
          },
          certificate: true,
        },
      });

      if (!locked) throw new Error('NOT_FOUND');

      // Concurrent idempotency guard
      if (locked.status === 'approved' && locked.certificate) {
        return { certRequest: locked, certificate: locked.certificate, isNew: false };
      }

      if (locked.status !== 'pending') {
        throw new Error('CONCURRENT_STATUS_CHANGE');
      }

      // Concurrency check: Ensure no active certificate exists for this activity
      const existingActive = await tx.issuedCertificate.findFirst({
        where: { activityId: locked.activityId, revokedAt: null },
      });
      if (existingActive) {
        throw new Error('ACTIVE_CERTIFICATE_EXISTS');
      }

      const year = new Date().getFullYear().toString();
      const count = await tx.issuedCertificate.count({
        where: { category: locked.activity.category },
      });
      const certificateNumber = formatCertificateNumber(locked.activity.category, year, count + 1);

      const issued = await tx.issuedCertificate.create({
        data: {
          certificateRequestId: id,
          activityId: locked.activityId,
          certificateNumber,
          studentId: locked.studentId,
          studentName: locked.student.name,
          studentRollNumber: locked.student.rollNumber ?? null,
          studentDepartment: locked.student.department,
          studentYear: locked.student.year ?? null,
          studentSection: locked.student.section ?? null,
          category: locked.activity.category,
          titleOrCompany: locked.activity.titleOrCompany,
          roleOrPosition: locked.activity.roleOrPosition ?? null,
          tenure: locked.tenure,
          effectiveStartDate: locked.capturedStartDate,
          effectiveEndDate: locked.capturedEndDate,
          issuedByCoordinatorId: actor.id,
          issuedByName: coordinatorUser?.name ?? actor.name,
          issuedByDesignation: coordinatorUser?.designation ?? null,
          issuedByDepartment: coordinatorUser?.department ?? actor.department,
        },
      });

      const updated = await tx.certificateRequest.update({
        where: { id },
        data: {
          status: 'approved',
          coordinatorId: actor.id,
          coordinatorRemarks: coordinatorRemarks?.trim() || null,
          reviewedAt: new Date(),
        },
        include: {
          activity: true,
          student: {
            select: {
              id: true,
              userId: true,
              name: true,
              rollNumber: true,
              department: true,
              year: true,
              section: true,
              avatarUrl: true,
            },
          },
          certificate: true,
        },
      });

      if (!locked.activity.coordinatorId) {
        await tx.studentActivity.update({
          where: { id: locked.activityId },
          data: { coordinatorId: actor.id },
        });
      }

      return { certRequest: updated, certificate: issued, isNew: true };
    });

    // Write to audit log (never logs secrets)
    if (result.isNew) {
      await logCertificateAuditAction({
        actorId: actor.id,
        actorName: coordinatorUser?.name ?? actor.name,
        actorRole: actor.role,
        action: 'CERTIFICATE_APPROVED',
        category: certReq.activity.category,
        studentId: certReq.studentId,
        studentName: certReq.student.name,
        details: {
          requestId: id,
          certificateNumber: result.certificate.certificateNumber,
          activityId: certReq.activityId,
          tenure: certReq.tenure,
          isOverride: authResult.isOverride,
          reason: coordinatorRemarks?.trim() || null,
        },
      });
    }

    res.json({ success: true, ...result });
  } catch (err: any) {
    if (err?.code === 'P2002' || err?.message === 'ACTIVE_CERTIFICATE_EXISTS' || err?.message?.includes('Unique constraint failed')) {
      res.status(409).json({
        error: 'An active certificate has already been issued for this activity by another coordinator.'
      });
      return;
    }
    if (err?.message === 'CONCURRENT_STATUS_CHANGE') {
      res.status(409).json({
        error: 'This request was updated concurrently by another coordinator. Please refresh.'
      });
      return;
    }
    console.error('POST /api/certificates/:id/approve error:', err);
    res.status(500).json({ error: 'Failed to approve certificate request.' });
  }
});

// POST /api/certificates/:id/reject — Atomic rejection
router.post('/:id/reject', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { coordinatorRemarks, coordinatorCode } = req.body as {
      coordinatorRemarks?: string;
      coordinatorCode?: string;
    };
    const actor = req.user!;

    const certReq = await prisma.certificateRequest.findUnique({
      where: { id },
      include: {
        activity: true,
        student: {
          select: { id: true, userId: true, name: true, rollNumber: true, department: true }
        }
      },
    });

    if (!certReq) {
      res.status(404).json({ error: 'Certificate request not found.' });
      return;
    }

    // Idempotency check: If already rejected, return cleanly
    if (certReq.status === 'rejected') {
      res.json({ success: true, certRequest: certReq, idempotent: true });
      return;
    }

    if (certReq.status !== 'pending') {
      res.status(409).json({ error: `Request is already '${certReq.status}'.` });
      return;
    }

    // Strict Coordinator Authorization & Code Verification
    const authResult = await verifyCoordinatorAuthorization({
      actorUserId: actor.id,
      actorRole: actor.role,
      category: certReq.activity.category as ActivityCategory,
      coordinatorCode,
      assignedCoordinatorId: certReq.activity.coordinatorId ?? certReq.coordinatorId,
    });

    if (!authResult.authorized) {
      res.status(authResult.status).json({ error: authResult.error });
      return;
    }

    const coordinatorUser = await prisma.user.findFirst({
      where: { userId: actor.id },
      select: { name: true, department: true },
    });

    // Atomic transaction for rejection
    const updated = await prisma.$transaction(async (tx) => {
      const locked = await tx.certificateRequest.findUnique({ where: { id } });
      if (!locked) throw new Error('NOT_FOUND');
      if (locked.status !== 'pending') throw new Error('CONCURRENT_STATUS_CHANGE');

      return tx.certificateRequest.update({
        where: { id },
        data: {
          status: 'rejected',
          coordinatorId: actor.id,
          coordinatorRemarks: coordinatorRemarks?.trim() || null,
          reviewedAt: new Date(),
        },
        include: {
          activity: true,
          student: {
            select: { id: true, userId: true, name: true, rollNumber: true, department: true }
          },
        },
      });
    });

    // Write to audit log
    await logCertificateAuditAction({
      actorId: actor.id,
      actorName: coordinatorUser?.name ?? actor.name,
      actorRole: actor.role,
      action: 'CERTIFICATE_REJECTED',
      category: certReq.activity.category,
      studentId: certReq.studentId,
      studentName: certReq.student.name,
      details: {
        requestId: id,
        activityId: certReq.activityId,
        isOverride: authResult.isOverride,
        reason: coordinatorRemarks?.trim() || null,
      },
    });

    res.json({ success: true, certRequest: updated });
  } catch (err: any) {
    if (err?.message === 'CONCURRENT_STATUS_CHANGE') {
      res.status(409).json({ error: 'This request was updated concurrently. Please refresh.' });
      return;
    }
    console.error('POST /api/certificates/:id/reject error:', err);
    res.status(500).json({ error: 'Failed to reject certificate request.' });
  }
});

// POST /api/certificates/:id/revoke — Atomic revocation with mandatory reason
router.post('/:id/revoke', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { revocationReason, coordinatorCode } = req.body as {
      revocationReason?: string;
      coordinatorCode?: string;
    };
    const actor = req.user!;

    // Mandatory reason requirement
    if (!revocationReason || typeof revocationReason !== 'string' || !revocationReason.trim()) {
      res.status(400).json({ error: 'A specific revocation reason is strictly required.' });
      return;
    }

    const certReq = await prisma.certificateRequest.findUnique({
      where: { id },
      include: {
        activity: true,
        certificate: true,
        student: {
          select: { id: true, userId: true, name: true }
        }
      },
    });

    if (!certReq) {
      res.status(404).json({ error: 'Certificate request not found.' });
      return;
    }

    if (certReq.status !== 'approved' || !certReq.certificate) {
      res.status(409).json({ error: 'Only an approved certificate can be revoked.' });
      return;
    }

    if (certReq.certificate.revokedAt) {
      res.status(409).json({ error: 'This certificate has already been revoked.' });
      return;
    }

    // Strict Coordinator Authorization & Code Verification
    const authResult = await verifyCoordinatorAuthorization({
      actorUserId: actor.id,
      actorRole: actor.role,
      category: certReq.activity.category as ActivityCategory,
      coordinatorCode,
      assignedCoordinatorId: certReq.activity.coordinatorId ?? certReq.coordinatorId,
    });

    if (!authResult.authorized) {
      res.status(authResult.status).json({ error: authResult.error });
      return;
    }

    const coordinatorUser = await prisma.user.findFirst({
      where: { userId: actor.id },
      select: { name: true, department: true },
    });

    // Atomic transaction for revocation
    await prisma.$transaction(async (tx) => {
      const lockedCert = await tx.issuedCertificate.findUnique({
        where: { id: certReq.certificate!.id },
      });
      if (!lockedCert || lockedCert.revokedAt) {
        throw new Error('ALREADY_REVOKED');
      }

      await tx.issuedCertificate.update({
        where: { id: certReq.certificate!.id },
        data: {
          revokedAt: new Date(),
          revokedById: actor.id,
          revocationReason: revocationReason.trim(),
        },
      });

      await tx.certificateRequest.update({
        where: { id },
        data: { status: 'revoked', reviewedAt: new Date() },
      });
    });

    // Write to audit log
    await logCertificateAuditAction({
      actorId: actor.id,
      actorName: coordinatorUser?.name ?? actor.name,
      actorRole: actor.role,
      action: 'CERTIFICATE_REVOKED',
      category: certReq.activity.category,
      studentId: certReq.studentId,
      studentName: certReq.student.name,
      details: {
        requestId: id,
        certificateNumber: certReq.certificate.certificateNumber,
        activityId: certReq.activityId,
        isOverride: authResult.isOverride,
        reason: revocationReason.trim(),
      },
    });

    res.json({ success: true, message: 'Certificate successfully revoked.' });
  } catch (err: any) {
    if (err?.message === 'ALREADY_REVOKED') {
      res.status(409).json({ error: 'This certificate has already been revoked.' });
      return;
    }
    console.error('POST /api/certificates/:id/revoke error:', err);
    res.status(500).json({ error: 'Failed to revoke certificate.' });
  }
});

export default router;
