import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Camera, CameraType } from '@prisma/client';
import { LineupsService } from '../lineups/lineups.service';
import { PrismaService } from '../prisma/prisma.service';
import { hashCameraKey } from './camera-key.util';
import { ONLINE_WINDOW_MS, toCameraResponse } from './cameras.service';
import { IngestDto } from './dto/crowd.dto';

export type CrowdLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
export type MonitoringStatus = 'NOT_STARTED' | 'ACTIVE' | 'INACTIVE';

/**
 * Status monitoring murni dari kamera dan snapshot (bukan dari tiket):
 * NOT_STARTED = kamera belum ada atau belum pernah mengirim data; ACTIVE = kamera aktif dan mengirim data
 * dalam 30 detik terakhir; INACTIVE = pernah ada data tetapi kamera nonaktif/berhenti mengirim.
 */
export function monitoringStatus(
  cam: Pick<Camera, 'isActive' | 'lastSeenAt'> | null,
  hasData: boolean,
  now = Date.now(),
): MonitoringStatus {
  if (!cam || !hasData) return 'NOT_STARTED';
  const fresh = cam.lastSeenAt !== null && now - cam.lastSeenAt.getTime() <= ONLINE_WINDOW_MS;
  return cam.isActive && fresh ? 'ACTIVE' : 'INACTIVE';
}

/** Level berdasarkan persentase kapasitas: <50 rendah, <75 sedang, <90 tinggi, selebihnya kritis. */
export function crowdLevel(occupancyPct: number): CrowdLevel {
  if (occupancyPct < 50) return 'LOW';
  if (occupancyPct < 75) return 'MODERATE';
  if (occupancyPct < 90) return 'HIGH';
  return 'CRITICAL';
}

/** Batas aman jumlah snapshot yang dimuat per kamera untuk satu permintaan dashboard. */
const MAX_ROWS = 50_000;
/** Toleransi jam kamera yang lebih cepat dari server. */
const FUTURE_SKEW_MS = 60_000;

interface Row {
  capturedAt: Date;
  peopleCount: number;
  inCount: number;
  outCount: number;
}

function bucketize(rows: Row[], bucketMs: number) {
  const map = new Map<number, { sum: number; max: number; n: number; inSum: number; outSum: number }>();
  for (const r of rows) {
    const key = Math.floor(r.capturedAt.getTime() / bucketMs) * bucketMs;
    const b = map.get(key) ?? { sum: 0, max: 0, n: 0, inSum: 0, outSum: 0 };
    b.sum += r.peopleCount;
    b.max = Math.max(b.max, r.peopleCount);
    b.n += 1;
    b.inSum += r.inCount;
    b.outSum += r.outCount;
    map.set(key, b);
  }
  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([t, b]) => ({
      t: new Date(t).toISOString(),
      avg: Math.round(b.sum / b.n),
      max: b.max,
      in: b.inSum,
      out: b.outSum,
    }));
}

