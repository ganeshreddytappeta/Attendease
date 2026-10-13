import { Router } from 'express';
import type { Request, Response } from 'express';
import { prisma } from '../db/prisma.js';
import { verifyToken } from '../middleware/auth.js';
import { hashCoordinatorCode } from '../utils/coordinatorUtils.js';
import type { ActivityCategory } from '@prisma/client';

const router = Router();

// Require authentication on all activity routes
router.use(verifyToken);

/**
 * Helper to check if a user is authorized to modify a specific category.
 * Returns { authorized: boolean, actor: any, reason?: string }
 */
async function checkCategoryAuthorization(
  req: Request,
  category: ActivityCategory,
  providedCode?: string
) {
  const reqUser = req.user!;
  // Admins always have full authority
  if (reqUser.role === 'admin') {
    return { authorized: true, actor: reqUser };
  }

  const headerCode = req.headers['x-coordinator-code'];
  const code = (providedCode || headerCode || '').toString();
  if (!code) {
    return { authorized: false, actor: reqUser, reason: 'Coordinator Authorization Code is required for this operation.' };
  }

  const hashed = hashCoordinatorCode(code);
  const userIdentifier = (reqUser as any).userId || reqUser.id;

  // Find active coordinator access record specifically for THIS category AND THIS logged-in user
  const access = await prisma.coordinatorAccess.findFirst({
    where: {
      category: category as ActivityCategory,
      codeHash: hashed,
      isActive: true,
      OR: [
        { facultyId: userIdentifier },
        { faculty: { id: reqUser.id } },
        { faculty: { userId: userIdentifier } }
      ]
    },
    include: { faculty: true }
  });

  if (!access) {
    // Check if the user is assigned as coordinator for this category at all
    const userAssignment = await prisma.coordinatorAccess.findFirst({
      where: {
        category: category as ActivityCategory,
        isActive: true,
        OR: [
          { facultyId: userIdentifier },
          { faculty: { id: reqUser.id } },
          { faculty: { userId: userIdentifier } }
        ]
      }
    });

    if (!userAssignment) {
      return {
        authorized: false,
        actor: reqUser,
        reason: `Access Denied: You are not assigned as a Coordinator for ${String(category).toUpperCase()}. Only designated category coordinators can modify this data.`
      };
    }

    return {
      authorized: false,
      actor: reqUser,
      reason: 'Invalid Coordinator Authorization Code for your account.'
    };
  }

  // Ensure faculty code is being used by an active faculty member
  if (!access.faculty.isActive) {
    return { authorized: false, actor: reqUser, reason: 'Your faculty coordinator account is currently inactive.' };
  }

  return { authorized: true, actor: reqUser, access };
}

/**
 * GET /api/activities/my-assignments
 * Returns category assignments for the logged-in user.
 */
router.get('/my-assignments', async (req: Request, res: Response) => {
  try {
    if (req.user?.role === 'admin') {
      res.json({ success: true, isAdmin: true, categories: ['internship', 'startup', 'project_work', 'sports', 'house_events'] });
      return;
    }

    const userIdentifier = (req.user as any)?.userId || req.user?.id;
    const assignments = await prisma.coordinatorAccess.findMany({
      where: {
        isActive: true,
        OR: [
          { facultyId: userIdentifier },
          { faculty: { id: req.user?.id } },
          { faculty: { userId: userIdentifier } }
        ]
      },
      select: { category: true }
    });

    const categories = assignments.map(a => a.category);
    res.json({ success: true, isAdmin: false, categories });
  } catch (error) {
    console.error('GET /api/activities/my-assignments error:', error);
    res.status(500).json({ error: 'Failed to fetch coordinator assignments' });
  }
});

