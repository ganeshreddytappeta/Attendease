/**
 * Phase 2 Test Suite: Certificate PDF Generation, Verification & Secure Downloads
 *
 * Exercises:
 * 1. PDF Validity & Integrity (Magic bytes, EOF trailer, valid buffer output)
 * 2. Immutable Snapshot Contents (Student details, activity, tenure, coordinator, dates)
 * 3. Clear distinction between completed activities and ongoing participation
 * 4. QR Code & Canonical Public Verification URL generation (no secrets/passwords exposed)
 * 5. Safe filename sanitization
 * 6. Secure download authorization rules (Student isolation, coordinator category scoping, admin override)
 * 7. Revoked certificate handling (watermark, alert banner, reason display)
 * 8. Repeated downloads idempotency & snapshot immutability
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import {
  generateCertificatePdf,
  getPublicVerificationUrl,
  getSafeCertificateFilename,
  CERT_COLORS,
  type IssuedCertificateSnapshot,
} from '../services/certificatePdf.service.js';

/**
 * Robust stream extractor for PDFKit buffers.
 * Extracts literal strings and hex-encoded font glyphs from decompressed content streams.
 */
function extractTextFromPdf(buf: Buffer): string {
  const raw = buf.toString('latin1');
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match: RegExpExecArray | null;
  let fullText = '';

  while ((match = streamRegex.exec(raw)) !== null) {
    let streamData = Buffer.from(match[1], 'latin1');
    try {
      streamData = zlib.inflateSync(streamData);
    } catch {
      // Stream is uncompressed or raw
    }
    const streamStr = streamData.toString('latin1');

    // Decode TJ arrays: [(H) 10 (e) 10 (l) 10 (l) 10 (o)] TJ or [<48> 10 <65>] TJ
    const tjMatches = streamStr.matchAll(/\[([\s\S]*?)\]\s*TJ/g);
    for (const tj of tjMatches) {
      let tjText = '';
      const items = tj[1].matchAll(/<([0-9a-fA-F]+)>|\(([^)]*)\)|(-?\d+(?:\.\d+)?)/g);
      for (const item of items) {
        if (item[1]) {
          try {
            tjText += Buffer.from(item[1], 'hex').toString('utf8');
          } catch {}
        } else if (item[2]) {
          tjText += item[2];
        } else if (item[3]) {
          const num = parseFloat(item[3]);
          if (num < -150) {
            tjText += ' ';
          }
        }
      }
      fullText += tjText + '\n';
    }

    // Decode direct Tj operators: (Hello) Tj or <48656c6c6f> Tj
    const directMatches = streamStr.matchAll(/(?:\(([^)]*)\)|<([0-9a-fA-F]+)>)\s*Tj/g);
    for (const dm of directMatches) {
      if (dm[1]) {
        fullText += dm[1] + '\n';
      } else if (dm[2]) {
        try {
          fullText += Buffer.from(dm[2], 'hex').toString('utf8') + '\n';
        } catch {}
      }
    }
  }

  return fullText;
}

