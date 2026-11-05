import { INestApplication } from '@nestjs/common';
import { EventStatus, Role } from '@prisma/client';
import request from 'supertest';
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

describe('Penugasan petugas & statistik check-in (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let server: ReturnType<INestApplication['getHttpServer']>;
  let admin: string;
  let customer: string;
  let staffA: string;
  let staffB: string;
  let staffAId: string;
  let staffBId: string;

  const put = (eventId: string, staffIds: string[]) =>
    request(server).put(url(`/admin/events/${eventId}/staff`)).set(bearer(admin)).send({ staffIds });
  const myEventIds = async (token: string) =>
    (await request(server).get(url('/staff/events')).set(bearer(token))).body.map((e: any) => e.id) as string[];
  const stats = (eventId: string, token = admin) =>
    request(server).get(url(`/admin/reports/events/${eventId}/checkin-stats`)).set(bearer(token));

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    server = app.getHttpServer();
    await resetDatabase(prisma);
    await createUser(prisma, 'admin@sa.local', Role.ADMIN);
    await createUser(prisma, 'customer@sa.local', Role.CUSTOMER);
    staffAId = (await createUser(prisma, 'a@sa.local', Role.GATE_STAFF)).id;
    staffBId = (await createUser(prisma, 'b@sa.local', Role.GATE_STAFF)).id;
    admin = await login(app, 'admin@sa.local');
    customer = await login(app, 'customer@sa.local');
    staffA = await login(app, 'a@sa.local');
    staffB = await login(app, 'b@sa.local');
  });

  afterAll(async () => {
    await resetDatabase(prisma);
    await app.close();
  });

  describe('Penugasan', () => {
    it('beberapa petugas ke satu event; daftar admin memuat eventIds; masing-masing melihat event', async () => {
      const { event } = await seedEvent(prisma, { title: 'Multi Petugas' });
      expect((await put(event.id, [staffAId, staffBId])).status).toBe(200);

      const list = await request(server).get(url('/admin/staff')).set(bearer(admin));
      for (const id of [staffAId, staffBId]) {
        expect(list.body.find((s: any) => s.id === id).eventIds).toContain(event.id);
      }
      expect(await myEventIds(staffA)).toContain(event.id);
      expect(await myEventIds(staffB)).toContain(event.id);
    });

    it('mengirim daftar lengkap: petugas yang masih dipilih tetap, yang dilepas kehilangan akses', async () => {
      const { event } = await seedEvent(prisma, { title: 'Ubah Penugasan' });
      await put(event.id, [staffAId, staffBId]);
      await put(event.id, [staffAId]); // B dilepas, A tetap

      expect(await myEventIds(staffA)).toContain(event.id);
      expect(await myEventIds(staffB)).not.toContain(event.id);
      expect(await prisma.staffAssignment.count({ where: { eventId: event.id } })).toBe(1);
    });

    it('petugas tidak ditugaskan ditolak scan (NOT_AUTHORIZED) dan tidak mengubah tiket', async () => {
      const { event, categories } = await seedEvent(prisma, { title: 'Akses Terbatas' });
      await put(event.id, [staffAId]);
      const { tickets } = await purchaseTickets(app, customer, categories[0].id, 1);

      const res = await scan(app, staffB, event.id, tickets[0].qrPayload);
      expect(res.body).toMatchObject({ success: false, result: 'NOT_AUTHORIZED' });
      const t = await prisma.ticket.findUniqueOrThrow({ where: { id: tickets[0].id } });
      expect(t.status).toBe('ACTIVE');
    });

    it('event DRAFT yang ditugaskan tersimpan tetapi tidak muncul di /staff/events (aturan PUBLISHED dipertahankan)', async () => {
      const { event } = await seedEvent(prisma, { title: 'Masih Draft', status: EventStatus.DRAFT });
      expect((await put(event.id, [staffAId])).status).toBe(200);
      expect(await myEventIds(staffA)).not.toContain(event.id);
      await prisma.event.update({ where: { id: event.id }, data: { status: EventStatus.PUBLISHED } });
      expect(await myEventIds(staffA)).toContain(event.id);
    });

    it('hanya ADMIN yang boleh mengatur penugasan', async () => {
      const { event } = await seedEvent(prisma);
      expect((await request(server).put(url(`/admin/events/${event.id}/staff`)).set(bearer(staffA)).send({ staffIds: [] })).status).toBe(403);
      expect((await request(server).put(url(`/admin/events/${event.id}/staff`)).set(bearer(customer)).send({ staffIds: [] })).status).toBe(403);
      expect((await request(server).get(url('/admin/staff')).set(bearer(staffA))).status).toBe(403);
    });
  });

  describe('Statistik check-in (terpisah dari crowd monitoring)', () => {
    it('alur lengkap: 0 -> 1 check-in -> scan ulang tidak menambah -> tiket invalid tidak menambah', async () => {
      const { event, categories } = await seedEvent(prisma, { title: 'Statistik Tiket' });
      await put(event.id, [staffAId]);
      const { tickets } = await purchaseTickets(app, customer, categories[0].id, 2);

      // Ada tiket, belum ada check-in, dan belum ada data monitoring sama sekali.
      let s = await stats(event.id);
      expect(s.status).toBe(200);
      expect(s.body).toMatchObject({ issued: 2, checkedIn: 0, notCheckedIn: 2, percentage: 0, lastCheckInAt: null });

      expect((await scan(app, staffA, event.id, tickets[0].qrPayload)).body.result).toBe('SUCCESS');
      s = await stats(event.id);
      expect(s.body).toMatchObject({ issued: 2, checkedIn: 1, notCheckedIn: 1, percentage: 50 });
      expect(s.body.lastCheckInAt).not.toBeNull();

      const again = await scan(app, staffA, event.id, tickets[0].qrPayload);
      expect(again.body.result).toBe('ALREADY_USED');
      expect((await stats(event.id)).body.checkedIn).toBe(1);

      const bad = await scan(app, staffA, event.id, 'bukan-qr-yang-valid');
      expect(bad.body.success).toBe(false);
      expect((await stats(event.id)).body.checkedIn).toBe(1);
    });

    it('acara tanpa tiket: semuanya 0 (tanpa NaN)', async () => {
      const { event } = await seedEvent(prisma, { title: 'Tanpa Tiket' });
      const s = await stats(event.id);
      expect(s.body).toMatchObject({ issued: 0, checkedIn: 0, notCheckedIn: 0, percentage: 0 });
    });

    it('data monitoring tidak memengaruhi statistik tiket, dan sebaliknya', async () => {
      const { event, categories } = await seedEvent(prisma, { title: 'Independen' });
      await put(event.id, [staffAId]);
      const { tickets } = await purchaseTickets(app, customer, categories[0].id, 1);
      await scan(app, staffA, event.id, tickets[0].qrPayload);

      const before = (await stats(event.id)).body;
      const dashBefore = await request(server).get(url(`/admin/events/${event.id}/crowd/dashboard`)).set(bearer(admin));
      expect(dashBefore.status).toBe(200);
      expect(dashBefore.body.crowd.status).toBe('NOT_STARTED');
      expect(JSON.stringify(dashBefore.body)).not.toMatch(/ticketsIssued|ticketsCheckedIn/);

      // Monitoring mulai mengirim data: orang terdeteksi jauh lebih banyak dari tiket ter-scan.
      const cam = await request(server)
        .post(url(`/admin/events/${event.id}/cameras`))
        .set(bearer(admin))
        .send({ type: 'CROWD', name: 'Crowd', capacity: 1000 });
      expect(cam.status).toBe(201);
      const ing = await request(server)
        .post(url('/crowd/ingest'))
        .set('x-camera-key', cam.body.apiKey)
        .send({ peopleCount: 500 });
      expect(ing.status).toBe(202);

      const dashAfter = await request(server).get(url(`/admin/events/${event.id}/crowd/dashboard`)).set(bearer(admin));
      expect(dashAfter.body.crowd).toMatchObject({ status: 'ACTIVE', current: 500 });
      const after = (await stats(event.id)).body;
      expect(after.issued).toBe(before.issued);
      expect(after.checkedIn).toBe(before.checkedIn);
    });

    it('hanya ADMIN yang boleh membaca; acara tidak ada 404', async () => {
      const { event } = await seedEvent(prisma);
      expect((await stats(event.id, staffA)).status).toBe(403);
      expect((await stats(event.id, customer)).status).toBe(403);
      expect((await stats('00000000-0000-4000-8000-000000000000')).status).toBe(404);
    });
  });
});