/**
 * GET /api/activities
 * Fetch all active student activity participation records.
 * Supports filtering by category, status, and search query (name/rollNumber).
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { category, status, search } = req.query;

    const whereClause: any = {
      isActive: true,
    };

    if (category && typeof category === 'string' && category !== 'all') {
      whereClause.category = category as ActivityCategory;
    }

    if (status && typeof status === 'string' && status !== 'all') {
      whereClause.status = status;
    }

    const activities = await prisma.studentActivity.findMany({
      where: whereClause,
      include: {
        student: {
          select: {
            id: true,
            userId: true,
            name: true,
            email: true,
            rollNumber: true,
            department: true,
            year: true,
            section: true,
            semester: true,
            avatarUrl: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // In-memory search filtering for student name / roll number / title
    let filtered = activities;
    if (search && typeof search === 'string') {
      const q = search.toLowerCase().trim();
      if (q) {
        filtered = activities.filter(act => {
          const sName = (act.student?.name || '').toLowerCase();
          const sRoll = (act.student?.rollNumber || act.student?.userId || '').toLowerCase();
          const sDept = (act.student?.department || '').toLowerCase();
          const title = (act.titleOrCompany || '').toLowerCase();
          const role  = (act.roleOrPosition || '').toLowerCase();
          return sName.includes(q) || sRoll.includes(q) || sDept.includes(q) || title.includes(q) || role.includes(q);
        });
      }
    }

    res.json({ success: true, count: filtered.length, activities: filtered });
  } catch (error) {
    console.error('GET /api/activities error:', error);
    res.status(500).json({ error: 'Failed to fetch student activities' });
  }
});

/**
 * POST /api/activities/verify-code
 * Verifies a coordinator code for a category.
 */
router.post('/verify-code', async (req: Request, res: Response) => {
  try {
    const { category, code } = req.body;
    if (!category || !code) {
      res.status(400).json({ error: 'Category and authorization code are required.' });
      return;
    }

    if (req.user?.role === 'admin') {
      res.json({ success: true, authorized: true, role: 'admin' });
      return;
    }

    const userIdentifier = (req.user as any)?.userId || req.user?.id;

    // Check if the user is assigned as coordinator for this category at all
    const userAssignment = await prisma.coordinatorAccess.findFirst({
      where: {
        category: category as ActivityCategory,
        isActive: true,
        OR: [
          { facultyId: userIdentifier },
          { faculty: { id: req.user?.id } },
          { faculty: { userId: userIdentifier } }
        ]
      }
    });

    if (!userAssignment) {
      res.status(403).json({ error: `Access Denied: You are not assigned as a Coordinator for ${String(category).toUpperCase()}. Only designated category coordinators can modify data.` });
      return;
    }

    const hashed = hashCoordinatorCode(code);
    const access = await prisma.coordinatorAccess.findFirst({
      where: {
        category: category as ActivityCategory,
        codeHash: hashed,
        isActive: true,
        OR: [
          { facultyId: userIdentifier },
          { faculty: { id: req.user?.id } },
          { faculty: { userId: userIdentifier } }
        ]
      },
      include: { faculty: true }
    });

    if (!access) {
      res.status(403).json({ error: 'Invalid Coordinator Authorization Code for your account.' });
      return;
    }

    res.json({
      success: true,
      authorized: true,
      category: access.category,
      facultyName: access.faculty.name,
      facultyId: access.faculty.userId
    });
  } catch (error) {
    console.error('POST /api/activities/verify-code error:', error);
    res.status(500).json({ error: 'Failed to verify coordinator code' });
  }
});

