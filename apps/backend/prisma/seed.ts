import { CameraType, EventStatus, PrismaClient, Role } from '@prisma/client';
import * as argon2 from 'argon2';
import { createHash } from 'crypto';

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

  await seedLiveConcert();

  console.log(`Seed selesai. Admin: ${admin.email}`);
}

// API key demo bersifat tetap agar skrip simulator dapat dipakai tanpa menyalin key. Seed ini menolak jalan di production.
export const DEMO_GATE_KEY = 'cpk_demo_gate_key_0123456789abcdef0123456789';
export const DEMO_CROWD_KEY = 'cpk_demo_crowd_key_0123456789abcdef012345678';
const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

/** PRNG deterministik sederhana agar data demo konsisten antar seed. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Konser yang sedang berlangsung: kamera gate + crowd, lineup, dan riwayat 2,5 jam terakhir. */
async function seedLiveConcert() {
  const MIN = 60 * 1000;
  const now = Date.now();
  const at = (offsetMin: number) => new Date(now + offsetMin * MIN);

  const eventData = {
    title: 'Konser Live Demo',
    category: 'Music',
    description: 'Konser yang sedang berlangsung untuk mendemokan dashboard crowd monitoring. (Data demo)',
    location: 'Lapangan Utama Kampus, Bandung',
    startAt: at(-150),
    endAt: at(150),
    posterUrl: 'https://picsum.photos/seed/crowdpulse-live/800/450',
    status: EventStatus.PUBLISHED,
  };
  const event = await prisma.event.upsert({
    where: { slug: 'konser-live-demo' },
    update: eventData,
    create: { slug: 'konser-live-demo', ...eventData },
  });

  // Reset data monitoring agar waktu relatif terhadap "sekarang".
  await prisma.crowdSnapshot.deleteMany({ where: { eventId: event.id } });
  await prisma.lineup.deleteMany({ where: { eventId: event.id } });

  const capacity = 1500;
  const gate = await prisma.camera.upsert({
    where: { eventId_type: { eventId: event.id, type: CameraType.GATE } },
    update: { apiKeyHash: sha256(DEMO_GATE_KEY), isActive: true },
    create: { eventId: event.id, type: CameraType.GATE, name: 'Kamera Gate Utama', apiKeyHash: sha256(DEMO_GATE_KEY) },
  });
  const crowd = await prisma.camera.upsert({
    where: { eventId_type: { eventId: event.id, type: CameraType.CROWD } },
    update: { apiKeyHash: sha256(DEMO_CROWD_KEY), isActive: true, capacity },
    create: { eventId: event.id, type: CameraType.CROWD, name: 'Kamera Crowd Panggung', capacity, apiKeyHash: sha256(DEMO_CROWD_KEY) },
  });

  const lineups = [
    { artistName: 'Senja Akustik', isGuestStar: false, startAt: at(-150), endAt: at(-100) },
    { artistName: 'Rumah Kaca', isGuestStar: false, startAt: at(-95), endAt: at(-45) },
    { artistName: 'The Midnight Echo', isGuestStar: true, startAt: at(-30), endAt: at(60), notes: 'Guest star utama' },
    { artistName: 'DJ Nusa', isGuestStar: false, startAt: at(70), endAt: at(130) },
  ];
  await prisma.lineup.createMany({ data: lineups.map((l) => ({ ...l, eventId: event.id })) });

  // Kurva penonton: naik bertahap, lonjakan saat guest star (menit -30..+60 relatif sekarang).
  const rand = mulberry32(42);
  const crowdAt = (m: number) => {
    const sinceStart = m + 150;
    let n = 150 + sinceStart * 2.6;
    if (m >= -30 && m <= 60) n += 520 * Math.min(1, (m + 30) / 20);
    return Math.max(0, Math.round(n + (rand() - 0.5) * 70));
  };
  const crowdRows: any[] = [];
  const gateRows: any[] = [];
  const STEP = 0.5; // 30 detik
  for (let m = -150; m <= 0; m += STEP) {
    const capturedAt = at(m);
    crowdRows.push({ cameraId: crowd.id, eventId: event.id, capturedAt, peopleCount: crowdAt(m), density: null });
    const arrivalRate = Math.max(1, 60 - (m + 150) * 0.3 + (m >= -45 && m <= -20 ? 25 : 0));
    gateRows.push({
      cameraId: gate.id,
      eventId: event.id,
      capturedAt,
      inCount: Math.max(0, Math.round((arrivalRate * STEP) / 2 + (rand() - 0.5) * 6)),
      outCount: Math.max(0, Math.round(rand() * 3)),
    });
  }
  await prisma.crowdSnapshot.createMany({ data: [...crowdRows, ...gateRows] });
  await prisma.camera.updateMany({ where: { eventId: event.id }, data: { lastSeenAt: new Date() } });

  // Sama seperti event PUBLISHED lain di seed: petugas demo ditugaskan agar acara terlihat di APK petugas.
  const staff = await prisma.user.findUnique({ where: { email: 'staff@crowdpulse.test' } });
  if (staff) {
    await prisma.staffAssignment.upsert({
      where: { staffId_eventId: { staffId: staff.id, eventId: event.id } },
      update: {},
      create: { staffId: staff.id, eventId: event.id },
    });
  }
  console.log('Event demo live: "Konser Live Demo" (kamera gate + crowd + lineup + riwayat).');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
