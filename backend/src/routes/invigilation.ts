/**
 * invigilation.ts
 *
 * Faculty-facing endpoints for invigilation duties.
 *
 * GET /api/invigilation/my-duties — Returns assigned invigilation duties for the logged-in faculty
 *                                    within the 3-calendar-day window (Asia/Kolkata), excluding completed duties.
 */
import { Router } from 'express';
import type { Request, Response } from 'express';
import { prisma } from '../db/prisma.js';
import { verifyToken } from '../middleware/auth.js';

const router = Router();

/**
 * Returns today's date and the date +3 calendar days from now, in Asia/Kolkata (IST),
 * as YYYY-MM-DD strings. This is used to filter visible duties for faculty.
 */
function getKolkataDateBounds(now: Date = new Date()): { todayDate: string; maxDate: string } {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const parts = formatter.format(now).split('-');
  const year = parseInt(parts[0]!, 10);
  const month = parseInt(parts[1]!, 10) - 1;
  const day = parseInt(parts[2]!, 10);

  const todayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  // +3 calendar days
  const plus3 = new Date(Date.UTC(year, month, day + 3));
  const plus3Parts = formatter.format(plus3).split('-');
  const maxStr = plus3Parts.join('-');

  return { todayDate: todayStr, maxDate: maxStr };
}

/**
 * GET /api/invigilation/my-duties
 * Authenticated faculty endpoint.
 */
router.get('/my-duties', verifyToken, async (req: Request, res: Response) => {
  try {
    const authUser = req.user;

    if (!authUser || (authUser.role !== 'faculty' && authUser.role !== 'hod')) {
      res.status(403).json({ error: 'Access denied. Faculty role required.' });
      return;
    }

    // Resolve exact database user
    const dbUser = await prisma.user.findFirst({
      where: {
        OR: [
          { id: authUser.id },
          { userId: authUser.id },
          { email: authUser.email },
        ],
        role: { in: ['faculty', 'hod'] },
      },
      select: { id: true, userId: true, name: true, department: true },
    });

    if (!dbUser) {
      res.status(404).json({ error: 'Faculty account not found.' });
      return;
    }

    const { todayDate, maxDate } = getKolkataDateBounds();
    const showAll = req.query['all'] === 'true' || req.query['scope'] === 'all' || req.query['history'] === 'true';

    // Query assignments for logged-in faculty (within 3-day window by default, or all if requested)
    const duties = await prisma.invigilationDuty.findMany({
      where: {
        assignments: {
          some: { facultyId: dbUser.id },
        },
        ...(showAll ? {} : {
          date: {
            gte: todayDate,
            lte: maxDate,
          },
        }),
      },
      include: {
        assignments: {
          include: {
            faculty: {
              select: { id: true, name: true, department: true, email: true },
            },
          },
        },
      },
      orderBy: [{ date: 'asc' }, { session: 'asc' }],
    });

    const formattedDuties = duties.map((duty) => {
      const isPast = duty.date < todayDate;
      const isToday = duty.date === todayDate;
      const coInvigilators = duty.assignments
        .filter((a) => a.facultyId !== dbUser.id)
        .map((a) => ({
          id: a.faculty.id,
          name: a.faculty.name,
          department: a.faculty.department,
          email: a.faculty.email,
        }));

      return {
        id:              duty.id,
        examType:        duty.examType,
        date:            duty.date,
        session:         duty.session,
        startTime:       duty.startTime ?? null,
        endTime:         duty.endTime ?? null,
        status:          isPast ? ('COMPLETED' as const) : ('UPCOMING' as const),
        isToday,
        isPast,
        coInvigilators,
      };
    });

    res.json({
      duties: formattedDuties,
      total: formattedDuties.length,
    });
  } catch (err) {
    console.error('[FacultyInvigilationError]', err);
    res.status(500).json({ error: 'Failed to retrieve invigilation duties.' });
  }
});

export default router;