/**
 * POST /api/activities
 * Add a student to an activity category.
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      studentId,
      category,
      titleOrCompany,
      roleOrPosition,
      mentorOrAchievement,
      startDate,
      endDate,
      status,
      coordinatorCode
    } = req.body;

    if (!studentId || !category || !titleOrCompany) {
      res.status(400).json({ error: 'studentId, category, and titleOrCompany are required.' });
      return;
    }

    // Server-side authorization check
    const authCheck = await checkCategoryAuthorization(req, category as ActivityCategory, coordinatorCode);
    if (!authCheck.authorized) {
      res.status(403).json({ error: authCheck.reason || 'Unauthorized operation.' });
      return;
    }

    // Verify student exists
    const studentUser = await prisma.user.findFirst({
      where: {
        OR: [{ userId: studentId }, { id: studentId }],
        role: 'student'
      }
    });

    if (!studentUser) {
      res.status(440).json({ error: `Student '${studentId}' not found.` });
      return;
    }

    const targetUserId = studentUser.userId;

    // Check for existing duplicate active record in the same category & title
    const existing = await prisma.studentActivity.findFirst({
      where: {
        studentId: targetUserId,
        category: category as ActivityCategory,
        titleOrCompany: titleOrCompany.trim(),
        isActive: true
      }
    });

    if (existing) {
      res.status(409).json({ error: `${studentUser.name} is already registered in ${category} for '${titleOrCompany}'.` });
      return;
    }

    const assignedCoordinatorId = req.user!.role === 'admin' ? (req.body.coordinatorId || null) : req.user!.id;

    const newActivity = await prisma.studentActivity.create({
      data: {
        studentId: targetUserId,
        coordinatorId: assignedCoordinatorId,
        category: category as ActivityCategory,
        titleOrCompany: titleOrCompany.trim(),
        roleOrPosition: roleOrPosition?.trim() || null,
        mentorOrAchievement: mentorOrAchievement?.trim() || null,
        startDate: startDate || null,
        endDate: endDate || null,
        status: status || 'active',
        isActive: true,
      },
      include: {
        student: {
          select: {
            id: true,
            userId: true,
            name: true,
            email: true,
            rollNumber: true,
            department: true,
            year: true,
            section: true,
            avatarUrl: true,
          }
        }
      }
    });

    // Write to audit log
    await prisma.activityAuditLog.create({
      data: {
        actorId: req.user!.id,
        actorName: req.user!.name,
        actorRole: req.user!.role,
        action: 'ADD',
        category: category,
        studentId: targetUserId,
        studentName: studentUser.name,
        details: JSON.stringify({
          titleOrCompany,
          roleOrPosition,
          mentorOrAchievement,
          status: newActivity.status
        })
      }
    });

    res.status(201).json({ success: true, activity: newActivity });
  } catch (error) {
    console.error('POST /api/activities error:', error);
    res.status(500).json({ error: 'Failed to add student activity' });
  }
});

/**
 * PUT /api/activities/:id
 * Edit student activity details.
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      titleOrCompany,
      roleOrPosition,
      mentorOrAchievement,
      startDate,
      endDate,
      status,
      coordinatorCode
    } = req.body;

    const existing = await prisma.studentActivity.findUnique({
      where: { id },
      include: { student: true }
    });

    if (!existing || !existing.isActive) {
      res.status(404).json({ error: 'Student activity record not found.' });
      return;
    }

    // Check category authorization
    const authCheck = await checkCategoryAuthorization(req, existing.category, coordinatorCode);
    if (!authCheck.authorized) {
      res.status(403).json({ error: authCheck.reason || 'Unauthorized operation.' });
      return;
    }

    const updated = await prisma.studentActivity.update({
      where: { id },
      data: {
        titleOrCompany: titleOrCompany !== undefined ? titleOrCompany.trim() : existing.titleOrCompany,
        roleOrPosition: roleOrPosition !== undefined ? roleOrPosition.trim() : existing.roleOrPosition,
        mentorOrAchievement: mentorOrAchievement !== undefined ? mentorOrAchievement.trim() : existing.mentorOrAchievement,
        startDate: startDate !== undefined ? startDate : existing.startDate,
        endDate: endDate !== undefined ? endDate : existing.endDate,
        status: status !== undefined ? status : existing.status,
      },
      include: {
        student: {
          select: {
            id: true,
            userId: true,
            name: true,
            email: true,
            rollNumber: true,
            department: true,
            year: true,
            section: true,
            avatarUrl: true,
          }
        }
      }
    });

    // Write to audit log
    await prisma.activityAuditLog.create({
      data: {
        actorId: req.user!.id,
        actorName: req.user!.name,
        actorRole: req.user!.role,
        action: 'EDIT',
        category: existing.category,
        studentId: existing.studentId,
        studentName: existing.student.name,
        details: JSON.stringify({
          before: { titleOrCompany: existing.titleOrCompany, status: existing.status },
          after: { titleOrCompany: updated.titleOrCompany, status: updated.status }
        })
      }
    });

    res.json({ success: true, activity: updated });
  } catch (error) {
    console.error('PUT /api/activities/:id error:', error);
    res.status(500).json({ error: 'Failed to update student activity' });
  }
});

/**
 * DELETE /api/activities/:id
 * Remove student membership from an activity (Soft deletion).
 * Master student user record is NEVER deleted.
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const coordinatorCode = (req.body?.coordinatorCode || req.query?.coordinatorCode || req.headers['x-coordinator-code'] || '').toString();

    const existing = await prisma.studentActivity.findUnique({
      where: { id },
      include: { student: true }
    });

    if (!existing || !existing.isActive) {
      res.status(404).json({ error: 'Student activity record not found.' });
      return;
    }

    // Check category authorization
    const authCheck = await checkCategoryAuthorization(req, existing.category, coordinatorCode);
    if (!authCheck.authorized) {
      res.status(403).json({ error: authCheck.reason || 'Unauthorized operation.' });
      return;
    }

    // Soft delete by setting isActive to false
    await prisma.studentActivity.update({
      where: { id },
      data: { isActive: false }
    });

    // Write audit log
    await prisma.activityAuditLog.create({
      data: {
        actorId: req.user!.id,
        actorName: req.user!.name,
        actorRole: req.user!.role,
        action: 'REMOVE',
        category: existing.category,
        studentId: existing.studentId,
        studentName: existing.student.name,
        details: JSON.stringify({
          removedTitle: existing.titleOrCompany,
          category: existing.category
        })
      }
    });

    res.json({ success: true, message: `Removed ${existing.student.name} from ${existing.category}.` });
  } catch (error) {
    console.error('DELETE /api/activities/:id error:', error);
    res.status(500).json({ error: 'Failed to remove student activity' });
  }
});

/**
 * POST /api/activities/bulk-add
 * Bulk add multiple students to an activity category.
 */
