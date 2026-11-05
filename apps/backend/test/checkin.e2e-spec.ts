import { INestApplication } from '@nestjs/common';
import { Role } from '@prisma/client';
import request from 'supertest';
import { QrSigner } from '../src/common/qr/qr-signer';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  bearer,
  createTestApp,
  createUser,
  login,
  purchaseTickets,
  resetDatabase,
  scan,
  seedEvent,
  url,
} from './helpers';

describe('Check-in (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let server: ReturnType<INestApplication['getHttpServer']>;
  let qr: QrSigner;

  let admin: string;
  let customer: string;
  let staffA: string;
  let staffB: string;
  let staffC: string;
  let staffAId: string;
  let staffBId: string;

  let event1: { id: string };
  let event2: { id: string };
  let cat1: { id: string };
  let cat2: { id: string };

  const buy = async (categoryId: string, qty = 1) => {
    const { tickets } = await purchaseTickets(app, customer, categoryId, qty);
    return tickets as Array<{ id: string; ticketCode: string; qrPayload: string }>;
  };
  const logsFor = (ticketId: string) =>
    prisma.checkInLog.findMany({ where: { ticketId }, orderBy: { scannedAt: 'asc' } });

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    server = app.getHttpServer();
    qr = app.get(QrSigner);
    await resetDatabase(prisma);

    await createUser(prisma, 'admin@ci.local', Role.ADMIN);
    await createUser(prisma, 'customer@ci.local', Role.CUSTOMER);
    const a = await createUser(prisma, 'staffa@ci.local', Role.GATE_STAFF);
    const b = await createUser(prisma, 'staffb@ci.local', Role.GATE_STAFF);
    await createUser(prisma, 'staffc@ci.local', Role.GATE_STAFF);
    staffAId = a.id;
    staffBId = b.id;

    const e1 = await seedEvent(prisma, { title: 'Event Satu', categories: [{ name: 'Reg', price: 10000, quota: 100 }] });
    const e2 = await seedEvent(prisma, { title: 'Event Dua', categories: [{ name: 'VIP', price: 20000, quota: 100 }] });
    event1 = e1.event;
    event2 = e2.event;
    cat1 = e1.categories[0];
    cat2 = e2.categories[0];

    await prisma.staffAssignment.createMany({
      data: [
        { staffId: a.id, eventId: event1.id },
        { staffId: a.id, eventId: event2.id },
        { staffId: b.id, eventId: event1.id },
      ],
    });

    admin = await login(app, 'admin@ci.local');
    customer = await login(app, 'customer@ci.local');
    staffA = await login(app, 'staffa@ci.local');
    staffB = await login(app, 'staffb@ci.local');
    staffC = await login(app, 'staffc@ci.local');
  });

  afterAll(async () => {
    await resetDatabase(prisma);
    await app.close();
  });

  it('alur lengkap: beli -> check-in pertama sukses -> scan kedua ditolak tanpa mengubah data (SC-07)', async () => {
    const [ticket] = await buy(cat1.id);

    const eventsRes = await request(server).get(url('/staff/events')).set(bearer(staffA));
    expect(eventsRes.status).toBe(200);
    const listed = eventsRes.body.find((e: any) => e.id === event1.id);
    expect(listed.stats.issued).toBeGreaterThanOrEqual(1);
    expect(eventsRes.body.map((e: any) => e.id).sort()).toEqual([event1.id, event2.id].sort());

    const first = await scan(app, staffA, event1.id, ticket.qrPayload);
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({ success: true, result: 'SUCCESS' });
    expect(first.body.ticket).toMatchObject({ ticketCode: ticket.ticketCode, categoryName: 'Reg', eventTitle: 'Event Satu' });

    const afterFirst = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(afterFirst).toMatchObject({ status: 'USED', checkedInById: staffAId });
    expect(afterFirst.checkedInAt).not.toBeNull();

    const second = await scan(app, staffB, event1.id, ticket.qrPayload);
    expect(second.status).toBe(200);
    expect(second.body).toMatchObject({ success: false, result: 'ALREADY_USED' });
    expect(second.body.firstCheckedInAt).toBe(afterFirst.checkedInAt!.toISOString());

    const afterSecond = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(afterSecond.checkedInAt!.getTime()).toBe(afterFirst.checkedInAt!.getTime());
    expect(afterSecond.checkedInById).toBe(staffAId);

    const logs = await logsFor(ticket.id);
    expect(logs.map((l) => l.result)).toEqual(['SUCCESS', 'ALREADY_USED']);
    expect(logs.map((l) => l.staffId)).toEqual([staffAId, staffBId]);

    const mine = await request(server).get(url(`/tickets/${ticket.id}`)).set(bearer(customer));
    expect(mine.body).toMatchObject({ status: 'USED', paymentStatus: 'PAID' });
    expect(mine.body.checkedInAt).not.toBeNull();
  });

  describe('Penolakan', () => {
    it('payload sampah dan signature salah: INVALID_TOKEN, tercatat tanpa tiket', async () => {
      const before = await prisma.checkInLog.count({ where: { eventId: event1.id, result: 'INVALID_TOKEN' } });
      const garbage = await scan(app, staffA, event1.id, 'bukan-qr');
      const forged = await scan(app, staffA, event1.id, `CP1.${'A'.repeat(26)}.${'0'.repeat(24)}`);
      for (const res of [garbage, forged]) {
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ success: false, result: 'INVALID_TOKEN' });
      }
      const after = await prisma.checkInLog.findMany({ where: { eventId: event1.id, result: 'INVALID_TOKEN' } });
      expect(after.length).toBe(before + 2);
      expect(after.every((l) => l.ticketId === null)).toBe(true);
    });

    it('signature benar tetapi tiket tidak ada di database: INVALID_TOKEN', async () => {
      const ghost = qr.buildPayload(qr.generateTicketCode());
      const res = await scan(app, staffA, event1.id, ghost);
      expect(res.body).toMatchObject({ success: false, result: 'INVALID_TOKEN' });
    });

    it('tiket acara lain: WRONG_EVENT, tiket tetap ACTIVE dan masih bisa dipakai di acara yang benar', async () => {
      const [ticket] = await buy(cat1.id);
      const wrong = await scan(app, staffA, event2.id, ticket.qrPayload);
      expect(wrong.body).toMatchObject({ success: false, result: 'WRONG_EVENT' });
      expect((await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } })).status).toBe('ACTIVE');
      const right = await scan(app, staffA, event1.id, ticket.qrPayload);
      expect(right.body).toMatchObject({ success: true, result: 'SUCCESS' });
    });

    it('order belum PAID: NOT_PAID dan tiket tidak berubah', async () => {
      const user = await prisma.user.findFirstOrThrow({ where: { email: 'customer@ci.local' } });
      const order = await prisma.order.create({
        data: {
          userId: user.id,
          orderNumber: 'CP-TEST-NOTPAID',
          totalAmount: 10000,
          status: 'PENDING',
          expiresAt: new Date(Date.now() + 3600_000),
          items: { create: [{ ticketCategoryId: cat1.id, quantity: 1, unitPrice: 10000, subtotal: 10000 }] },
        },
        include: { items: true },
      });
      const code = qr.generateTicketCode();
      const ticket = await prisma.ticket.create({
        data: { orderItemId: order.items[0].id, eventId: event1.id, ownerId: user.id, ticketCode: code },
      });
      const res = await scan(app, staffA, event1.id, qr.buildPayload(code));
      expect(res.body).toMatchObject({ success: false, result: 'NOT_PAID' });
      expect((await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } })).status).toBe('ACTIVE');
    });

    it('tiket dibatalkan atau kedaluwarsa: CANCELLED_OR_EXPIRED', async () => {
      const [t1, t2] = await buy(cat1.id, 2);
      await prisma.ticket.update({ where: { id: t1.id }, data: { status: 'CANCELLED' } });
      await prisma.ticket.update({ where: { id: t2.id }, data: { status: 'EXPIRED' } });
      for (const t of [t1, t2]) {
        const res = await scan(app, staffA, event1.id, t.qrPayload);
        expect(res.body).toMatchObject({ success: false, result: 'CANCELLED_OR_EXPIRED' });
      }
    });
  });

  describe('Otorisasi', () => {
    it('petugas yang tidak ditugaskan: 403 NOT_AUTHORIZED dan tercatat', async () => {
      const [ticket] = await buy(cat1.id);
      const res = await scan(app, staffC, event1.id, ticket.qrPayload);
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('NOT_AUTHORIZED');
      expect((await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } })).status).toBe('ACTIVE');
      const staffCUser = await prisma.user.findFirstOrThrow({ where: { email: 'staffc@ci.local' } });
      expect(
        await prisma.checkInLog.count({ where: { staffId: staffCUser.id, result: 'NOT_AUTHORIZED', eventId: event1.id } }),
      ).toBe(1);
    });

    it('petugas yang ditugaskan hanya ke acara 1 tidak dapat check-in di acara 2', async () => {
      const [ticket] = await buy(cat2.id);
      const res = await scan(app, staffB, event2.id, ticket.qrPayload);
      expect(res.status).toBe(403);
      expect((await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } })).status).toBe('ACTIVE');
    });

    it('customer, admin, dan tanpa token tidak boleh memakai /checkin', async () => {
      const [ticket] = await buy(cat1.id);
      expect((await scan(app, customer, event1.id, ticket.qrPayload)).status).toBe(403);
      expect((await scan(app, admin, event1.id, ticket.qrPayload)).status).toBe(403);
      expect(
        (await request(server).post(url('/checkin')).send({ eventId: event1.id, qrPayload: ticket.qrPayload })).status,
      ).toBe(401);
      expect((await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } })).status).toBe('ACTIVE');
    });

    it('acara tidak ada: 404; body tidak valid: 400', async () => {
      const res = await scan(app, staffA, '00000000-0000-4000-8000-000000000000', 'x');
      expect(res.status).toBe(404);
      const bad = await request(server).post(url('/checkin')).set(bearer(staffA)).send({ eventId: 'bukan-uuid' });
      expect(bad.status).toBe(400);
    });
  });

  describe('Concurrency (SC-06)', () => {
    it('6 check-in bersamaan pada satu tiket: tepat satu SUCCESS, lainnya ALREADY_USED', async () => {
      const [ticket] = await buy(cat1.id);
      const actors = [staffA, staffB, staffA, staffB, staffA, staffB];

      const results = await Promise.all(actors.map((token) => scan(app, token, event1.id, ticket.qrPayload)));
      expect(results.every((r) => r.status === 200)).toBe(true);

      const outcomes = results.map((r) => r.body.result);
      expect(outcomes.filter((o) => o === 'SUCCESS')).toHaveLength(1);
      expect(outcomes.filter((o) => o === 'ALREADY_USED')).toHaveLength(5);

      const winnerIndex = outcomes.indexOf('SUCCESS');
      const expectedWinner = actors[winnerIndex] === staffA ? staffAId : staffBId;
      const db = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
      expect(db.status).toBe('USED');
      expect(db.checkedInById).toBe(expectedWinner);

      const logs = await logsFor(ticket.id);
      expect(logs.filter((l) => l.result === 'SUCCESS')).toHaveLength(1);
      expect(logs.filter((l) => l.result === 'ALREADY_USED')).toHaveLength(5);
    });

    it('banyak tiket berbeda dipindai bersamaan: semuanya sukses tepat sekali', async () => {
      const tickets = await buy(cat1.id, 5);
      const results = await Promise.all(tickets.map((t) => scan(app, staffA, event1.id, t.qrPayload)));
      expect(results.map((r) => r.body.result)).toEqual(Array(5).fill('SUCCESS'));
    });
  });

  describe('Riwayat petugas', () => {
    it('petugas hanya melihat riwayat miliknya, dengan filter dan paginasi', async () => {
      const a = await request(server).get(url('/staff/checkins?limit=100')).set(bearer(staffA));
      expect(a.status).toBe(200);
      expect(a.body.items.length).toBeGreaterThan(0);
      expect(a.body.meta.total).toBe(a.body.items.length);

      const staffBLogs = await request(server).get(url('/staff/checkins?limit=100')).set(bearer(staffB));
      const aIds = new Set(a.body.items.map((l: any) => l.id));
      expect(staffBLogs.body.items.every((l: any) => !aIds.has(l.id))).toBe(true);

      const onlySuccess = await request(server).get(url('/staff/checkins?result=SUCCESS&limit=100')).set(bearer(staffA));
      expect(onlySuccess.body.items.every((l: any) => l.result === 'SUCCESS')).toBe(true);

      const byEvent = await request(server).get(url(`/staff/checkins?eventId=${event2.id}&limit=100`)).set(bearer(staffA));
      expect(byEvent.body.items.every((l: any) => l.eventId === event2.id)).toBe(true);

      const paged = await request(server).get(url('/staff/checkins?limit=2&page=1')).set(bearer(staffA));
      expect(paged.body.items).toHaveLength(2);

      expect((await request(server).get(url('/staff/checkins')).set(bearer(customer))).status).toBe(403);
    });

    it('admin melihat ringkasan check-in', async () => {
      const res = await request(server).get(url(`/admin/reports/checkins?eventId=${event1.id}`)).set(bearer(admin));
      expect(res.status).toBe(200);
      expect(res.body.ticketsCheckedIn).toBeGreaterThan(0);
      expect(res.body.byResult.SUCCESS).toBeGreaterThan(0);
      expect(res.body.byResult.ALREADY_USED).toBeGreaterThan(0);
      expect(res.body.recent.length).toBeGreaterThan(0);
      expect((await request(server).get(url('/admin/reports/checkins')).set(bearer(staffA))).status).toBe(403);
    });
  });
});
