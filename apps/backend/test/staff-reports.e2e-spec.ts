import { INestApplication } from '@nestjs/common';
import { Role } from '@prisma/client';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  PASSWORD,
  bearer,
  createTestApp,
  createUser,
  login,
  purchaseTickets,
  resetDatabase,
  seedEvent,
  url,
} from './helpers';

describe('Staff admin & Reports (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let server: ReturnType<INestApplication['getHttpServer']>;
  let admin: string;
  let customer: string;
  let customerId: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    server = app.getHttpServer();
    await resetDatabase(prisma);
    await createUser(prisma, 'admin@sr.local', Role.ADMIN);
    customerId = (await createUser(prisma, 'customer@sr.local', Role.CUSTOMER)).id;
    admin = await login(app, 'admin@sr.local');
    customer = await login(app, 'customer@sr.local');
  });

  afterAll(async () => {
    await resetDatabase(prisma);
    await app.close();
  });

  describe('Akun petugas', () => {
    let staffId: string;

    it('admin membuat petugas; respons tanpa passwordHash; password di-hash', async () => {
      const res = await request(server)
        .post(url('/admin/staff'))
        .set(bearer(admin))
        .send({ name: 'Petugas Baru', email: 'Baru@SR.local', password: PASSWORD });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ email: 'baru@sr.local', role: 'GATE_STAFF', isActive: true, eventIds: [] });
      expect(JSON.stringify(res.body)).not.toContain('passwordHash');
      staffId = res.body.id;

      const inDb = await prisma.user.findUniqueOrThrow({ where: { id: staffId } });
      expect(inDb.passwordHash).toMatch(/^\$argon2/);
    });

    it('email duplikat 409; password lemah 400; customer tidak boleh membuat petugas', async () => {
      const dup = await request(server)
        .post(url('/admin/staff'))
        .set(bearer(admin))
        .send({ name: 'Dobel', email: 'baru@sr.local', password: PASSWORD });
      expect(dup.status).toBe(409);
      const weak = await request(server)
        .post(url('/admin/staff'))
        .set(bearer(admin))
        .send({ name: 'Lemah', email: 'lemah@sr.local', password: 'abcdefgh' });
      expect(weak.status).toBe(400);
      const forbidden = await request(server)
        .post(url('/admin/staff'))
        .set(bearer(customer))
        .send({ name: 'X', email: 'x@sr.local', password: PASSWORD });
      expect(forbidden.status).toBe(403);
    });

    it('petugas baru dapat login, ditugaskan ke acara, lalu melihatnya di /staff/events', async () => {
      const { event } = await seedEvent(prisma, { title: 'Acara Penugasan' });
      const assign = await request(server)
        .put(url(`/admin/events/${event.id}/staff`))
        .set(bearer(admin))
        .send({ staffIds: [staffId] });
      expect(assign.status).toBe(200);

      const token = await login(app, 'baru@sr.local');
      const mine = await request(server).get(url('/staff/events')).set(bearer(token));
      expect(mine.body.map((e: any) => e.id)).toContain(event.id);

      const list = await request(server).get(url('/admin/staff')).set(bearer(admin));
      const row = list.body.find((s: any) => s.id === staffId);
      expect(row.eventIds).toContain(event.id);

      // mengganti penugasan menjadi kosong mencabut akses
      await request(server).put(url(`/admin/events/${event.id}/staff`)).set(bearer(admin)).send({ staffIds: [] });
      const after = await request(server).get(url('/staff/events')).set(bearer(token));
      expect(after.body.map((e: any) => e.id)).not.toContain(event.id);
    });

    it('menugaskan akun yang bukan petugas ditolak 400', async () => {
      const { event } = await seedEvent(prisma);
      const res = await request(server)
        .put(url(`/admin/events/${event.id}/staff`))
        .set(bearer(admin))
        .send({ staffIds: [customerId] });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_STAFF');
    });

    it('menonaktifkan petugas langsung mencabut login dan token lama', async () => {
      const token = await login(app, 'baru@sr.local');
      const patched = await request(server)
        .patch(url(`/admin/staff/${staffId}`))
        .set(bearer(admin))
        .send({ isActive: false });
      expect(patched.status).toBe(200);
      expect(patched.body.isActive).toBe(false);

      expect((await request(server).get(url('/auth/me')).set(bearer(token))).status).toBe(401);
      const relogin = await request(server).post(url('/auth/login')).send({ email: 'baru@sr.local', password: PASSWORD });
      expect(relogin.status).toBe(401);
    });

    it('PATCH tidak dapat dipakai pada akun non-petugas (404) dan menolak perubahan role/email', async () => {
      expect(
        (await request(server).patch(url(`/admin/staff/${customerId}`)).set(bearer(admin)).send({ name: 'Hack' })).status,
      ).toBe(404);
      expect(
        (await request(server).patch(url(`/admin/staff/${staffId}`)).set(bearer(admin)).send({ role: 'ADMIN' })).status,
      ).toBe(400);
      expect(
        (await request(server).patch(url(`/admin/staff/${staffId}`)).set(bearer(admin)).send({ email: 'lain@sr.local' })).status,
      ).toBe(400);
    });
  });

  describe('Laporan', () => {
    it('summary dan sales mencerminkan pembelian', async () => {
      const { event, categories } = await seedEvent(prisma, {
        title: 'Acara Laporan',
        categories: [{ name: 'Reg', price: 25000, quota: 10 }],
      });
      await purchaseTickets(app, customer, categories[0].id, 3);

      const summary = await request(server).get(url('/admin/reports/summary')).set(bearer(admin));
      expect(summary.status).toBe(200);
      expect(summary.body.events.total).toBeGreaterThanOrEqual(1);
      expect(summary.body.orders.byStatus.PAID).toBeGreaterThanOrEqual(1);
      expect(summary.body.tickets.issued).toBeGreaterThanOrEqual(3);
      expect(summary.body.simulatedRevenue).toBeGreaterThanOrEqual(75000);

      const sales = await request(server).get(url(`/admin/reports/sales?eventId=${event.id}`)).set(bearer(admin));
      expect(sales.status).toBe(200);
      expect(sales.body).toHaveLength(1);
      expect(sales.body[0]).toMatchObject({
        name: 'Reg',
        eventTitle: 'Acara Laporan',
        quota: 10,
        soldCount: 3,
        reservedCount: 0,
        available: 7,
        ticketsPaid: 3,
        simulatedRevenue: 75000,
      });
    });

    it('laporan hanya untuk admin', async () => {
      for (const path of ['/admin/reports/summary', '/admin/reports/sales', '/admin/reports/checkins']) {
        expect((await request(server).get(url(path)).set(bearer(customer))).status).toBe(403);
        expect((await request(server).get(url(path))).status).toBe(401);
      }
      expect((await request(server).get(url('/admin/reports/sales?eventId=bukan-uuid')).set(bearer(admin))).status).toBe(400);
    });
  });
});
