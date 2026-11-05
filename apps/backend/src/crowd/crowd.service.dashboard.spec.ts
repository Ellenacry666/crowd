import { BadRequestException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { LineupsService } from '../lineups/lineups.service';
import { hashCameraKey } from './camera-key.util';
import { CrowdService } from './crowd.service';

/**
 * Menguji logika layanan terhadap Prisma in-memory (tanpa database).
 * Query SQL sebenarnya diverifikasi lewat e2e/manual; ini mengunci logika bisnis.
 */
const MIN = 60_000;
const now = Date.now();
const at = (m: number) => new Date(now + m * MIN);

function makeFake() {
  const event = { id: 'ev', title: 'T', location: 'L', startAt: at(-150), endAt: at(150), status: 'PUBLISHED' };
  const gate = { id: 'g', eventId: 'ev', type: 'GATE', name: 'G', capacity: null, isActive: true, lastSeenAt: at(0), apiKeyHash: hashCameraKey('gk'), streamUrl: null };
  const crowd = { id: 'c', eventId: 'ev', type: 'CROWD', name: 'C', capacity: 1000, isActive: true, lastSeenAt: at(0), apiKeyHash: hashCameraKey('ck'), streamUrl: null };
  const cameras = [gate, crowd];
  const snaps: any[] = [];
  // Crowd: 400 orang sebelum guest star (menit -50..-31), 800 saat tampil (-30..0)
  for (let m = -50; m <= 0; m++) snaps.push({ cameraId: 'c', capturedAt: at(m), peopleCount: m < -30 ? 400 : 800, inCount: 0, outCount: 0 });
  for (let m = -50; m <= 0; m++) snaps.push({ cameraId: 'g', capturedAt: at(m), peopleCount: 0, inCount: 5, outCount: 1 });
  const lineups = [
    { id: 'l1', eventId: 'ev', artistName: 'Guest', isGuestStar: true, startAt: at(-30), endAt: at(30), notes: null },
    { id: 'l2', eventId: 'ev', artistName: 'Nanti', isGuestStar: false, startAt: at(40), endAt: at(80), notes: null },
  ];
  const inRange = (r: any, w: any) =>
    r.cameraId === w.cameraId &&
    (!w.capturedAt || ((!w.capturedAt.gte || r.capturedAt >= w.capturedAt.gte) && (!w.capturedAt.lte || r.capturedAt <= w.capturedAt.lte) && (!w.capturedAt.lt || r.capturedAt < w.capturedAt.lt)));

  const prisma: any = {
    event: { findUnique: async () => event },
    camera: {
      findMany: async () => cameras,
      findUnique: async ({ where }: any) => (where.apiKeyHash ? cameras.find((c) => c.apiKeyHash === where.apiKeyHash) ?? null : cameras.find((c) => c.type === where.eventId_type?.type) ?? null),
      update: async () => ({}),
    },
    ticket: { count: async () => { throw new Error('dashboard monitoring tidak boleh membaca tabel tiket'); } },
    lineup: { findMany: async () => lineups },
    crowdSnapshot: {
      create: async ({ data }: any) => { snaps.push(data); return data; },
      findMany: async ({ where }: any) => snaps.filter((r) => inRange(r, where)).sort((a, b) => +a.capturedAt - +b.capturedAt),
      findFirst: async ({ where }: any) => [...snaps].filter((r) => r.cameraId === where.cameraId).sort((a, b) => +b.capturedAt - +a.capturedAt)[0] ?? null,
      aggregate: async ({ where }: any) => {
        const rows = snaps.filter((r) => inRange(r, where));
        const sum = (k: string) => rows.reduce((a, r) => a + r[k], 0);
        const counts = rows.map((r) => r.peopleCount);
        return {
          _sum: { inCount: sum('inCount'), outCount: sum('outCount') },
          _avg: { peopleCount: counts.length ? sum('peopleCount') / counts.length : null },
          _max: { peopleCount: counts.length ? Math.max(...counts) : null },
          _count: { _all: rows.length },
        };
      },
    },
    $transaction: async (ops: Promise<unknown>[]) => Promise.all(ops),
  };
  return { prisma, snaps };
}

function setup() {
  const { prisma, snaps } = makeFake();
  const lineups = new LineupsService(prisma);
  return { service: new CrowdService(prisma, lineups), snaps };
}

describe('CrowdService.dashboard', () => {
  it('menghitung gate, crowd, level, dan analitik guest star', async () => {
    const { service } = setup();
    const d = await service.dashboard('ev', 60);

    expect(d.gate.totalIn).toBe(51 * 5);
    expect(d.gate.totalOut).toBe(51);
    expect(d.gate.insideNow).toBe(255 - 51);
    // Respons monitoring tidak boleh membawa data tiket (sumbernya terpisah: /admin/reports/events/:id/checkin-stats).
    expect(JSON.stringify(d)).not.toMatch(/ticketsIssued|ticketsCheckedIn/);
    expect(d.gate.status).toBe('ACTIVE');
    expect(d.crowd.status).toBe('ACTIVE');
    expect(d.gate.series.length).toBeGreaterThan(1);

    expect(d.crowd.current).toBe(800);
    expect(d.crowd.occupancyPct).toBe(80);
    expect(d.crowd.level).toBe('HIGH');
    expect(d.crowd.peak).toBe(800);

    const guest = d.lineups.find((l) => l.id === 'l1')!;
    expect(guest.phase).toBe('LIVE');
    expect(guest.avgPeople).toBe(800);
    expect(guest.baselineAvg).toBe(400);
    expect(guest.upliftPct).toBe(100); // 400 -> 800
    expect(d.currentLineup?.id).toBe('l1');
    expect(d.nextLineup?.id).toBe('l2');
  });

  it('penampil yang belum tampil tidak punya metrik (null, bukan 0)', async () => {
    const { service } = setup();
    const d = await service.dashboard('ev', 60);
    const upcoming = d.lineups.find((l) => l.id === 'l2')!;
    expect(upcoming.avgPeople).toBeNull();
    expect(upcoming.peakPeople).toBeNull();
    expect(upcoming.upliftPct).toBeNull();
  });

  it('bucket grafik tidak melebihi sekitar 60 titik', async () => {
    const { service } = setup();
    const d = await service.dashboard('ev', 60);
    expect(d.crowd.series.length).toBeLessThanOrEqual(61);
  });
});

describe('CrowdService.dashboard — status monitoring', () => {
  it('NOT_STARTED bila kamera ada tetapi belum pernah mengirim data (bukan error, bukan 0 palsu)', async () => {
    const { prisma, snaps } = makeFake();
    snaps.length = 0;
    const d = await new CrowdService(prisma, new LineupsService(prisma)).dashboard('ev', 60);
    expect(d.crowd.status).toBe('NOT_STARTED');
    expect(d.crowd.current).toBeNull();
    expect(d.crowd.series).toEqual([]);
    expect(d.gate.status).toBe('NOT_STARTED');
  });

  it('INACTIVE bila pernah ada data tetapi kamera berhenti mengirim', async () => {
    const { prisma } = makeFake();
    const stale = new Date(now - 10 * MIN);
    const orig = prisma.camera.findMany;
    prisma.camera.findMany = async () => (await orig()).map((c: any) => ({ ...c, lastSeenAt: stale }));
    const d = await new CrowdService(prisma, new LineupsService(prisma)).dashboard('ev', 60);
    expect(d.crowd.status).toBe('INACTIVE');
  });

  it('NOT_STARTED bila acara tidak punya kamera sama sekali', async () => {
    const { prisma } = makeFake();
    prisma.camera.findMany = async () => [];
    const d = await new CrowdService(prisma, new LineupsService(prisma)).dashboard('ev', 60);
    expect(d.crowd).toMatchObject({ configured: false, status: 'NOT_STARTED' });
    expect(d.gate).toMatchObject({ configured: false, status: 'NOT_STARTED' });
  });
});

describe('CrowdService.ingest', () => {
  it('menolak tanpa key / key salah', async () => {
    const { service } = setup();
    await expect(service.ingest(undefined, { peopleCount: 1 })).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(service.ingest('salah', { peopleCount: 1 })).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('kamera CROWD wajib peopleCount, GATE wajib inCount/outCount', async () => {
    const { service } = setup();
    await expect(service.ingest('ck', {})).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.ingest('gk', {})).rejects.toBeInstanceOf(BadRequestException);
  });

  it('menolak capturedAt di masa depan', async () => {
    const { service } = setup();
    await expect(service.ingest('ck', { peopleCount: 5, capturedAt: at(10) })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('menyimpan snapshot valid; kamera GATE tidak menyimpan peopleCount', async () => {
    const { service, snaps } = setup();
    const before = snaps.length;
    await expect(service.ingest('gk', { inCount: 7, outCount: 2, peopleCount: 999 })).resolves.toEqual({ accepted: true });
    const saved = snaps[before];
    expect(saved).toMatchObject({ cameraId: 'g', inCount: 7, outCount: 2, peopleCount: 0 });
  });

  it('menolak kamera nonaktif', async () => {
    const { prisma } = makeFake();
    prisma.camera.findUnique = async () => ({ id: 'c', eventId: 'ev', type: 'CROWD', isActive: false });
    const service = new CrowdService(prisma, new LineupsService(prisma));
    await expect(service.ingest('ck', { peopleCount: 1 })).rejects.toBeInstanceOf(ForbiddenException);
  });
});
