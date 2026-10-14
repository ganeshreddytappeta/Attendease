/**
 * Certificate PDF Generation Service
 * AttendEase Phase 2: PDFKit-based downloadable certificates with QR-based public verification.
 *
 * Requirements:
 * - PDFKit on the backend
 * - Dedicated certificate PDF-generation service
 * - Uses immutable IssuedCertificate snapshot (never current student/activity record)
 * - Palette: Deep Teal #134E4A, Teal #0D9488, White #FFFFFF, Charcoal #1E293B
 * - Clear distinction between completed activities and ongoing participation
 * - QR code embedding canonical public verification URL
 * - Approved logo where available, clean monogram fallback
 * - Revoked status handling (prominent banner/watermark if revoked)
 * - Never exposes private contact details, internal secrets, or raw passwords
 */

import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import fs from 'node:fs';
import path from 'node:path';

export interface IssuedCertificateSnapshot {
  id: string;
  certificateNumber: string;
  studentId: string;
  studentName: string;
  studentRollNumber?: string | null;
  studentDepartment: string;
  studentYear?: string | null;
  studentSection?: string | null;
  category: string;
  titleOrCompany: string;
  roleOrPosition?: string | null;
  tenure: 'completed' | 'active';
  effectiveStartDate?: string | null;
  effectiveEndDate?: string | null;
  issuedByCoordinatorId: string;
  issuedByName: string;
  issuedByDesignation?: string | null;
  issuedByDepartment: string;
  issuedAt: Date | string;
  verificationToken: string;
  revokedAt?: Date | string | null;
  revokedById?: string | null;
  revocationReason?: string | null;
}

// ── Color Palette (Certificate-only Palette) ─────────────────────────────────
export const CERT_COLORS = {
  deepTeal: '#134E4A',
  teal: '#0D9488',
  white: '#FFFFFF',
  charcoal: '#1E293B',
  mutedCharcoal: '#475569',
  lightTealTint: '#F0FDFA',
  tealBorder: '#99F6E4',
  revokedRed: '#991B1B',
  revokedBg: '#FEF2F2',
  revokedBorder: '#F87171',
} as const;

export const CATEGORY_LABELS: Record<string, string> = {
  internship: 'Internship',
  startup: 'Startup / Entrepreneurship',
  project_work: 'Project Work',
  sports: 'Sports & Athletics',
  house_events: 'House Events',
};

/**
 * Resolves the canonical public verification URL for a given verification token.
 * Uses trusted server configuration (PUBLIC_APP_URL, APP_URL, FRONTEND_URL)
 * with a secure fallback.
 */
export function getPublicVerificationUrl(verificationToken: string): string {
  const isProd = process.env.NODE_ENV === 'production';
  const baseUrl =
    process.env.PUBLIC_APP_URL ||
    process.env.APP_URL ||
    process.env.FRONTEND_URL ||
    (isProd ? 'https://attendease-apuw.onrender.com' : 'http://localhost:5173');

  const cleanBase = baseUrl.trim().replace(/\/+$/, '');
  return `${cleanBase}/verify/${encodeURIComponent(verificationToken)}`;
}

/**
 * Returns a sanitized, safe filename for the certificate PDF.
 */
export function getSafeCertificateFilename(certificateNumber: string): string {
  const safeNumber = certificateNumber.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `AttendEase-Certificate-${safeNumber}.pdf`;
}

/**
 * Formats calendar date string (YYYY-MM-DD) or Date object into human-readable format.
 */
function formatDate(val?: string | Date | null): string {
  if (!val) return 'N/A';
  try {
    const d = typeof val === 'string' ? new Date(`${val.slice(0, 10)}T00:00:00Z`) : val;
    if (isNaN(d.getTime())) return String(val);
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC',
    });
  } catch {
    return String(val);
  }
}

/**
 * Attempts to locate an approved institutional or AttendEase logo image on disk.
 */
