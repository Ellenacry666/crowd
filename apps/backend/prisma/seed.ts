import { EventStatus, PrismaClient, Role } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

async function upsertUser(name: string, email: string, password: string, role: Role) {
  const passwordHash = await argon2.hash(password);
  return prisma.user.upsert({
    where: { email },
    update: { name, role, isActive: true },
    create: { name, email, passwordHash, role },
  });
}

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Seed data is for demo only and must not run in production.');
  }

  // DEMO ONLY credentials
  const admin = await upsertUser('Admin CrowdPulse', 'admin@crowdpulse.test', 'Admin123!', Role.ADMIN);
  const staff = await upsertUser('Petugas Gerbang 1', 'staff@crowdpulse.test', 'Staff123!', Role.GATE_STAFF);
  await upsertUser('Customer Demo', 'customer@crowdpulse.test', 'Customer123!', Role.CUSTOMER);

  const now = Date.now();
  const events = [
    {
      slug: 'crowdpulse-music-fest-2026',
      title: 'CrowdPulse Music Fest 2026',
      category: 'Music',
      description: 'Festival musik akhir tahun dengan penampil lokal dan nasional. (Data demo)',
      location: 'Lapangan Utama Kampus, Bandung',
      startAt: new Date(now + 30 * DAY),
      endAt: new Date(now + 30 * DAY + 6 * HOUR),
      posterUrl: 'https://picsum.photos/seed/crowdpulse-music/800/450',
      status: EventStatus.PUBLISHED,
      categories: [
        { name: 'Regular', price: 150000, quota: 100 },
        { name: 'VIP', price: 350000, quota: 30 },
      ],
    },
    {
      slug: 'campus-tech-talk',
      title: 'Campus Tech Talk',
      category: 'Education',
      description: 'Seminar teknologi bersama praktisi industri. (Data demo)',
      location: 'Aula Gedung Serbaguna, Jakarta',
      startAt: new Date(now + 14 * DAY),
      endAt: new Date(now + 14 * DAY + 3 * HOUR),
      posterUrl: 'https://picsum.photos/seed/crowdpulse-tech/800/450',
      status: EventStatus.PUBLISHED,
      categories: [{ name: 'General', price: 50000, quota: 200 }],
    },
    {
      slug: 'draft-private-showcase',
      title: 'Draft Private Showcase',
      category: 'Exhibition',
      description: 'Acara berstatus DRAFT, tidak boleh tampil di daftar publik. (Data demo)',
      location: 'Galeri Kota, Surabaya',
      startAt: new Date(now + 60 * DAY),
      endAt: new Date(now + 60 * DAY + 4 * HOUR),
      posterUrl: null,
      status: EventStatus.DRAFT,
      categories: [{ name: 'General', price: 75000, quota: 50 }],
    },
  ];

  for (const { categories, ...eventData } of events) {
    const event = await prisma.event.upsert({
      where: { slug: eventData.slug },
      update: {},
      create: eventData,
    });

    for (const c of categories) {
      await prisma.ticketCategory.upsert({
        where: { eventId_name: { eventId: event.id, name: c.name } },
        update: {},
        create: { ...c, eventId: event.id },
      });
    }

    if (eventData.status === EventStatus.PUBLISHED) {
      await prisma.staffAssignment.upsert({
        where: { staffId_eventId: { staffId: staff.id, eventId: event.id } },
        update: {},
        create: { staffId: staff.id, eventId: event.id },
      });
    }
  }

  console.log(`Seed selesai. Admin: ${admin.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
