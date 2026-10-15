import { Router } from 'express';
import type { Request, Response } from 'express';
import crypto from 'crypto';
import { verifyToken } from '../middleware/auth.js';
import { prisma } from '../db/prisma.js';
import { generateShareToken } from '../utils/shareToken.js';
import type { RequestReason } from '../types.js';
import type { Prisma, RequestStatus } from '@prisma/client';
import {
  isStudentOwnerOfRequest,
  isFacultyAuthorizedForRequest,
  isHodAuthorizedForRequest,
  isAdminAuthorizedForRequest,
} from '../services/requestAuth.js';
import { sendRequestDecisionEmail } from '../services/emailService.js';
import { sendWhatsAppDecisionNotification } from '../services/whatsappService.js';
import { getCanonicalRosterForYear } from '../services/rosterService.js';

const router = Router();

// Helper to extract roll suffix in backend
function extractRollSuffixBackend(rawRoll: string): string {
  if (!rawRoll) return '';
  const str = rawRoll.trim().toUpperCase();

  const leMatch = str.match(/LE0*([1-9]|1[0-2])$/i);
  if (leMatch) {
    return `LE${parseInt(leMatch[1], 10)}`;
  }

  if (str.includes('95A')) {
    const numMatch = str.match(/(\d{1,2})$/);
    if (numMatch) {
      const num = parseInt(numMatch[1], 10);
      if (num >= 1 && num <= 20) {
        return `LE${num}`;
      }
    }
  }

  const suffixMatch = str.match(/([A-D][0-9]|[0-9]{1,2})$/i);
  if (suffixMatch) {
    const val = suffixMatch[1];
    if (/^\d+$/.test(val)) {
      return String(parseInt(val, 10));
    }
    return val;
  }
  return str;
}

function sortRolls(rolls: string[]): string[] {
  return [...rolls].sort((a, b) => {
    const isNumA = /^\d+$/.test(a);
    const isNumB = /^\d+$/.test(b);
    if (isNumA && isNumB) return parseInt(a, 10) - parseInt(b, 10);
    if (isNumA) return -1;
    if (isNumB) return 1;

    const isLeA = /^LE\d+$/i.test(a);
    const isLeB = /^LE\d+$/i.test(b);
    if (isLeA && isLeB) {
      const numA = parseInt(a.replace(/LE/i, ''), 10);
      const numB = parseInt(b.replace(/LE/i, ''), 10);
      return numA - numB;
    }
    if (isLeA) return 1;
    if (isLeB) return -1;

    return a.localeCompare(b, undefined, { numeric: true });
  });
}

// Public endpoint for canonical sections and section-wise student rosters from database
const handlePublicSections = async (req: Request, res: Response) => {
  try {
    const { year } = req.query;
    const rosterData = await getCanonicalRosterForYear(typeof year === 'string' ? year : undefined);
    res.json({
      year: rosterData.year,
      sections: rosterData.sections,
    });
  } catch (error) {
    console.error('Error fetching public sections:', error);
    res.status(500).json({ error: 'Internal error' });
  }
};

router.get('/public-sections', handlePublicSections);
router.get('/students/roster', handlePublicSections);

// Public endpoint for permissions page viewer & attendance pre-highlighting
router.get('/public-approved', async (req: Request, res: Response) => {
  try {
    const { date } = req.query;

    const where: Prisma.RequestWhereInput = {
      status: 'approved',
    };

    if (date && typeof date === 'string' && date.trim()) {
      const targetDate = date.trim().slice(0, 10);
      where.OR = [
        { date: { startsWith: targetDate } },
        {
          AND: [
            { date: { lte: targetDate } },
            { endDate: { gte: targetDate } },
          ],
        },
      ];
    }

    const requests = await prisma.request.findMany({
      where,
      include: REQUEST_INCLUDE,
      orderBy: { date: 'desc' },
    });

    const mapped = requests.map(toApi);
    res.json({ requests: mapped });
  } catch (error) {
    console.error('Error fetching public approved requests:', error);
    res.status(500).json({ error: 'Internal error' });
  }
});

/**
 * POST /api/requests/upload-proof
 * Accepts base64 encoded file payload and uploads to Cloudinary.
 * Returns { url: string, documentName: string }
 */