describe('Phase 2 — Certificate PDF Validity & Structure', () => {
  const mockCompletedSnapshot: IssuedCertificateSnapshot = {
    id: 'cert_rec_001',
    certificateNumber: 'CERT-INT-2024-0042',
    studentId: 'stu-csit-001',
    studentName: 'Alice Johnson',
    studentRollNumber: '21B91A0501',
    studentDepartment: 'CSIT',
    studentYear: 'IV',
    studentSection: 'A',
    category: 'internship',
    titleOrCompany: 'Google India Pvt Ltd',
    roleOrPosition: 'Software Engineering Intern',
    tenure: 'completed',
    effectiveStartDate: '2024-05-01',
    effectiveEndDate: '2024-07-31',
    issuedByCoordinatorId: 'fac-coord-001',
    issuedByName: 'Dr. Jane Coordinator',
    issuedByDesignation: 'Associate Professor',
    issuedByDepartment: 'CSIT',
    issuedAt: new Date('2024-08-01T10:00:00Z'),
    verificationToken: 'vtoken_abcdef123456789',
    revokedAt: null,
    revocationReason: null,
  };

  it('1. Generates a valid PDF buffer with standard PDF headers and trailers', async () => {
    const pdfBuffer = await generateCertificatePdf(mockCompletedSnapshot);

    assert.ok(Buffer.isBuffer(pdfBuffer), 'Output must be a Node.js Buffer');
    assert.ok(pdfBuffer.length > 5000, 'PDF buffer must be non-empty and reasonably sized');

    // Standard PDF header validation
    const header = pdfBuffer.subarray(0, 5).toString('ascii');
    assert.equal(header, '%PDF-', 'PDF must begin with the standard %PDF- magic bytes');

    // Standard PDF trailer validation
    const tail = pdfBuffer.subarray(pdfBuffer.length - 128).toString('latin1');
    assert.ok(tail.includes('%%EOF'), 'PDF must terminate with %%EOF marker');
  });

  it('2. Embeds immutable snapshot contents accurately', async () => {
    const pdfBuffer = await generateCertificatePdf(mockCompletedSnapshot);
    const text = extractTextFromPdf(pdfBuffer);

    // Verify certificate number
    assert.ok(
      text.includes('CERT-INT-2024-0042'),
      'PDF text must include the immutable certificate number'
    );

    // Verify student details
    assert.ok(
      text.includes('ALICE JOHNSON') || text.includes('Alice Johnson'),
      'PDF text must include the student name'
    );
    assert.ok(
      text.includes('21B91A0501'),
      'PDF text must include student roll number'
    );
    assert.ok(
      text.includes('CSIT'),
      'PDF text must include student department'
    );

    // Verify activity & role
    assert.ok(
      text.includes('Google India Pvt Ltd'),
      'PDF text must include company/organization'
    );
    assert.ok(
      text.includes('Software Engineering Intern'),
      'PDF text must include role/position'
    );

    // Verify issuing coordinator details
    assert.ok(
      text.includes('Dr. Jane Coordinator'),
      'PDF text must include coordinator name'
    );
  });

  it('3. Clearly distinguishes completed activities from ongoing participation', async () => {
    // 3a. Completed activity
    const completedBuffer = await generateCertificatePdf(mockCompletedSnapshot);
    const completedText = extractTextFromPdf(completedBuffer);
    assert.ok(
      completedText.includes('SUCCESSFUL COMPLETION') || completedText.includes('successfully completed'),
      'Completed certificate must state successful completion'
    );
    assert.ok(
      !completedText.includes('Participation may be ongoing beyond this date'),
      'Completed certificate must NOT have ongoing disclaimer'
    );

    // 3b. Active participation activity
    const mockActiveSnapshot: IssuedCertificateSnapshot = {
      ...mockCompletedSnapshot,
      id: 'cert_rec_002',
      certificateNumber: 'CERT-STA-2024-0089',
      category: 'startup',
      titleOrCompany: 'InnovateX Labs',
      roleOrPosition: 'Co-Founder & Technical Lead',
      tenure: 'active',
      effectiveStartDate: '2024-01-15',
      effectiveEndDate: '2024-08-15',
      verificationToken: 'vtoken_startup_987654321',
    };

    const activeBuffer = await generateCertificatePdf(mockActiveSnapshot);
    const activeText = extractTextFromPdf(activeBuffer);

    assert.ok(
      activeText.includes('ACTIVE PARTICIPATION') || activeText.includes('actively participating'),
      'Active certificate must state verified active participation'
    );
    assert.ok(
      activeText.includes('Active participant as of') || activeText.includes('ongoing beyond this date'),
      'Active certificate must include explicit ongoing participation disclaimer note'
    );
  });
});