@Injectable()
export class CrowdService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lineups: LineupsService,
  ) {}

  // ---------- Ingest (dipanggil layanan analisis, autentikasi lewat API key kamera) ----------
  async ingest(apiKey: string | undefined, dto: IngestDto) {
    if (!apiKey) {
      throw new UnauthorizedException({ message: 'Header x-camera-key wajib diisi', code: 'CAMERA_KEY_REQUIRED' });
    }
    const camera = await this.prisma.camera.findUnique({ where: { apiKeyHash: hashCameraKey(apiKey) } });
    if (!camera) {
      throw new UnauthorizedException({ message: 'API key kamera tidak valid', code: 'CAMERA_KEY_INVALID' });
    }
    if (!camera.isActive) {
      throw new ForbiddenException({ message: 'Kamera dinonaktifkan', code: 'CAMERA_DISABLED' });
    }

    const now = new Date();
    const capturedAt = dto.capturedAt ?? now;
    if (capturedAt.getTime() > now.getTime() + FUTURE_SKEW_MS) {
      throw new BadRequestException({ message: 'capturedAt tidak boleh di masa depan', code: 'INVALID_CAPTURED_AT' });
    }

    let peopleCount = 0;
    if (camera.type === CameraType.CROWD) {
      if (dto.peopleCount === undefined) {
        throw new BadRequestException({ message: 'peopleCount wajib untuk kamera CROWD', code: 'PEOPLE_COUNT_REQUIRED' });
      }
      peopleCount = dto.peopleCount;
    } else if (dto.inCount === undefined && dto.outCount === undefined) {
      throw new BadRequestException({ message: 'inCount atau outCount wajib untuk kamera GATE', code: 'GATE_COUNT_REQUIRED' });
    }

    await this.prisma.$transaction([
      this.prisma.crowdSnapshot.create({
        data: {
          cameraId: camera.id,
          eventId: camera.eventId,
          capturedAt,
          peopleCount,
          inCount: camera.type === CameraType.GATE ? (dto.inCount ?? 0) : 0,
          outCount: camera.type === CameraType.GATE ? (dto.outCount ?? 0) : 0,
          density: dto.density ?? null,
        },
      }),
      this.prisma.camera.update({ where: { id: camera.id }, data: { lastSeenAt: now } }),
    ]);
    return { accepted: true };
  }

  // ---------- Dashboard admin ----------
  async dashboard(eventId: string, minutes: number) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, title: true, location: true, startAt: true, endAt: true, status: true },
    });
    if (!event) {
      throw new NotFoundException({ message: 'Acara tidak ditemukan', code: 'EVENT_NOT_FOUND' });
    }

    const now = new Date();
    const from = new Date(now.getTime() - minutes * 60_000);
    const bucketMs = Math.max(10, Math.round((minutes * 60) / 60 / 10) * 10) * 1000;

    const cameras = await this.prisma.camera.findMany({ where: { eventId } });
    const gateCam = cameras.find((c) => c.type === CameraType.GATE) ?? null;
    const crowdCam = cameras.find((c) => c.type === CameraType.CROWD) ?? null;

    const [gate, crowd, lineups] = await Promise.all([
      this.gateSection(gateCam, from, now, bucketMs),
      this.crowdSection(crowdCam, from, now, bucketMs),
      this.lineups.analytics(eventId),
    ]);

    return {
      generatedAt: now.toISOString(),
      windowMinutes: minutes,
      bucketSeconds: bucketMs / 1000,
      event,
      cameras: cameras.map((c) => toCameraResponse(c, now.getTime())),
      gate,
      crowd,
      lineups,
      currentLineup: lineups.find((l) => l.phase === 'LIVE') ?? null,
      nextLineup: lineups.find((l) => l.phase === 'UPCOMING') ?? null,
    };
  }

  private async gateSection(cam: Camera | null, from: Date, to: Date, bucketMs: number) {
    if (!cam) {
      return { configured: false, status: 'NOT_STARTED' as MonitoringStatus, lastSnapshotAt: null, totalIn: 0, totalOut: 0, insideNow: 0, inLast5Min: 0, series: [] };
    }
    const last5 = new Date(to.getTime() - 5 * 60_000);
    const [totals, last5Sum, rows, latest] = await Promise.all([
      this.prisma.crowdSnapshot.aggregate({
        where: { cameraId: cam.id },
        _sum: { inCount: true, outCount: true },
      }),
      this.prisma.crowdSnapshot.aggregate({
        where: { cameraId: cam.id, capturedAt: { gte: last5 } },
        _sum: { inCount: true },
      }),
      this.prisma.crowdSnapshot.findMany({
        where: { cameraId: cam.id, capturedAt: { gte: from, lte: to } },
        select: { capturedAt: true, peopleCount: true, inCount: true, outCount: true },
        orderBy: { capturedAt: 'asc' },
        take: MAX_ROWS,
      }),
      this.prisma.crowdSnapshot.findFirst({
        where: { cameraId: cam.id },
        orderBy: { capturedAt: 'desc' },
        select: { capturedAt: true },
      }),
    ]);
    const totalIn = totals._sum.inCount ?? 0;
    const totalOut = totals._sum.outCount ?? 0;
    return {
      configured: true,
      status: monitoringStatus(cam, latest !== null, to.getTime()),
      lastSnapshotAt: latest?.capturedAt ?? null,
      totalIn,
      totalOut,
      insideNow: Math.max(0, totalIn - totalOut),
      inLast5Min: last5Sum._sum.inCount ?? 0,
      series: bucketize(rows, bucketMs).map(({ t, in: i, out }) => ({ t, in: i, out })),
    };
  }

  private async crowdSection(
    cam: Camera | null,
    from: Date,
    to: Date,
    bucketMs: number,
  ) {
    if (!cam) {
      return { configured: false, status: 'NOT_STARTED' as MonitoringStatus, current: null, avg: null, peak: null, capacity: null, occupancyPct: null, level: null, lastSnapshotAt: null, density: null, series: [] };
    }
    const [latest, rows] = await Promise.all([
      this.prisma.crowdSnapshot.findFirst({
        where: { cameraId: cam.id },
        orderBy: { capturedAt: 'desc' },
        select: { capturedAt: true, peopleCount: true, density: true },
      }),
      this.prisma.crowdSnapshot.findMany({
        where: { cameraId: cam.id, capturedAt: { gte: from, lte: to } },
        select: { capturedAt: true, peopleCount: true, inCount: true, outCount: true },
        orderBy: { capturedAt: 'asc' },
        take: MAX_ROWS,
      }),
    ]);

    const counts = rows.map((r) => r.peopleCount);
    const current = latest?.peopleCount ?? null;
    const occupancyPct =
      current !== null && cam.capacity ? Math.round((current / cam.capacity) * 1000) / 10 : null;
    return {
      configured: true,
      status: monitoringStatus(cam, latest !== null, to.getTime()),
      current,
      lastSnapshotAt: latest?.capturedAt ?? null,
      density: latest?.density ?? null,
      avg: counts.length ? Math.round(counts.reduce((a, b) => a + b, 0) / counts.length) : null,
      peak: counts.length ? Math.max(...counts) : null,
      capacity: cam.capacity,
      occupancyPct,
      level: occupancyPct === null ? null : crowdLevel(occupancyPct),
      series: bucketize(rows, bucketMs).map(({ t, avg, max }) => ({ t, avg, max })),
    };
  }
}
