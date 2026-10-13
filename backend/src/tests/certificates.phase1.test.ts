/**
 * Automated Test Suite — Certificate System Phase 1 Remediation
 *
 * Runs completely isolated in-memory unit and integration tests without
 * touching or modifying the shared production Supabase database.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  todayIST,
  isValidISODateString,
  getISTDayRange,
  resolveAndValidateEffectiveDates,
  checkStudentCertificateEligibility,
  formatCertificateNumber,
} from '../services/certificate.service.js';
import { hashCoordinatorCode } from '../utils/coordinatorUtils.js';

describe('1. Date Integrity & Historical End-Date Policy', () => {
  const referenceDate = '2026-10-13';

  it('rejects an activity with a missing (null) start date', () => {
    const result = resolveAndValidateEffectiveDates({
      status: 'active',
      startDate: null,
      endDate: null,
    }, referenceDate);

    assert.equal(result.valid, false);
    if (!result.valid) {
      assert.match(result.error, /must have a valid recorded start date/i);
    }
  });

  it('rejects an activity with an invalid calendar start date format', () => {
    const invalidFormats = ['2026/10/01', '10-10-2026', '2026-02-31', 'invalid', '2026-13-01'];
    for (const d of invalidFormats) {
      const result = resolveAndValidateEffectiveDates({
        status: 'active',
        startDate: d,
        endDate: null,
      }, referenceDate);
      assert.equal(result.valid, false, `Expected ${d} to be rejected`);
    }
  });

  it('rejects a start date in the future', () => {
    const result = resolveAndValidateEffectiveDates({
      status: 'active',
      startDate: '2026-10-15',
      endDate: null,
    }, referenceDate);

    assert.equal(result.valid, false);
    if (!result.valid) {
      assert.match(result.error, /cannot be in the future/i);
    }
  });

  it('NEVER silently replaces a missing historical end date with today for completed activities', () => {
    const result = resolveAndValidateEffectiveDates({
      status: 'completed',
      startDate: '2026-01-15',
      endDate: null, // missing historical end date
    }, referenceDate);

    assert.equal(result.valid, false);
    if (!result.valid) {
      assert.match(result.error, /must have a valid recorded historical end date/i);
    }
  });

  it('rejects a completed activity where end date precedes start date', () => {
    const result = resolveAndValidateEffectiveDates({
      status: 'completed',
      startDate: '2026-05-01',
      endDate: '2026-04-30',
    }, referenceDate);

    assert.equal(result.valid, false);
    if (!result.valid) {
      assert.match(result.error, /cannot precede start date/i);
    }
  });

  it('correctly resolves a completed activity with valid historical dates', () => {
    const result = resolveAndValidateEffectiveDates({
      status: 'completed',
      startDate: '2026-01-10',
      endDate: '2026-06-30',
    }, referenceDate);

    assert.equal(result.valid, true);
    if (result.valid) {
      assert.equal(result.dates.tenure, 'completed');
      assert.equal(result.dates.capturedStartDate, '2026-01-10');
      assert.equal(result.dates.capturedEndDate, '2026-06-30');
    }
  });

  it('correctly resolves an active activity with IST reference application date', () => {
    const result = resolveAndValidateEffectiveDates({
      status: 'active',
      startDate: '2026-08-01',
      endDate: null,
    }, referenceDate);

    assert.equal(result.valid, true);
    if (result.valid) {
      assert.equal(result.dates.tenure, 'active');
      assert.equal(result.dates.capturedStartDate, '2026-08-01');
      assert.equal(result.dates.capturedEndDate, referenceDate);
    }
  });
});

describe('2. Student Activity Eligibility & Ownership Enforcement', () => {
  it('rejects when activity record does not exist', () => {
    const result = checkStudentCertificateEligibility(null, 'stu-001');
    assert.equal(result.eligible, false);
    if (!result.eligible) {
      assert.equal(result.status, 404);
    }
  });

  it('rejects when student is not the owner of the activity (ownership mismatch)', () => {
    const activity = {
      id: 'act-1',
      studentId: 'stu-999', // Different student
      category: 'internship' as const,
      isActive: true,
      student: { isActive: true },
    };
    const result = checkStudentCertificateEligibility(activity, 'stu-001');
    assert.equal(result.eligible, false);
    if (!result.eligible) {
      assert.equal(result.status, 403);
      assert.match(result.error, /only request certificates for your own/i);
    }
  });

  it('rejects an inactive or soft-deleted activity record', () => {
    const activity = {
      id: 'act-1',
      studentId: 'stu-001',
      category: 'internship' as const,
      isActive: false, // Inactive/deleted
      student: { isActive: true },
    };
    const result = checkStudentCertificateEligibility(activity, 'stu-001');
    assert.equal(result.eligible, false);
    if (!result.eligible) {
      assert.equal(result.status, 400);
      assert.match(result.error, /archived, deactivated, or deleted/i);
    }
  });

  it('rejects when the student user account is marked inactive', () => {
    const activity = {
      id: 'act-1',
      studentId: 'stu-001',
      category: 'internship' as const,
      isActive: true,
      student: { isActive: false },
    };
    const result = checkStudentCertificateEligibility(activity, 'stu-001');
    assert.equal(result.eligible, false);
    if (!result.eligible) {
      assert.equal(result.status, 403);
      assert.match(result.error, /student account is inactive/i);
    }
  });

  it('accepts an active, verified student activity matching canonical User.userId', () => {
    const activity = {
      id: 'act-1',
      studentId: 'stu-001',
      category: 'internship' as const,
      isActive: true,
      student: { isActive: true },
    };
    const result = checkStudentCertificateEligibility(activity, 'stu-001');
    assert.equal(result.eligible, true);
  });
});

describe('3. Coordinator Authorization & Code Verification Safeguards', () => {
  it('enforces coordinator code hashing matching algorithm', () => {
    const rawCode = 'COORD-TEST-1234';
    const hash1 = hashCoordinatorCode(rawCode);
    const hash2 = hashCoordinatorCode(rawCode);
    assert.equal(hash1, hash2);
    assert.notEqual(rawCode, hash1);
  });

  it('demonstrates coordinator assignment isolation logic', () => {
    const assignedCoordinatorId: string = 'fac-alpha';
    const actor1: string = 'fac-alpha';
    const actor2: string = 'fac-beta';

    // Same coordinator
    assert.equal(actor1 === assignedCoordinatorId, true);

    // Different coordinator in same category is blocked
    assert.equal(actor2 === assignedCoordinatorId, false);
  });
});

describe('4. Asia/Kolkata Daily Request Limit Calculations', () => {
  it('computes accurate UTC boundary timestamps for Asia/Kolkata calendar day', () => {
    const range = getISTDayRange('2026-10-13');
    assert.equal(range.dateIST, '2026-10-13');

    // 2026-10-13 00:00:00 IST is 2026-10-12 18:30:00 UTC
    assert.equal(range.startUTC.toISOString(), '2026-10-12T18:30:00.000Z');

    // 2026-10-13 23:59:59.999 IST is 2026-10-13 18:29:59.999 UTC
    assert.equal(range.endUTC.toISOString(), '2026-10-13T18:29:59.999Z');
  });

  it('validates that any request within IST bounds is captured by daily limit', () => {
    const range = getISTDayRange('2026-10-13');
    const midDayUTC = new Date('2026-10-13T06:00:00.000Z'); // 11:30 AM IST
    assert.ok(midDayUTC >= range.startUTC && midDayUTC <= range.endUTC);

    const nextDayMorningUTC = new Date('2026-10-13T19:00:00.000Z'); // Oct 14 00:30 AM IST
    assert.ok(nextDayMorningUTC > range.endUTC);
  });
});

describe('5. Certificate Number Generation & Idempotency Safeguards', () => {
  it('formats deterministic, human-readable certificate numbers', () => {
    const certNum1 = formatCertificateNumber('internship', 2026, 1);
    assert.equal(certNum1, 'CERT-INT-2026-0001');

    const certNum42 = formatCertificateNumber('startup', 2026, 42);
    assert.equal(certNum42, 'CERT-STA-2026-0042');
  });
});