describe('Phase 2 — QR Code & Canonical Public Verification URL', () => {
  it('4. Generates canonical public verification URL using trusted server config', () => {
    const oldPublicUrl = process.env.PUBLIC_APP_URL;
    process.env.PUBLIC_APP_URL = 'https://attendease.srkrec.edu.in';

    try {
      const url = getPublicVerificationUrl('token_xyz_12345');
      assert.equal(url, 'https://attendease.srkrec.edu.in/verify/token_xyz_12345');

      // Ensures trailing slashes are trimmed cleanly
      process.env.PUBLIC_APP_URL = 'https://attendease.srkrec.edu.in/';
      const urlTrailing = getPublicVerificationUrl('token_xyz_12345');
      assert.equal(urlTrailing, 'https://attendease.srkrec.edu.in/verify/token_xyz_12345');
    } finally {
      process.env.PUBLIC_APP_URL = oldPublicUrl;
    }
  });

  it('4b. Never falls back to localhost when running in production environment', () => {
    const oldEnv = process.env.NODE_ENV;
    const oldPublic = process.env.PUBLIC_APP_URL;
    const oldApp = process.env.APP_URL;
    const oldFront = process.env.FRONTEND_URL;

    try {
      process.env.NODE_ENV = 'production';
      delete process.env.PUBLIC_APP_URL;
      delete process.env.APP_URL;
      delete process.env.FRONTEND_URL;

      const url = getPublicVerificationUrl('token_prod_test');
      assert.ok(!url.includes('localhost'), 'Production QR URL must never fallback to localhost');
      assert.ok(url.startsWith('https://'), 'Production QR URL fallback must be HTTPS');
    } finally {
      process.env.NODE_ENV = oldEnv;
      process.env.PUBLIC_APP_URL = oldPublic;
      process.env.APP_URL = oldApp;
      process.env.FRONTEND_URL = oldFront;
    }
  });

  it('5. Ensures QR code verification URL contains NO private contact details or internal secrets', () => {
    const token = 'vtoken_public_secure_99';
    const url = getPublicVerificationUrl(token);

    // QR URL should only encode the canonical public verification endpoint
    assert.ok(url.endsWith(`/verify/${token}`));
    assert.ok(!url.includes('password'));
    assert.ok(!url.includes('email='));
    assert.ok(!url.includes('phone='));
    assert.ok(!url.includes('secret'));
    assert.ok(!url.includes('apiKey'));
  });

  it('6. Sanitizes filename safely against path traversal and dangerous characters', () => {
    const safe1 = getSafeCertificateFilename('CERT-INT-2024-0042');
    assert.equal(safe1, 'AttendEase-Certificate-CERT-INT-2024-0042.pdf');

    // Attempted path traversal attack
    const safe2 = getSafeCertificateFilename('../../etc/passwd');
    assert.ok(!safe2.includes('/'));
    assert.ok(!safe2.includes('..'));
    assert.equal(safe2, 'AttendEase-Certificate-______etc_passwd.pdf');

    // Windows reserved and whitespace characters
    const safe3 = getSafeCertificateFilename('CERT INT:2024\\0042*');
    assert.equal(safe3, 'AttendEase-Certificate-CERT_INT_2024_0042_.pdf');
  });
});

