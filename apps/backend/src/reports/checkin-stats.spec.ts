import { NotFoundException } from '@nestjs/common';
import { TicketStatus } from '@prisma/client';
import { buildCheckInStats, ReportsService } from './reports.service';

describe('buildCheckInStats', () => {
  it('belum ada tiket: semuanya 0, tanpa pembagian nol / NaN', () => {
    expect(buildCheckInStats({})).toEqual({ issued: 0, checkedIn: 0, notCheckedIn: 0, percentage: 0, invalidTickets: 0 });
  });

  it('ada tiket tetapi belum ada check-in: 0%', () => {
    expect(buildCheckInStats({ ACTIVE: 10 })).toMatchObject({ issued: 10, checkedIn: 0, notCheckedIn: 10, percentage: 0 });
  });

  it('rumus: belum = issued - checkedIn; persentase 1 desimal', () => {
    const s = buildCheckInStats({ ACTIVE: 6, USED: 3, CANCELLED: 1 });
    expect(s).toEqual({ issued: 10, checkedIn: 3, notCheckedIn: 7, percentage: 30, invalidTickets: 1 });
    expect(buildCheckInStats({ ACTIVE: 2, USED: 1 }).percentage).toBe(33.3);
  });

  it('semua sudah check-in: 100%', () => {
    expect(buildCheckInStats({ USED: 4 })).toMatchObject({ notCheckedIn: 0, percentage: 100 });
  });

  it('hanya status USED yang dihitung sebagai check-in', () => {
    const s = buildCheckInStats({ ACTIVE: 1, EXPIRED: 2, CANCELLED: 2 });
    expect(s.checkedIn).toBe(0);
    expect(s.invalidTickets).toBe(4);
  });
});

describe('ReportsService.eventCheckInStats', () => {
  const make = (tickets: Array<{ status: TicketStatus; eventId: string; checkedInAt?: Date }>, eventExists = true) => {
    const prisma: any = {
      event: { findUnique: async () => (eventExists ? { id: 'ev' } : null) },
      ticket: {
        groupBy: async ({ where }: any) => {
          const m = new Map<string, number>();
          for (const t of tickets.filter((x) => x.eventId === where.eventId)) m.set(t.status, (m.get(t.status) ?? 0) + 1);
          return [...m].map(([status, n]) => ({ status, _count: { _all: n } }));
        },
        aggregate: async ({ where }: any) => {
          const used = tickets.filter((x) => x.eventId === where.eventId && x.status === 'USED' && x.checkedInAt);
          return { _max: { checkedInAt: used.length ? new Date(Math.max(...used.map((u) => +u.checkedInAt!))) : null } };
        },
      },
      // Sengaja tidak ada crowdSnapshot/camera: statistik tiket tidak boleh menyentuh data monitoring.
    };
    return new ReportsService(prisma);
  };

  it('tetap menghasilkan statistik walaupun tidak ada data monitoring sama sekali', async () => {
    const svc = make([{ status: 'ACTIVE', eventId: 'ev' }, { status: 'ACTIVE', eventId: 'ev' }]);
    const r = await svc.eventCheckInStats('ev');
    expect(r).toMatchObject({ issued: 2, checkedIn: 0, notCheckedIn: 2, percentage: 0, lastCheckInAt: null });
  });

  it('hanya menghitung tiket acara yang diminta dan melaporkan check-in terakhir', async () => {
    const t = new Date('2026-01-01T10:00:00Z');
    const svc = make([
      { status: 'USED', eventId: 'ev', checkedInAt: t },
      { status: 'ACTIVE', eventId: 'ev' },
      { status: 'USED', eventId: 'lain', checkedInAt: new Date() },
    ]);
    const r = await svc.eventCheckInStats('ev');
    expect(r).toMatchObject({ issued: 2, checkedIn: 1, notCheckedIn: 1, percentage: 50 });
    expect(r.lastCheckInAt).toEqual(t);
  });

  it('acara tidak ada: 404', async () => {
    await expect(make([], false).eventCheckInStats('x')).rejects.toBeInstanceOf(NotFoundException);
  });
});
