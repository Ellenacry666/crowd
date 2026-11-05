import { EventStatus } from '@prisma/client';
import { EventsService } from './events.service';

describe('EventsService.finishEndedEvents', () => {
  const make = () => {
    const calls: any[] = [];
    const prisma: any = { event: { updateMany: async (a: any) => { calls.push(a); return { count: 2 }; } } };
    return { svc: new EventsService(prisma), calls };
  };
  const now = new Date('2026-11-04T12:00:00Z');
  afterEach(() => { delete process.env.EVENT_AUTO_FINISH_GRACE_MINUTES; });

  it('hanya mengubah PUBLISHED yang endAt-nya sudah lewat menjadi FINISHED', async () => {
    const { svc, calls } = make();
    await expect(svc.finishEndedEvents(now)).resolves.toBe(2);
    expect(calls[0].where.status).toBe(EventStatus.PUBLISHED); // DRAFT & CANCELLED tidak tersentuh
    expect(calls[0].where.endAt.lt).toEqual(now);
    expect(calls[0].data).toEqual({ status: EventStatus.FINISHED });
  });

  it('masa tenggang menggeser batas waktu', async () => {
    process.env.EVENT_AUTO_FINISH_GRACE_MINUTES = '30';
    const { svc, calls } = make();
    await svc.finishEndedEvents(now);
    expect(calls[0].where.endAt.lt).toEqual(new Date('2026-11-04T11:30:00Z'));
  });

  it('nilai tenggang tidak valid atau negatif diabaikan', async () => {
    for (const v of ['abc', '-5']) {
      process.env.EVENT_AUTO_FINISH_GRACE_MINUTES = v;
      const { svc, calls } = make();
      await svc.finishEndedEvents(now);
      expect(calls[0].where.endAt.lt).toEqual(now);
    }
  });
});
