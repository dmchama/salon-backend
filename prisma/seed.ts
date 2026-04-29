import { PrismaClient, BookingStatus, SalonStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function hash(plain: string) {
  return bcrypt.hash(plain, 10);
}

function slot(daysFromNow: number, hour: number, durationMin: number) {
  const start = new Date();
  start.setDate(start.getDate() + daysFromNow);
  start.setHours(hour, 0, 0, 0);
  const end = new Date(start.getTime() + durationMin * 60_000);
  return { startAt: start, endAt: end };
}

function bh(days: Record<string, [string, string] | null>) {
  return Object.fromEntries(
    Object.entries(days).map(([d, v]) => [d, v ? { open: v[0], close: v[1] } : null]),
  );
}

async function main() {
  console.log('Cleaning previous seed data...');
  await prisma.booking.deleteMany({});
  await prisma.galleryItem.deleteMany({});
  await prisma.service.deleteMany({});
  await prisma.technician.deleteMany({});
  await prisma.salon.deleteMany({});
  await prisma.ownerSubscription.deleteMany({});
  await prisma.subscriptionPlan.deleteMany({});
  await prisma.user.deleteMany({});

  console.log('Seeding fresh data...\n');

  // ─── Subscription Plans ───────────────────────────────────────────────────
  const [planBasic, planPro, planEnterprise] = await Promise.all([
    prisma.subscriptionPlan.create({
      data: {
        name: 'Basic',
        description: 'Perfect for solo stylists just getting started.',
        priceCents: 199_900,
        currency: 'LKR',
        intervalMonths: 1,
        features: ['1 salon listing', 'Up to 50 bookings/month', 'Basic booking management', '1 staff member'],
        active: true,
      },
    }),
    prisma.subscriptionPlan.create({
      data: {
        name: 'Professional',
        description: 'For growing salons that need more power.',
        priceCents: 499_900,
        currency: 'LKR',
        intervalMonths: 1,
        features: ['3 salon listings', 'Unlimited bookings', 'Technician management', 'Gallery uploads', 'Priority support', 'Up to 5 staff'],
        active: true,
      },
    }),
    prisma.subscriptionPlan.create({
      data: {
        name: 'Enterprise',
        description: 'Full-featured plan for salon chains.',
        priceCents: 999_900,
        currency: 'LKR',
        intervalMonths: 1,
        features: ['Unlimited salons', 'Dedicated account manager', 'Analytics dashboard', 'API access', 'Custom branding'],
        active: true,
      },
    }),
  ]);
  console.log('  ✓ Subscription plans');

  // ─── Users ────────────────────────────────────────────────────────────────
  const pw = await hash('password123');

  const [, owner1, owner2, owner3] = await Promise.all([
    prisma.user.create({ data: { email: 'admin@salonapp.com', passwordHash: pw, role: 'SUPER_ADMIN', accountStatus: 'ACTIVE', firstName: 'Alex', lastName: 'Rivera', phone: '+94-77-000-0001' } }),
    prisma.user.create({ data: { email: 'sophia@glamourstudio.lk', passwordHash: pw, role: 'SALON_ADMIN', accountStatus: 'ACTIVE', firstName: 'Sophia', lastName: 'Perera', phone: '+94-77-100-0001' } }),
    prisma.user.create({ data: { email: 'james@urbancuts.lk', passwordHash: pw, role: 'SALON_ADMIN', accountStatus: 'ACTIVE', firstName: 'James', lastName: 'Fernando', phone: '+94-77-200-0001' } }),
    prisma.user.create({ data: { email: 'nina@luxenails.lk', passwordHash: pw, role: 'SALON_ADMIN', accountStatus: 'PENDING', firstName: 'Nina', lastName: 'Jayawardena', phone: '+94-77-300-0001' } }),
  ]);
  console.log('  ✓ Users');

  // ─── Owner Subscriptions (back-dated so monthly trend has data) ───────────
  const now = new Date();
  const monthsAgo = (n: number) => {
    const d = new Date(now);
    d.setMonth(d.getMonth() - n);
    return d;
  };

  await Promise.all([
    prisma.ownerSubscription.create({ data: { ownerId: owner1.id, planId: planPro.id, startsAt: monthsAgo(2), expiresAt: monthsAgo(-1), status: 'ACTIVE' } }),
    prisma.ownerSubscription.create({ data: { ownerId: owner2.id, planId: planBasic.id, startsAt: monthsAgo(1), expiresAt: monthsAgo(-1), status: 'ACTIVE' } }),
    prisma.ownerSubscription.create({ data: { ownerId: owner3.id, planId: planEnterprise.id, startsAt: monthsAgo(3), expiresAt: monthsAgo(-3), status: 'ACTIVE' } }),
    // A few historical expired subscriptions for revenue trend
    prisma.ownerSubscription.create({ data: { ownerId: owner1.id, planId: planBasic.id, startsAt: monthsAgo(5), expiresAt: monthsAgo(4), status: 'EXPIRED' } }),
    prisma.ownerSubscription.create({ data: { ownerId: owner2.id, planId: planPro.id, startsAt: monthsAgo(4), expiresAt: monthsAgo(3), status: 'EXPIRED' } }),
    prisma.ownerSubscription.create({ data: { ownerId: owner3.id, planId: planPro.id, startsAt: monthsAgo(3), expiresAt: monthsAgo(2), status: 'EXPIRED' } }),
  ]);
  console.log('  ✓ Owner subscriptions');

  // ─── Salons ───────────────────────────────────────────────────────────────
  const [salon1, salon2, salon3] = await Promise.all([
    prisma.salon.create({
      data: {
        ownerId: owner1.id, name: 'Glamour Studio Colombo', slug: 'glamour-studio-colombo',
        description: 'A premier hair and beauty salon in the heart of Colombo. Specialising in colour, cuts, and luxury treatments.',
        address: '45 Galle Road, Colombo 03', city: 'Colombo', country: 'LK',
        contactPhone: '+94-11-100-1000', contactEmail: 'hello@glamourstudio.lk', websiteUrl: 'https://glamourstudio.lk',
        businessHours: bh({ mon: ['09:00','19:00'], tue: ['09:00','19:00'], wed: ['09:00','19:00'], thu: ['09:00','20:00'], fri: ['09:00','20:00'], sat: ['10:00','18:00'], sun: null }),
        status: SalonStatus.PUBLISHED,
      },
    }),
    prisma.salon.create({
      data: {
        ownerId: owner2.id, name: 'Urban Cuts Kandy', slug: 'urban-cuts-kandy',
        description: 'Trendy barbershop and hair salon for men and women. Expert fades, tapers, and modern styles.',
        address: '12 Peradeniya Road, Kandy', city: 'Kandy', country: 'LK',
        contactPhone: '+94-81-200-2000', contactEmail: 'book@urbancuts.lk',
        businessHours: bh({ mon: ['10:00','20:00'], tue: ['10:00','20:00'], wed: ['10:00','20:00'], thu: ['10:00','20:00'], fri: ['10:00','21:00'], sat: ['09:00','21:00'], sun: ['11:00','17:00'] }),
        status: SalonStatus.PUBLISHED,
      },
    }),
    prisma.salon.create({
      data: {
        ownerId: owner3.id, name: 'Luxe Nails & Spa Galle', slug: 'luxe-nails-spa-galle',
        description: 'Upscale nail salon and day spa offering manicures, pedicures, gel, acrylics, and full body treatments.',
        address: '7 Church Street, Galle Fort', city: 'Galle', country: 'LK',
        contactPhone: '+94-91-300-3000', contactEmail: 'appointments@luxenails.lk', websiteUrl: 'https://luxenails.lk',
        businessHours: bh({ mon: ['09:00','20:00'], tue: ['09:00','20:00'], wed: ['09:00','20:00'], thu: ['09:00','20:00'], fri: ['09:00','21:00'], sat: ['09:00','21:00'], sun: ['10:00','18:00'] }),
        status: SalonStatus.PUBLISHED,
      },
    }),
  ]);

  await prisma.salon.create({
    data: {
      ownerId: owner1.id, name: 'Glamour Studio Nugegoda', slug: 'glamour-studio-nugegoda',
      description: 'Coming soon — our new Nugegoda branch.',
      address: '22 High Level Road, Nugegoda', city: 'Nugegoda', country: 'LK',
      status: SalonStatus.DRAFT,
    },
  });
  console.log('  ✓ Salons');

  // ─── Services ─────────────────────────────────────────────────────────────
  const [svc1a, svc1b, svc1c, svc1d] = await Promise.all([
    prisma.service.create({ data: { salonId: salon1.id, name: "Women's Haircut & Blowout", durationMin: 60,  priceCents: 350_000, sortOrder: 1 } }),
    prisma.service.create({ data: { salonId: salon1.id, name: 'Full Colour', description: 'Single-process colour from roots to ends.', durationMin: 120, priceCents: 700_000, sortOrder: 2 } }),
    prisma.service.create({ data: { salonId: salon1.id, name: 'Balayage / Highlights', durationMin: 150, priceCents: 1_200_000, sortOrder: 3 } }),
    prisma.service.create({ data: { salonId: salon1.id, name: 'Keratin Treatment', durationMin: 180, priceCents: 1_800_000, sortOrder: 4 } }),
  ]);

  const [svc2a, svc2b, svc2c] = await Promise.all([
    prisma.service.create({ data: { salonId: salon2.id, name: "Men's Haircut", durationMin: 30, priceCents: 150_000, sortOrder: 1 } }),
    prisma.service.create({ data: { salonId: salon2.id, name: 'Fade + Lineup',  durationMin: 45, priceCents: 200_000, sortOrder: 2 } }),
    prisma.service.create({ data: { salonId: salon2.id, name: 'Beard Trim & Shape', durationMin: 20, priceCents: 100_000, sortOrder: 3 } }),
  ]);

  const [svc3a, svc3b, svc3c, svc3d] = await Promise.all([
    prisma.service.create({ data: { salonId: salon3.id, name: 'Classic Manicure', durationMin: 45, priceCents: 180_000, sortOrder: 1 } }),
    prisma.service.create({ data: { salonId: salon3.id, name: 'Gel Manicure',     durationMin: 60, priceCents: 280_000, sortOrder: 2 } }),
    prisma.service.create({ data: { salonId: salon3.id, name: 'Classic Pedicure', durationMin: 60, priceCents: 220_000, sortOrder: 3 } }),
    prisma.service.create({ data: { salonId: salon3.id, name: 'Acrylic Full Set', durationMin: 90, priceCents: 400_000, sortOrder: 4 } }),
  ]);
  console.log('  ✓ Services');

  // ─── Technicians ──────────────────────────────────────────────────────────
  const [tech1a, tech1b] = await Promise.all([
    prisma.technician.create({ data: { salonId: salon1.id, name: 'Ishara Wickramasinghe', email: 'ishara@glamourstudio.lk', phone: '+94-77-101-0001', specialization: 'Colour specialist, Balayage expert', sortOrder: 1 } }),
    prisma.technician.create({ data: { salonId: salon1.id, name: 'Marcus De Silva',       email: 'marcus@glamourstudio.lk', phone: '+94-77-101-0002', specialization: 'Haircuts, Keratin treatments', sortOrder: 2 } }),
  ]);

  const [tech2a, tech2b] = await Promise.all([
    prisma.technician.create({ data: { salonId: salon2.id, name: 'Dilan Rajapaksa', email: 'dilan@urbancuts.lk', phone: '+94-77-201-0001', specialization: 'Fades, Tapers, Modern cuts', sortOrder: 1 } }),
    prisma.technician.create({ data: { salonId: salon2.id, name: 'Kenji Tanaka',    email: 'kenji@urbancuts.lk', phone: '+94-77-201-0002', specialization: 'Modern cuts, Beard grooming', sortOrder: 2 } }),
  ]);

  const [tech3a, tech3b] = await Promise.all([
    prisma.technician.create({ data: { salonId: salon3.id, name: 'Nimesha Amarasinghe', email: 'nimesha@luxenails.lk', phone: '+94-77-301-0001', specialization: 'Nail art, Gel, Acrylics', sortOrder: 1 } }),
    prisma.technician.create({ data: { salonId: salon3.id, name: 'Priya Bandara',       email: 'priya@luxenails.lk',   phone: '+94-77-301-0002', specialization: 'Pedicures, Spa treatments', sortOrder: 2 } }),
  ]);
  console.log('  ✓ Technicians');

  // ─── Gallery Items ────────────────────────────────────────────────────────
  await prisma.galleryItem.createMany({
    data: [
      { salonId: salon1.id, url: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800', caption: 'Our signature balayage', sortOrder: 1 },
      { salonId: salon1.id, url: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=800', caption: 'Colour transformation', sortOrder: 2 },
      { salonId: salon1.id, url: 'https://images.unsplash.com/photo-1492106087820-71f1a00d2b11?w=800', caption: 'Salon interior', sortOrder: 3 },
      { salonId: salon2.id, url: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=800', caption: 'Clean fade', sortOrder: 1 },
      { salonId: salon2.id, url: 'https://images.unsplash.com/photo-1599351431202-1e0f0137899a?w=800', caption: 'Beard lineup', sortOrder: 2 },
      { salonId: salon3.id, url: 'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=800', caption: 'Gel nail art', sortOrder: 1 },
      { salonId: salon3.id, url: 'https://images.unsplash.com/photo-1604654894600-df63bc536370?w=800', caption: 'French manicure', sortOrder: 2 },
    ],
  });
  console.log('  ✓ Gallery items');

  // ─── Bookings (spread over past months for trend data) ────────────────────
  function pastSlot(daysAgo: number, hour: number, durationMin: number) {
    const start = new Date();
    start.setDate(start.getDate() - daysAgo);
    start.setHours(hour, 0, 0, 0);
    const end = new Date(start.getTime() + durationMin * 60_000);
    return { startAt: start, endAt: end };
  }

  await prisma.booking.createMany({
    data: [
      // Salon 1 — future
      { salonId: salon1.id, serviceId: svc1a.id, technicianId: tech1a.id, guestName: 'Amali Gunawardena',    guestEmail: 'amali.g@gmail.com',   guestPhone: '+94-77-900-0001', ...slot(1,  10, 60),  status: BookingStatus.PENDING },
      { salonId: salon1.id, serviceId: svc1b.id, technicianId: tech1b.id, guestName: 'Sachini Rathnayake',   guestEmail: 'sachini.r@gmail.com', guestPhone: '+94-77-900-0002', ...slot(2,  14, 120), status: BookingStatus.CONFIRMED, notes: 'Wants to go 2 shades lighter.' },
      { salonId: salon1.id, serviceId: svc1c.id, technicianId: tech1a.id, guestName: 'Dulani Senanayake',    guestEmail: 'dulani.s@gmail.com',                                  ...slot(3,  11, 150), status: BookingStatus.CONFIRMED },
      // Salon 1 — past this month
      { salonId: salon1.id, serviceId: svc1d.id, technicianId: tech1b.id, guestName: 'Tharaka Kumara',       guestEmail: 'tharaka.k@gmail.com',                                 ...pastSlot(5,  10, 180), status: BookingStatus.COMPLETED },
      { salonId: salon1.id, serviceId: svc1a.id, technicianId: tech1a.id, guestName: 'Nadeeka Weerasinghe',  guestEmail: 'nadeeka.w@gmail.com',                                 ...pastSlot(2,  15, 60),  status: BookingStatus.CANCELLED },
      // Salon 1 — last month
      { salonId: salon1.id, serviceId: svc1b.id, technicianId: tech1b.id, guestName: 'Sandamali Peiris',     guestEmail: 'sandamali.p@gmail.com',                               ...pastSlot(35, 10, 120), status: BookingStatus.COMPLETED },
      { salonId: salon1.id, serviceId: svc1c.id, technicianId: tech1a.id, guestName: 'Thilini Bandara',      guestEmail: 'thilini.b@gmail.com',                                 ...pastSlot(40, 14, 150), status: BookingStatus.COMPLETED },
      // Salon 1 — 2 months ago
      { salonId: salon1.id, serviceId: svc1d.id, technicianId: tech1b.id, guestName: 'Malsha Rajapaksa',     guestEmail: 'malsha.r@gmail.com',                                  ...pastSlot(65, 11, 180), status: BookingStatus.COMPLETED },

      // Salon 2 — future
      { salonId: salon2.id, serviceId: svc2b.id, technicianId: tech2a.id, guestName: 'Ravindu Jayasinghe',   guestEmail: 'ravindu.j@gmail.com', guestPhone: '+94-77-910-0001', ...slot(1,  11, 45),  status: BookingStatus.PENDING },
      { salonId: salon2.id, serviceId: svc2a.id, technicianId: tech2b.id, guestName: 'Kasun Perera',         guestEmail: 'kasun.p@gmail.com',                                   ...slot(2,  9,  30),  status: BookingStatus.CONFIRMED },
      { salonId: salon2.id, serviceId: svc2c.id, technicianId: tech2a.id, guestName: 'Buddhika Silva',       guestEmail: 'buddhika.s@gmail.com',                                ...slot(0,  16, 20),  status: BookingStatus.CONFIRMED },
      // Salon 2 — past
      { salonId: salon2.id, serviceId: svc2b.id, technicianId: tech2b.id, guestName: 'Naveen Fernando',      guestEmail: 'naveen.f@gmail.com',                                  ...pastSlot(3,  12, 45),  status: BookingStatus.COMPLETED },
      { salonId: salon2.id, serviceId: svc2a.id, technicianId: tech2a.id, guestName: 'Chathura Madusanka',   guestEmail: 'chathura.m@gmail.com',                                ...pastSlot(1,  14, 30),  status: BookingStatus.NO_SHOW },
      { salonId: salon2.id, serviceId: svc2b.id, technicianId: tech2b.id, guestName: 'Isuru Gallage',        guestEmail: 'isuru.g@gmail.com',                                   ...pastSlot(38, 10, 45),  status: BookingStatus.COMPLETED },
      { salonId: salon2.id, serviceId: svc2a.id, technicianId: tech2a.id, guestName: 'Dinesh Alwis',         guestEmail: 'dinesh.a@gmail.com',                                  ...pastSlot(70, 15, 30),  status: BookingStatus.COMPLETED },

      // Salon 3 — future
      { salonId: salon3.id, serviceId: svc3b.id, technicianId: tech3a.id, guestName: 'Thisari Herath',       guestEmail: 'thisari.h@gmail.com', guestPhone: '+94-77-920-0001', ...slot(1,  10, 60),  status: BookingStatus.PENDING },
      { salonId: salon3.id, serviceId: svc3d.id, technicianId: tech3a.id, guestName: 'Sanduni Mendis',       guestEmail: 'sanduni.m@gmail.com',                                 ...slot(2,  13, 90),  status: BookingStatus.PENDING, notes: 'Wants coffin shape, hot pink.' },
      { salonId: salon3.id, serviceId: svc3c.id, technicianId: tech3b.id, guestName: 'Oshadi Hirimuthugoda', guestEmail: 'oshadi.h@gmail.com',                                  ...slot(3,  15, 60),  status: BookingStatus.CONFIRMED },
      // Salon 3 — past
      { salonId: salon3.id, serviceId: svc3a.id, technicianId: tech3b.id, guestName: 'Dilukshi Gamage',      guestEmail: 'dilukshi.g@gmail.com',                                ...pastSlot(4,  11, 45),  status: BookingStatus.COMPLETED },
      { salonId: salon3.id, serviceId: svc3b.id, technicianId: tech3a.id, guestName: 'Sewwandi Karunarathne',guestEmail: 'sewwandi.k@gmail.com',                                ...pastSlot(7,  9,  60),  status: BookingStatus.COMPLETED },
      { salonId: salon3.id, serviceId: svc3c.id, technicianId: tech3b.id, guestName: 'Hasini Dilshan',       guestEmail: 'hasini.d@gmail.com',                                  ...pastSlot(42, 14, 60),  status: BookingStatus.COMPLETED },
      { salonId: salon3.id, serviceId: svc3d.id, technicianId: tech3a.id, guestName: 'Sachithra Wijewardena',guestEmail: 'sachithra.w@gmail.com',                               ...pastSlot(75, 10, 90),  status: BookingStatus.COMPLETED },
    ],
  });
  console.log('  ✓ Bookings (22 across 3 salons, spread over 3 months)');

  console.log('\n─────────────────────────────────────────────────────────────');
  console.log('Seed complete!  All passwords: password123');
  console.log('');
  console.log('  Super Admin  admin@salonapp.com');
  console.log('  Salon Admin  sophia@glamourstudio.lk   → Glamour Studio Colombo');
  console.log('  Salon Admin  james@urbancuts.lk        → Urban Cuts Kandy');
  console.log('  Salon Admin  nina@luxenails.lk         → Luxe Nails & Spa Galle');
  console.log('─────────────────────────────────────────────────────────────');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