router.post('/bulk-add', async (req: Request, res: Response) => {
  try {
    const {
      studentIds,
      category,
      titleOrCompany,
      roleOrPosition,
      mentorOrAchievement,
      startDate,
      endDate,
      status,
      coordinatorCode
    } = req.body;

    if (!Array.isArray(studentIds) || studentIds.length === 0 || !category || !titleOrCompany) {
      res.status(400).json({ error: 'studentIds (array), category, and titleOrCompany are required.' });
      return;
    }

    // Authorization check
    const authCheck = await checkCategoryAuthorization(req, category as ActivityCategory, coordinatorCode);
    if (!authCheck.authorized) {
      res.status(403).json({ error: authCheck.reason || 'Unauthorized operation.' });
      return;
    }

    const students = await prisma.user.findMany({
      where: {
        OR: [{ userId: { in: studentIds } }, { id: { in: studentIds } }],
        role: 'student'
      }
    });

    let addedCount = 0;
    let skippedCount = 0;
    const addedNames: string[] = [];

    const assignedCoordinatorId = req.user!.role === 'admin' ? (req.body.coordinatorId || null) : req.user!.id;

    for (const student of students) {
      const existing = await prisma.studentActivity.findFirst({
        where: {
          studentId: student.userId,
          category: category as ActivityCategory,
          titleOrCompany: titleOrCompany.trim(),
          isActive: true
        }
      });

      if (existing) {
        skippedCount++;
        continue;
      }

      await prisma.studentActivity.create({
        data: {
          studentId: student.userId,
          coordinatorId: assignedCoordinatorId,
          category: category as ActivityCategory,
          titleOrCompany: titleOrCompany.trim(),
          roleOrPosition: roleOrPosition?.trim() || null,
          mentorOrAchievement: mentorOrAchievement?.trim() || null,
          startDate: startDate || null,
          endDate: endDate || null,
          status: status || 'active',
          isActive: true
        }
      });

      addedCount++;
      addedNames.push(student.name);
    }

    // Audit log
    await prisma.activityAuditLog.create({
      data: {
        actorId: req.user!.id,
        actorName: req.user!.name,
        actorRole: req.user!.role,
        action: 'BULK_ADD',
        category: category,
        details: JSON.stringify({
          count: addedCount,
          skipped: skippedCount,
          students: addedNames,
          titleOrCompany
        })
      }
    });

    res.json({
      success: true,
      addedCount,
      skippedCount,
      message: `Added ${addedCount} student(s) to ${category}. (${skippedCount} skipped as duplicate)`
    });
  } catch (error) {
    console.error('POST /api/activities/bulk-add error:', error);
    res.status(500).json({ error: 'Failed to bulk add student activities' });
  }
});

