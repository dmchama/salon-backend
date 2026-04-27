import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('Admin123!', 12);

  await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      passwordHash,
      role: Role.SUPER_ADMIN,
      firstName: 'System',
      lastName: 'Admin',
    },
  });

  await prisma.subscriptionPlan.upsert({
    where: { id: 'seed-plan-basic' },
    update: {},
    create: {
      id: 'seed-plan-basic',
      name: 'Basic',
      description: 'Essential listing and bookings',
      priceCents: 199_900,
      currency: 'LKR',
      intervalMonths: 1,
      features: [
        'Up to 50 bookings/month',
        'Basic salon profile',
        'Email support',
        '1 staff member',
      ],
      active: true,
    },
  });

  await prisma.subscriptionPlan.upsert({
    where: { id: 'seed-plan-professional' },
    update: {},
    create: {
      id: 'seed-plan-professional',
      name: 'Professional',
      description: 'Full profile, analytics, and priority support',
      priceCents: 499_900,
      currency: 'LKR',
      intervalMonths: 1,
      features: [
        'Unlimited bookings',
        'Full salon profile with gallery',
        'Priority support',
        'Up to 5 staff',
        'Analytics dashboard',
      ],
      active: true,
    },
  });

  await prisma.subscriptionPlan.upsert({
    where: { id: 'seed-plan-enterprise' },
    update: {},
    create: {
      id: 'seed-plan-enterprise',
      name: 'Enterprise',
      description: 'Multi-branch and dedicated support',
      priceCents: 999_900,
      currency: 'LKR',
      intervalMonths: 1,
      features: [
        'Everything in Professional',
        'Multiple branches',
        'Dedicated account manager',
        'Custom branding',
        'API access',
      ],
      active: true,
    },
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