function resolveApprovedLogoPath(): string | null {
  const candidates = [
    path.resolve(process.cwd(), '../frontend/src/assets/srkr-logo.png'),
    path.resolve(process.cwd(), '../frontend/public/logo.png'),
    path.resolve(process.cwd(), '../frontend/public/favicon.png'),
    path.resolve(process.cwd(), '../frontend/src/assets/attendease-logo.png'),
    path.resolve(process.cwd(), 'src/assets/logo.png'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

/**
 * Draws a clean vector emblem/monogram fallback when no physical image logo is found.
 */
function drawMonogramFallback(doc: typeof PDFDocument.prototype, x: number, y: number): void {
  doc.save();

  // Outer circular seal
  doc
    .circle(x + 24, y + 24, 22)
    .lineWidth(1.5)
    .strokeColor(CERT_COLORS.teal)
    .stroke();

  // Inner dotted circle
  doc
    .circle(x + 24, y + 24, 18)
    .lineWidth(0.75)
    .strokeColor(CERT_COLORS.deepTeal)
    .stroke();

  // Center Monogram text "AE"
  doc
    .font('Helvetica-Bold')
    .fontSize(14)
    .fillColor(CERT_COLORS.deepTeal)
    .text('AE', x + 10, y + 17, { width: 28, align: 'center' });

  doc.restore();
}

/**
 * Dedicated Certificate PDF Generation Service.
 * Accepts an immutable snapshot of an IssuedCertificate and generates
 * a complete, tamper-evident PDF document buffer.
 */
export async function generateCertificatePdf(
  cert: IssuedCertificateSnapshot
): Promise<Buffer> {
  // 1. Generate QR Code containing ONLY the canonical public verification URL
  const verificationUrl = getPublicVerificationUrl(cert.verificationToken);
  const qrBuffer = await QRCode.toBuffer(verificationUrl, {
    errorCorrectionLevel: 'M',
    type: 'png',
    margin: 1,
    width: 200,
    color: {
      dark: CERT_COLORS.charcoal,
      light: CERT_COLORS.white,
    },
  });

  const logoPath = resolveApprovedLogoPath();

  return new Promise<Buffer>((resolve, reject) => {
    // Landscape A4 dimensions: 841.89 x 595.28 points
    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margin: 28,
      info: {
        Title: `Certificate of Participation - ${cert.certificateNumber}`,
        Author: 'AttendEase Verified Credential Registry',
        Subject: `Participation Certificate for ${cert.studentName}`,
        Keywords: 'AttendEase, Certificate, Verified Credential, Participation',
        CreationDate: new Date(cert.issuedAt),
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', (err) => reject(err));

    const width = 841.89;
    const height = 595.28;

    // ── 1. Page Background & Double Border ───────────────────────────────────
    // Solid white background
    doc.rect(0, 0, width, height).fill(CERT_COLORS.white);

    // Outer decorative border (Deep Teal)
    doc
      .rect(18, 18, width - 36, height - 36)
      .lineWidth(3)
      .strokeColor(CERT_COLORS.deepTeal)
      .stroke();

    // Inner fine border (Teal)
    doc
      .rect(24, 24, width - 48, height - 48)
      .lineWidth(1)
      .strokeColor(CERT_COLORS.teal)
      .stroke();

    // Corner decorative corner blocks
    const cornerSize = 10;
    const corners = [
      [24, 24],
      [width - 24 - cornerSize, 24],
      [24, height - 24 - cornerSize],
      [width - 24 - cornerSize, height - 24 - cornerSize],
    ];
    doc.fillColor(CERT_COLORS.deepTeal);
    for (const [cx, cy] of corners) {
      doc.rect(cx, cy, cornerSize, cornerSize).fill();
    }

    // ── 2. Top Header & Institution ─────────────────────────────────────────
    const logoX = 46;
    const logoY = 38;

    if (logoPath) {
      try {
        doc.image(logoPath, logoX, logoY, { fit: [48, 48], align: 'center' });
      } catch {
        drawMonogramFallback(doc, logoX, logoY);
      }
    } else {
      drawMonogramFallback(doc, logoX, logoY);
    }

    // Institution & Registry Header
    doc
      .font('Helvetica-Bold')
      .fontSize(11)
      .fillColor(CERT_COLORS.deepTeal)
      .text('ATTENDEASE VERIFIED CREDENTIAL REGISTRY', 106, 42, {
        characterSpacing: 1.5,
      });

    doc
      .font('Helvetica')
      .fontSize(8.5)
      .fillColor(CERT_COLORS.teal)
      .text(
        'OFFICIAL INSTITUTIONAL STUDENT PARTICIPATION & ACHIEVEMENT RECORD',
        106,
        57,
        { characterSpacing: 0.5 }
      );

    // Certificate Number Badge (Top Right)
    const badgeText = `Ref: ${cert.certificateNumber}`;
    doc
      .font('Helvetica-Bold')
      .fontSize(9)
      .fillColor(CERT_COLORS.deepTeal);
    const badgeWidth = doc.widthOfString(badgeText) + 20;
    const badgeX = width - 46 - badgeWidth;

    doc
      .roundedRect(badgeX, 40, badgeWidth, 22, 4)
      .fillAndStroke(CERT_COLORS.lightTealTint, CERT_COLORS.teal);

    doc
      .fillColor(CERT_COLORS.deepTeal)
      .text(badgeText, badgeX + 10, 46);

    // Separator line
    doc
      .moveTo(46, 94)
      .lineTo(width - 46, 94)
      .lineWidth(0.75)
      .strokeColor(CERT_COLORS.tealBorder)
      .stroke();

    // ── 3. Certificate Title & Tenue Badge ───────────────────────────────────
    doc
      .font('Helvetica-Bold')
      .fontSize(23)
      .fillColor(CERT_COLORS.deepTeal)
      .text('CERTIFICATE OF PARTICIPATION', 0, 108, {
        align: 'center',
        characterSpacing: 1.2,
      });

    const isCompleted = cert.tenure === 'completed';
    const tenureSubtitle = isCompleted
      ? 'IN RECOGNITION OF SUCCESSFUL COMPLETION'
      : 'OFFICIAL RECORD OF VERIFIED ACTIVE PARTICIPATION';

    doc
      .font('Helvetica-Bold')
      .fontSize(8.5)
      .fillColor(CERT_COLORS.teal)
      .text(tenureSubtitle, 0, 137, {
        align: 'center',
        characterSpacing: 1,
      });

    // ── 4. Recipient Presentation Block ─────────────────────────────────────
    doc
      .font('Times-Italic')
      .fontSize(11)
      .fillColor(CERT_COLORS.mutedCharcoal)
      .text('This is to certify that', 0, 158, { align: 'center' });

    // Student Name (Prominent)
    doc
      .font('Helvetica-Bold')
      .fontSize(22)
      .fillColor(CERT_COLORS.deepTeal)
      .text(cert.studentName.toUpperCase(), 0, 175, {
        align: 'center',
        characterSpacing: 0.8,
      });

    // Student Academic Snapshot Details
    const studentAcademicParts: string[] = [];
    if (cert.studentRollNumber) {
      studentAcademicParts.push(`Roll No: ${cert.studentRollNumber}`);
    }
    if (cert.studentDepartment) {
      studentAcademicParts.push(`Department of ${cert.studentDepartment}`);
    }
    if (cert.studentYear) {
      studentAcademicParts.push(`${cert.studentYear} Year`);
    }
    if (cert.studentSection) {
      studentAcademicParts.push(`Section ${cert.studentSection}`);
    }

    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor(CERT_COLORS.charcoal)
      .text(studentAcademicParts.join('  •  '), 0, 203, { align: 'center' });

    // ── 5. Activity Card / Description ──────────────────────────────────────
    const cardWidth = 710;
    const cardHeight = 132;
    const cardX = (width - cardWidth) / 2;
    const cardY = 224;

    doc
      .roundedRect(cardX, cardY, cardWidth, cardHeight, 8)
      .fillAndStroke(CERT_COLORS.lightTealTint, CERT_COLORS.teal);

    const categoryLabel = CATEGORY_LABELS[cert.category] || cert.category;
    const participationVerb = isCompleted
      ? 'has successfully completed verified participation in'
      : 'is actively participating in';

    doc
      .font('Helvetica')
      .fontSize(10.5)
      .fillColor(CERT_COLORS.charcoal)
      .text(participationVerb, cardX + 16, cardY + 14, {
        width: cardWidth - 32,
        align: 'center',
      });

    // Activity Title / Company Name
    doc
      .font('Helvetica-Bold')
      .fontSize(15)
      .fillColor(CERT_COLORS.deepTeal)
      .text(cert.titleOrCompany, cardX + 16, cardY + 31, {
        width: cardWidth - 32,
        align: 'center',
      });

    // Role or Position (if available)
    let currentCardY = cardY + 54;
    if (cert.roleOrPosition) {
      doc
        .font('Helvetica')
        .fontSize(10)
        .fillColor(CERT_COLORS.charcoal)
        .text(`Role / Position: ${cert.roleOrPosition}`, cardX + 16, currentCardY, {
          width: cardWidth - 32,
          align: 'center',
        });
      currentCardY += 16;
    }

    // Effective Duration & Category
    const startDateFormatted = formatDate(cert.effectiveStartDate);
    const endDateFormatted = formatDate(cert.effectiveEndDate);
    const durationText = isCompleted
      ? `Category: ${categoryLabel}    |    Effective Duration: ${startDateFormatted} — ${endDateFormatted}`
      : `Category: ${categoryLabel}    |    Active Tenure: From ${startDateFormatted} (Effective Record: ${endDateFormatted})`;

    doc
      .font('Helvetica')
      .fontSize(9.5)
      .fillColor(CERT_COLORS.mutedCharcoal)
      .text(durationText, cardX + 16, currentCardY, {
        width: cardWidth - 32,
        align: 'center',
      });

    // Distinguish completed vs active participation explicitly
    if (!isCompleted) {
      doc
        .font('Helvetica-Oblique')
        .fontSize(8.5)
        .fillColor(CERT_COLORS.teal)
        .text(
          `* Note: Active participant as of ${endDateFormatted}. Participation may be ongoing beyond this date.`,
          cardX + 16,
          currentCardY + 18,
          {
            width: cardWidth - 32,
            align: 'center',
          }
        );
    } else {
      doc
        .font('Helvetica-Oblique')
        .fontSize(8.5)
        .fillColor(CERT_COLORS.teal)
        .text(
          'Completed Tenure: The participant has satisfied all institutional requirements for this activity.',
          cardX + 16,
          currentCardY + 18,
          {
            width: cardWidth - 32,
            align: 'center',
          }
        );
    }

    // ── 6. Bottom Signatures & QR Verification Block ─────────────────────────
    const bottomY = 384;

    // LEFT: Issuing Authority / Coordinator Details
    const sigLineX = 56;
    const sigLineWidth = 210;

    doc
      .moveTo(sigLineX, bottomY + 70)
      .lineTo(sigLineX + sigLineWidth, bottomY + 70)
      .lineWidth(1)
      .strokeColor(CERT_COLORS.teal)
      .stroke();

    doc
      .font('Helvetica-Bold')
      .fontSize(11)
      .fillColor(CERT_COLORS.charcoal)
      .text(cert.issuedByName, sigLineX, bottomY + 76);

    const designation = cert.issuedByDesignation || 'Institutional Coordinator';
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(CERT_COLORS.mutedCharcoal)
      .text(`${designation}, Dept. of ${cert.issuedByDepartment}`, sigLineX, bottomY + 91);

    doc
      .font('Helvetica')
      .fontSize(8.5)
      .fillColor(CERT_COLORS.mutedCharcoal)
      .text(`Date of Issue: ${formatDate(cert.issuedAt)}`, sigLineX, bottomY + 105);

    // CENTER: Authenticated Seal Stamp
    const sealCenterX = width / 2;
    const sealCenterY = bottomY + 68;

    doc.save();
    doc
      .circle(sealCenterX, sealCenterY, 32)
      .lineWidth(1.5)
      .strokeColor(CERT_COLORS.teal)
      .stroke();

    doc
      .circle(sealCenterX, sealCenterY, 27)
      .lineWidth(0.75)
      .strokeColor(CERT_COLORS.deepTeal)
      .stroke();

    doc
      .font('Helvetica-Bold')
      .fontSize(7)
      .fillColor(CERT_COLORS.deepTeal)
      .text('ATTENDEASE', sealCenterX - 25, sealCenterY - 14, { width: 50, align: 'center' });

    doc
      .font('Helvetica-Bold')
      .fontSize(6)
      .fillColor(CERT_COLORS.teal)
      .text('AUTHENTICATED', sealCenterX - 25, sealCenterY - 3, { width: 50, align: 'center' });

    doc
      .font('Helvetica')
      .fontSize(5.5)
      .fillColor(CERT_COLORS.mutedCharcoal)
      .text('REGISTRY SEAL', sealCenterX - 25, sealCenterY + 7, { width: 50, align: 'center' });
    doc.restore();

    // RIGHT: QR Verification Block
    const qrSize = 64;
    const qrX = width - 56 - qrSize - 130;
    const qrY = bottomY + 44;

    doc.image(qrBuffer, qrX, qrY, { width: qrSize, height: qrSize });

    const qrTextX = qrX + qrSize + 10;
    doc
      .font('Helvetica-Bold')
      .fontSize(8.5)
      .fillColor(CERT_COLORS.deepTeal)
      .text('VERIFY CREDENTIAL', qrTextX, qrY + 4);

    doc
      .font('Helvetica')
      .fontSize(7)
      .fillColor(CERT_COLORS.mutedCharcoal)
      .text('Scan QR code to verify this', qrTextX, qrY + 18);

    doc
      .font('Helvetica')
      .fontSize(7)
      .fillColor(CERT_COLORS.mutedCharcoal)
      .text('certificate online securely.', qrTextX, qrY + 28);

    doc
      .font('Helvetica-Bold')
      .fontSize(7)
      .fillColor(CERT_COLORS.teal)
      .text(`Token: ${cert.verificationToken.slice(0, 10)}...`, qrTextX, qrY + 40);

    doc
      .font('Helvetica')
      .fontSize(6.5)
      .fillColor(CERT_COLORS.mutedCharcoal)
      .text('Tamper-Evident Institutional Record', qrTextX, qrY + 52);

    // ── 7. Revocation Notice / Watermark (if Revoked) ────────────────────────
    if (cert.revokedAt) {
      doc.save();

      // Top Alert Banner
      const revBannerHeight = 24;
      doc
        .rect(30, 26, width - 60, revBannerHeight)
        .fillAndStroke(CERT_COLORS.revokedBg, CERT_COLORS.revokedBorder);

      const revokedDateStr = formatDate(cert.revokedAt);
      const revNotice = `REVOKED — This certificate was revoked on ${revokedDateStr}. It is no longer valid. ${cert.revocationReason ? `Reason: ${cert.revocationReason}` : ''}`;

      doc
        .font('Helvetica-Bold')
        .fontSize(8.5)
        .fillColor(CERT_COLORS.revokedRed)
        .text(revNotice, 36, 33, {
          width: width - 72,
          align: 'center',
        });

      // Large diagonal watermark
      doc.rotate(-25, { origin: [width / 2, height / 2] });
      doc
        .font('Helvetica-Bold')
        .fontSize(64)
        .fillColor(CERT_COLORS.revokedRed)
        .opacity(0.18)
        .text('REVOKED', 0, height / 2 - 40, {
          align: 'center',
          width: width,
        });

      doc.restore();
    }

    doc.end();
  });
}
