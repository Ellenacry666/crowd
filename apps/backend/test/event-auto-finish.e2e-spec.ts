import { INestApplication } from '@nestjs/common';
import { EventStatus } from '@prisma/client';
import { EventsService } from '../src/events/events.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, resetDatabase, seedEvent } from './helpers';

describe('Acara otomatis FINISHED (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    await resetDatabase(prisma);
  });
  afterAll(async () => {
    await resetDatabase(prisma);
    await app.close();
  });

  it('hanya acara PUBLISHED yang sudah berakhir yang menjadi FINISHED', async () => {
    // seedEvent: mulai = sekarang + daysAhead hari, durasi 3 jam. daysAhead -2 => sudah berakhir.
    const endedPublished = (await seedEvent(prisma, { title: 'Selesai Terbit', daysAhead: -2 })).event;
    const endedDraft = (await seedEvent(prisma, { title: 'Selesai Draft', daysAhead: -2, status: EventStatus.DRAFT })).event;
    const endedCancelled = (await seedEvent(prisma, { title: 'Selesai Batal', daysAhead: -2, status: EventStatus.CANCELLED })).event;
    const upcoming = (await seedEvent(prisma, { title: 'Akan Datang', daysAhead: 5 })).event;

    const n = await app.get(EventsService).finishEndedEvents();
    expect(n).toBe(1);

    const status = async (id: string) => (await prisma.event.findUniqueOrThrow({ where: { id } })).status;
    expect(await status(endedPublished.id)).toBe(EventStatus.FINISHED);
    expect(await status(endedDraft.id)).toBe(EventStatus.DRAFT);
    expect(await status(endedCancelled.id)).toBe(EventStatus.CANCELLED);
    expect(await status(upcoming.id)).toBe(EventStatus.PUBLISHED);

    // Idempotent: dijalankan lagi tidak mengubah apa pun.
    expect(await app.get(EventsService).finishEndedEvents()).toBe(0);
  });
});
