import { Router } from 'express';
import type { Request, Response } from 'express';
import { verifyToken } from '../middleware/auth.js';
import { prisma } from '../db/prisma.js';
import { normalizeToCanonicalSection } from '../constants/canonicalSections.js';

const router = Router();

function formatUserResponse(user: {
  userId: string; email: string; role: string; name: string;
  department: string; designation?: string | null; rollNumber?: string | null;
  semester?: number | null; avatarUrl?: string | null; phone?: string | null;
  counselorId?: string | null; year?: string | null; section?: string | null;
}) {
  return {
    id:          user.userId,
    email:       user.email,
    role:        user.role,
    name:        user.name,
    department:  user.department,
    ...(user.designation && { designation: user.designation }),
    ...(user.rollNumber  && { rollNumber:  user.rollNumber  }),
    ...(user.semester    && { semester:    user.semester    }),
    ...(user.year        && { year:        user.year        }),
    ...(user.section     && { section:     user.section     }),
    ...(user.avatarUrl   && { avatarUrl:   user.avatarUrl   }),
    ...(user.phone       && { phone:       user.phone       }),
    ...(user.counselorId && { counselorId: user.counselorId }),
    ...(user.studentActivities && {
      studentActivities: user.studentActivities,
      hasActivities: user.studentActivities.length > 0,
    }),
  };
}

/**
 * GET /api/users/counselees
 * Returns counseling students assigned to the currently logged in faculty member,
 * along with their attendance percentage analytics calculated from database records.
 */