router.post('/upload-proof', async (req: Request, res: Response) => {
  try {
    const { file, filename } = req.body as { file?: string; filename?: string };

    if (!file) {
      res.status(400).json({ error: 'File payload is required' });
      return;
    }

    let cloudName = process.env['CLOUDINARY_CLOUD_NAME'] || 'yp5l3jrg';
    let apiKey = process.env['CLOUDINARY_API_KEY'] || '926915746443411';
    let apiSecret = process.env['CLOUDINARY_API_SECRET'] || 'pFUsk-t924l6n3Wh2abEbVfER0U';
    const uploadPreset = process.env['CLOUDINARY_UPLOAD_PRESET'] || 'attendease_proofs';

    const cloudinaryUrl = process.env['CLOUDINARY_URL'];
    if (cloudinaryUrl && cloudinaryUrl.startsWith('cloudinary://')) {
      try {
        const match = cloudinaryUrl.match(/^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/);
        if (match) {
          apiKey = match[1];
          apiSecret = match[2];
          cloudName = match[3];
        }
      } catch (err) {
        console.warn('Could not parse CLOUDINARY_URL:', err);
      }
    }

    let uploadedUrl = '';

    // If Cloudinary credentials are provided, use signed upload
    if (apiKey && apiSecret) {
      try {
        const timestamp = Math.floor(Date.now() / 1000);
        const strToSign = `timestamp=${timestamp}${apiSecret}`;
        const signature = crypto.createHash('sha1').update(strToSign).digest('hex');

        const params = new URLSearchParams();
        params.append('file', file);
        params.append('timestamp', String(timestamp));
        params.append('api_key', apiKey);
        params.append('signature', signature);

        const cloudRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
          method: 'POST',
          body: params,
        });

        if (cloudRes.ok) {
          const data = await cloudRes.json();
          uploadedUrl = data.secure_url || data.url;
        }
      } catch (cErr) {
        console.warn('Signed Cloudinary upload failed, trying unsigned:', cErr);
      }
    }

    // Direct / unsigned Cloudinary upload attempt
    if (!uploadedUrl) {
      try {
        const params = new URLSearchParams();
        params.append('file', file);
        params.append('upload_preset', uploadPreset);

        const cloudRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
          method: 'POST',
          body: params,
        });

        if (cloudRes.ok) {
          const data = await cloudRes.json();
          uploadedUrl = data.secure_url || data.url;
        } else {
          // Try standard unsigned preset fallback
          const paramsMl = new URLSearchParams();
          paramsMl.append('file', file);
          paramsMl.append('upload_preset', 'ml_default');

          const cloudResMl = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
            method: 'POST',
            body: paramsMl,
          });
          if (cloudResMl.ok) {
            const data = await cloudResMl.json();
            uploadedUrl = data.secure_url || data.url;
          }
        }
      } catch (uErr) {
        console.warn('Unsigned Cloudinary upload attempt failed:', uErr);
      }
    }

    // Fail-safe URL fallback to preserve proof link functionality
    if (!uploadedUrl) {
      uploadedUrl = file;
    }

    res.json({
      url: uploadedUrl,
      documentName: filename || 'uploaded_proof_document.pdf',
    });
  } catch (err: any) {
    console.error('Upload proof error:', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

// All other routes require a valid JWT
router.use(verifyToken);

const REASON_LABELS: Record<RequestReason, string> = {
  internship:          'Internship',
  startup:             'Startup Work',
  project_development: 'Project Development',
  medical:             'Medical Leave',
  sports:              'Sports Event',
  family_emergency:    'Family Emergency',
  competition:         'Competition',
  other:               'Other',
};

// Shared include for all request queries including actions audit trail
const REQUEST_INCLUDE = {
  student: {
    include: {
      studentActivities: {
        where: { isActive: true },
        select: {
          id: true,
          category: true,
          titleOrCompany: true,
          roleOrPosition: true,
          status: true,
          isActive: true,
        },
      },
    },
  },
  primaryFaculty: true,
  faculties:      { include: { faculty: true } },
  actions:        { include: { performedBy: true }, orderBy: { performedAt: 'asc' as const } },
  shareLinks:     { where: { isActive: true }, orderBy: { createdAt: 'desc' as const }, take: 1 },
} as const;

// Lightweight include for table/list views (omits heavy audit logs actions)
const REQUEST_LIST_INCLUDE = {
  student: {
    include: {
      studentActivities: {
        where: { isActive: true },
        select: {
          id: true,
          category: true,
          titleOrCompany: true,
          roleOrPosition: true,
          status: true,
          isActive: true,
        },
      },
    },
  },
  primaryFaculty: true,
  faculties:      { include: { faculty: true } },
  shareLinks:     { where: { isActive: true }, orderBy: { createdAt: 'desc' as const }, take: 1 },
} as const;

/** Convert a Prisma request row (with relations) to the frontend API shape */
function toApi(r: any) {
  const student = r.student;
  const faculty = r.primaryFaculty;
  const allFacultyRows = r.faculties ? r.faculties.map((rf: any) => rf.faculty) : [];
  const fallbackRoll = r.studentId?.startsWith('stu-') ? r.studentId.replace('stu-', '').toUpperCase() : (r.studentId || 'STUDENT');

  const activeActivities = student?.studentActivities?.filter((a: any) => a.isActive !== false) || [];
  const hasActivities = activeActivities.length > 0;

  const studentObj = student ? {
    id:          student.userId,
    name:        student.name,
    rollNumber:  student.rollNumber ?? fallbackRoll,
    department:  student.department ?? 'CSIT',
    year:        student.year       ?? undefined,
    section:     student.section    ?? undefined,
    semester:    student.semester   ?? 1,
    email:       student.email,
    avatarUrl:   student.avatarUrl  || (student.rollNumber ? `https://srkrexams.in/SRKR/photo/${student.rollNumber.toUpperCase()}.jpg` : (fallbackRoll ? `https://srkrexams.in/SRKR/photo/${fallbackRoll.toUpperCase()}.jpg` : undefined)),
    hasActivities,
    studentActivities: activeActivities.map((a: any) => ({
      id: a.id,
      category: a.category,
      titleOrCompany: a.titleOrCompany,
      roleOrPosition: a.roleOrPosition,
      status: a.status,
    })),
  } : {
    id:          r.studentId || 'stu-unknown',
    name:        r.studentName || fallbackRoll,
    rollNumber:  fallbackRoll,
    department:  'CSIT',
    year:        undefined,
    semester:    1,
    email:       `${fallbackRoll.toLowerCase()}@srkrec.ac.in`,
    avatarUrl:   fallbackRoll ? `https://srkrexams.in/SRKR/photo/${fallbackRoll.toUpperCase()}.jpg` : undefined,
    hasActivities: false,
    studentActivities: [],
  };

  const facultyObj = faculty ? {
    id:          faculty.userId,
    name:        faculty.name,
    department:  faculty.department,
    email:       faculty.email,
    avatarUrl:   faculty.avatarUrl  ?? undefined,
  } : {
    id:          r.primaryFacultyId || 'fac-001',
    name:        'Department Faculty',
    department:  'CSIT',
    email:       'faculty@srkrec.ac.in',
    avatarUrl:   undefined,
  };

  const activeShareLink = r.shareLinks && r.shareLinks.length > 0 ? r.shareLinks[0] : null;
  const shareToken = activeShareLink ? activeShareLink.token : undefined;
  const shareUrl = shareToken ? `/r/${shareToken}` : undefined;

  const base = {
    id:                  r.requestId,
    publicId:            r.publicId ?? r.requestId,
    shareToken,
    shareUrl,
    studentId:           r.studentId,
    student:             studentObj,
    reason:              r.reason,
    reasonLabel:         r.reasonLabel,
    date:                r.date,
    endDate:             r.endDate ?? undefined,
    periods:             r.periods ?? undefined,
    startTime:           r.startTime,
    endTime:             r.endTime,
    description:         r.description,
    documentName:        r.documentName ?? undefined,
    documentUrl:         r.documentUrl  ?? (r.documentName?.startsWith('http') ? r.documentName : undefined),
    status:              r.status,
    rejectionReason:     r.rejectionReason ?? undefined,
    submittedAt:         r.submittedAt,
    reviewedAt:          r.reviewedAt   ?? undefined,
    finalDecisionBy:     r.finalDecisionBy ?? undefined,
    finalDecisionUserId: r.finalDecisionUserId ?? undefined,
    facultyId:           r.primaryFacultyId ?? undefined,
    faculty:             facultyObj,
    facultyIds: allFacultyRows.map((f: any) => f.userId),
    faculties:  allFacultyRows.map((f: any) => ({
      id:          f.userId,
      name:        f.name,
      department:  f.department,
      email:       f.email,
      avatarUrl:   f.avatarUrl   ?? undefined,
    })),
    actions: r.actions ? r.actions.map((act: any) => ({
      id:          act.id,
      action:      act.action,
      remarks:     act.remarks ?? undefined,
      performedAt: act.performedAt,
      performedBy: {
        id:   act.performedBy?.userId || act.performedById,
        name: act.performedBy?.name || 'User',
        role: act.performedBy?.role,
      },
    })) : [],
  };

  // Find the exact Faculty or HOD user who approved/rejected this request
  const lastDecisionAction = r.actions && r.actions.length > 0
    ? [...r.actions].reverse().find((act: any) =>
        act.action?.includes('Approved') || act.action?.includes('Rejected') || act.action?.includes('Overridden')
      )
    : null;

  let finalDecisionName = lastDecisionAction?.performedBy?.name;

  if (!finalDecisionName && r.finalDecisionUserId) {
    if (r.primaryFaculty && (r.primaryFaculty.userId === r.finalDecisionUserId || r.primaryFaculty.id === r.finalDecisionUserId)) {
      finalDecisionName = r.primaryFaculty.name;
    } else {
      const matchInFaculties = allFacultyRows.find((f: any) => f && (f.userId === r.finalDecisionUserId || f.id === r.finalDecisionUserId));
      if (matchInFaculties) {
        finalDecisionName = matchInFaculties.name;
      }
    }
  }

  if (!finalDecisionName) {
    if (r.finalDecisionBy === 'HOD') {
      finalDecisionName = 'HOD';
    } else if (r.finalDecisionBy === 'Faculty') {
      finalDecisionName = faculty?.name || (allFacultyRows.length > 0 && allFacultyRows[0] ? allFacultyRows[0].name : 'Faculty');
    }
  }

  return {
    ...base,
    finalDecisionName,
  };
}

/**
 * GET /api/requests
 * - student : own requests only
 * - faculty : requests assigned to them ONLY (cannot view requests assigned to other faculty)
 * - hod     : all requests for their department with query filters (status, facultyId, studentId, date)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const limitParam = req.query['limit'] ? Math.min(100, Math.max(1, parseInt(String(req.query['limit']), 10))) : undefined;
    const offsetParam = req.query['offset'] ? Math.max(0, parseInt(String(req.query['offset']), 10)) : 0;
    const statusParam = req.query['status'] as string | undefined;
    const searchParam = (req.query['search'] as string | undefined)?.trim();

    let where: Prisma.RequestWhereInput = {};

    if (user.role === 'student') {
      where = {
        student: {
          OR: [
            { userId: user.id },
            { email: { equals: user.email, mode: 'insensitive' } },
            ...(user.rollNumber ? [{ rollNumber: user.rollNumber }] : []),
          ],
        },
      };
    } else if (user.role === 'faculty') {
      // Faculty can ONLY view requests specifically assigned to them
      where = {
        OR: [
          { primaryFacultyId: user.id },
          { faculties: { some: { facultyId: user.id } } },
          { primaryFaculty: { email: { equals: user.email, mode: 'insensitive' as const } } },
          { faculties: { some: { faculty: { email: { equals: user.email, mode: 'insensitive' as const } } } } },
        ],
      };
    } else {
      // HOD / Admin / Viewer: view all requests with optional status, faculty, student, date filters
      const { status, facultyId, studentId, date } = req.query;

      where = {
        ...(status && { status: status as RequestStatus }),
        ...(date && { date: String(date) }),
        ...(studentId && {
          OR: [
            { studentId: String(studentId) },
            { student: { userId: String(studentId) } },
            { student: { rollNumber: String(studentId) } },
          ],
        }),
        ...(facultyId && {
          OR: [
            { primaryFacultyId: String(facultyId) },
            { faculties: { some: { facultyId: String(facultyId) } } },
          ],
        }),
      };
    }

    if (statusParam && statusParam !== 'all') {
      where = {
        ...where,
        status: statusParam as RequestStatus,
      };
    }

    if (searchParam) {
      where = {
        ...where,
        OR: [
          ...(where.OR || []),
          { reasonLabel: { contains: searchParam, mode: 'insensitive' } },
          { description: { contains: searchParam, mode: 'insensitive' } },
          { studentId: { contains: searchParam, mode: 'insensitive' } },
          { student: { name: { contains: searchParam, mode: 'insensitive' } } },
          { student: { rollNumber: { contains: searchParam, mode: 'insensitive' } } },
        ],
      };
    }

    const total = await prisma.request.count({ where });

    const docs = await prisma.request.findMany({
      where,
      include:  REQUEST_LIST_INCLUDE,
      orderBy:  { submittedAt: 'desc' },
      ...(limitParam !== undefined ? { take: limitParam, skip: offsetParam } : {}),
    });

    res.json({
      requests: docs.map(toApi),
      total,
      hasMore: limitParam !== undefined ? (offsetParam + docs.length) < total : false,
      offset: offsetParam,
      limit: limitParam,
    });
  } catch (err) {
    console.error('GET /requests error:', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

/**
 * GET /api/requests/summary — fast summary counts for dashboards without full table dump
 */
router.get('/summary', async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    let baseWhere: Prisma.RequestWhereInput = {};

    if (user.role === 'student') {
      baseWhere = {
        student: {
          OR: [
            { userId: user.id },
            { email: { equals: user.email, mode: 'insensitive' } },
            ...(user.rollNumber ? [{ rollNumber: user.rollNumber }] : []),
          ],
        },
      };
    } else if (user.role === 'faculty') {
      baseWhere = {
        OR: [
          { primaryFacultyId: user.id },
          { faculties: { some: { facultyId: user.id } } },
          { primaryFaculty: { email: { equals: user.email, mode: 'insensitive' as const } } },
          { faculties: { some: { faculty: { email: { equals: user.email, mode: 'insensitive' as const } } } } },
        ],
      };
    }

    const [pending, approved, rejected, recent] = await Promise.all([
      prisma.request.count({ where: { ...baseWhere, status: 'pending' } }),
      prisma.request.count({ where: { ...baseWhere, status: 'approved' } }),
      prisma.request.count({ where: { ...baseWhere, status: 'rejected' } }),
      prisma.request.findMany({
        where: baseWhere,
        include: REQUEST_LIST_INCLUDE,
        orderBy: { submittedAt: 'desc' },
        take: 5,
      }),
    ]);

    const total = pending + approved + rejected;

    res.json({
      stats: { total, pending, approved, rejected },
      recent: recent.map(toApi),
    });
  } catch (err) {
    console.error('GET /requests/summary error:', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

/**
 * GET /api/requests/:id
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const idParam = (req.params['id'] || '').trim();
    const doc = await prisma.request.findFirst({
      where: {
        OR: [
          { id:        { equals: idParam, mode: 'insensitive' } },
          { requestId: { equals: idParam, mode: 'insensitive' } },
          { publicId:  { equals: idParam, mode: 'insensitive' } },
        ],
      },
      include: REQUEST_INCLUDE,
    });

    if (!doc) {
      res.status(404).json({ error: 'Request not found' });
      return;
    }

    const tokenUser = req.user!;
    const dbUser = await prisma.user.findFirst({
      where: {
        OR: [
          { userId: { equals: tokenUser.id, mode: 'insensitive' } },
          { id:     { equals: tokenUser.id, mode: 'insensitive' } },
          { email:  { equals: tokenUser.email, mode: 'insensitive' } },
        ],
      },
    });

    const activeUser = dbUser || tokenUser;

    // 1. Student access guard — students can only view their own requests
    if (activeUser.role === 'student') {
      if (!isStudentOwnerOfRequest(doc, activeUser as any)) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }
    }

    // 2. Faculty read access — authenticated faculty can read request details
    // (assignment enforcement is on the review/action endpoint)

    // 3. HOD access guard
    if (activeUser.role === 'hod') {
      if (!isHodAuthorizedForRequest(doc, activeUser as any)) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }
    }

    // 4. Admin access guard
    if (activeUser.role === 'admin') {
      if (!isAdminAuthorizedForRequest(doc, activeUser as any)) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }
    }

    res.json({ request: toApi(doc) });
  } catch (err) {
    console.error('GET /requests/:id error:', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

/**
 * POST /api/requests/hod-direct-grant
 * HOD voluntarily selects students and grants direct classwork exemptions (pre-approved).
 */
router.post('/hod-direct-grant', async (req: Request, res: Response) => {
  const user = req.user!;
  const isHodOrAdmin = user.role === 'hod' || user.role === 'admin';

  if (!isHodOrAdmin) {
    res.status(403).json({ error: 'Only HOD or Admin can issue direct classwork exemptions' });
    return;
  }

  const { studentIds, reason, startDate, endDate, startTime, endTime, periods, description } = req.body as {
    studentIds:   string[];
    reason:       string;
    startDate:    string;
    endDate?:     string;
    startTime?:   string;
    endTime?:     string;
    periods?:     string;
    description?: string;
  };

  if (!Array.isArray(studentIds) || studentIds.length === 0 || !reason || !startDate) {
    res.status(400).json({ error: 'studentIds (array), reason, and startDate are required' });
    return;
  }

  try {
    const hodUser = await prisma.user.findFirst({
      where: { OR: [{ userId: user.id }, { email: user.email }] },
    });
    const performingUserId = hodUser?.userId || user.id;

    const targetStudents = await prisma.user.findMany({
      where: {
        OR: [
          { userId: { in: studentIds } },
          { id: { in: studentIds } },
          { rollNumber: { in: studentIds } },
        ],
      },
    });

    if (targetStudents.length === 0) {
      res.status(404).json({ error: 'No matching students found' });
      return;
    }

    const createdRequests: any[] = [];

    for (const student of targetStudents) {
      const tsHex   = Date.now().toString(36).toUpperCase();
      const randHex = Math.random().toString(36).slice(2, 6).toUpperCase();
      const requestId = `req-HOD-${tsHex}-${randHex}`;

      const sDate = String(startDate).trim();
      const eDate = endDate ? String(endDate).trim() : sDate;
      const sTime = startTime ? String(startTime).trim() : '09:00';
      const eTime = endTime ? String(endTime).trim() : '17:00';
      const pText = periods ? String(periods).trim() : '1,2,3,4,5,6,7,8';
      const desc  = description?.trim() || `HOD Direct Voluntary Classwork Exemption: ${reason}`;
      const rLabel = String(reason).trim();

      const newDoc = await prisma.$transaction(async tx => {
        const created = await tx.request.create({
          data: {
            requestId,
            studentId:           student.userId,
            primaryFacultyId:    performingUserId,
            reason:              'other',
            reasonLabel:         rLabel,
            date:                sDate,
            endDate:             eDate,
            startTime:           sTime,
            endTime:             eTime,
            periods:             pText,
            description:         desc,
            status:              'approved',
            submittedAt:         new Date().toISOString(),
            reviewedAt:          new Date().toISOString(),
            finalDecisionBy:     'HOD',
            finalDecisionUserId: performingUserId,
          },
        });

        await tx.requestAction.create({
          data: {
            requestId:     created.id,
            action:        'Approved by HOD',
            remarks:       `Voluntary Classwork Exemption Granted by HOD: ${rLabel}`,
            performedById: performingUserId,
            performedAt:   new Date().toISOString(),
          },
        });

        await tx.notification.create({
          data: {
            userId:    student.userId,
            requestId: created.id,
            title:     'Classwork Exemption Granted by HOD',
            message:   `HOD has granted you direct permission for "${rLabel}" from ${sDate}${eDate !== sDate ? ' to ' + eDate : ''}.`,
            type:      'approved',
          },
        });

        return tx.request.findUnique({
          where: { id: created.id },
          include: REQUEST_INCLUDE,
        });
      });

      if (newDoc) {
        const apiDoc = toApi(newDoc);
        createdRequests.push(apiDoc);

        // Dispatch exemption email asynchronously
        try {
          const studentEmail =
            newDoc.student?.email ||
            (newDoc.student?.rollNumber ? `${newDoc.student.rollNumber.toLowerCase()}@srkrec.ac.in` : null);

          if (studentEmail) {
            const share = newDoc.shareLinks && newDoc.shareLinks.length > 0 ? newDoc.shareLinks[0].token : undefined;
            void sendRequestDecisionEmail({
              recipientEmail: studentEmail,
              studentName: newDoc.student?.name || 'Student',
              studentRoll: newDoc.student?.rollNumber || newDoc.studentId,
              department: newDoc.student?.department || 'CSIT',
              reasonLabel: newDoc.reasonLabel || newDoc.reason,
              date: newDoc.date,
              periods: newDoc.periods || undefined,
              status: 'approved',
              decisionByRole: 'HOD',
              reviewerName: user.name || 'Head of Department',
              shareToken: share,
              publicId: newDoc.publicId || newDoc.id,
            }).catch(e => console.warn('[EmailService] Direct grant email dispatch failed:', e));
          }
        } catch (emailErr) {
          console.warn('[EmailService] Failed to trigger direct grant email:', emailErr);
        }

        // Dispatch exemption WhatsApp notification asynchronously
        try {
          if (newDoc.student?.phone) {
            void sendWhatsAppDecisionNotification({
              recipientPhone: newDoc.student.phone,
              studentName: newDoc.student.name,
              studentRoll: newDoc.student.rollNumber || newDoc.studentId,
              department: newDoc.student.department || 'CSIT & CSD',
              reasonLabel: newDoc.reasonLabel || newDoc.reason,
              date: newDoc.date,
              periods: newDoc.periods || undefined,
              status: 'approved',
              decisionByRole: 'HOD',
              reviewerName: user.name || 'Head of Department',
            }).catch(e => console.warn('[WhatsAppService] Direct grant WhatsApp dispatch failed:', e));
          }
        } catch (waErr) {
          console.warn('[WhatsAppService] Failed to trigger direct grant WhatsApp:', waErr);
        }
      }
    }

    res.json({
      success: true,
      message: `Direct exemption granted to ${createdRequests.length} student(s)`,
      count:   createdRequests.length,
      requests: createdRequests,
    });
  } catch (err) {
    console.error('POST /requests/hod-direct-grant error:', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

/**
 * POST /api/requests — student creates a new request
 */
router.post('/', async (req: Request, res: Response) => {

  const user = req.user!;
  if (user.role !== 'student') {
    res.status(403).json({ error: 'Only students can submit requests' });
    return;
  }

  const { reason, date, endDate, periods, startTime, endTime, description, documentName, documentUrl, facultyId, facultyIds } = req.body as {
    reason:        string;
    date:          string;
    endDate?:      string;
    periods?:      string;
    startTime:     string;
    endTime:       string;
    description:   string;
    documentName?: string;
    documentUrl?:  string;
    facultyId?:    string;
    facultyIds?:   string[];
  };

  if (!reason || !date || !startTime || !endTime || !description) {
    res.status(400).json({ error: 'Missing required fields' });
    return;
  }

  try {
    // Normalize reason enum value safely
    const rawReason = String(reason).trim().toLowerCase().replace(/\s+/g, '_');
    const validReasons: RequestReason[] = ['internship', 'startup', 'project_development', 'medical', 'sports', 'family_emergency', 'competition', 'other'];
    const safeReason: RequestReason = validReasons.includes(rawReason as RequestReason)
      ? (rawReason as RequestReason)
      : 'other';

    // Load student profile with fallback
    let studentUser = await prisma.user.findFirst({
      where: {
        OR: [
          { userId: { equals: user.id, mode: 'insensitive' as const } },
          { email:  { equals: user.email, mode: 'insensitive' as const } },
          ...(user.rollNumber ? [{ rollNumber: { equals: user.rollNumber, mode: 'insensitive' as const } }] : []),
        ],
      },
    });

    if (!studentUser) {
      studentUser = await prisma.user.findFirst({
        where: { role: 'student' },
      });
    }

    if (!studentUser) {
      res.status(400).json({ error: 'Student record not found. Please log in again.' });
      return;
    }

    // Enforce daily request limit: maximum 3 requests per student for the same date
    const dailyCount = await prisma.request.count({
      where: {
        studentId: studentUser.userId,
        date: date,
      },
    });

    if (dailyCount >= 3) {
      res.status(400).json({ error: 'Daily request limit reached. You can submit a maximum of 3 requests for the same date.' });
      return;
    }

    // Resolve list of faculty IDs
    const targetIds = Array.isArray(facultyIds) && facultyIds.length > 0
      ? facultyIds
      : facultyId ? [facultyId] : [];

    let facultyDocs: { userId: string }[] = [];
    if (targetIds.length > 0) {
      facultyDocs = await prisma.user.findMany({
        where: {
          OR: [
            { userId: { in: targetIds } },
            { email:  { in: targetIds } },
          ],
        },
      });
    }

    // Fallback: assign any faculty member
    if (facultyDocs.length === 0) {
      const fallback = await prisma.user.findFirst({
        where: { role: 'faculty' },
      });
      if (fallback) facultyDocs = [fallback];
    }

    // Collision-safe requestId and non-sequential publicId
    const tsHex    = Date.now().toString(36).toUpperCase();
    const randHex  = Math.random().toString(36).slice(2, 6).toUpperCase();
    const requestId = `req-${tsHex}-${randHex}`;

    // Non-sequential cryptographically secure publicId (e.g. rq_U2YQ7XkP9WmL3nA8)
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';
    const bytes = crypto.randomBytes(16);
    let publicIdStr = 'rq_';
    for (let i = 0; i < 16; i++) {
      publicIdStr += chars[bytes[i] % chars.length];
    }
    const publicId = publicIdStr;

    const primaryFaculty = facultyDocs[0] ?? null;
    const finalDocName = documentName || (documentUrl ? 'Uploaded_Proof_Document' : undefined);
    const finalDocUrl = documentUrl || (documentName?.startsWith('http') || documentName?.startsWith('data:') ? documentName : undefined);

    // 1. Create the base request document
    const created = await prisma.request.create({
      data: {
        requestId,
        publicId,
        studentId:        studentUser.userId,
        primaryFacultyId: primaryFaculty?.userId ?? null,
        reason:           safeReason as any,
        reasonLabel:      REASON_LABELS[safeReason] ?? String(reason),
        date,
        ...(endDate && { endDate }),
        ...(periods && { periods }),
        startTime,
        endTime,
        description,
        status:           'pending',
        submittedAt:      new Date().toISOString(),
        ...(finalDocName && { documentName: finalDocName }),
        ...(finalDocUrl && { documentUrl: finalDocUrl }),
      },
    });

    // 2. Assign faculty members
    if (facultyDocs.length > 0) {
      try {
        await prisma.requestFaculty.createMany({
          data: facultyDocs.map(f => ({
            requestId: created.id,
            facultyId: f.userId,
          })),
          skipDuplicates: true,
        });
      } catch (fErr) {
        console.warn('Could not create request faculty assignments:', fErr);
      }
    }

    // 3. Generate dedicated secure share token
    const shareToken = generateShareToken(10);
    try {
      await (prisma as any).permissionRequestShareLink.create({
        data: {
          requestId: created.id,
          token:     shareToken,
          createdBy: studentUser.userId,
          isActive:  true,
        },
      });
    } catch (tokenErr) {
      console.warn('Could not create share token entry:', tokenErr);
    }

    // 4. Record audit action
    try {
      await prisma.requestAction.create({
        data: {
          requestId:     created.id,
          performedById: studentUser.userId,
          action:        'Submitted',
          remarks:       'Request submitted by student',
        },
      });
    } catch (actErr) {
      console.warn('Could not create request action audit log:', actErr);
    }

    // 5. Generate notifications for assigned faculty
    if (facultyDocs.length > 0) {
      try {
        await prisma.notification.createMany({
          data: facultyDocs.map(f => ({
            userId:    f.userId,
            requestId: created.id,
            type:      'pending',
            title:     'New Attendance Request',
            message:   `${studentUser.name} submitted a new request for ${REASON_LABELS[safeReason] ?? reason}.`,
          })),
        });
      } catch (notifErr) {
        console.warn('Could not create notifications:', notifErr);
      }
    }

    // 6. Fetch complete request with all relations
    let newDoc = null;
    try {
      newDoc = await prisma.request.findUnique({
        where:   { id: created.id },
        include: REQUEST_INCLUDE,
      });
    } catch (fetchErr) {
      console.warn('Could not fetch request with relations, using created object:', fetchErr);
    }

    const mapped = toApi(newDoc || created);
    const finalShareToken = shareToken || mapped.shareToken || ((newDoc as any)?.shareLinks?.[0]?.token);
    const shareUrl = finalShareToken ? `/r/${finalShareToken}` : `/share/${mapped.publicId || mapped.id}`;

    res.status(201).json({
      success: true,
      request: mapped,
      requestId: mapped.id,
      shareToken: finalShareToken,
      shareUrl,
    });
  } catch (err) {
    console.error('POST /requests error:', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

/**
 * GET /api/requests/:id/share-link
 * POST /api/requests/:id/share-link
 * Get or create active share token for a permission request.
 * Authenticated access only.
 */
router.all('/:id/share-link', async (req: Request, res: Response) => {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const idParam = (req.params['id'] || '').trim();
    const user = req.user!;

    const doc = await prisma.request.findFirst({
      where: {
        OR: [
          { id:        { equals: idParam, mode: 'insensitive' } },
          { requestId: { equals: idParam, mode: 'insensitive' } },
          { publicId:  { equals: idParam, mode: 'insensitive' } },
        ],
      },
      include: REQUEST_INCLUDE,
    });

    if (!doc) {
      res.status(404).json({ error: 'Request not found' });
      return;
    }

    const docAny = doc as any;

    // Check ownership for students
    if (user.role === 'student') {
      if (!isStudentOwnerOfRequest(doc, user as any)) {
        res.status(403).json({ error: 'You are not authorized to access share links for this request' });
        return;
      }
    }

    const shareLinksList: any[] = docAny.shareLinks || [];
    let activeLink = shareLinksList.find((l: any) => !l.revokedAt && (!l.expiresAt || new Date(l.expiresAt) > new Date()));

    if (!activeLink) {
      // Attempt creation with up to 3 retries to handle rare token collisions
      let createError: any = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        const token = generateShareToken(16); // Use full 16-char entropy
        try {
          activeLink = await (prisma as any).permissionRequestShareLink.create({
            data: {
              requestId: doc.id,
              token,
              createdBy: doc.studentId,
              isActive:  true,
            },
          });
          createError = null;
          break; // Success
        } catch (createErr: any) {
          createError = createErr;
          console.error(`Share link create attempt ${attempt} failed for requestId=${doc.id}:`, createErr?.message || createErr);
          // Only retry on unique constraint violation
          if (!createErr?.message?.includes('unique') && !createErr?.message?.includes('Unique')) break;
        }
      }

      if (!activeLink) {
        console.error('Failed to create share link after retries:', createError);
        res.status(500).json({ error: 'Could not create share link. Please try again.' });
        return;
      }
    }

    const shareUrl = `/r/${activeLink.token}`;
    res.json({
      success: true,
      requestId: doc.requestId,
      shareToken: activeLink.token,
      shareUrl,
      isActive: activeLink.isActive,
      createdAt: activeLink.createdAt,
      expiresAt: activeLink.expiresAt,
    });
  } catch (err) {
    console.error('GET /requests/:id/share-link error:', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

/**
 * POST /api/requests/bulk-review
 * Body: { requestIds: string[], action: 'approve' | 'reject', rejectionReason?: string, remarks?: string }
 * Allows Faculty / HOD to accept or reject multiple requests simultaneously.
 */
router.post('/bulk-review', async (req: Request, res: Response) => {
  const user = req.user!;

  if (user.role === 'student') {
    res.status(403).json({ error: 'Students cannot review requests' });
    return;
  }

  const { requestIds, action, rejectionReason, remarks } = req.body as {
    requestIds:        string[];
    action:           'approve' | 'reject';
    rejectionReason?: string;
    remarks?:         string;
  };

  if (!Array.isArray(requestIds) || requestIds.length === 0) {
    res.status(400).json({ error: 'requestIds array is required and must not be empty' });
    return;
  }

  if (!action || !['approve', 'reject'].includes(action)) {
    res.status(400).json({ error: 'action must be "approve" or "reject"' });
    return;
  }

  try {
    const existingRequests = await prisma.request.findMany({
      where: {
        OR: [
          { id:        { in: requestIds } },
          { requestId: { in: requestIds } },
        ],
      },
      include: REQUEST_INCLUDE,
    });

    if (existingRequests.length === 0) {
      res.status(404).json({ error: 'No matching requests found' });
      return;
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    const decisionRole = user.role === 'hod' ? 'HOD' : 'Faculty';
    const performingUserId = (user as any).userId || user.id;
    const now = new Date().toISOString();

    const updatedRequests: any[] = [];
    const skippedIds: string[] = [];

    // Filter eligible requests first (outside transaction to avoid holding locks)
    const eligibleRequests: typeof existingRequests = [];
    for (const existing of existingRequests) {
      if (user.role === 'faculty') {
        const assignedFacultyIds = existing.faculties.map(rf => rf.facultyId);
        const assignedEmails     = existing.faculties.map(rf => rf.faculty.email);

        const isAssignedFaculty =
          existing.primaryFacultyId === user.id ||
          assignedFacultyIds.includes(user.id) ||
          existing.primaryFaculty?.email === user.email ||
          assignedEmails.includes(user.email);

        if (!isAssignedFaculty || existing.finalDecisionBy === 'HOD') {
          skippedIds.push(existing.id);
          continue;
        }
      }
      eligibleRequests.push(existing);
    }

    const actionName = user.role === 'faculty'
      ? (action === 'approve' ? 'Approved by Faculty (Bulk)' : 'Rejected by Faculty (Bulk)')
      : (action === 'approve' ? 'Approved by HOD (Bulk)' : 'Rejected by HOD (Bulk)');

    const effectiveRemarks = remarks?.trim() || rejectionReason?.trim() ||
      (action === 'approve' ? `Bulk approved by ${user.role.toUpperCase()}` : `Bulk rejected by ${user.role.toUpperCase()}`);

    const eligibleIds = eligibleRequests.map(r => r.id);

    await prisma.$transaction(async tx => {
      // Bulk update all eligible requests in one query
      await tx.request.updateMany({
        where: { id: { in: eligibleIds } },
        data: {
          status:              newStatus,
          rejectionReason:     action === 'reject' ? (rejectionReason ?? null) : null,
          reviewedAt:          now,
          finalDecisionBy:     decisionRole,
          finalDecisionUserId: performingUserId,
        },
      });

      // Bulk insert audit actions
      await tx.requestAction.createMany({
        data: eligibleIds.map(id => ({
          requestId:     id,
          performedById: performingUserId,
          action:        actionName,
          remarks:       effectiveRemarks,
        })),
        skipDuplicates: true,
      });

      // Bulk insert student notifications
      await tx.notification.createMany({
        data: eligibleRequests.map(existing => ({
          userId:    existing.studentId,
          requestId: existing.id,
          type:      action === 'approve' ? 'approved' : 'rejected',
          title:     `Request ${action === 'approve' ? 'Approved' : 'Rejected'}`,
          message:   `Your permission request for ${existing.reasonLabel} has been ${action === 'approve' ? 'approved' : 'rejected'} by ${user.name}.`,
        })),
        skipDuplicates: true,
      });
    }, { timeout: 30000 });

    // Fetch updated requests after transaction commits
    const updatedDocs = await prisma.request.findMany({
      where:   { id: { in: eligibleIds } },
      include: REQUEST_INCLUDE,
    });
    updatedRequests.push(...updatedDocs);

    res.json({
      success: true,
      count: updatedRequests.length,
      requests: updatedRequests.map(toApi),
      skippedCount: skippedIds.length,
    });
  } catch (err: any) {
    console.error('POST /requests/bulk-review error:', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

/**
 * PUT /api/requests/:id — student updates an existing pending request
 * Rules:
 * 1. Can only update pending requests.
 * 2. If approved (or rejected/cancelled), student CANNOT edit it.
 */
router.put('/:id', async (req: Request, res: Response) => {
  const user = req.user!;
  const idParam = (req.params['id'] || '').trim();

  try {
    const existing = await prisma.request.findFirst({
      where: {
        OR: [
          { id:        { equals: idParam, mode: 'insensitive' } },
          { requestId: { equals: idParam, mode: 'insensitive' } },
          { publicId:  { equals: idParam, mode: 'insensitive' } },
        ],
      },
      include: REQUEST_INCLUDE,
    });

    if (!existing) {
      res.status(404).json({ error: 'Request not found' });
      return;
    }

    // Ownership check for student
    if (user.role === 'student') {
      if (!isStudentOwnerOfRequest(existing, user as any)) {
        res.status(403).json({ error: 'You are not authorized to edit this request' });
        return;
      }

      // Rule: Approved requests CANNOT be edited by student
      if (existing.status === 'approved') {
        res.status(403).json({ error: 'Approved requests cannot be edited by student' });
        return;
      }
    }

    const { reason, date, endDate, periods, startTime, endTime, description, documentName, documentUrl, facultyId, facultyIds } = req.body;

    const rawReason = reason ? String(reason).trim().toLowerCase().replace(/\s+/g, '_') : existing.reason;
    const validReasons: RequestReason[] = ['internship', 'startup', 'project_development', 'medical', 'sports', 'family_emergency', 'competition', 'other'];
    const safeReason: RequestReason = validReasons.includes(rawReason as RequestReason)
      ? (rawReason as RequestReason)
      : existing.reason;

    // Resolve faculty assignments if provided
    let primaryFacultyId = existing.primaryFacultyId;
    const targetFacultyInput = Array.isArray(facultyIds) && facultyIds.length > 0
      ? facultyIds
      : facultyId ? [facultyId] : [];

    let newFacultyDocs: { userId: string }[] = [];
    if (targetFacultyInput.length > 0) {
      newFacultyDocs = await prisma.user.findMany({
        where: {
          OR: [
            { userId: { in: targetFacultyInput } },
            { email:  { in: targetFacultyInput } },
            { id:     { in: targetFacultyInput } },
          ],
        },
      });
    }

    if (newFacultyDocs.length > 0) {
      primaryFacultyId = newFacultyDocs[0].userId;
    }

    const isResubmitting = existing.status === 'rejected';

    const updated = await prisma.$transaction(async tx => {
      const result = await tx.request.update({
        where: { id: existing.id },
        data: {
          ...(isResubmitting ? { status: 'pending', rejectionReason: null, reviewedAt: null, finalDecisionBy: null, finalDecisionUserId: null } : {}),
          ...(reason && { reason: safeReason, reasonLabel: REASON_LABELS[safeReason] ?? String(reason) }),
          ...(date && { date }),
          ...(endDate !== undefined && { endDate }),
          ...(periods !== undefined && { periods }),
          ...(startTime && { startTime }),
          ...(endTime && { endTime }),
          ...(description && { description }),
          ...(documentName !== undefined && { documentName }),
          ...(documentUrl !== undefined && { documentUrl }),
          ...(primaryFacultyId && { primaryFacultyId }),
        },
        include: REQUEST_INCLUDE,
      });

      // Update RequestFaculty junction table so new assigned faculty see the request in their dashboard
      if (newFacultyDocs.length > 0) {
        await tx.requestFaculty.deleteMany({
          where: { requestId: existing.id },
        });

        await tx.requestFaculty.createMany({
          data: newFacultyDocs.map(f => ({
            requestId: existing.id,
            facultyId: f.userId,
          })),
        });
      }

      // Log audit action
      await tx.requestAction.create({
        data: {
          requestId:     existing.id,
          performedById: user.id,
          action:        'Updated',
          remarks:       'Request details and assigned faculty updated by student',
        },
      });

      return result;
    });

    res.json({ request: toApi(updated) });
  } catch (err: any) {
    console.error('PUT /requests/:id error:', err);
    res.status(500).json({ error: 'Internal error' });
  }
});



/**
 * PATCH /api/requests/:id — faculty / HOD approves or rejects
 * Body: { action: 'approve' | 'reject', rejectionReason?: string, remarks?: string }
 */
router.patch('/:id', async (req: Request, res: Response) => {
  const user = req.user!;

  if (user.role === 'student') {
    res.status(403).json({ error: 'Students cannot review requests' });
    return;
  }

  const { action, rejectionReason, remarks, periods, approvedPeriods } = req.body as {
    action:           'approve' | 'reject';
    rejectionReason?: string;
    remarks?:         string;
    periods?:         string | string[];
    approvedPeriods?: string | string[];
  };

  if (!action || !['approve', 'reject'].includes(action)) {
    res.status(400).json({ error: 'action must be "approve" or "reject"' });
    return;
  }

  const effectiveRemarks = remarks?.trim() || rejectionReason?.trim() || (action === 'reject' ? `Rejected by ${user.role.toUpperCase()} Override` : `Approved by ${user.role.toUpperCase()} Override`);

  try {
    const idParam = (req.params['id'] || '').trim();
    // 1. Fast indexed lookup by primary key or unique requestId (1ms)
    let existing = await prisma.request.findUnique({
      where: { id: idParam },
      include: REQUEST_INCLUDE,
    });
    if (!existing) {
      existing = await prisma.request.findUnique({
        where: { requestId: idParam },
        include: REQUEST_INCLUDE,
      });
    }
    if (!existing) {
      existing = await prisma.request.findFirst({
        where: {
          OR: [
            { publicId:  idParam },
            { id:        { equals: idParam, mode: 'insensitive' } },
            { requestId: { equals: idParam, mode: 'insensitive' } },
            { publicId:  { equals: idParam, mode: 'insensitive' } },
          ],
        },
        include: REQUEST_INCLUDE,
      });
    }

    if (!existing) {
      res.status(404).json({ error: 'Request not found' });
      return;
    }

    // ── Faculty & HOD authorization check (Fast indexed user lookup) ──
    const tokenUser = req.user!;
    let dbUser = await prisma.user.findUnique({
      where: { userId: tokenUser.id },
    });
    if (!dbUser) {
      dbUser = await prisma.user.findUnique({
        where: { id: tokenUser.id },
      });
    }
    if (!dbUser && tokenUser.email) {
      dbUser = await prisma.user.findUnique({
        where: { email: tokenUser.email },
      });
    }
    if (!dbUser) {
      dbUser = await prisma.user.findFirst({
        where: {
          OR: [
            { userId: { equals: tokenUser.id, mode: 'insensitive' } },
            { id:     { equals: tokenUser.id, mode: 'insensitive' } },
            { email:  { equals: tokenUser.email, mode: 'insensitive' } },
          ],
        },
      });
    }

    const activeUser = dbUser || tokenUser;

    if (user.role === 'faculty') {
      const isAuthorized = isFacultyAuthorizedForRequest(existing, activeUser as any);
      if (!isAuthorized) {
        res.status(403).json({ error: 'This request is not assigned to you' });
        return;
      }
    } else if (user.role === 'hod') {
      const isAuthorized = isHodAuthorizedForRequest(existing, activeUser as any) || isFacultyAuthorizedForRequest(existing, activeUser as any);
      if (!isAuthorized) {
        res.status(403).json({ error: 'You are not authorized to review requests for this department' });
        return;
      }
    } else if (user.role !== 'admin') {
      res.status(403).json({ error: 'Forbidden: unauthorized to review requests' });
      return;
    }


    // ── Determine Action Name & Status ────────────────────────────────────────
    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    let actionName: string;

    if (user.role === 'faculty') {
      actionName = action === 'approve' ? 'Approved by Faculty' : 'Rejected by Faculty';
    } else {
      // HOD action: check if force rejecting an already approved request or overriding faculty
      if (existing.status === 'approved' && action === 'reject') {
        actionName = 'Force Rejected by HOD';
      } else if (existing.finalDecisionBy === 'Faculty' || (existing.status !== 'pending' && existing.status !== 'cancelled')) {
        actionName = action === 'approve' ? 'Force Approved by HOD' : 'Overridden by HOD';
      } else {
        actionName = action === 'approve' ? 'Approved by HOD' : 'Rejected by HOD';
      }
    }

    const decisionRole = user.role === 'admin' ? 'Admin' : (user.role === 'hod' ? 'HOD' : 'Faculty');

    const performingUserId = (user as any).userId || user.id;

    const finalPeriods = action === 'approve'
      ? (periods !== undefined ? (Array.isArray(periods) ? periods.join(', ') : String(periods).trim()) :
         approvedPeriods !== undefined ? (Array.isArray(approvedPeriods) ? approvedPeriods.join(', ') : String(approvedPeriods).trim()) : undefined)
      : undefined;

    const updated = await prisma.$transaction(async tx => {
      const result = await tx.request.update({
        where: { id: existing.id },
        data: {
          status:              newStatus,
          rejectionReason:     action === 'reject' ? (rejectionReason?.trim() || 'Force Rejected by HOD Override') : null,
          ...(finalPeriods !== undefined && finalPeriods !== '' ? { periods: finalPeriods } : {}),
          reviewedAt:          new Date().toISOString(),
          finalDecisionBy:     decisionRole,
          finalDecisionUserId: performingUserId,
        },
        include: REQUEST_INCLUDE,
      });

      const previousDecisionText = existing.finalDecisionBy
        ? `${existing.status.toUpperCase()} by ${existing.finalDecisionBy}`
        : existing.status.toUpperCase();
      const newDecisionText = `${newStatus.toUpperCase()} by ${decisionRole}`;
      const logTimestamp = new Date().toISOString();

      const auditRemarks = `[Override Log] Previous: ${previousDecisionText} -> New: ${newDecisionText} | PerformedBy: ${performingUserId} | At: ${logTimestamp}. ${effectiveRemarks}`;

      // Record audit action (performedById references User.userId)
      await tx.requestAction.create({
        data: {
          requestId:     existing.id,
          performedById: performingUserId,
          action:        actionName,
          remarks:       auditRemarks,
        },
      });

      // Safely generate notification for student without breaking transaction
      try {
        const studentRecipientId = existing.student?.userId || existing.studentId;
        if (studentRecipientId) {
          await tx.notification.create({
            data: {
              userId:    studentRecipientId,
              requestId: existing.id,
              type:      newStatus,
              title:     `Request ${action === 'approve' ? 'Approved' : 'Rejected'}`,
              message:   `Your request for ${existing.reasonLabel} has been ${newStatus} by ${user.name} (${decisionRole}).`,
            },
          });
        }
      } catch (notifErr) {
        console.warn('Student notification generation skipped:', notifErr);
      }

      // Safely generate notification for assigned faculty if HOD override
      const assignedFacIds = existing.faculties ? existing.faculties.map((rf: any) => rf.facultyId || rf.faculty?.userId).filter(Boolean) : [];
      if (user.role === 'hod' && assignedFacIds.length > 0) {
        try {
          await tx.notification.createMany({
            data: assignedFacIds.map((facId: string) => ({
              userId:    facId,
              requestId: existing.id,
              type:      'override',
              title:     'HOD Decision Override',
              message:   `HOD ${user.name} updated decision to ${newStatus} for student ${existing.student?.name || 'Student'}.`,
            })),
            skipDuplicates: true,
          });
        } catch (facNotifErr) {
          console.warn('Faculty notification generation skipped:', facNotifErr);
        }
      }

      return result;
    });

    // ── Dispatch Automated Decision Email asynchronously ──
    try {
      const studentRecipientEmail =
        updated.student?.email ||
        (updated.student?.rollNumber ? `${updated.student.rollNumber.toLowerCase()}@srkrec.ac.in` : null);

      if (studentRecipientEmail) {
        const activeShare =
          updated.shareLinks && updated.shareLinks.length > 0 ? updated.shareLinks[0].token : undefined;

        void sendRequestDecisionEmail({
          recipientEmail: studentRecipientEmail,
          studentName: updated.student?.name || 'Student',
          studentRoll: updated.student?.rollNumber || updated.studentId,
          department: updated.student?.department || 'CSIT',
          reasonLabel: updated.reasonLabel || updated.reason,
          date: updated.date,
          periods: updated.periods || undefined,
          status: newStatus,
          rejectionReason: action === 'reject' ? (rejectionReason?.trim() || undefined) : undefined,
          decisionByRole: decisionRole,
          reviewerName: user.name,
          shareToken: activeShare,
          publicId: updated.publicId || updated.id,
        }).catch(err => console.warn('[EmailService] Async decision email dispatch failed:', err));
      }
    } catch (emailErr) {
      console.warn('[EmailService] Failed to trigger decision email:', emailErr);
    }

    // ── Dispatch Automated WhatsApp Notification asynchronously ──
    try {
      if (updated.student?.phone) {
        void sendWhatsAppDecisionNotification({
          recipientPhone: updated.student.phone,
          studentName: updated.student.name,
          studentRoll: updated.student.rollNumber || updated.studentId,
          department: updated.student.department || 'CSIT & CSD',
          reasonLabel: updated.reasonLabel || updated.reason,
          date: updated.date,
          periods: updated.periods || undefined,
          status: newStatus,
          rejectionReason: action === 'reject' ? (rejectionReason?.trim() || undefined) : undefined,
          decisionByRole: decisionRole,
          reviewerName: user.name,
        }).catch(err => console.warn('[WhatsAppService] Async decision WhatsApp dispatch failed:', err));
      }
    } catch (waErr) {
      console.warn('[WhatsAppService] Failed to trigger decision WhatsApp:', waErr);
    }

    res.json({ request: toApi(updated) });
  } catch (err) {
    console.error('PATCH /requests/:id error:', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

/**
 * POST /api/requests/:id/cancel — student cancels a pending request
 */
router.post('/:id/cancel', async (req: Request, res: Response) => {
  const user = req.user!;
  if (user.role !== 'student') {
    res.status(403).json({ error: 'Only students can cancel their requests' });
    return;
  }

  try {
    const existing = await prisma.request.findUnique({
      where:   { requestId: req.params['id'] },
      include: REQUEST_INCLUDE,
    });

    if (!existing) {
      res.status(404).json({ error: 'Request not found' });
      return;
    }

    if (
      existing.studentId !== user.id &&
      existing.student?.userId !== user.id &&
      existing.student?.email.toLowerCase() !== user.email.toLowerCase()
    ) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    if (existing.status === 'cancelled') {
      res.status(400).json({ error: 'Request is already cancelled' });
      return;
    }

    const updated = await prisma.$transaction(async tx => {
      const result = await tx.request.update({
        where: { requestId: req.params['id'] },
        data:  { status: 'cancelled' },
        include: REQUEST_INCLUDE,
      });

      // Audit action
      await tx.requestAction.create({
        data: {
          requestId:     existing.id,
          performedById: user.id,
          action:        'Cancelled',
          remarks:       'Request cancelled by student',
        },
      });

      // Notify faculty
      const assignedFacultyIds = existing.faculties.map(rf => rf.facultyId);
      if (assignedFacultyIds.length > 0) {
        await tx.notification.createMany({
          data: assignedFacultyIds.map(facId => ({
            userId:    facId,
            requestId: existing.id,
            type:      'cancelled',
            title:     'Request Cancelled',
            message:   `Student ${existing.student?.name || 'Student'} cancelled their request for ${existing.reasonLabel}.`,
          })),
        });
      }

      return result;
    });

    res.json({ request: toApi(updated) });
  } catch (err) {
    console.error('POST /requests/:id/cancel error:', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

/**
 * GET /api/requests/:id/actions — retrieve audit timeline for a request
 */
router.get('/:id/actions', async (req: Request, res: Response) => {
  try {
    const existing = await prisma.request.findUnique({
      where: { requestId: req.params['id'] },
      select: { id: true, requestId: true, studentId: true, student: { select: { department: true } } },
    });

    if (!existing) {
      res.status(404).json({ error: 'Request not found' });
      return;
    }

    const actions = await prisma.requestAction.findMany({
      where:   { requestId: existing.id },
      include: { performedBy: true },
      orderBy: { performedAt: 'asc' },
    });

    res.json({
      actions: actions.map(act => ({
        id:          act.id,
        action:      act.action,
        remarks:     act.remarks ?? undefined,
        performedAt: act.performedAt,
        performedBy: {
          id:   act.performedBy.userId,
          name: act.performedBy.name,
          role: act.performedBy.role,
        },
      })),
    });
  } catch (err) {
    console.error('GET /requests/:id/actions error:', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

/**
 * DELETE /api/requests/:id — student cancels/deletes a PENDING request
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const idParam = (req.params['id'] || '').trim();

    const existing = await prisma.request.findFirst({
      where: {
        OR: [
          { id:        { equals: idParam, mode: 'insensitive' } },
          { requestId: { equals: idParam, mode: 'insensitive' } },
        ],
      },
    });

    if (!existing) {
      res.status(404).json({ error: 'Request not found' });
      return;
    }

    // Verify ownership and deletion authorization:
    // Student can delete ONLY their own request.
    // Admin retains administrative deletion capability.
    // Faculty and HOD cannot delete student requests.
    const isStudentOwner = user.role === 'student' && (
      existing.studentId.toLowerCase() === user.id.toLowerCase() ||
      (user.rollNumber ? existing.studentId.toLowerCase() === user.rollNumber.toLowerCase() : false)
    );
    const isAdmin = user.role === 'admin';

    if (!isStudentOwner && !isAdmin) {
      res.status(403).json({ error: 'You are not authorized to delete this request' });
      return;
    }

    // Enforce strict pending status check
    if (existing.status !== 'pending') {
      res.status(400).json({ error: 'Only pending requests can be deleted. Approved or rejected requests cannot be deleted.' });
      return;
    }

    // Delete in transaction
    await prisma.$transaction(async tx => {
      await tx.requestAction.deleteMany({ where: { requestId: existing.id } });
      await tx.requestFaculty.deleteMany({ where: { requestId: existing.id } });
      await tx.notification.deleteMany({ where: { requestId: existing.id } });
      await tx.request.delete({ where: { id: existing.id } });
    });

    res.json({ message: 'Request deleted successfully' });
  } catch (err) {
    console.error('DELETE /requests/:id error:', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

export default router;
