/**
 * import.service.ts
 *
 * Orchestrates the bulk Excel/CSV import pipeline:
 *   1. Direct parsing for CSV (fast, resilient) + ExcelJS for XLSX
 *   2. Smart column matching and derivation
 *   3. Batch-insert all valid rows directly into PostgreSQL
 *   4. Return a detailed ImportReport
 */
import ExcelJS from 'exceljs';
import { prisma } from '../../db/prisma.js';
import { mapRowToFields, validateImportRow } from '../validators/import.validator.js';
import { toCanonicalSection } from '../../constants/canonicalSections.js';
import type { ImportReport, ImportRowError, RawExcelRow } from '../types/import.types.js';

function toUserId(rollNumber: string): string {
  return `stu-${rollNumber}`;
}

function normaliseCellValue(
  raw: ExcelJS.CellValue,
): string | number | boolean | null | undefined {
  if (raw === null || raw === undefined) return raw;
  if (typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean') {
    return raw;
  }
  if (typeof raw === 'object' && 'text' in (raw as object)) {
    return String((raw as { text: unknown }).text);
  }
  return String(raw);
}

/** Simple, robust CSV line splitter that handles quotes */
function parseCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

export async function importStudentsFromBuffer(buffer: Buffer): Promise<ImportReport> {
  const dataRows: Array<{ rowIndex: number; raw: RawExcelRow }> = [];
  const failedRows: ImportRowError[] = [];
  const skippedRows: ImportRowError[] = [];

  const isZip = buffer.length >= 2 && buffer[0] === 0x50 && buffer[1] === 0x4b; // 'PK'

  if (!isZip) {
    // ── Parse Plain CSV Text ─────────────────────────────────────────────────
    const text = buffer.toString('utf-8').replace(/^\uFEFF/, ''); // strip BOM
    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);

    if (lines.length === 0) {
      return { inserted: 0, skipped: 0, upserted: 0, failed: [{ row: 0, reason: 'The CSV file is empty.' }] };
    }

    // Detect delimiter: comma, semicolon, or tab
    const firstLine = lines[0] || '';
    const commaCount = (firstLine.match(/,/g) || []).length;
    const semiCount = (firstLine.match(/;/g) || []).length;
    const tabCount = (firstLine.match(/\t/g) || []).length;
    const delimiter = (semiCount > commaCount && semiCount > tabCount) ? ';' : (tabCount > commaCount ? '\t' : ',');

    const headers = parseCsvLine(firstLine, delimiter).map(h => h.replace(/^["']|["']$/g, '').trim());

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line || !line.trim()) continue;
      const values = parseCsvLine(line, delimiter).map(v => v.replace(/^["']|["']$/g, '').trim());
      const rawRow: RawExcelRow = {};

      headers.forEach((header, colIdx) => {
        if (header) {
          rawRow[header] = values[colIdx] ?? '';
        }
      });

      const hasValue = Object.values(rawRow).some(v => v !== null && v !== undefined && String(v).trim() !== '');
      if (hasValue) {
        dataRows.push({ rowIndex: i + 1, raw: rawRow });
      }
    }
  } else {
    // ── Parse XLSX via ExcelJS ───────────────────────────────────────────────
    try {
      const workbook = new ExcelJS.Workbook();
      const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
      await workbook.xlsx.load(arrayBuffer as ArrayBuffer);

      const worksheet = workbook.worksheets[0];
      if (!worksheet) {
        return { inserted: 0, skipped: 0, upserted: 0, failed: [{ row: 0, reason: 'The uploaded file contains no worksheets.' }] };
      }

      const headerRow = worksheet.getRow(1);
      const headers: string[] = [];
      headerRow.eachCell({ includeEmpty: true }, (cell, colIndex) => {
        headers[colIndex] = String(cell.value ?? '').trim();
      });

      worksheet.eachRow({ includeEmpty: false }, (row, rowIndex) => {
        if (rowIndex === 1) return;
        const rawRow: RawExcelRow = {};
        row.eachCell({ includeEmpty: true }, (cell, colIndex) => {
          const header = headers[colIndex];
          if (header) {
            rawRow[header] = normaliseCellValue(cell.value);
          }
        });
        const hasAnyValue = Object.values(rawRow).some(v => v !== null && v !== undefined && v !== '');
        if (hasAnyValue) {
          dataRows.push({ rowIndex, raw: rawRow });
        }
      });
    } catch (err: any) {
      return { inserted: 0, skipped: 0, upserted: 0, failed: [{ row: 0, reason: `Excel parse error: ${err.message}` }] };
    }
  }

  if (dataRows.length === 0) {
    return { inserted: 0, skipped: 0, upserted: 0, failed: [{ row: 0, reason: 'No student data rows found in the uploaded file.' }] };
  }

  // ── Step 2: Validate & Map ────────────────────────────────────────────────
  const validUsers: Array<{
    userId: string;
    name: string;
    email: string;
    role: 'student' | 'faculty' | 'hod' | 'admin';
    department: string;
    rollNumber?: string;
    year?: string;
    section?: string;
    semester?: number;
    password: string;
    avatarUrl?: string;
    phone?: string;
    isActive: boolean;
  }> = [];

  for (const { rowIndex, raw } of dataRows) {
    const mapped = mapRowToFields(raw);
    const result = validateImportRow(mapped);

    if (!result.ok) {
      failedRows.push({ row: rowIndex, rollNumber: String(mapped['rollNumber'] ?? ''), reason: result.error });
      continue;
    }

    const s = result.data;
    const roll = s.rollNumber.toUpperCase().trim();
    const role = (s.role as 'student' | 'faculty' | 'hod' | 'admin') || 'student';
    const password = role === 'student' ? roll : '1234';

    // Standardize section to canonical ID ('CSIT-A' | 'CSIT-B' | 'CSD') for student accounts
    const canonicalSec = role === 'student'
      ? (toCanonicalSection(s.department, s.section) || (s.department?.includes('CSD') ? 'CSD' : 'CSIT-A'))
      : (s.section || undefined);

    validUsers.push({
      userId: toUserId(roll),
      name: s.name,
      email: s.email,
      role: role,
      department: s.department,
      rollNumber: roll,
      year: s.year || (role === 'student' ? '3rd Year' : undefined),
      section: canonicalSec,
      semester: s.semester || (role === 'student' ? 6 : undefined),
      password: password,
      avatarUrl: s.avatarUrl || (role === 'student' ? `https://srkrexams.in/SRKR/photo/${roll}.jpg` : undefined),
      phone: s.phone,
      isActive: true,
    });
  }

  // ── Step 3: Upsert directly into PostgreSQL (preserve existing passwords) ──
  let insertedCount = 0;
  let updatedCount = 0;

  const upsertPromises = validUsers.map(async (u, idx) => {
    try {
      const existing = await prisma.user.findFirst({
        where: {
          OR: [
            ...(u.rollNumber ? [{ rollNumber: u.rollNumber }] : []),
            { userId: u.userId },
            { email: u.email },
          ],
        },
      });

      if (existing) {
        // Update student/user details while preserving their existing password
        await prisma.user.update({
          where: { id: existing.id },
          data: {
            name: u.name,
            department: u.department,
            ...(u.year ? { year: u.year } : {}),
            ...(u.section ? { section: u.section } : {}),
            ...(u.semester ? { semester: u.semester } : {}),
            ...(u.role ? { role: u.role } : {}),
            ...(u.avatarUrl ? { avatarUrl: u.avatarUrl } : {}),
          },
        });
        updatedCount++;
      } else {
        // Insert new student/user
        await prisma.user.create({
          data: u,
        });
        insertedCount++;
      }
    } catch (err: any) {
      failedRows.push({
        row: idx + 2,
        rollNumber: u.rollNumber,
        reason: err.message || 'Database error during import',
      });
    }
  });

  await Promise.all(upsertPromises);

  return {
    inserted: insertedCount,
    skipped: 0,
    upserted: updatedCount,
    failed: failedRows,
  };
}