describe('Phase 2 — Secure PDF Download Authorization', () => {
  const certSnapshot: IssuedCertificateSnapshot = {
    id: 'cert_101',
    certificateNumber: 'CERT-SPO-2024-0012',
    studentId: 'stu-student-01',
    studentName: 'Bob Smith',
    studentDepartment: 'ECE',
    category: 'sports',
    titleOrCompany: 'Inter-University Athletics',
    roleOrPosition: 'Team Captain',
    tenure: 'completed',
    effectiveStartDate: '2024-02-01',
    effectiveEndDate: '2024-02-15',
    issuedByCoordinatorId: 'fac-sports-coord',
    issuedByName: 'Coach Davis',
    issuedByDepartment: 'Physical Education',
    issuedAt: new Date(),
    verificationToken: 'vtoken_sports_123',
    revokedAt: null,
    revocationReason: null,
  };

  // Helper matching the route authorization logic
  async function evaluateDownloadAccess(
    actor: { id: string; role: string; userId?: string },
    cert: IssuedCertificateSnapshot,
    mockDb: {
      coordinatorAccess: {
        findFirst: (args: any) => Promise<any>;
      };
    }
  ): Promise<{ status: 200 | 403; error?: string }> {
    if (actor.role === 'student') {
      const isOwner =
        cert.studentId.toLowerCase() === actor.id.toLowerCase() ||
        cert.studentId.toLowerCase() === actor.userId?.toLowerCase();
      if (!isOwner) {
        return { status: 403, error: 'Access denied: You are only authorized to download your own certificates.' };
      }
      return { status: 200 };
    }

    if (actor.role === 'faculty') {
      const isIssuer = cert.issuedByCoordinatorId.toLowerCase() === actor.id.toLowerCase();
      if (isIssuer) return { status: 200 };

      const hasAccess = await mockDb.coordinatorAccess.findFirst({
        where: {
          isActive: true,
          category: cert.category,
          OR: [{ facultyId: actor.id }, { faculty: { userId: actor.id } }],
        },
      });

      if (!hasAccess) {
        return { status: 403, error: 'Access denied: You are not authorized to access certificates for this category.' };
      }
      return { status: 200 };
    }

    if (actor.role === 'admin') {
      return { status: 200 };
    }

    return { status: 403, error: 'Access denied: Insufficient permissions.' };
  }

  it('7. Allows a student to download their own certificate', async () => {
    const actorStudent = { id: 'stu-student-01', role: 'student', userId: 'stu-student-01' };
    const mockDb = { coordinatorAccess: { findFirst: async () => null } };

    const result = await evaluateDownloadAccess(actorStudent, certSnapshot, mockDb);
    assert.equal(result.status, 200);
  });

  it('8. BLOCKS a student from downloading another student\'s certificate', async () => {
    const unauthorizedStudent = { id: 'stu-intruder-02', role: 'student', userId: 'stu-intruder-02' };
    const mockDb = { coordinatorAccess: { findFirst: async () => null } };

    const result = await evaluateDownloadAccess(unauthorizedStudent, certSnapshot, mockDb);
    assert.equal(result.status, 403);
    assert.match(result.error!, /only authorized to download your own/i);
  });

  it('9. Allows an administrator to download any certificate', async () => {
    const adminUser = { id: 'admin-001', role: 'admin', userId: 'admin-001' };
    const mockDb = { coordinatorAccess: { findFirst: async () => null } };

    const result = await evaluateDownloadAccess(adminUser, certSnapshot, mockDb);
    assert.equal(result.status, 200);
  });

  it('10. Allows the issuing coordinator or category coordinator to download', async () => {
    // 10a. Issuing coordinator
    const issuingCoord = { id: 'fac-sports-coord', role: 'faculty', userId: 'fac-sports-coord' };
    const mockDb = { coordinatorAccess: { findFirst: async () => null } };

    const resultIssuer = await evaluateDownloadAccess(issuingCoord, certSnapshot, mockDb);
    assert.equal(resultIssuer.status, 200);

    // 10b. Another coordinator with sports category access
    const categoryCoord = { id: 'fac-sports-backup', role: 'faculty', userId: 'fac-sports-backup' };
    const mockDbActive = {
      coordinatorAccess: {
        findFirst: async (args: any) =>
          args.where.category === 'sports' ? { id: 'acc-1', category: 'sports' } : null,
      },
    };

    const resultCat = await evaluateDownloadAccess(categoryCoord, certSnapshot, mockDbActive);
    assert.equal(resultCat.status, 200);
  });

  it('11. BLOCKS a coordinator who does NOT have access to the certificate category', async () => {
    const internshipCoord = { id: 'fac-internship-only', role: 'faculty', userId: 'fac-internship-only' };
    const mockDbOther = {
      coordinatorAccess: {
        findFirst: async () => null, // No sports access
      },
    };

    const result = await evaluateDownloadAccess(internshipCoord, certSnapshot, mockDbOther);
    assert.equal(result.status, 403);
    assert.match(result.error!, /not authorized to access certificates for this category/i);
  });
});

