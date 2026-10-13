/**
 * Certificate Service — Business Logic, Validations, and Authorization
 * AttendEase Phase 1 Remediation
 */

import { prisma } from '../db/prisma.js';
import { hashCoordinatorCode } from '../utils/coordinatorUtils.js';
import type { ActivityCategory, CertificateTenure } from '@prisma/client';

export const CANONICAL_CATEGORIES: ActivityCategory[] = [
  'internship',
  'startup',
  'project_work',
  'sports',
  'house_events',
];

/**
 * Returns current date string formatted as YYYY-MM-DD in Asia/Kolkata (IST).
 */
export function todayIST(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

/**
 * Validates strict YYYY-MM-DD calendar date format.
 */
export function isValidISODateString(dateStr: unknown): boolean {
  if (typeof dateStr !== 'string') return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const parts = dateStr.split('-');
  const year = parseInt(parts[0]!, 10);
  const month = parseInt(parts[1]!, 10);
  const day = parseInt(parts[2]!, 10);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return false;
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;

  const d = new Date(Date.UTC(year, month - 1, day));
  return (
    d.getUTCFullYear() === year &&
    d.getUTCMonth() === month - 1 &&
    d.getUTCDate() === day
  );
}

/**
 * Calculates start and end UTC timestamps for an Asia/Kolkata calendar day.
 */
export function getISTDayRange(dateIST?: string): { startUTC: Date; endUTC: Date; dateIST: string } {
  const dateStr = dateIST && isValidISODateString(dateIST) ? dateIST : todayIST();
  const startUTC = new Date(`${dateStr}T00:00:00+05:30`);
  const endUTC = new Date(`${dateStr}T23:59:59.999+05:30`);
  return { startUTC, endUTC, dateIST: dateStr };
}

export interface EffectiveDatesResult {
  tenure: CertificateTenure;
  capturedStartDate: string;
  capturedEndDate: string;
}

/**
 * Validates activity date integrity and resolves effective dates.
 * Enforces:
 * 1. Required, well-formed start date that cannot be in the future.
 * 2. If completed/archived, required historical end date (endDate >= startDate, endDate <= today).
 *    NEVER silently defaults missing historical end date to today.
 * 3. If active, captures todayIST() as effective end date with 'active' tenure.
 */
export function resolveAndValidateEffectiveDates(activity: {
  status: string;
  startDate: string | null;
  endDate: string | null;
}, referenceDateIST: string = todayIST()): { valid: true; dates: EffectiveDatesResult } | { valid: false; error: string } {
  if (!activity.startDate || !isValidISODateString(activity.startDate)) {
    return {
      valid: false,
      error: 'Activity must have a valid recorded start date (YYYY-MM-DD) before requesting a certificate.'
    };
  }

  if (activity.startDate > referenceDateIST) {
    return {
      valid: false,
      error: 'Activity start date cannot be in the future.'
    };
  }

  const isTerminal = activity.status === 'completed' || activity.status === 'archived';

  if (isTerminal) {
    if (!activity.endDate || !isValidISODateString(activity.endDate)) {
      return {
        valid: false,
        error: 'Completed/archived activity must have a valid recorded historical end date (YYYY-MM-DD). Silently defaulting to today is prohibited.'
      };
    }

    if (activity.endDate < activity.startDate) {
      return {
        valid: false,
        error: 'Recorded end date cannot precede start date.'
      };
    }

    if (activity.endDate > referenceDateIST) {
      return {
        valid: false,
        error: 'Historical end date cannot be in the future for completed/archived activities.'
      };
    }

    return {
      valid: true,
      dates: {
        tenure: 'completed',
        capturedStartDate: activity.startDate,
        capturedEndDate: activity.endDate,
      }
    };
  }

  // Active activity
  return {
    valid: true,
    dates: {
      tenure: 'active',
      capturedStartDate: activity.startDate,
      capturedEndDate: referenceDateIST,
    }
  };
}

/**
 * Validates student eligibility and activity integrity server-side.
 */
export function checkStudentCertificateEligibility(
  activity: {
    id: string;
    studentId: string;
    category: ActivityCategory;
    isActive: boolean;
    student?: {
      isActive: boolean;
    } | null;
  } | null,
  studentUserId: string
): { eligible: true } | { eligible: false; status: number; error: string } {
  if (!activity) {
    return { eligible: false, status: 404, error: 'Activity record not found.' };
  }

  if (!activity.isActive) {
    return {
      eligible: false,
      status: 400,
      error: 'Activity record has been archived, deactivated, or deleted. Certificates cannot be issued.'
    };
  }

  if (activity.student && !activity.student.isActive) {
    return {
      eligible: false,
      status: 403,
      error: 'Student account is inactive.'
    };
  }

  if (activity.studentId !== studentUserId) {
    return {
      eligible: false,
      status: 403,
      error: 'Access denied: You can only request certificates for your own verified activities.'
    };
  }

  if (!CANONICAL_CATEGORIES.includes(activity.category)) {
    return {
      eligible: false,
      status: 400,
      error: `Invalid activity category '${activity.category}'.`
    };
  }

  return { eligible: true };
}

/**
 * Validates coordinator authorization.
 * Strict rules:
 * 1. Admin always authorized, marked as isOverride = true for auditable override logging.
 * 2. Faculty / HOD must supply a non-empty coordinatorCode. Missing code is an immediate 400/401 failure.
 * 3. Code must match an active CoordinatorAccess record for this category and user.
 * 4. Explicit coordinator assignment protection: if the activity or request is assigned to a specific coordinator,
 *    other coordinators in the same category CANNOT act on it.
 */
export async function verifyCoordinatorAuthorization(
  params: {
    actorUserId: string;
    actorRole: string;
    category: ActivityCategory;
    coordinatorCode: string | undefined;
    assignedCoordinatorId?: string | null;
  },
  dbClient: any = prisma
): Promise<{ authorized: true; isOverride: boolean; access?: any } | { authorized: false; status: number; error: string }> {
  const { actorUserId, actorRole, category, coordinatorCode, assignedCoordinatorId } = params;

  // 1. Admin override check
  if (actorRole === 'admin') {
    return { authorized: true, isOverride: true };
  }

  if (actorRole !== 'faculty' && actorRole !== 'hod') {
    return {
      authorized: false,
      status: 403,
      error: 'Only assigned faculty coordinators or administrators can review certificate requests.'
    };
  }

  // 2. Strict Coordinator Code requirement — NO BYPASS
  if (!coordinatorCode || typeof coordinatorCode !== 'string' || !coordinatorCode.trim()) {
    return {
      authorized: false,
      status: 401,
      error: 'Coordinator Authorization Code is strictly required for this operation.'
    };
  }

  const hashed = hashCoordinatorCode(coordinatorCode.trim());

  const access = await dbClient.coordinatorAccess.findFirst({
    where: {
      category,
      codeHash: hashed,
      isActive: true,
      OR: [
        { facultyId: actorUserId },
        { faculty: { userId: actorUserId } }
      ]
    },
    include: {
      faculty: {
        select: {
          id: true,
          userId: true,
          name: true,
          department: true,
          designation: true,
          isActive: true
        }
      }
    }
  });

  if (!access) {
    return {
      authorized: false,
      status: 403,
      error: `Invalid or unauthorized Coordinator Code for ${category.toUpperCase()} activities.`
    };
  }

  if (!access.faculty?.isActive) {
    return {
      authorized: false,
      status: 403,
      error: 'Your faculty coordinator account is currently inactive.'
    };
  }

  // 3. Responsible coordinator assignment isolation
  // Category access alone must not permit overriding another explicitly assigned coordinator.
  if (assignedCoordinatorId && assignedCoordinatorId !== actorUserId) {
    return {
      authorized: false,
      status: 403,
      error: `This request is explicitly assigned to another coordinator (${assignedCoordinatorId}). Category coordinators cannot override assigned colleagues.`
    };
  }

  return { authorized: true, isOverride: false, access };
}

/**
 * Creates an audit log entry in activity_audit_logs.
 * NEVER logs authorization codes or secrets.
 */
export async function logCertificateAuditAction(data: {
  actorId: string;
  actorName: string;
  actorRole: string;
  action: 'CERTIFICATE_APPROVED' | 'CERTIFICATE_REJECTED' | 'CERTIFICATE_REVOKED';
  category: string;
  studentId: string;
  studentName: string;
  details: {
    requestId: string;
    certificateNumber?: string;
    activityId: string;
    tenure?: string;
    isOverride: boolean;
    reason?: string | null;
  };
}): Promise<void> {
  try {
    await prisma.activityAuditLog.create({
      data: {
        actorId: data.actorId,
        actorName: data.actorName,
        actorRole: data.actorRole,
        action: data.action,
        category: data.category,
        studentId: data.studentId,
        studentName: data.studentName,
        details: JSON.stringify(data.details),
      }
    });
  } catch (err) {
    // Non-fatal logging failure should be reported in server logs
    console.error('Failed to write certificate audit log:', err);
  }
}

/**
 * Generates human-readable collision-resistant certificate number.
 */
export function formatCertificateNumber(category: string, year: number | string, sequenceNumber: number): string {
  const categoryCode = category.slice(0, 3).toUpperCase();
  const seq = String(sequenceNumber).padStart(4, '0');
  return `CERT-${categoryCode}-${year}-${seq}`;
}
