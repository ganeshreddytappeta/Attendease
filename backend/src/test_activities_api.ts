import jwt from 'jsonwebtoken';
import { prisma } from './db/prisma.js';

async function test() {
  const faculty = await prisma.user.findFirst({ where: { role: 'faculty' } });
  if (!faculty) {
    console.log('No faculty found');
    return;
  }
  const token = jwt.sign(
    { id: faculty.id, userId: faculty.userId, role: faculty.role, email: faculty.email },
    process.env.JWT_SECRET || 'attendease_secret_key_2026',
    { expiresIn: '7d' }
  );

  for (const cat of ['internship', 'startup', 'project_work', 'sports', 'house_events']) {
    const res = await fetch(`http://localhost:3000/api/activities?category=${cat}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log(`Cat: ${cat} -> Status: ${res.status}`);
    const data = await res.json();
    console.log(`Cat: ${cat} -> Count:`, data.count, 'Activities length:', data.activities?.length);
    if (data.activities?.length > 0) {
      console.log(`Sample [${cat}]:`, data.activities[0].student?.name, data.activities[0].titleOrCompany);
    }
  }
}

test().finally(() => prisma.$disconnect());