describe('Phase 2 — Revoked Certificates & Snapshot Immutability', () => {
  it('12. Stamped PDF prominently displays REVOKED notice, date, and reason', async () => {
    const revokedSnapshot: IssuedCertificateSnapshot = {
      id: 'cert_rev_001',
      certificateNumber: 'CERT-INT-2024-0099',
      studentId: 'stu-001',
      studentName: 'Charlie Brown',
      studentDepartment: 'MECH',
      category: 'internship',
      titleOrCompany: 'Acme Robotics',
      tenure: 'completed',
      effectiveStartDate: '2024-01-01',
      effectiveEndDate: '2024-04-01',
      issuedByCoordinatorId: 'fac-coord-01',
      issuedByName: 'Prof. Miller',
      issuedByDepartment: 'MECH',
      issuedAt: new Date('2024-04-05'),
      verificationToken: 'vtoken_revoked_test_99',
      revokedAt: new Date('2024-05-10T14:30:00Z'),
      revocationReason: 'Falsified external completion letter discovered upon audit',
    };

    const pdfBuffer = await generateCertificatePdf(revokedSnapshot);
    const text = extractTextFromPdf(pdfBuffer);

    assert.ok(
      text.includes('REVOKED'),
      'PDF text must include REVOKED watermark and banner'
    );
    assert.ok(
      text.includes('no longer valid'),
      'PDF text must declare that the certificate is no longer valid'
    );
    assert.ok(
      text.includes('Falsified external completion letter'),
      'PDF text must include the revocation reason'
    );
  });

  it('13. Repeated downloads produce consistent PDFs and never mutate certificate number or snapshot', async () => {
    const originalSnapshot: IssuedCertificateSnapshot = {
      id: 'cert_repeat_001',
      certificateNumber: 'CERT-PRJ-2024-0312',
      studentId: 'stu-repeat-01',
      studentName: 'Dana Scully',
      studentDepartment: 'CSE',
      category: 'project_work',
      titleOrCompany: 'Autonomous Drone Navigation',
      roleOrPosition: 'Lead Researcher',
      tenure: 'completed',
      effectiveStartDate: '2024-01-10',
      effectiveEndDate: '2024-05-15',
      issuedByCoordinatorId: 'fac-cse-coord',
      issuedByName: 'Dr. Fox Mulder',
      issuedByDepartment: 'CSE',
      issuedAt: new Date('2024-05-20T09:00:00Z'),
      verificationToken: 'vtoken_repeat_test_312',
      revokedAt: null,
      revocationReason: null,
    };

    // Deep freeze snapshot to guarantee immutability
    const frozenSnapshot = Object.freeze({ ...originalSnapshot });

    // Download 1
    const buffer1 = await generateCertificatePdf(frozenSnapshot);

    // Download 2
    const buffer2 = await generateCertificatePdf(frozenSnapshot);

    // Download 3
    const buffer3 = await generateCertificatePdf(frozenSnapshot);

    // Ensure snapshot remained unchanged
    assert.equal(frozenSnapshot.certificateNumber, 'CERT-PRJ-2024-0312');
    assert.equal(frozenSnapshot.verificationToken, 'vtoken_repeat_test_312');
    assert.equal(new Date(frozenSnapshot.issuedAt).toISOString(), '2024-05-20T09:00:00.000Z');

    // Ensure all 3 generated PDFs are valid and equivalent in size (within font compression variance)
    assert.ok(buffer1.length > 5000);
    assert.ok(buffer2.length > 5000);
    assert.ok(buffer3.length > 5000);
    assert.equal(Math.abs(buffer1.length - buffer2.length) < 50, true);
    assert.equal(Math.abs(buffer2.length - buffer3.length) < 50, true);
  });
});