router.get('/counselees', verifyToken, async (req: Request, res: Response) => {
  try {
    const facultyUserId = req.user!.id;
    const counselees = await (prisma.user as any).findMany({
      where: {
        role: 'student',
        counselorId: facultyUserId,
      },
      orderBy: { rollNumber: 'asc' },
    });

    if (counselees.length === 0) {
      res.json({ counselees: [] });
      return;
    }

    // Collect all roll numbers and user IDs for batch querying
    const studentUserIds = counselees.map((s: any) => s.userId);
    const rollNumbers = counselees.map((s: any) => s.rollNumber || s.userId).filter(Boolean) as string[];
    const rollSuffixes = rollNumbers.map(r => r.length > 2 ? r.slice(-2) : r);
    const allRollTargets = Array.from(new Set([...rollNumbers, ...rollSuffixes]));

    // Batch fetch attendance records and approved permissions
    const [allRecords, approvedRequests] = await Promise.all([
      (prisma as any).attendanceRecord ? (prisma as any).attendanceRecord.findMany({
        where: { rollNumber: { in: allRollTargets } },
      }) : Promise.resolve([]),
      (prisma as any).request ? (prisma as any).request.findMany({
        where: {
          studentId: { in: studentUserIds },
          status: 'approved',
        },
        select: { studentId: true },
      }) : Promise.resolve([]),
    ]);

    // Group records by roll
    const recordsByRoll = new Map<string, any[]>();
    allRecords.forEach((r: any) => {
      const key = r.rollNumber;
      if (!recordsByRoll.has(key)) recordsByRoll.set(key, []);
      recordsByRoll.get(key)!.push(r);
    });

    // Group approved requests by studentId
    const approvedCountByStudent = new Map<string, number>();
    approvedRequests.forEach((req: any) => {
      const cur = approvedCountByStudent.get(req.studentId) || 0;
      approvedCountByStudent.set(req.studentId, cur + 1);
    });

    // Compute stats for each counselee in-memory
    const counseleesWithStats = counselees.map((student: any) => {
      const roll = student.rollNumber || student.userId;
      const suffix = roll.length > 2 ? roll.slice(-2) : roll;

      const fullRecords = recordsByRoll.get(roll) || [];
      const suffixRecords = roll !== suffix ? (recordsByRoll.get(suffix) || []) : [];
      
      // Combine unique record IDs
      const recordMap = new Map<string, typeof fullRecords[0]>();
      [...fullRecords, ...suffixRecords].forEach(rec => recordMap.set(rec.id, rec));
      const studentRecords = Array.from(recordMap.values());

      const conductedCount = studentRecords.length;
      const presentCount = studentRecords.filter(r => r.status === 'present').length;
      const approvedPermissionsCount = approvedCountByStudent.get(student.userId) || 0;

      const effectivePresent = presentCount + approvedPermissionsCount;
      const percentage = conductedCount > 0
        ? Math.min(100, Math.round((effectivePresent / conductedCount) * 100))
        : 85;

      return {
        ...formatUserResponse(student),
        stats: {
          conductedCount,
          presentCount,
          approvedPermissionsCount,
          absentCount: conductedCount - presentCount,
          percentage,
        },
      };
    });

    res.json({ counselees: counseleesWithStats });
  } catch (err) {
    console.error('GET /users/counselees error:', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

/**
 * POST /api/users/counselee-attendance
 * Allows a mentor/faculty to manually enter/update attendance for an assigned counselee.
 */
router.post('/counselee-attendance', verifyToken, async (req: Request, res: Response) => {
  try {
    const facultyUserId = req.user!.id;
    const { studentId, conductedCount, presentCount, percentage } = req.body as {
      studentId: string;
      conductedCount?: number;
      presentCount?: number;
      percentage?: number;
    };

    if (!studentId) {
      res.status(400).json({ error: 'studentId is required' });
      return;
    }

    const student = await prisma.user.findFirst({
      where: {
        OR: [
          { userId: studentId },
          { id: studentId },
          { rollNumber: studentId },
        ],
      },
    });

    if (!student) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }

    const roll = student.rollNumber || student.userId;

    // Determine target conducted and present counts
    let targetConducted = typeof conductedCount === 'number' ? Math.max(1, conductedCount) : 100;
    let targetPresent = typeof presentCount === 'number' ? Math.max(0, Math.min(targetConducted, presentCount)) : 85;

    if (typeof percentage === 'number' && typeof conductedCount !== 'number' && typeof presentCount !== 'number') {
      const clampedPct = Math.max(0, Math.min(100, percentage));
      targetConducted = 100;
      targetPresent = Math.round((clampedPct / 100) * targetConducted);
    }

    // Upsert a counseling attendance submission for this student by this faculty
    const submissionKey = {
      date: '2026-01-01',
      section: `COUNSELING-${student.userId}`,
      periods: '1',
    };

    const submission = await (prisma as any).attendanceSubmission.upsert({
      where: {
        date_section_periods: submissionKey,
      },
      update: {
        markedById: facultyUserId,
        year: student.year || '3rd Year',
      },
      create: {
        ...submissionKey,
        year: student.year || '3rd Year',
        periodLabel: 'Counseling Attendance Entry',
        markedById: facultyUserId,
      },
    });

    // Delete existing records for this submission
    await (prisma as any).attendanceRecord.deleteMany({
      where: { submissionId: submission.id },
    });

    // Create present records and absent records
    const recordsToCreate = [];
    for (let i = 1; i <= targetPresent; i++) {
      recordsToCreate.push({
        submissionId: submission.id,
        rollNumber: roll,
        status: 'present',
      });
    }
    const targetAbsent = targetConducted - targetPresent;
    for (let i = 1; i <= targetAbsent; i++) {
      recordsToCreate.push({
        submissionId: submission.id,
        rollNumber: roll,
        status: 'absent',
      });
    }

    if (recordsToCreate.length > 0) {
      await (prisma as any).attendanceRecord.createMany({
        data: recordsToCreate,
      });
    }

    const calcPct = targetConducted > 0 ? Math.round((targetPresent / targetConducted) * 100) : 100;

    res.json({
      success: true,
      message: `Updated attendance for ${student.name} (${roll}) to ${calcPct}%`,
      stats: {
        conductedCount: targetConducted,
        presentCount: targetPresent,
        absentCount: targetAbsent,
        percentage: calcPct,
      },
    });
  } catch (err) {
    console.error('POST /users/counselee-attendance error:', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

/**
 * GET /api/users/faculty
 * Returns all faculty members — visible to both HODs and Admin.
 */
router.get('/faculty', verifyToken, async (_req: Request, res: Response) => {
  try {
    const docs = await prisma.user.findMany({
      where: {
        role: { in: ['faculty', 'hod'] },
        isActive: true,
      },
      orderBy: { name: 'asc' },
    });
    res.json({ faculty: docs.map(formatUserResponse) });
  } catch (err) {
    console.error('GET /users/faculty error:', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

/**
 * GET /api/users/students
 * Returns all students with derived section and year — used by HOD Direct Exemption Modal.
 */
router.get('/students', verifyToken, async (_req: Request, res: Response) => {
  try {
    const students = await prisma.user.findMany({
      where: { role: 'student' },
      orderBy: { rollNumber: 'asc' },
    });

    const formatted = students.map((s: any) => {
      const roll = s.rollNumber || s.userId;
      const canonicalSec = normalizeToCanonicalSection(s.department, s.section);
      const sem = s.semester || 6;
      const derivedYear = `${Math.ceil(sem / 2)}th Year`;

      return {
        id:         s.userId,
        name:       s.name,
        email:      s.email,
        rollNumber: roll,
        department: s.department || 'Computer Science',
        semester:   sem,
        year:       s.year || derivedYear,
        section:    canonicalSec || (s.department?.includes('CSD') ? 'CSD' : 'CSIT-A'),
        avatarUrl:  s.avatarUrl ?? undefined,
      };
    });

    res.json({ students: formatted });
  } catch (err) {
    console.error('GET /users/students error:', err);
    res.status(500).json({ error: 'Internal error' });
  }
});


/**
 * GET /api/users/counseling/all
 * Returns all faculty members along with their assigned counseling students.
 */
router.get('/counseling/all', verifyToken, async (_req: Request, res: Response) => {
  try {
    const facultyList = await (prisma.user as any).findMany({
      where: { role: { in: ['faculty', 'hod'] } },
      include: {
        counselees: {
          select: {
            id: true,
            userId: true,
            name: true,
            email: true,
            rollNumber: true,
            department: true,
            semester: true,
            year: true,
            section: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    const unassignedStudents = await (prisma.user as any).findMany({
      where: {
        role: 'student',
        counselorId: null,
      },
      select: {
        id: true,
        userId: true,
        name: true,
        email: true,
        rollNumber: true,
        department: true,
        semester: true,
        year: true,
        section: true,
        avatarUrl: true,
      },
      orderBy: { rollNumber: 'asc' },
    });

    res.json({
      facultyCounselors: facultyList.map((f: any) => ({
        ...formatUserResponse(f),
        counselees: (f.counselees || []).map((s: any) => ({
          id: s.userId,
          name: s.name,
          email: s.email,
          rollNumber: s.rollNumber ?? s.userId,
          department: s.department,
          semester: s.semester ?? undefined,
          year: s.year ?? undefined,
          section: s.section ?? undefined,
          avatarUrl: s.avatarUrl ?? undefined,
        })),
      })),
      unassignedStudents: unassignedStudents.map((s: any) => ({
        id: s.userId,
        name: s.name,
        email: s.email,
        rollNumber: s.rollNumber ?? s.userId,
        department: s.department,
        semester: s.semester ?? undefined,
        year: s.year ?? undefined,
        section: s.section ?? undefined,
        avatarUrl: s.avatarUrl ?? undefined,
      })),
    });
  } catch (err) {
    console.error('GET /users/counseling/all error:', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

/**
 * POST /api/users/counseling/assign
 * Bulk assigns students to a faculty counselor.
 */
router.post('/counseling/assign', verifyToken, async (req: Request, res: Response) => {
  try {
    const { facultyId, studentIds } = req.body as { facultyId: string; studentIds: string[] };

    if (!facultyId || !Array.isArray(studentIds) || studentIds.length === 0) {
      res.status(400).json({ error: 'facultyId and non-empty studentIds array are required' });
      return;
    }

    // Verify faculty exists
    const faculty = await prisma.user.findFirst({
      where: { OR: [{ userId: facultyId }, { id: facultyId }] },
    });

    if (!faculty) {
      res.status(404).json({ error: 'Faculty member not found' });
      return;
    }

    // Expand identifiers
    const targets = new Set<string>();
    studentIds.forEach(id => {
      if (!id) return;
      const clean = String(id).trim();
      targets.add(clean);
      if (clean.startsWith('stu-')) {
        targets.add(clean.replace(/^stu-/, ''));
      } else {
        targets.add(`stu-${clean}`);
      }
    });

    const targetList = Array.from(targets);

    // Assign counselorId to students
    const updated = await (prisma.user as any).updateMany({
      where: {
        role: 'student',
        OR: [
          { userId: { in: targetList } },
          { id: { in: targetList } },
          { rollNumber: { in: targetList } },
        ],
      },
      data: { counselorId: faculty.userId },
    });

    res.json({
      success: true,
      message: `Assigned ${updated.count} student(s) to ${faculty.name}`,
      count: updated.count,
    });
  } catch (err) {
    console.error('POST /users/counseling/assign error:', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

/**
 * POST /api/users/counseling/unassign
 * Unassigns one or multiple students from their counselor.
 */
router.post('/counseling/unassign', verifyToken, async (req: Request, res: Response) => {
  try {
    const { studentId, studentIds, facultyId, unassignAll } = req.body as {
      studentId?: string;
      studentIds?: string[];
      facultyId?: string;
      unassignAll?: boolean;
    };

    // 1. Bulk unassign all counselees for a faculty
    if (unassignAll && facultyId) {
      const faculty = await prisma.user.findFirst({
        where: { OR: [{ userId: facultyId }, { id: facultyId }] },
      });
      const targetCounselorId = faculty ? faculty.userId : facultyId;
      const result = await (prisma.user as any).updateMany({
        where: { counselorId: targetCounselorId },
        data: { counselorId: null },
      });
      res.json({ success: true, message: `Unassigned all ${result.count} student(s) from counselor`, count: result.count });
      return;
    }

    // 2. Unassign specific student(s)
    const idsToUnassign = (studentIds && Array.isArray(studentIds) && studentIds.length > 0)
      ? studentIds
      : (studentId ? [studentId] : []);

    if (idsToUnassign.length === 0) {
      res.status(400).json({ error: 'studentId or studentIds array is required' });
      return;
    }

    const targets = new Set<string>();
    idsToUnassign.forEach(id => {
      if (!id) return;
      const clean = String(id).trim();
      targets.add(clean);
      if (clean.startsWith('stu-')) {
        targets.add(clean.replace(/^stu-/, ''));
      } else {
        targets.add(`stu-${clean}`);
      }
    });

    const targetList = Array.from(targets);

    const result = await (prisma.user as any).updateMany({
      where: {
        OR: [
          { userId: { in: targetList } },
          { id: { in: targetList } },
          { rollNumber: { in: targetList } },
        ],
      },
      data: { counselorId: null },
    });

    res.json({ success: true, message: `Unassigned ${result.count} student(s) successfully`, count: result.count });
  } catch (err) {
    console.error('POST /users/counseling/unassign error:', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

/**
 * GET /api/users/me
 * Returns current user profile from PostgreSQL.
 */
router.get('/me', verifyToken, async (req: Request, res: Response) => {
  try {
    const tokenUser = req.user!;
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { id:     tokenUser.id },
          { userId: tokenUser.id },
          { email:  { equals: tokenUser.email, mode: 'insensitive' } },
        ],
      },
      include: {
        studentActivities: {
          where: { isActive: true },
        },
      },
    });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json({ user: formatUserResponse(user) });
  } catch (err) {
    console.error('GET /users/me error:', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

/**
 * PUT /api/users/me
 * Updates current user personal info.
 */
router.put('/me', verifyToken, async (req: Request, res: Response) => {
  try {
    const tokenUser = req.user!;
    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { id: tokenUser.id },
          { userId: tokenUser.id },
          { email: { equals: tokenUser.email, mode: 'insensitive' } },
        ],
      },
    });
    if (!existing) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const { name, email, phone, avatarUrl, semester, designation, password, currentPassword } = req.body;

    // Handle password change validation
    if (password && String(password).trim().length > 0) {
      if (currentPassword) {
        const cur = String(currentPassword).trim();
        const dbPwd = String(existing.password).trim();
        if (dbPwd !== cur && dbPwd.toLowerCase() !== cur.toLowerCase()) {
          res.status(400).json({ error: 'Current password does not match' });
          return;
        }
      }
    }

    // Validate email uniqueness if changing email
    let cleanEmail: string | undefined = undefined;
    if (email !== undefined && String(email).trim().length > 0) {
      cleanEmail = String(email).trim().toLowerCase();
      if (cleanEmail !== existing.email.toLowerCase()) {
        const emailTaken = await prisma.user.findFirst({
          where: {
            email: { equals: cleanEmail, mode: 'insensitive' },
            id: { not: existing.id },
          },
        });
        if (emailTaken) {
          res.status(400).json({ error: 'Email is already in use by another account' });
          return;
        }
      }
    }

    const updated = await prisma.user.update({
      where: { id: existing.id },
      data: {
        ...(name !== undefined && { name: String(name).trim() }),
        ...(cleanEmail !== undefined && { email: cleanEmail }),
        ...(phone !== undefined && { phone: phone ? String(phone).trim() : null }),
        ...(avatarUrl !== undefined && { avatarUrl: avatarUrl ? String(avatarUrl).trim() : null }),
        ...(semester !== undefined && !isNaN(Number(semester)) && { semester: Number(semester) }),
        ...(designation !== undefined && { designation: designation ? String(designation).trim() : null }),
        ...(password !== undefined && String(password).trim().length > 0 && { password: String(password).trim() }),
      },
    });

    res.json({ user: formatUserResponse(updated) });
  } catch (err) {
    console.error('PUT /users/me error:', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

/**
 * GET /api/users/proxy-image
 * Proxies remote images (e.g. SRKR exam portal, Cloudinary) to avoid CORS in Excel export
 */
router.get('/proxy-image', async (req: Request, res: Response) => {
  try {
    const imageUrl = req.query.url as string;
    if (!imageUrl) {
      res.status(400).send('Image URL required');
      return;
    }
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      },
    });
    if (!response.ok) {
      res.status(response.status).send('Failed to fetch remote image');
      return;
    }
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const buffer = Buffer.from(await response.arrayBuffer());
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(buffer);
  } catch (err: any) {
    console.error('Proxy image error:', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

export default router;