/**
 * POST /api/activities/bulk-remove
 * Bulk remove multiple student activity records (Soft delete).
 */
router.post('/bulk-remove', async (req: Request, res: Response) => {
  try {
    const { activityIds, coordinatorCode } = req.body;

    if (!Array.isArray(activityIds) || activityIds.length === 0) {
      res.status(400).json({ error: 'activityIds array is required.' });
      return;
    }

    const records = await prisma.studentActivity.findMany({
      where: {
        id: { in: activityIds },
        isActive: true
      },
      include: { student: true }
    });

    if (records.length === 0) {
      res.status(404).json({ error: 'No active student activity records found to remove.' });
      return;
    }

    // Group records by category to check authorization per category
    const categories = Array.from(new Set(records.map(r => r.category)));
    for (const cat of categories) {
      const authCheck = await checkCategoryAuthorization(req, cat, coordinatorCode);
      if (!authCheck.authorized) {
        res.status(403).json({ error: `Unauthorized to remove records for category '${cat}': ${authCheck.reason}` });
        return;
      }
    }

    // Soft delete all selected records
    await prisma.studentActivity.updateMany({
      where: { id: { in: activityIds } },
      data: { isActive: false }
    });

    // Write audit log
    await prisma.activityAuditLog.create({
      data: {
        actorId: req.user!.id,
        actorName: req.user!.name,
        actorRole: req.user!.role,
        action: 'BULK_REMOVE',
        category: categories.join(', '),
        details: JSON.stringify({
          removedCount: records.length,
          students: records.map(r => ({ name: r.student.name, category: r.category, title: r.titleOrCompany }))
        })
      }
    });

    res.json({
      success: true,
      removedCount: records.length,
      message: `Successfully removed ${records.length} student activity membership(s).`
    });
  } catch (error) {
    console.error('POST /api/activities/bulk-remove error:', error);
    res.status(500).json({ error: 'Failed to bulk remove student activities' });
  }
});

/**
 * GET /api/activities/audit-logs
 * Fetch audit log history. Accessible to Admin and Coordinators.
 */
router.get('/audit-logs', async (req: Request, res: Response) => {
  try {
    const { category, limit } = req.query;

    const whereClause: any = {};
    if (category && typeof category === 'string' && category !== 'all') {
      whereClause.category = category;
    }

    const take = limit ? parseInt(limit as string, 10) : 50;

    const logs = await prisma.activityAuditLog.findMany({
      where: whereClause,
      orderBy: { timestamp: 'desc' },
      take: isNaN(take) ? 50 : Math.min(take, 200)
    });

    res.json({ success: true, count: logs.length, logs });
  } catch (error) {
    console.error('GET /api/activities/audit-logs error:', error);
    res.status(500).json({ error: 'Failed to fetch activity audit logs' });
  }
});

export default router;
