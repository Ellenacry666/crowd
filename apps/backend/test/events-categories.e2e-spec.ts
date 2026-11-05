import { INestApplication } from '@nestjs/common';
import { EventStatus, Role } from '@prisma/client';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  bearer,
  createTestApp,
  createUser,
  login,
  resetDatabase,
  seedEvent,
  url,
} from './helpers';

const DAY = 24 * 60 * 60 * 1000;
const future = (days: number, hours = 0) => new Date(Date.now() + days * DAY + hours * 3600_000).toISOString();

describe('Events & Ticket Categories (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let admin: string;
  let customer: string;
  let server: ReturnType<INestApplication['getHttpServer']>;

  const newEventBody = (over: Record<string, unknown> = {}) => ({
    title: 'Jazz Night Bandung',
    category: 'Music',
    description: 'Malam jazz',
    location: 'Bandung',
    startAt: future(10),
    endAt: future(10, 3),
    ...over,
  });

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    server = app.getHttpServer();
    await resetDatabase(prisma);
    await createUser(prisma, 'admin@ev.local', Role.ADMIN);
    await createUser(prisma, 'customer@ev.local', Role.CUSTOMER);
    admin = await login(app, 'admin@ev.local');
    customer = await login(app, 'customer@ev.local');
  });

  afterAll(async () => {
    await resetDatabase(prisma);
    await app.close();
  });

  describe('CRUD acara (admin)', () => {
    it('admin membuat acara DRAFT dengan slug otomatis', async () => {
      const res = await request(server).post(url('/admin/events')).set(bearer(admin)).send(newEventBody());
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('DRAFT');
      expect(res.body.slug).toBe('jazz-night-bandung');
    });

    it('judul sama menghasilkan slug unik, bukan error', async () => {
      const res = await request(server).post(url('/admin/events')).set(bearer(admin)).send(newEventBody());
      expect(res.status).toBe(201);
      expect(res.body.slug).toMatch(/^jazz-night-bandung-[0-9a-f]{4}$/);
    });

    it('slug eksplisit yang bentrok ditolak 409', async () => {
      const res = await request(server)
        .post(url('/admin/events'))
        .set(bearer(admin))
        .send(newEventBody({ slug: 'jazz-night-bandung' }));
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('SLUG_TAKEN');
    });

    it('menolak endAt <= startAt', async () => {
      const res = await request(server)
        .post(url('/admin/events'))
        .set(bearer(admin))
        .send(newEventBody({ startAt: future(10), endAt: future(9) }));
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_TIME_RANGE');
    });

    it('menolak field tak dikenal dan input tidak valid', async () => {
      const unknown = await request(server)
        .post(url('/admin/events'))
        .set(bearer(admin))
        .send(newEventBody({ isAdmin: true }));
      expect(unknown.status).toBe(400);
      const badDate = await request(server)
        .post(url('/admin/events'))
        .set(bearer(admin))
        .send(newEventBody({ startAt: 'bukan-tanggal' }));
      expect(badDate.status).toBe(400);
      const badUrl = await request(server)
        .post(url('/admin/events'))
        .set(bearer(admin))
        .send(newEventBody({ posterUrl: 'javascript:alert(1)' }));
      expect(badUrl.status).toBe(400);
    });

    it('customer dan tanpa token tidak boleh mengelola acara', async () => {
      expect((await request(server).post(url('/admin/events')).send(newEventBody())).status).toBe(401);
      expect(
        (await request(server).post(url('/admin/events')).set(bearer(customer)).send(newEventBody())).status,
      ).toBe(403);
    });

    it('admin mengubah dan menghapus acara tanpa order', async () => {
      const created = await request(server)
        .post(url('/admin/events'))
        .set(bearer(admin))
        .send(newEventBody({ title: 'Acara Sementara' }));
      const id = created.body.id;

      const patched = await request(server)
        .patch(url(`/admin/events/${id}`))
        .set(bearer(admin))
        .send({ location: 'Jakarta', status: 'PUBLISHED' });
      expect(patched.status).toBe(200);
      expect(patched.body.location).toBe('Jakarta');
      expect(patched.body.status).toBe('PUBLISHED');

      const badRange = await request(server)
        .patch(url(`/admin/events/${id}`))
        .set(bearer(admin))
        .send({ endAt: future(1) });
      expect(badRange.status).toBe(400);

      const del = await request(server).delete(url(`/admin/events/${id}`)).set(bearer(admin));
      expect(del.status).toBe(200);
      expect((await request(server).get(url(`/admin/events/${id}`)).set(bearer(admin))).status).toBe(404);
    });
  });

  describe('Akses publik', () => {
    let published: { id: string; slug: string };

    beforeAll(async () => {
      const { event } = await seedEvent(prisma, {
        title: 'Publik Rock Fest',
        categories: [
          { name: 'Regular', price: 100000, quota: 10 },
          { name: 'VIP', price: 300000, quota: 5 },
        ],
      });
      published = event;
      await seedEvent(prisma, { title: 'Rahasia Draft', status: EventStatus.DRAFT });
    });

    it('daftar publik hanya menampilkan PUBLISHED, tanpa token', async () => {
      const res = await request(server).get(url('/events'));
      expect(res.status).toBe(200);
      const titles = res.body.items.map((e: any) => e.title);
      expect(titles).toContain('Publik Rock Fest');
      expect(titles).not.toContain('Rahasia Draft');
      expect(res.body.meta).toMatchObject({ page: 1, limit: 20 });
    });

    it('pencarian dan filter kategori bekerja', async () => {
      const search = await request(server).get(url('/events?search=rock'));
      expect(search.body.items.map((e: any) => e.title)).toEqual(['Publik Rock Fest']);
      const none = await request(server).get(url('/events?search=tidakadaacara'));
      expect(none.body.items).toHaveLength(0);
      const cat = await request(server).get(url('/events?category=music'));
      expect(cat.body.items.length).toBeGreaterThan(0);
      const other = await request(server).get(url('/events?category=Education'));
      expect(other.body.items).toHaveLength(0);
    });

    it('detail lewat slug maupun id menampilkan kategori, harga, dan ketersediaan', async () => {
      for (const key of [published.slug, published.id]) {
        const res = await request(server).get(url(`/events/${key}`));
        expect(res.status).toBe(200);
        expect(res.body.minPrice).toBe(100000);
        expect(res.body.ticketCategories).toEqual([
          expect.objectContaining({ name: 'Regular', price: 100000, available: 10 }),
          expect.objectContaining({ name: 'VIP', price: 300000, available: 5 }),
        ]);
        // data internal tidak bocor ke publik
        expect(res.body.ticketCategories[0]).not.toHaveProperty('soldCount');
      }
    });

    it('acara DRAFT tidak dapat dibuka publik (404)', async () => {
      const draft = await prisma.event.findFirstOrThrow({ where: { title: 'Rahasia Draft' } });
      expect((await request(server).get(url(`/events/${draft.id}`))).status).toBe(404);
      expect((await request(server).get(url(`/events/${draft.slug}`))).status).toBe(404);
    });

    it('parameter query tidak valid ditolak', async () => {
      expect((await request(server).get(url('/events?page=0'))).status).toBe(400);
      expect((await request(server).get(url('/events?limit=1000'))).status).toBe(400);
    });
  });

  describe('Kategori tiket dan kuota', () => {
    let eventId: string;

    beforeAll(async () => {
      const { event } = await seedEvent(prisma, { title: 'Acara Kategori', categories: [] });
      eventId = event.id;
    });

    it('admin membuat kategori; nama duplikat 409; harga negatif 400', async () => {
      const ok = await request(server)
        .post(url(`/admin/events/${eventId}/ticket-categories`))
        .set(bearer(admin))
        .send({ name: 'Early Bird', price: 75000, quota: 20 });
      expect(ok.status).toBe(201);
      expect(ok.body).toMatchObject({ quota: 20, soldCount: 0, reservedCount: 0, available: 20 });

      const dup = await request(server)
        .post(url(`/admin/events/${eventId}/ticket-categories`))
        .set(bearer(admin))
        .send({ name: 'Early Bird', price: 80000, quota: 10 });
      expect(dup.status).toBe(409);
      expect(dup.body.code).toBe('CATEGORY_NAME_TAKEN');

      const neg = await request(server)
        .post(url(`/admin/events/${eventId}/ticket-categories`))
        .set(bearer(admin))
        .send({ name: 'Minus', price: -1, quota: 10 });
      expect(neg.status).toBe(400);

      const noEvent = await request(server)
        .post(url('/admin/events/00000000-0000-4000-8000-000000000000/ticket-categories'))
        .set(bearer(admin))
        .send({ name: 'X', price: 1, quota: 1 });
      expect(noEvent.status).toBe(404);
    });

    it('kuota tidak boleh lebih kecil dari terjual + dicadangkan', async () => {
      const cat = await prisma.ticketCategory.findFirstOrThrow({ where: { eventId, name: 'Early Bird' } });
      await prisma.ticketCategory.update({
        where: { id: cat.id },
        data: { soldCount: 6, reservedCount: 4 },
      });

      const tooLow = await request(server)
        .patch(url(`/admin/ticket-categories/${cat.id}`))
        .set(bearer(admin))
        .send({ quota: 9 });
      expect(tooLow.status).toBe(409);
      expect(tooLow.body.code).toBe('QUOTA_BELOW_SOLD');

      const exact = await request(server)
        .patch(url(`/admin/ticket-categories/${cat.id}`))
        .set(bearer(admin))
        .send({ quota: 10, price: 90000 });
      expect(exact.status).toBe(200);
      expect(exact.body).toMatchObject({ quota: 10, price: 90000, available: 0 });
    });

    it('customer tidak boleh mengubah kategori; kategori yang dipakai order tidak dapat dihapus', async () => {
      const cat = await prisma.ticketCategory.findFirstOrThrow({ where: { eventId, name: 'Early Bird' } });
      expect(
        (
          await request(server)
            .patch(url(`/admin/ticket-categories/${cat.id}`))
            .set(bearer(customer))
            .send({ price: 1 })
        ).status,
      ).toBe(403);

      const user = await prisma.user.findFirstOrThrow({ where: { email: 'customer@ev.local' } });
      await prisma.order.create({
        data: {
          userId: user.id,
          orderNumber: 'CP-TEST-CATEGORY',
          totalAmount: 90000,
          expiresAt: new Date(Date.now() + DAY),
          items: { create: [{ ticketCategoryId: cat.id, quantity: 1, unitPrice: 90000, subtotal: 90000 }] },
        },
      });
      const del = await request(server).delete(url(`/admin/ticket-categories/${cat.id}`)).set(bearer(admin));
      expect(del.status).toBe(409);
      expect(del.body.code).toBe('CATEGORY_HAS_ORDERS');

      const delEvent = await request(server).delete(url(`/admin/events/${eventId}`)).set(bearer(admin));
      expect(delEvent.status).toBe(409);
      expect(delEvent.body.code).toBe('EVENT_HAS_ORDERS');
    });

    it('kategori tanpa order dapat dihapus', async () => {
      const created = await request(server)
        .post(url(`/admin/events/${eventId}/ticket-categories`))
        .set(bearer(admin))
        .send({ name: 'Sementara', price: 1000, quota: 5 });
      const del = await request(server)
        .delete(url(`/admin/ticket-categories/${created.body.id}`))
        .set(bearer(admin));
      expect(del.status).toBe(200);
    });
  });
});
