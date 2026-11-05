import { INestApplication } from '@nestjs/common';
import { EventStatus, Role } from '@prisma/client';
import request from 'supertest';
import { OrdersService } from '../src/orders/orders.service';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  bearer,
  createTestApp,
  createUser,
  login,
  resetDatabase,
  seedEvent,
  uploadAllPhotos,
  url,
} from './helpers';

describe('Orders, Payments & Tickets (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let server: ReturnType<INestApplication['getHttpServer']>;
  let admin: string;
  let alice: string;
  let bob: string;

  const createOrder = (token: string, items: unknown[]) =>
    request(server).post(url('/orders')).set(bearer(token)).send({ items });
  // Pembayaran SUCCESS mewajibkan foto pemegang tiket; helper mengunggahnya (gagal diam-diam bila
  // bukan pemilik/sudah kedaluwarsa, agar tes penolakan tetap menguji respons server).
  const pay = async (token: string, orderId: string, outcome: string, withPhotos = true) => {
    if (outcome === 'SUCCESS' && withPhotos) await uploadAllPhotos(app, token, orderId);
    return request(server).post(url(`/payments/${orderId}/simulate`)).set(bearer(token)).send({ outcome });
  };
  const category = (id: string) => prisma.ticketCategory.findUniqueOrThrow({ where: { id } });

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    server = app.getHttpServer();
    await resetDatabase(prisma);
    await createUser(prisma, 'admin@op.local', Role.ADMIN);
    await createUser(prisma, 'alice@op.local', Role.CUSTOMER);
    await createUser(prisma, 'bob@op.local', Role.CUSTOMER);
    admin = await login(app, 'admin@op.local');
    alice = await login(app, 'alice@op.local');
    bob = await login(app, 'bob@op.local');
  });

  afterAll(async () => {
    await resetDatabase(prisma);
    await app.close();
  });

  describe('Pembuatan order', () => {
    it('harga selalu dari database; field harga dari klien ditolak (SC-03)', async () => {
      const { categories } = await seedEvent(prisma, {
        categories: [{ name: 'Regular', price: 150000, quota: 20 }],
      });
      const cat = categories[0];

      const tamper = await createOrder(alice, [{ ticketCategoryId: cat.id, quantity: 1, unitPrice: 1 }]);
      expect(tamper.status).toBe(400);
      const tamperTotal = await request(server)
        .post(url('/orders'))
        .set(bearer(alice))
        .send({ items: [{ ticketCategoryId: cat.id, quantity: 1 }], totalAmount: 1 });
      expect(tamperTotal.status).toBe(400);

      const ok = await createOrder(alice, [{ ticketCategoryId: cat.id, quantity: 2 }]);
      expect(ok.status).toBe(201);
      expect(ok.body).toMatchObject({ status: 'PENDING', totalAmount: 300000 });
      expect(ok.body.items[0]).toMatchObject({ unitPrice: 150000, subtotal: 300000, quantity: 2 });
      expect(ok.body.orderNumber).toMatch(/^CP-\d{6}-[0-9A-F]{8}$/);
      expect(new Date(ok.body.expiresAt).getTime()).toBeGreaterThan(Date.now());

      // perubahan harga setelah order tidak mengubah order lama
      await prisma.ticketCategory.update({ where: { id: cat.id }, data: { price: 999999 } });
      const again = await request(server).get(url(`/orders/${ok.body.id}`)).set(bearer(alice));
      expect(again.body.totalAmount).toBe(300000);
    });

    it('order mencadangkan stok; belum ada tiket sebelum dibayar (SC-05)', async () => {
      const { categories } = await seedEvent(prisma, { categories: [{ name: 'R', price: 10000, quota: 5 }] });
      const cat = categories[0];
      const res = await createOrder(alice, [{ ticketCategoryId: cat.id, quantity: 3 }]);
      expect(res.status).toBe(201);
      expect(await category(cat.id)).toMatchObject({ reservedCount: 3, soldCount: 0 });
      expect(await prisma.ticket.count({ where: { eventId: cat.eventId } })).toBe(0);
    });

    it('aturan validasi: >5 tiket, duplikat, kosong, kategori tak ada, acara DRAFT, campur acara', async () => {
      const a = await seedEvent(prisma, { categories: [{ name: 'A', price: 1000, quota: 50 }] });
      const b = await seedEvent(prisma, { categories: [{ name: 'B', price: 1000, quota: 50 }] });
      const draft = await seedEvent(prisma, { status: EventStatus.DRAFT, categories: [{ name: 'D', price: 1000, quota: 5 }] });
      const catA = a.categories[0].id;
      const catB = b.categories[0].id;

      expect((await createOrder(alice, [{ ticketCategoryId: catA, quantity: 6 }])).status).toBe(400);
      expect((await createOrder(alice, [])).status).toBe(400);
      const dup = await createOrder(alice, [
        { ticketCategoryId: catA, quantity: 1 },
        { ticketCategoryId: catA, quantity: 1 },
      ]);
      expect(dup.status).toBe(400);
      expect(dup.body.code).toBe('DUPLICATE_ITEM');
      expect((await createOrder(alice, [{ ticketCategoryId: catA, quantity: 0 }])).status).toBe(400);
      expect(
        (await createOrder(alice, [{ ticketCategoryId: '00000000-0000-4000-8000-000000000000', quantity: 1 }])).status,
      ).toBe(404);

      const notAvail = await createOrder(alice, [{ ticketCategoryId: draft.categories[0].id, quantity: 1 }]);
      expect(notAvail.status).toBe(409);
      expect(notAvail.body.code).toBe('EVENT_NOT_AVAILABLE');

      const mixed = await createOrder(alice, [
        { ticketCategoryId: catA, quantity: 1 },
        { ticketCategoryId: catB, quantity: 1 },
      ]);
      expect(mixed.status).toBe(400);
      expect(mixed.body.code).toBe('MIXED_EVENTS');
    });

    it('stok kurang pada salah satu item membatalkan seluruh order tanpa cadangan tersisa', async () => {
      const { categories } = await seedEvent(prisma, {
        categories: [
          { name: 'Banyak', price: 1000, quota: 10 },
          { name: 'Sedikit', price: 2000, quota: 1 },
        ],
      });
      const banyak = categories.find((c) => c.name === 'Banyak')!;
      const sedikit = categories.find((c) => c.name === 'Sedikit')!;
      const res = await createOrder(alice, [
        { ticketCategoryId: banyak.id, quantity: 1 },
        { ticketCategoryId: sedikit.id, quantity: 2 },
      ]);
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('INSUFFICIENT_STOCK');
      expect((await category(banyak.id)).reservedCount).toBe(0);
      expect((await category(sedikit.id)).reservedCount).toBe(0);
    });

    it('hanya CUSTOMER yang dapat membuat order; tanpa token 401', async () => {
      const { categories } = await seedEvent(prisma);
      const body = { items: [{ ticketCategoryId: categories[0].id, quantity: 1 }] };
      expect((await request(server).post(url('/orders')).send(body)).status).toBe(401);
      expect((await request(server).post(url('/orders')).set(bearer(admin)).send(body)).status).toBe(403);
    });
  });

  describe('Pembayaran simulasi dan penerbitan tiket', () => {
    it('sukses: order PAID, stok terjual, tiket ACTIVE terbit dengan QR valid', async () => {
      const { categories } = await seedEvent(prisma, { categories: [{ name: 'R', price: 50000, quota: 10 }] });
      const cat = categories[0];
      const order = await createOrder(alice, [{ ticketCategoryId: cat.id, quantity: 2 }]);

      const res = await pay(alice, order.body.id, 'SUCCESS');
      expect(res.status).toBe(200);
      expect(res.body.order.status).toBe('PAID');
      expect(res.body.payment).toMatchObject({ status: 'SUCCESS', method: 'SIMULATION' });
      expect(res.body.ticketsIssued).toBe(2);
      expect(res.body.notice).toMatch(/SIMULASI/);

      expect(await category(cat.id)).toMatchObject({ soldCount: 2, reservedCount: 0 });

      const mine = await request(server).get(url('/tickets/my')).set(bearer(alice));
      const tickets = mine.body.filter((t: any) => t.orderNumber === order.body.orderNumber);
      expect(tickets).toHaveLength(2);
      for (const t of tickets) {
        expect(t).toMatchObject({ status: 'ACTIVE', paymentStatus: 'PAID', categoryName: 'R', checkedInAt: null });
        expect(t.qrPayload).toMatch(/^CP1\.[A-Z2-7]{26}\.[0-9a-f]{24}$/);
        expect(t.qrPayload).toContain(t.ticketCode);
      }
      expect(new Set(tickets.map((t: any) => t.ticketCode)).size).toBe(2);

      const payments = await prisma.paymentTransaction.findMany({ where: { orderId: order.body.id } });
      expect(payments).toHaveLength(1);
      expect(payments[0].reference).toMatch(/^SIM-/);
    });

    it('gagal: order FAILED, cadangan dilepas, tidak ada tiket (SC-05)', async () => {
      const { categories } = await seedEvent(prisma, { categories: [{ name: 'R', price: 50000, quota: 4 }] });
      const cat = categories[0];
      const order = await createOrder(alice, [{ ticketCategoryId: cat.id, quantity: 4 }]);
      expect(await category(cat.id)).toMatchObject({ reservedCount: 4 });

      const res = await pay(alice, order.body.id, 'FAILED');
      expect(res.status).toBe(200);
      expect(res.body.order.status).toBe('FAILED');
      expect(res.body.ticketsIssued).toBe(0);
      expect(await category(cat.id)).toMatchObject({ reservedCount: 0, soldCount: 0 });
      expect(await prisma.ticket.count({ where: { eventId: cat.eventId } })).toBe(0);

      // stok kembali tersedia
      expect((await createOrder(bob, [{ ticketCategoryId: cat.id, quantity: 4 }])).status).toBe(201);
    });

    it('klien tidak dapat mengirim status PAID; outcome tak dikenal ditolak', async () => {
      const { categories } = await seedEvent(prisma);
      const order = await createOrder(alice, [{ ticketCategoryId: categories[0].id, quantity: 1 }]);
      for (const body of [{ status: 'PAID' }, { outcome: 'PAID' }, { outcome: 'SUCCESS', status: 'PAID' }, {}]) {
        const res = await request(server)
          .post(url(`/payments/${order.body.id}/simulate`))
          .set(bearer(alice))
          .send(body);
        expect(res.status).toBe(400);
      }
      const o = await prisma.order.findUniqueOrThrow({ where: { id: order.body.id } });
      expect(o.status).toBe('PENDING');
    });

    it('pembayaran kedua pada order final ditolak 409 dan tidak menerbitkan tiket tambahan', async () => {
      const { categories } = await seedEvent(prisma);
      const order = await createOrder(alice, [{ ticketCategoryId: categories[0].id, quantity: 1 }]);
      expect((await pay(alice, order.body.id, 'SUCCESS')).status).toBe(200);
      const second = await pay(alice, order.body.id, 'SUCCESS');
      expect(second.status).toBe(409);
      expect(second.body.code).toBe('ORDER_NOT_PENDING');
      expect((await pay(alice, order.body.id, 'FAILED')).status).toBe(409);
      expect(await prisma.ticket.count({ where: { orderItem: { orderId: order.body.id } } })).toBe(1);
    });

    it('user lain tidak dapat membayar order orang lain (404) dan admin tidak dapat membayar (403)', async () => {
      const { categories } = await seedEvent(prisma);
      const order = await createOrder(alice, [{ ticketCategoryId: categories[0].id, quantity: 1 }]);
      expect((await pay(bob, order.body.id, 'SUCCESS')).status).toBe(404);
      expect((await pay(admin, order.body.id, 'SUCCESS')).status).toBe(403);
      expect((await prisma.order.findUniqueOrThrow({ where: { id: order.body.id } })).status).toBe('PENDING');
    });

    it('flag PAYMENT_SIMULATION_ENABLED=false menonaktifkan endpoint (SC-11)', async () => {
      const { categories } = await seedEvent(prisma);
      const order = await createOrder(alice, [{ ticketCategoryId: categories[0].id, quantity: 1 }]);
      const previous = process.env.PAYMENT_SIMULATION_ENABLED;
      process.env.PAYMENT_SIMULATION_ENABLED = 'false';
      try {
        expect((await pay(alice, order.body.id, 'SUCCESS')).status).toBe(404);
      } finally {
        if (previous === undefined) delete process.env.PAYMENT_SIMULATION_ENABLED;
        else process.env.PAYMENT_SIMULATION_ENABLED = previous;
      }
      expect((await prisma.order.findUniqueOrThrow({ where: { id: order.body.id } })).status).toBe('PENDING');
      expect((await pay(alice, order.body.id, 'SUCCESS')).status).toBe(200);
    });
  });

  describe('Kedaluwarsa order', () => {
    it('pembayaran setelah batas waktu ditolak 410, order EXPIRED, stok dilepas', async () => {
      const { categories } = await seedEvent(prisma, { categories: [{ name: 'R', price: 1000, quota: 3 }] });
      const cat = categories[0];
      const order = await createOrder(alice, [{ ticketCategoryId: cat.id, quantity: 3 }]);
      await prisma.order.update({ where: { id: order.body.id }, data: { expiresAt: new Date(Date.now() - 1000) } });

      const res = await pay(alice, order.body.id, 'SUCCESS');
      expect(res.status).toBe(410);
      expect(res.body.code).toBe('ORDER_EXPIRED');
      expect((await prisma.order.findUniqueOrThrow({ where: { id: order.body.id } })).status).toBe('EXPIRED');
      expect(await category(cat.id)).toMatchObject({ reservedCount: 0, soldCount: 0 });
      expect(await prisma.ticket.count({ where: { eventId: cat.eventId } })).toBe(0);
    });

    it('expireOverdueOrders melepas stok dan idempoten', async () => {
      const { categories } = await seedEvent(prisma, { categories: [{ name: 'R', price: 1000, quota: 5 }] });
      const cat = categories[0];
      const order = await createOrder(alice, [{ ticketCategoryId: cat.id, quantity: 2 }]);
      await prisma.order.update({ where: { id: order.body.id }, data: { expiresAt: new Date(Date.now() - 1000) } });

      const orders = app.get(OrdersService);
      expect(await orders.expireOverdueOrders()).toBeGreaterThanOrEqual(1);
      expect((await prisma.order.findUniqueOrThrow({ where: { id: order.body.id } })).status).toBe('EXPIRED');
      expect((await category(cat.id)).reservedCount).toBe(0);

      expect(await orders.expireOverdueOrders()).toBe(0); // dijalankan ulang: tidak ada perubahan
      expect((await category(cat.id)).reservedCount).toBe(0);
    });
  });

  describe('Kepemilikan data (SC-02)', () => {
    it('customer tidak dapat membaca order maupun tiket milik orang lain', async () => {
      const { categories } = await seedEvent(prisma);
      const order = await createOrder(alice, [{ ticketCategoryId: categories[0].id, quantity: 1 }]);
      await pay(alice, order.body.id, 'SUCCESS');
      const aliceTickets = await request(server).get(url('/tickets/my')).set(bearer(alice));
      const ticketId = aliceTickets.body.find((t: any) => t.orderNumber === order.body.orderNumber).id;

      expect((await request(server).get(url(`/orders/${order.body.id}`)).set(bearer(alice))).status).toBe(200);
      expect((await request(server).get(url(`/tickets/${ticketId}`)).set(bearer(alice))).status).toBe(200);

      expect((await request(server).get(url(`/orders/${order.body.id}`)).set(bearer(bob))).status).toBe(404);
      expect((await request(server).get(url(`/tickets/${ticketId}`)).set(bearer(bob))).status).toBe(404);

      const bobOrders = await request(server).get(url('/orders/my')).set(bearer(bob));
      expect(bobOrders.body.map((o: any) => o.id)).not.toContain(order.body.id);
      const bobTickets = await request(server).get(url('/tickets/my')).set(bearer(bob));
      expect(bobTickets.body.map((t: any) => t.id)).not.toContain(ticketId);
    });

    it('admin dapat melihat order orang lain dan daftar tiket tanpa qrPayload', async () => {
      const { categories } = await seedEvent(prisma);
      const order = await createOrder(alice, [{ ticketCategoryId: categories[0].id, quantity: 1 }]);
      await pay(alice, order.body.id, 'SUCCESS');

      expect((await request(server).get(url(`/orders/${order.body.id}`)).set(bearer(admin))).status).toBe(200);

      const list = await request(server).get(url('/admin/orders?status=PAID')).set(bearer(admin));
      expect(list.status).toBe(200);
      expect(list.body.items.some((o: any) => o.id === order.body.id && o.user.email === 'alice@op.local')).toBe(true);

      const tickets = await request(server)
        .get(url(`/admin/tickets?eventId=${categories[0].eventId}`))
        .set(bearer(admin));
      expect(tickets.status).toBe(200);
      expect(tickets.body.items).toHaveLength(1);
      expect(tickets.body.items[0]).not.toHaveProperty('qrPayload');

      expect((await request(server).get(url('/admin/orders')).set(bearer(alice))).status).toBe(403);
      expect((await request(server).get(url('/admin/tickets')).set(bearer(alice))).status).toBe(403);
    });
  });

  describe('Concurrency', () => {
    it('8 order paralel pada kuota 3: tepat 3 berhasil, tidak ada overselling (SC-04)', async () => {
      const { categories } = await seedEvent(prisma, { categories: [{ name: 'Terbatas', price: 1000, quota: 3 }] });
      const cat = categories[0];

      const results = await Promise.all(
        Array.from({ length: 8 }, (_, i) =>
          createOrder(i % 2 === 0 ? alice : bob, [{ ticketCategoryId: cat.id, quantity: 1 }]),
        ),
      );
      const statuses = results.map((r) => r.status);
      expect(statuses.filter((s) => s === 201)).toHaveLength(3);
      expect(statuses.filter((s) => s === 409)).toHaveLength(5);

      const after = await category(cat.id);
      expect(after.reservedCount).toBe(3);
      expect(after.soldCount + after.reservedCount).toBeLessThanOrEqual(after.quota);
    });

    it('order berbeda ukuran bersamaan tidak melewati kuota', async () => {
      const { categories } = await seedEvent(prisma, { categories: [{ name: 'Campur', price: 1000, quota: 7 }] });
      const cat = categories[0];
      const qty = [3, 3, 2, 2, 1, 1, 4];
      const results = await Promise.all(
        qty.map((q, i) => createOrder(i % 2 === 0 ? alice : bob, [{ ticketCategoryId: cat.id, quantity: q }])),
      );
      const accepted = results
        .map((r, i) => (r.status === 201 ? qty[i] : 0))
        .reduce((a, b) => a + b, 0);
      const after = await category(cat.id);
      expect(after.reservedCount).toBe(accepted);
      expect(accepted).toBeLessThanOrEqual(7);
    });

    it('dua pembayaran sukses bersamaan pada satu order: satu menang, tiket tidak ganda', async () => {
      const { categories } = await seedEvent(prisma, { categories: [{ name: 'R', price: 1000, quota: 5 }] });
      const cat = categories[0];
      const order = await createOrder(alice, [{ ticketCategoryId: cat.id, quantity: 2 }]);

      expect(await uploadAllPhotos(app, alice, order.body.id)).toBe(true);
      const results = await Promise.all([
        pay(alice, order.body.id, 'SUCCESS', false),
        pay(alice, order.body.id, 'SUCCESS', false),
        pay(alice, order.body.id, 'FAILED', false),
      ]);
      expect(results.filter((r) => r.status === 200)).toHaveLength(1);
      expect(results.filter((r) => r.status === 409)).toHaveLength(2);

      const finalOrder = await prisma.order.findUniqueOrThrow({ where: { id: order.body.id } });
      const tickets = await prisma.ticket.count({ where: { orderItem: { orderId: order.body.id } } });
      const after = await category(cat.id);
      if (finalOrder.status === 'PAID') {
        expect(tickets).toBe(2);
        expect(after).toMatchObject({ soldCount: 2, reservedCount: 0 });
      } else {
        expect(finalOrder.status).toBe('FAILED');
        expect(tickets).toBe(0);
        expect(after).toMatchObject({ soldCount: 0, reservedCount: 0 });
      }
    });
  });
});
