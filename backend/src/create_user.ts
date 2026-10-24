import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    const roll = '25B91A07B3';
    const hashedPassword = await bcrypt.hash(roll, 10);

    // Try inserting or updating the user
    const user = await prisma.user.upsert({
        where: { rollNumber: roll },
        update: {
            name: roll,
            password: hashedPassword,
        },
        create: {
            userId: `stu-${roll}`,
            name: roll,
            email: `${roll.toLowerCase()}@college.edu`,
            role: 'student' as any,
            department: 'CSIT',
            rollNumber: roll,
            semester: 6,
            password: hashedPassword,
        },
    });

    console.log('✅ Successfully created user:');
    console.log({
        rollNumber: user.rollNumber,
        name: user.name,
        password: roll,
    });
}

main()
    .catch((err) => {
        console.error('❌ Error creating user:', err);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });