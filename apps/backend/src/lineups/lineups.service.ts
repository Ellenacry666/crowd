import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CameraType, Lineup } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLineupDto, UpdateLineupDto } from './dto/lineup.dto';

/** Jendela sebelum penampil naik panggung yang dipakai sebagai pembanding (baseline). */
const BASELINE_MINUTES = 15;

export type LineupPhase = 'UPCOMING' | 'LIVE' | 'DONE';

export function lineupPhase(l: Pick<Lineup, 'startAt' | 'endAt'>, now = new Date()): LineupPhase {
  if (now < l.startAt) return 'UPCOMING';
  if (now >= l.endAt) return 'DONE';
  return 'LIVE';
}

@Injectable()
export class LineupsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(eventId: string) {
    await this.assertEvent(eventId);
    const rows = await this.prisma.lineup.findMany({
      where: { eventId },
      orderBy: { startAt: 'asc' },
    });
    return rows.map((l) => this.toResponse(l));
  }

  async create(eventId: string, dto: CreateLineupDto) {
    const event = await this.assertEvent(eventId);
    await this.assertValid(event, dto.startAt, dto.endAt);
    const created = await this.prisma.lineup.create({
      data: {
        eventId,
        artistName: dto.artistName,
        isGuestStar: dto.isGuestStar ?? false,
        startAt: dto.startAt,
        endAt: dto.endAt,
        notes: dto.notes ?? null,
      },
    });
    return this.toResponse(created);
  }

  async update(id: string, dto: UpdateLineupDto) {
    const existing = await this.prisma.lineup.findUnique({ where: { id } });
    if (!existing) throw this.notFound();
    const event = await this.assertEvent(existing.eventId);
    const startAt = dto.startAt ?? existing.startAt;
    const endAt = dto.endAt ?? existing.endAt;
    await this.assertValid(event, startAt, endAt, id);
    const updated = await this.prisma.lineup.update({
      where: { id },
      data: {
        ...(dto.artistName !== undefined ? { artistName: dto.artistName } : {}),
        ...(dto.isGuestStar !== undefined ? { isGuestStar: dto.isGuestStar } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        startAt,
        endAt,
      },
    });
    return this.toResponse(updated);
  }

  async remove(id: string) {
    const existing = await this.prisma.lineup.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw this.notFound();
    await this.prisma.lineup.delete({ where: { id } });
    return { deleted: true };
  }

  /**
   * Analisis kerumunan per penampil dari kamera CROWD acara:
   * rata-rata & puncak saat tampil, dibandingkan rata-rata 15 menit sebelumnya.
   * Penampil yang belum tampil tidak punya metrik (null), bukan nol.
   */
  async analytics(eventId: string) {
    const [lineups, crowdCam] = await Promise.all([
      this.list(eventId),
      this.prisma.camera.findUnique({
        where: { eventId_type: { eventId, type: CameraType.CROWD } },
        select: { id: true },
      }),
    ]);
    const now = new Date();
    return Promise.all(
      lineups.map(async (l) => {
        const base = { ...l, avgPeople: null, peakPeople: null, baselineAvg: null, upliftPct: null, samples: 0 } as LineupAnalytics;
        if (!crowdCam || l.phase === 'UPCOMING') return base;

        const to = l.endAt < now ? l.endAt : now;
        const baselineFrom = new Date(l.startAt.getTime() - BASELINE_MINUTES * 60_000);
        const [during, before] = await Promise.all([
          this.prisma.crowdSnapshot.aggregate({
            where: { cameraId: crowdCam.id, capturedAt: { gte: l.startAt, lte: to } },
            _avg: { peopleCount: true },
            _max: { peopleCount: true },
            _count: { _all: true },
          }),
          this.prisma.crowdSnapshot.aggregate({
            where: { cameraId: crowdCam.id, capturedAt: { gte: baselineFrom, lt: l.startAt } },
            _avg: { peopleCount: true },
          }),
        ]);
        if (during._count._all === 0) return base;

        const avg = during._avg.peopleCount ?? 0;
        const baseline = before._avg.peopleCount;
        return {
          ...l,
          avgPeople: Math.round(avg),
          peakPeople: during._max.peopleCount ?? 0,
          baselineAvg: baseline === null ? null : Math.round(baseline),
          upliftPct: baseline && baseline > 0 ? Math.round(((avg - baseline) / baseline) * 1000) / 10 : null,
          samples: during._count._all,
        };
      }),
    );
  }

  private toResponse(l: Lineup) {
    return {
      id: l.id,
      eventId: l.eventId,
      artistName: l.artistName,
      isGuestStar: l.isGuestStar,
      startAt: l.startAt,
      endAt: l.endAt,
      notes: l.notes,
      phase: lineupPhase(l),
    };
  }

  private async assertEvent(eventId: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, startAt: true, endAt: true },
    });
    if (!event) {
      throw new NotFoundException({ message: 'Acara tidak ditemukan', code: 'EVENT_NOT_FOUND' });
    }
    return event;
  }

  private async assertValid(
    event: { id: string; startAt: Date; endAt: Date },
    startAt: Date,
    endAt: Date,
    ignoreId?: string,
  ) {
    if (endAt.getTime() <= startAt.getTime()) {
      throw new BadRequestException({ message: 'endAt harus setelah startAt', code: 'INVALID_TIME_RANGE' });
    }
    if (startAt < event.startAt || endAt > event.endAt) {
      throw new BadRequestException({
        message: 'Jadwal penampil harus berada dalam waktu acara',
        code: 'LINEUP_OUT_OF_EVENT_RANGE',
      });
    }
    // Satu kamera CROWD = satu panggung: jadwal tidak boleh bertumpuk agar analisis per penampil tidak tercampur.
    const overlap = await this.prisma.lineup.findFirst({
      where: {
        eventId: event.id,
        startAt: { lt: endAt },
        endAt: { gt: startAt },
        ...(ignoreId ? { id: { not: ignoreId } } : {}),
      },
      select: { artistName: true },
    });
    if (overlap) {
      throw new ConflictException({
        message: `Jadwal bertabrakan dengan penampil "${overlap.artistName}"`,
        code: 'LINEUP_OVERLAP',
      });
    }
  }

  private notFound() {
    return new NotFoundException({ message: 'Lineup tidak ditemukan', code: 'LINEUP_NOT_FOUND' });
  }
}

export type LineupAnalytics = ReturnType<LineupsService['toResponse']> & {
  avgPeople: number | null;
  peakPeople: number | null;
  baselineAvg: number | null;
  upliftPct: number | null;
  samples: number;
};
