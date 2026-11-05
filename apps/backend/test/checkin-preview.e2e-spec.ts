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

describe('Check-in preview (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let server: ReturnType<INestApplication['getHttpServer']>;
  let qr: QrSigner;
  let customer: string;
  let customerId: string;
  let staffA: string;
  let staffB: string;
  let staffC: string;
  let customerToken: string;
  let event1: { id: string };
  let event2: { id: string };
  let cat1: { id: string };
  let cat2: { id: string };

  const preview = (token: string, eventId: string, qrPayload: string) =>
    request(server).post(url('/checkin/preview')).set(bearer(token)).send({ eventId, qrPayload });
  const buy = async (categoryId: string, qty = 1) =>
    (await purchaseTickets(app, customer, categoryId, qty)).tickets as Array<{
      id: string;
      ticketCode: string;
      qrPayload: string;
    }>;
  const logCount = () => prisma.checkInLog.count();

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    server = app.getHttpServer();
    qr = app.get(QrSigner);
    await resetDatabase(prisma);

    const c = await createUser(prisma, 'customer@pv.local', Role.CUSTOMER);
    customerId = c.id;
    const a = await createUser(prisma, 'staffa@pv.local', Role.GATE_STAFF);
    const b = await createUser(prisma, 'staffb@pv.local', Role.GATE_STAFF);
    await createUser(prisma, 'staffc@pv.local', Role.GATE_STAFF);

    const e1 = await seedEvent(prisma, { title: 'Preview Satu', categories: [{ name: 'Reg', price: 10000, quota: 50 }] });
    const e2 = await seedEvent(prisma, { title: 'Preview Dua', categories: [{ name: 'VIP', price: 20000, quota: 50 }] });
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

    customer = await login(app, 'customer@pv.local');
    customerToken = customer;
    staffA = await login(app, 'staffa@pv.local');
    staffB = await login(app, 'staffb@pv.local');
    staffC = await login(app, 'staffc@pv.local');
  });

  afterAll(async () => {
    await resetDatabase(prisma);
    await app.close();
  });

  it('tiket valid: READY dengan data minimal; status tiket dan log TIDAK berubah', async () => {
    const [ticket] = await buy(cat1.id);
    const logsBefore = await logCount();

    const res = await preview(staffA, event1.id, ticket.qrPayload);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, result: 'READY' });
    expect(res.body.ticket).toMatchObject({
      id: ticket.id,
      ticketCode: ticket.ticketCode,
      categoryName: 'Reg',
      eventTitle: 'Preview Satu',
      buyerName: 'customer',
      hasHolderPhoto: true,
      status: 'ACTIVE',
      checkedInAt: null,
    });

    // privasi: tidak ada email, token QR, atau hash di respons
    const raw = JSON.stringify(res.body);
    expect(raw).not.toContain('customer@pv.local');
    expect(raw).not.toContain(ticket.qrPayload);
    expect(raw).not.toMatch(/passwordHash|orderNumber|storageKey/);

    // pratinjau berulang tidak "membakar" tiket
    await preview(staffA, event1.id, ticket.qrPayload);
    await preview(staffB, event1.id, ticket.qrPayload);
    const db = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(db).toMatchObject({ status: 'ACTIVE', checkedInAt: null, checkedInById: null });
    expect(await logCount()).toBe(logsBefore);
  });

  it('alur dua langkah: pratinjau lalu konfirmasi check-in; scan ulang menjadi ALREADY_USED', async () => {
    const [ticket] = await buy(cat1.id);
    expect((await preview(staffA, event1.id, ticket.qrPayload)).body.result).toBe('READY');

    const confirm = await scan(app, staffA, event1.id, ticket.qrPayload);
    expect(confirm.body).toMatchObject({ success: true, result: 'SUCCESS' });

    const again = await preview(staffB, event1.id, ticket.qrPayload);
    expect(again.status).toBe(200);
    expect(again.body).toMatchObject({ success: false, result: 'ALREADY_USED' });
    expect(again.body.firstCheckedInAt).toBe(confirm.body.ticket.checkedInAt);
    expect(again.body.ticket).toMatchObject({ status: 'USED', hasHolderPhoto: true });
  });

  it('petugas boleh menolak: tiket yang hanya dipratinjau tetap dapat dipakai pemilik sah', async () => {
    const [ticket] = await buy(cat1.id);
    await preview(staffA, event1.id, ticket.qrPayload); // petugas melihat, wajah tidak cocok, tidak dikonfirmasi
    expect((await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } })).status).toBe('ACTIVE');
    expect((await scan(app, staffB, event1.id, ticket.qrPayload)).body.result).toBe('SUCCESS');
  });

  it('penolakan pada pratinjau tidak ditulis ke log dan tidak membocorkan data tiket', async () => {
    const [ticket] = await buy(cat1.id);
    const logsBefore = await logCount();

    const garbage = await preview(staffA, event1.id, 'bukan-qr');
    expect(garbage.body).toMatchObject({ success: false, result: 'INVALID_TOKEN' });
    const ghost = await preview(staffA, event1.id, qr.buildPayload(qr.generateTicketCode()));
    expect(ghost.body).toMatchObject({ success: false, result: 'INVALID_TOKEN' });

    const wrong = await preview(staffA, event2.id, ticket.qrPayload);
    expect(wrong.body).toMatchObject({ success: false, result: 'WRONG_EVENT' });
    expect(wrong.body.ticket).toBeUndefined();
    expect(JSON.stringify(wrong.body)).not.toContain('Preview Satu');

    expect(await logCount()).toBe(logsBefore);
  });

  it('order belum PAID dan tiket dibatalkan/kedaluwarsa ditolak tanpa data tiket', async () => {
    const notPaidOrder = await prisma.order.create({
      data: {
        userId: customerId,
        orderNumber: 'CP-TEST-PV-NOTPAID',
        totalAmount: 10000,
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 3600_000),
        items: { create: [{ ticketCategoryId: cat1.id, quantity: 1, unitPrice: 10000, subtotal: 10000 }] },
      },
      include: { items: true },
    });
    const code = qr.generateTicketCode();
    await prisma.ticket.create({
      data: { orderItemId: notPaidOrder.items[0].id, eventId: event1.id, ownerId: customerId, ticketCode: code },
    });
    const unpaid = await preview(staffA, event1.id, qr.buildPayload(code));
    expect(unpaid.body).toMatchObject({ success: false, result: 'NOT_PAID' });
    expect(unpaid.body.ticket).toBeUndefined();

    const [t1, t2] = await buy(cat1.id, 2);
    await prisma.ticket.update({ where: { id: t1.id }, data: { status: 'CANCELLED' } });
    await prisma.ticket.update({ where: { id: t2.id }, data: { status: 'EXPIRED' } });
    for (const t of [t1, t2]) {
      const res = await preview(staffA, event1.id, t.qrPayload);
      expect(res.body).toMatchObject({ success: false, result: 'CANCELLED_OR_EXPIRED' });
      expect(res.body.ticket).toBeUndefined();
    }
  });

  it('petugas yang tidak ditugaskan: 403 dan upaya dicatat; role lain ditolak', async () => {
    const [ticket] = await buy(cat1.id);
    const logsBefore = await prisma.checkInLog.count({ where: { result: 'NOT_AUTHORIZED' } });

    const res = await preview(staffC, event1.id, ticket.qrPayload);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('NOT_AUTHORIZED');
    expect(await prisma.checkInLog.count({ where: { result: 'NOT_AUTHORIZED' } })).toBe(logsBefore + 1);

    // petugas B hanya ditugaskan ke acara 1
    const b2 = await buy(cat2.id);
    expect((await preview(staffB, event2.id, b2[0].qrPayload)).status).toBe(403);

    expect((await preview(customerToken, event1.id, ticket.qrPayload)).status).toBe(403);
    expect(
      (await request(server).post(url('/checkin/preview')).send({ eventId: event1.id, qrPayload: ticket.qrPayload })).status,
    ).toBe(401);
    expect((await preview(staffA, '00000000-0000-4000-8000-000000000000', 'x')).status).toBe(404);
    expect(
      (await request(server).post(url('/checkin/preview')).set(bearer(staffA)).send({ eventId: 'bukan-uuid' })).status,
    ).toBe(400);
  });

  it('petugas yang ditugaskan dapat mengambil foto pemegang dari tiket yang dipratinjau', async () => {
    const [ticket] = await buy(cat1.id);
    const res = await preview(staffA, event1.id, ticket.qrPayload);
    const photo = await request(server).get(url(`/tickets/${res.body.ticket.id}/photo`)).set(bearer(staffA));
    expect(photo.status).toBe(200);
    expect(photo.headers['content-type']).toMatch(/image\//);
    // petugas lain yang tidak ditugaskan tidak dapat
    expect((await request(server).get(url(`/tickets/${res.body.ticket.id}/photo`)).set(bearer(staffC))).status).toBe(404);
  });
});
